/**
 * THE MATCH, ON SCREEN.
 *
 * A thin control plane over the pure `ChallengeRunner`: it owns the clock, the
 * speed, the pause, and the bridge that keeps the player's own city in sync
 * with the live sandbox so every Phase 1-5 tool (build toolbar, demolish,
 * natural language, the AI advisor) keeps working inside a match.
 *
 * All the actual simulation lives in the runner, which is pure — so what the
 * player watches and what `npm run verify:challenge` prints are the same match.
 */
import { create } from 'zustand'
import {
  createMatch,
  scorerFor,
  step,
  verdictOf,
  runToEnd,
  type ChallengeState,
  type LogEntry,
  type PendingDecision,
  type Side,
} from '../challenge/ChallengeRunner'
import { build as buildSnapshot, demolish as demolishSnapshot, type CitySnapshot } from '../challenge/CityRuntime'
import {
  DEFAULT_SETUP,
  CHALLENGE_OBJECTIVES,
  type ChallengeSetup,
  type AIPersonalityId,
} from '../challenge/ChallengeConfig'
import { AI_PERSONALITIES } from '../ai/AIPersonality'
import { analyseCity } from '../ai/cityAnalyst'
import { useCityStore } from './useCityStore'
import { useOptimizerStore } from './useOptimizerStore'
import { useSandboxStore } from './useSandboxStore'
import type { CityDelta } from '../city/infrastructure'

/** Where the player is in the challenge flow. */
export type ChallengePhase =
  | 'closed'
  | 'setup'
  | 'running'
  | 'paused'
  | 'decision'
  | 'finished'
  | 'tournament'

export interface TournamentRow {
  personality: AIPersonalityId
  score: number
  population: number
  traffic: number
  co2: number
  treasury: number
  builds: number
  state: ChallengeState
}

export interface ChallengeStore {
  phase: ChallengePhase
  setup: ChallengeSetup
  match: ChallengeState | null
  /** wall-clock ms per simulated month */
  msPerTick: number
  /** true when nobody is playing the human side */
  watchOnly: boolean
  /** the AI city rotates on its own unless the player is inspecting it */
  autoRotate: boolean
  tournament: TournamentRow[] | null
  tournamentRunning: boolean
  /** which side's log the activity panel is showing */
  logFilter: Side | 'all'

  open: () => void
  close: () => void
  updateSetup: (patch: Partial<ChallengeSetup>) => void
  start: (watchOnly?: boolean) => void
  play: () => void
  pause: () => void
  setSpeed: (ms: number) => void
  skipYear: () => void
  resolveDecision: () => void
  setLogFilter: (f: Side | 'all') => void
  setAutoRotate: (v: boolean) => void

  /** the player built something in their city */
  applyHumanBuild: (delta: CityDelta, capex: number) => void
  applyHumanDemolish: (buildingId: string, cost: number) => void

  replay: () => void
  rematch: (personality: AIPersonalityId) => void
  runTournament: () => void
  abandon: () => void
}

let timer: number | null = null

/** Push the player's match city into the live store so the 3D view and every
 *  Phase 1-5 panel reads it as "the city". */
function syncHumanToLive(snap: CitySnapshot) {
  const cs = useCityStore.getState()
  useCityStore.setState({
    city: snap.city,
    config: snap.config,
    baseConfig: snap.baseConfig,
    current: snap.result,
    previous: cs.current,
    runProgress: 1,
    hasRun: true,
    analysis: analyseCity({
      city: snap.city,
      config: snap.config,
      current: snap.result,
      baseline: cs.baseline,
    }),
  })
  // the sandbox treasury is the match treasury while a match is running
  useSandboxStore.setState({ treasury: snap.treasury, spentTotal: snap.spentTotal })
  useSandboxStore.getState().refresh()
}

