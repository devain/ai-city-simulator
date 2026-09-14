/**
 * THE DEMO DRIVER.
 *
 * A state machine over `DEMO_TIMELINE`, advanced by one requestAnimationFrame
 * loop. It reads which stage the elapsed clock is in, fires that stage's
 * `enter` exactly once, and mirrors the stage's UI and simulation speed into
 * the rest of the app.
 *
 * One loop and one clock — not a chain of setTimeouts — which is what makes it
 * pausable, scrubbable and deterministic enough to record twice and get the
 * same film.
 */
import { create } from 'zustand'
import {
  DEMO_TIMELINE,
  DEMO_TOTAL_SECONDS,
  STAGE_STARTS,
  resolve,
  stageAt,
  type DemoStage,
  type DemoUi,
  type StageSpec,
} from '../demo/DemoTimeline'
import { lockAll, resetChannels } from '../demo/cameraBus'
import { useChallengeStore } from './useChallengeStore'
import { useCityStore } from './useCityStore'
import { useOptimizerStore } from './useOptimizerStore'
import { useSandboxStore } from './useSandboxStore'
import { DEFAULT_SETUP } from '../challenge/ChallengeConfig'
import { CATALOGUE_BY_ID } from '../sandbox/catalogue'
import { sandboxPlan } from '../sandbox/sandboxPlan'
import { bestFreeSlot } from '../sandbox/siting'
import { clock, setHour } from '../lib/clock'

/** The seed every recording starts from, so two takes match. */
export const DEMO_SEED = 20250114

/**
 * The human side's moves, by stage.
 *
 * Reasonable but *reactive*: housing while demand is loud, services once the
 * problems are already visible. That is how most people play, and it is the
 * habit the AI's foresight is meant to beat. None of it is sabotage — every
 * one is a sensible building in a sensible place — and the human still wins
 * some objectives.
 */
const HUMAN_SCRIPT: Partial<Record<DemoStage, string[]>> = {
  HUMAN_ACTION: ['residential_tower', 'residential_tower'],
  AI_ANALYSIS: ['shopping_centre'],
  AI_CONSTRUCTION: ['residential_tower'],
  SIMULATION_FAST_FORWARD: ['school', 'transit_hub', 'solar_farm'],
}

interface DemoState {
  active: boolean
  paused: boolean
  /** ms since the demo began */
  elapsed: number
  stageIndex: number
  stage: DemoStage
  /** 0..1 through the current stage */
  progress: number
  ui: DemoUi
  /** the narration currently on screen */
  title: string
  lines: string[]
  act: string

  start: () => void
  stop: () => void
  togglePause: () => void
  /** jump to a stage — used by the scrubber and by SKIP */
  seek: (stageIndex: number) => void
  skipToEnd: () => void
}

let raf = 0
let lastFrame = 0
let firedStage = -1
/** human script moves already played, so each fires once */
const played = new Set<string>()

const emptyUi: DemoUi = {}

export const useDemoStore = create<DemoState>((set, get) => ({
  active: false,
  paused: false,
  elapsed: 0,
  stageIndex: 0,
  stage: 'INTRO',
  progress: 0,
  ui: emptyUi,
  title: '',
  lines: [],
  act: '',

  /* ---------------------------------------------------------------- */

  start: () => {
    get().stop()

    /* ---- a clean, deterministic slate ---- */
    resetChannels()
    lockAll(true)
    played.clear()
    firedStage = -1

    const ch = useChallengeStore.getState()
    ch.updateSetup({
      ...DEFAULT_SETUP,
      seed: DEMO_SEED,
      seedLabel: 'Meridian',
      budget: 100_000_000,
      population: 20_000,
      years: 10,
      objective: 'balanced',
      personality: 'balanced',
    })
    // start the match, then immediately take the clock off it — the demo owns
    // pacing from here, stage by stage
    ch.start(false)
    ch.pause()

    useOptimizerStore.getState().resetOptimizer()
    useSandboxStore.setState({ activeItemId: null, ghost: null, impact: null, demolishMode: false })
    useCityStore.setState({ heatLayer: 'none', selectedBuilding: null, hoveredBuilding: null })

    /*
     * Pin the time of day. The city clock normally runs, so without this the
     * demo's lighting depends on when the button was pressed — two takes would
     * not match, and the winner card could land in the middle of the night.
     * Late afternoon: long shadows, windows starting to light, and it barely
     * moves across 88 seconds at this speed.
     */
    setHour(16.4)
    clock.speed = 0.05

    set({
      active: true,
      paused: false,
      elapsed: 0,
      stageIndex: 0,
      stage: DEMO_TIMELINE[0].id,
      progress: 0,
      ui: DEMO_TIMELINE[0].ui,
      title: '',
      lines: [],
      act: DEMO_TIMELINE[0].act,
    })

    lastFrame = performance.now()
    raf = requestAnimationFrame(tick)
  },

  stop: () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    lockAll(false)
    resetChannels()
    // Leaving the demo hands the application back as it was found — the match
    // the demo created goes with it, rather than stranding the player in a
    // half-finished challenge they never started.
    useChallengeStore.getState().abandon()
    set({ active: false, paused: false, ui: emptyUi, title: '', lines: [], act: '' })
  },

  togglePause: () => {
    const p = !get().paused
    set({ paused: p })
    if (p) useChallengeStore.getState().pause()
    else lastFrame = performance.now()
  },

  seek: (stageIndex) => {
    const i = Math.max(0, Math.min(DEMO_TIMELINE.length - 1, stageIndex))
    firedStage = -1
    set({ elapsed: STAGE_STARTS[i] + 1 })
    lastFrame = performance.now()
  },

  skipToEnd: () => {
    // run the match out, then park on the winner card
    const ch = useChallengeStore.getState()
    ch.pause()
    let guard = 0
    while (guard++ < 40 && !useChallengeStore.getState().match?.finished) {
      useChallengeStore.getState().skipYear()
    }
    get().seek(DEMO_TIMELINE.findIndex((s) => s.id === 'WINNER_REVEAL'))
  },
}))