export const useChallengeStore = create<ChallengeStore>((set, get) => ({
  phase: 'closed',
  setup: DEFAULT_SETUP,
  match: null,
  msPerTick: 900,
  watchOnly: false,
  autoRotate: true,
  tournament: null,
  tournamentRunning: false,
  logFilter: 'all',

  open: () => set({ phase: 'setup' }),

  close: () => {
    get().pause()
    set({ phase: 'closed' })
  },

  updateSetup: (patch) => set((s) => ({ setup: { ...s.setup, ...patch } })),

  /* ---------------------------------------------------------------- */

  start: (watchOnly = false) => {
    get().pause()
    const setup = { ...get().setup, watchOnly }
    const match = createMatch(setup)

    // the optimizer's cinematic machinery must not fight the match clock
    useOptimizerStore.getState().resetOptimizer()
    useSandboxStore.getState().stopClock()
    useSandboxStore.setState({ mode: watchOnly ? 'human' : 'assist', activeItemId: null, ghost: null })

    // give the live store the shared starting city
    useCityStore.setState({
      baseCity: match.baseline.city,
      baseline: match.baseline.result,
      heatLayer: 'none',
      selectedBuilding: null,
      hoveredBuilding: null,
      userBuildings: [],
      scenarioBuildings: [],
      scenario: 'current',
    })
    syncHumanToLive(match.human)

    useCityStore.getState().pushEvent(
      `City Challenge — ${setup.years} years · ${CHALLENGE_OBJECTIVES[setup.objective].label} · vs ${
        AI_PERSONALITIES[setup.personality].label
      } AI`,
      'ai',
    )

    set({ match, setup, watchOnly, phase: 'running', tournament: null })
    get().play()
  },

  play: () => {
    if (timer !== null) return
    const m = get().match
    if (!m || m.finished) return
    set({ phase: 'running' })

    const loop = () => {
      timer = window.setTimeout(() => {
        timer = null
        const s = get()
        if (s.phase !== 'running' || !s.match) return

        const { state, finished } = step(s.match)
        syncHumanToLive(state.human)

        if (state.pending && !s.watchOnly) {
          // a major AI decision briefly stops the clock so the player sees it
          set({ match: state, phase: 'decision' })
          return
        }
        set({ match: { ...state, pending: null } })

        if (finished) {
          set({ phase: 'finished' })
          useCityStore.getState().pushEvent('Challenge complete', 'ok')
          return
        }
        loop()
      }, get().msPerTick)
    }
    loop()
  },

  pause: () => {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
    const phase = get().phase
    // Pausing during a decision moment has to dismiss it too, or the modal's
    // auto-continue fires a few seconds later and restarts the match behind
    // the player's back.
    if (phase === 'decision') {
      const m = get().match
      set({ phase: 'paused', match: m ? { ...m, pending: null } : m })
      return
    }
    if (phase === 'running') set({ phase: 'paused' })
  },

  setSpeed: (ms) => {
    set({ msPerTick: Math.max(60, ms) })
  },

  /** Run out the rest of the current simulated year at once. */
  skipYear: () => {
    const s = get()
    if (!s.match || s.match.finished) return
    get().pause()
    let state = s.match
    const target = (Math.floor(state.human.tick / 12) + 1) * 12
    let guard = 0
    while (!state.finished && state.human.tick < target && guard++ < 24) {
      state = step(state).state
      state = { ...state, pending: null }
    }
    syncHumanToLive(state.human)
    set({ match: state, phase: state.finished ? 'finished' : 'paused' })
  },

  resolveDecision: () => {
    const s = get()
    if (!s.match) return
    set({ match: { ...s.match, pending: null }, phase: 'running' })
    get().play()
  },

  setLogFilter: (f) => set({ logFilter: f }),
  setAutoRotate: (v) => set({ autoRotate: v }),

  /* ---------------------------------------------------------------- */
  /* the player's own city                                             */
  /* ---------------------------------------------------------------- */

  applyHumanBuild: (delta, capex) => {
    const s = get()
    if (!s.match) return
    const human = buildSnapshot(s.match.human, delta, capex)
    const score = scorerFor(s.match)
    set({
      match: {
        ...s.match,
        human,
        scores: { ...s.match.scores, human: score(human) },
        log: [
          ...s.match.log,
          {
            id: Date.now(),
            side: 'human' as const,
            tick: human.tick,
            year: Math.floor(human.tick / 12) + 1,
            month: (human.tick % 12) + 1,
            kind: 'build' as const,
            text: `You built ${delta.buildings[0]?.label.toLowerCase() ?? 'infrastructure'}`,
            at: delta.buildings[0] ? { x: delta.buildings[0].x, z: delta.buildings[0].z } : null,
          } satisfies LogEntry,
        ].slice(-400),
      },
    })
    syncHumanToLive(human)
  },

  applyHumanDemolish: (buildingId, cost) => {
    const s = get()
    if (!s.match) return
    const human = demolishSnapshot(s.match.human, buildingId, cost)
    const score = scorerFor(s.match)
    set({ match: { ...s.match, human, scores: { ...s.match.scores, human: score(human) } } })
    syncHumanToLive(human)
  },

  /* ---------------------------------------------------------------- */
  /* replay, rematch, tournament                                       */
  /* ---------------------------------------------------------------- */

  replay: () => get().start(get().watchOnly),

  rematch: (personality) => {
    set((s) => ({ setup: { ...s.setup, personality } }))
    get().start(get().watchOnly)
  },

  runTournament: () => {
    get().pause()
    set({ phase: 'tournament', tournamentRunning: true, tournament: null })

    // run off the main thread's critical path so the UI can paint the spinner
    window.setTimeout(() => {
      const setup = get().setup
      const rows: TournamentRow[] = (
        Object.keys(AI_PERSONALITIES) as AIPersonalityId[]
      ).map((id) => {
        const state = runToEnd({ ...setup, personality: id, watchOnly: true })
        return {
          personality: id,
          score: state.scores.ai.total,
          population: state.ai.result.population,
          traffic: state.ai.result.metrics.traffic.utilisation,
          co2: state.ai.result.raw.co2PerCapitaKgYear,
          treasury: state.ai.treasury,
          builds: state.log.filter((l) => l.side === 'ai' && l.kind === 'build').length,
          state,
        }
      })
      rows.sort((a, b) => b.score - a.score)
      set({ tournament: rows, tournamentRunning: false })
    }, 60)
  },

  abandon: () => {
    get().pause()
    set({ phase: 'closed', match: null, tournament: null })
    useSandboxStore.getState().resetSandbox()
  },
}))

/** Is a match in progress? Used by the sandbox to route builds correctly. */
export const matchIsLive = () => {
  const p = useChallengeStore.getState().phase
  return p === 'running' || p === 'paused' || p === 'decision'
}

export { verdictOf }
export type { PendingDecision, LogEntry }