/* ------------------------------------------------------------------ */
/* the loop                                                            */
/* ------------------------------------------------------------------ */

function tick() {
  raf = requestAnimationFrame(tick)
  const store = useDemoStore.getState()
  if (!store.active) return

  const now = performance.now()
  const dt = Math.min(120, now - lastFrame)
  lastFrame = now
  if (store.paused) return

  const elapsed = Math.min(store.elapsed + dt, DEMO_TOTAL_SECONDS * 1000)
  const { index, spec, progress } = stageAt(elapsed)
  const match = useChallengeStore.getState().match
  const ctx = { match, progress }

  /* ---- stage entry, exactly once ---- */
  if (index !== firedStage) {
    firedStage = index
    applyStage(spec, ctx)
  }

  /* ---- the human side plays its scripted move ---- */
  playHumanScript(spec, progress)

  /* ---- narration: reveal lines across the stage ---- */
  const rawLines = (spec.lines ?? []).map((l) => resolve(l, ctx)).filter(Boolean)
  const shown = rawLines.slice(0, Math.max(1, Math.ceil(progress * rawLines.length * 1.15)))

  useDemoStore.setState({
    elapsed,
    stageIndex: index,
    stage: spec.id,
    progress,
    ui: spec.ui,
    act: spec.act,
    title: spec.title ? resolve(spec.title, ctx) : '',
    lines: shown,
  })

  /* ---- the demo ends by holding the last frame ---- */
  if (elapsed >= DEMO_TOTAL_SECONDS * 1000) {
    useChallengeStore.getState().pause()
  }
}

/** Put the world into the shape this stage asks for. */
function applyStage(spec: StageSpec, ctx: { match: ReturnType<typeof useChallengeStore.getState>['match']; progress: number }) {
  const ch = useChallengeStore.getState()

  if (spec.speed > 0) {
    ch.setSpeed(spec.speed)
    if (!ch.match?.finished) ch.play()
  } else {
    ch.pause()
  }

  spec.enter?.(ctx)
}

/**
 * Fire the human moves for a stage, once each, spread across it so they do not
 * all land on the same frame.
 */
function playHumanScript(spec: StageSpec, progress: number) {
  const moves = HUMAN_SCRIPT[spec.id]
  if (!moves) return

  for (let i = 0; i < moves.length; i++) {
    const key = `${spec.id}:${i}`
    if (played.has(key)) continue
    // space them evenly through the stage, starting a beat in
    const due = 0.18 + (i / Math.max(1, moves.length)) * 0.7
    if (progress < due) continue
    played.add(key)
    humanBuild(moves[i])
  }
}

/** Place a building in the player's match city, exactly as a click would. */
function humanBuild(itemId: string) {
  const store = useChallengeStore.getState()
  const match = store.match
  if (!match) return
  const item = CATALOGUE_BY_ID[itemId]
  if (!item || item.capex > match.human.treasury) return

  const snap = match.human
  const slot = bestFreeSlot(snap.city, snap.result, item.relieves)
  if (!slot) return
  const plan = sandboxPlan(snap.city, snap.config, snap.result, item, slot, 'you')
  if (!plan) return

  store.applyHumanBuild(plan.delta, item.capex)
}

export { DEMO_TIMELINE, DEMO_TOTAL_SECONDS }
