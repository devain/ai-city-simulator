/**
 * THE SANDBOX — Phase 5's control plane.
 *
 * Owns the things that make the city a place rather than a demonstration: who
 * is in control, the treasury, the simulated calendar, the build and demolish
 * interactions, the city's history, and the autonomous agent's heartbeat.
 *
 * It owns no rendering and no simulation of its own. Every number here is
 * derived from `useCityStore`'s live result, and every construction goes
 * through the Phase 3 execution system in `useOptimizerStore`.
 */
import { create } from 'zustand'
import { runSimulation } from '../simulation/citySimulation'
import { generateCity } from '../city/generateCity'
import { analyseCity } from '../ai/cityAnalyst'
import { slotKey } from '../city/placement'
import { useCityStore } from './useCityStore'
import { useOptimizerStore } from './useOptimizerStore'
import { validatePlan } from '../ai/planValidation'
import { registerSandboxView, type SandboxView } from '../ai/CityAIProvider'
import { registerTreasuryDebit } from '../sandbox/treasury'
import { matchIsLive, useChallengeStore } from './useChallengeStore'
import { cityFinance, type CityFinance } from '../sandbox/finance'
import { cityHealth, type CityHealth } from '../sandbox/health'
import { cityDemand, type DemandBar } from '../sandbox/demand'
import { populationPressure, stepOccupancy, type PopulationPressure } from '../sandbox/population'
import { cityPriorities, type CityPriority } from '../ai/CityPriorities'
import { adviseCity, adviceItem, type Advice } from '../ai/CityAdvisor'
import { predictImpact, type BuildImpact } from '../ai/predictImpact'
import {
  AGENT_OBJECTIVES,
  decide,
  logLineFor,
  spendableBy,
  type AgentDecision,
  type AgentObjectiveId,
} from '../ai/AutonomousCityAgent'
import {
  CATALOGUE_BY_ID,
  LINEAR_BY_ID,
  isLinear,
  type CatalogueItem,
  type LinearItem,
} from '../sandbox/catalogue'
import { sandboxPlan } from '../sandbox/sandboxPlan'
import { bestFreeSlot, nearestFreeSlot, districtLabel, type Slot } from '../sandbox/siting'
import { MODES, MODE_TRANSITION, type SandboxMode } from '../sandbox/modes'
import {
  configWithEvents,
  eventDueAt,
  EVENT_BY_ID,
  type ActiveEvent,
} from '../sandbox/events'
import {
  POPULATION_MILESTONES,
  tickToDate,
  formatTick,
  type HistoryEntry,
  type HistoryKind,
} from '../sandbox/history'
import {
  listSlots,
  loadCity,
  saveCity,
  storageAvailable,
  type SavedCity,
  type SlotId,
} from '../sandbox/persistence'
import type { Building, City, DistrictId } from '../simulation/types'

export const STARTING_TREASURY = 100_000_000
/** capital the autonomous agent must always leave in the bank */
export const EMERGENCY_RESERVE = 5_000_000

export interface AiLogEntry {
  id: number
  tick: number
  at: string
  text: string
  kind: 'analyze' | 'decide' | 'build' | 'observe' | 'warn' | 'mode'
}

export interface GhostState {
  x: number
  z: number
  district: DistrictId
  valid: boolean
  /** why it is invalid, when it is */
  problem: string | null
}

export interface DemolishTarget {
  building: Building
  refund: number
  opexSaved: number
  impact: string[]
}

export interface ChallengeState {
  active: boolean
  /** who is playing this run */
  side: 'human' | 'ai'
  startTick: number
  endTick: number
  objective: AgentObjectiveId
  /** results, once a side finishes */
  results: Partial<Record<'human' | 'ai', ChallengeResult>>
}

export interface ChallengeResult {
  population: number
  health: number
  treasury: number
  traffic: number
  co2PerCapita: number
  economy: number
  netIncome: number
}

interface SandboxState {
  /* ---- who is in control ---- */
  mode: SandboxMode
  /* ---- money ---- */
  treasury: number
  spentTotal: number
  reserve: number
  /* ---- the calendar ---- */
  tick: number
  clockRunning: boolean
  /** wall-clock ms per simulated month */
  msPerTick: number
  occupancy: number
  /* ---- weather ---- */
  activeEvents: ActiveEvent[]
  firedEventIds: string[]
  /* ---- derived, recomputed whenever the city changes ---- */
  finance: CityFinance
  health: CityHealth
  demand: DemandBar[]
  priorities: CityPriority[]
  pressure: PopulationPressure
  /* ---- the record ---- */
  history: HistoryEntry[]
  aiLog: AiLogEntry[]
  /* ---- placement ---- */
  activeItemId: string | null
  ghost: GhostState | null
  impact: BuildImpact | null
  /* ---- demolition ---- */
  demolishMode: boolean
  demolishTarget: DemolishTarget | null
  /* ---- the advisor ---- */
  advice: Advice | null
  dismissedAdvice: string[]
  /* ---- the agent ---- */
  agentObjective: AgentObjectiveId
  agentPaused: boolean
  agentStatus: string
  lastDecision: AgentDecision | null
  agentBusy: boolean
  agentBuilt: Record<string, DistrictId[]>
  /* ---- persistence ---- */
  slots: ReturnType<typeof listSlots>
  saveNotice: string | null
  /* ---- challenge ---- */
  challenge: ChallengeState | null

  /* ---- actions ---- */
  setMode: (m: SandboxMode) => void
  refresh: () => void
  startClock: () => void
  stopClock: () => void
  toggleClock: () => void
  setSpeed: (ms: number) => void
  advanceMonth: () => void

  selectItem: (id: string | null) => void
  moveGhost: (x: number, z: number) => void
  confirmBuild: () => void
  cancelBuild: () => void
  /** place a specific item without the ghost — used by the advisor and the NL layer */
  buildItem: (id: string, opts?: { district?: DistrictId; cinematic?: boolean; byAi?: boolean }) => boolean

  setDemolishMode: (v: boolean) => void
  pickDemolish: (buildingId: string) => void
  confirmDemolish: () => void
  cancelDemolish: () => void

  acceptAdvice: () => void
  dismissAdvice: () => void

  setAgentObjective: (id: AgentObjectiveId) => void
  pauseAgent: () => void
  resumeAgent: () => void
  runAgentStep: () => void

  pushHistory: (kind: HistoryKind, title: string, detail: string, major?: boolean) => void
  pushAiLog: (text: string, kind: AiLogEntry['kind']) => void

  saveTo: (slot: SlotId) => void
  loadFrom: (slot: SlotId) => void
  newCity: () => void
  resetSandbox: () => void
  refreshSlots: () => void

  startChallenge: (side: 'human' | 'ai', objective: AgentObjectiveId, years?: number) => void
  endChallenge: () => void
  clearChallenge: () => void
}

/* ------------------------------------------------------------------ */
/* module-level plumbing                                               */
/* ------------------------------------------------------------------ */

let historyId = 0
let aiLogId = 0
let tickTimer: number | null = null

const stamp = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Everything derived from the live city, in one pass. */
function derive(city: City, current: ReturnType<typeof runSimulation>, treasury: number, dismissed: string[], config: ReturnType<typeof cfgOf>) {
  const finance = cityFinance(city, current)
  const health = cityHealth(current, finance)
  const demand = cityDemand(city, current)
  const priorities = cityPriorities(city, current, finance, health)
  const pressure = populationPressure(current, config.occupancyRate, current.raw.livabilityIndex)
  const advice = adviseCity({
    city,
    config,
    current,
    priorities,
    treasury,
    dismissed,
  })
  return { finance, health, demand, priorities, pressure, advice }
}

const cfgOf = () => useCityStore.getState().config

/* seed state ------------------------------------------------------- */

const seedCity = useCityStore.getState().city
const seedResult = useCityStore.getState().current
const seedFinance = cityFinance(seedCity, seedResult)
const seedHealth = cityHealth(seedResult, seedFinance)

export const useSandboxStore = create<SandboxState>((set, get) => ({
  mode: 'human',

  treasury: STARTING_TREASURY,
  spentTotal: 0,
  reserve: EMERGENCY_RESERVE,

  tick: 0,
  clockRunning: false,
  msPerTick: 2400,
  occupancy: useCityStore.getState().config.occupancyRate,

  activeEvents: [],
  firedEventIds: [],

  finance: seedFinance,
  health: seedHealth,
  demand: cityDemand(seedCity, seedResult),
  priorities: cityPriorities(seedCity, seedResult, seedFinance, seedHealth),
  pressure: populationPressure(
    seedResult,
    useCityStore.getState().config.occupancyRate,
    seedResult.raw.livabilityIndex,
  ),

  history: [
    {
      id: historyId++,
      tick: 0,
      year: 1,
      month: 1,
      kind: 'founded',
      title: 'City founded',
      detail: `${seedResult.population.toLocaleString('en-US')} residents · $${(
        STARTING_TREASURY / 1e6
      ).toFixed(0)}M treasury`,
      snapshot: {
        population: seedResult.population,
        health: seedHealth.score,
        treasury: STARTING_TREASURY,
        traffic: seedResult.metrics.traffic.utilisation,
      },
      major: true,
    },
  ],
  aiLog: [],

  activeItemId: null,
  ghost: null,
  impact: null,

  demolishMode: false,
  demolishTarget: null,

  advice: null,
  dismissedAdvice: [],

  agentObjective: 'grow',
  agentPaused: false,
  agentStatus: 'Standing by',
  lastDecision: null,
  agentBusy: false,
  agentBuilt: {},

  slots: listSlots(),
  saveNotice: null,

  challenge: null,

  /* ---------------------------------------------------------------- */
  /* derived state                                                     */
  /* ---------------------------------------------------------------- */

  refresh: () => {
    const cs = useCityStore.getState()
    const { treasury, dismissedAdvice, mode } = get()
    const d = derive(cs.city, cs.current, treasury, dismissedAdvice, cs.config)
    // The advice is always computed — asking "what should I build?" is an
    // invitation, so the answer must exist in every mode. Whether it is
    // *volunteered* is the panel's business, not the store's.
    void mode
    set({
      finance: d.finance,
      health: d.health,
      demand: d.demand,
      priorities: d.priorities,
      pressure: d.pressure,
      advice: d.advice,
    })
  },

  /* ---------------------------------------------------------------- */
  /* modes                                                             */
  /* ---------------------------------------------------------------- */

  setMode: (m) => {
    const prev = get().mode
    if (prev === m) return
    const cs = useCityStore.getState()

    set({ mode: m, activeItemId: null, ghost: null, impact: null, demolishMode: false, demolishTarget: null })
    cs.pushEvent(MODE_TRANSITION[m], m === 'autonomous' ? 'ai' : 'info')
    get().pushHistory('mode', MODES[m].label + ' mode', MODE_TRANSITION[m], false)

    if (m === 'autonomous') {
      set({ agentPaused: false, agentStatus: 'Analyzing the city…' })
      get().pushAiLog('Took control of the city', 'mode')
      get().pushAiLog(
        `Objective: ${AGENT_OBJECTIVES[get().agentObjective].phrase}`,
        'analyze',
      )
      if (!get().clockRunning) get().startClock()
      // act immediately rather than making the player wait for the next month
      window.setTimeout(() => get().runAgentStep(), 700)
    } else if (prev === 'autonomous') {
      set({ agentStatus: 'Paused — you have control' })
      get().pushAiLog('Control handed back to the operator', 'mode')
    }

    if (m === 'assist') {
      set({ dismissedAdvice: [] })
      get().pushAiLog('Now advising — I will not build without your approval', 'mode')
    }

    get().refresh()
  },

  /* ---------------------------------------------------------------- */
  /* the living city clock                                             */
  /* ---------------------------------------------------------------- */

  startClock: () => {
    if (tickTimer !== null) return
    set({ clockRunning: true })
    const loop = () => {
      tickTimer = window.setTimeout(() => {
        tickTimer = null
        if (!get().clockRunning) return
        get().advanceMonth()
        if (get().clockRunning) loop()
      }, get().msPerTick)
    }
    loop()
  },

  stopClock: () => {
    set({ clockRunning: false })
    if (tickTimer !== null) {
      window.clearTimeout(tickTimer)
      tickTimer = null
    }
  },

  toggleClock: () => (get().clockRunning ? get().stopClock() : get().startClock()),

  setSpeed: (ms) => set({ msPerTick: Math.max(350, ms) }),

  /** One simulated month. The heartbeat of the whole sandbox. */
  advanceMonth: () => {
    const cs = useCityStore.getState()
    const s = get()
    const tick = s.tick + 1
    const { year, month } = tickToDate(tick)

    /* ---- 1. weather: events start and lift on their own ---- */
    let activeEvents = s.activeEvents.filter((e) => e.endsTick > tick)
    const lifted = s.activeEvents.filter((e) => e.endsTick <= tick)
    for (const e of lifted) {
      cs.pushEvent(`${e.spec.name} has passed`, 'ok')
      get().pushHistory('event', `${e.spec.name} ended`, 'Conditions back to normal', false)
    }

    const due = eventDueAt(cs.config.seed, tick)
    if (due && !activeEvents.some((e) => e.spec.id === due.id)) {
      activeEvents = [...activeEvents, { spec: due, startedTick: tick, endsTick: tick + due.months }]
      cs.pushEvent(`${due.name.toUpperCase()} — ${due.blurb}`, due.severity === 'CRITICAL' ? 'alert' : 'warn')
      get().pushHistory('event', due.name, due.blurb, true)
      if (MODES[s.mode].aiMayAdvise) {
        get().pushAiLog(`${due.name} detected — ${due.response} is the response`, 'warn')
      }
    }

    /* ---- 2. the config the city actually runs under this month ---- */
    const config = configWithEvents(cs.baseConfig, activeEvents)

    /* ---- 3. population responds to how good a place this is ---- */
    const pressure = populationPressure(cs.current, s.occupancy, cs.current.raw.livabilityIndex)
    const occupancy = stepOccupancy(s.occupancy, pressure)
    const liveConfig = { ...config, occupancyRate: occupancy }

    const result = runSimulation(cs.city, liveConfig)

    useCityStore.setState({
      config: liveConfig,
      previous: cs.current,
      current: result,
      runProgress: 1,
      analysis: analyseCity({
        city: cs.city,
        config: liveConfig,
        current: result,
        baseline: cs.baseline,
      }),
    })

    /* ---- 4. the books ---- */
    const finance = cityFinance(cs.city, result)
    const treasury = Math.max(0, s.treasury + finance.netIncome / 12)

    set({ tick, activeEvents, occupancy, treasury })

    /* ---- 5. milestones worth remembering ---- */
    const crossed = POPULATION_MILESTONES.find(
      (m) => cs.current.population < m && result.population >= m,
    )
    if (crossed) {
      get().pushHistory(
        'milestone',
        `Population reached ${crossed.toLocaleString('en-US')}`,
        `Year ${year} · occupancy ${(occupancy * 100).toFixed(0)}%`,
        true,
      )
    }
    if (month === 1 && year > 1) {
      get().pushHistory(
        'finance',
        `Year ${year} begins`,
        `${result.population.toLocaleString('en-US')} residents · $${(treasury / 1e6).toFixed(
          1,
        )}M treasury · net ${finance.netIncome >= 0 ? '+' : '−'}$${(
          Math.abs(finance.netIncome) / 1e6
        ).toFixed(1)}M/yr`,
        false,
      )
    }

    get().refresh()

    /* ---- 6. the agent gets its turn ---- */
    const st = get()
    if (st.mode === 'autonomous' && !st.agentPaused && !st.agentBusy) {
      get().runAgentStep()
    }

    /* ---- 7. a challenge run ends on its own ---- */
    if (st.challenge?.active && tick >= st.challenge.endTick) get().endChallenge()
  },

  /* ---------------------------------------------------------------- */
  /* placement                                                         */
  /* ---------------------------------------------------------------- */

  selectItem: (id) => {
    if (!id) {
      set({ activeItemId: null, ghost: null, impact: null })
      return
    }
    const item = CATALOGUE_BY_ID[id] ?? LINEAR_BY_ID[id]
    if (!item) return
    set({ activeItemId: id, demolishMode: false, demolishTarget: null })

    const cs = useCityStore.getState()
    if (isLinear(item)) {
      // linear work has no plot — preview it straight away
      set({
        ghost: null,
        impact: predictImpact(cs.city, cs.config, cs.current, item, null),
      })
      return
    }
    // start the ghost on the plot the AI would have chosen
    const slot = bestFreeSlot(cs.city, cs.current, item.relieves)
    if (slot) get().moveGhost(slot.x, slot.z)
  },

  moveGhost: (x, z) => {
    const { activeItemId } = get()
    if (!activeItemId) return
    const item = CATALOGUE_BY_ID[activeItemId]
    if (!item) return

    const cs = useCityStore.getState()
    const slot = nearestFreeSlot(cs.city, x, z)
    if (!slot) {
      set({
        ghost: { x, z, district: 'central', valid: false, problem: 'No buildable land remains' },
        impact: null,
      })
      return
    }

    const prev = get().ghost
    const moved = !prev || slotKey(prev.x, prev.z) !== slotKey(slot.x, slot.z)
    const affordable = item.capex <= get().treasury

    set({
      ghost: {
        x: slot.x,
        z: slot.z,
        district: slot.district,
        valid: affordable,
        problem: affordable
          ? null
          : `Insufficient funds — needs $${(item.capex / 1e6).toFixed(1)}M, you have $${(
              get().treasury / 1e6
            ).toFixed(1)}M`,
      },
    })

    // one extra simulation per plot, not per pointer move
    if (moved || !get().impact) {
      set({ impact: predictImpact(cs.city, cs.config, cs.current, item, slot) })
    }
  },

  cancelBuild: () => set({ activeItemId: null, ghost: null, impact: null }),

  confirmBuild: () => {
    const { activeItemId, ghost } = get()
    if (!activeItemId) return
    const item = CATALOGUE_BY_ID[activeItemId] ?? LINEAR_BY_ID[activeItemId]
    if (!item) return
    const slot: Slot | null =
      isLinear(item) || !ghost ? null : { x: ghost.x, z: ghost.z, district: ghost.district }
    get().cancelBuild()
    placeThrough(item, slot, { cinematic: false, byAi: false })
  },

  buildItem: (id, opts = {}) => {
    const item = CATALOGUE_BY_ID[id] ?? LINEAR_BY_ID[id]
    if (!item) return false
    const cs = useCityStore.getState()
    const slot = isLinear(item)
      ? null
      : opts.district
        ? (cs.city.freeSlots.find((s) => s.district === opts.district) ??
           bestFreeSlot(cs.city, cs.current, item.relieves))
        : bestFreeSlot(cs.city, cs.current, item.relieves)
    return placeThrough(item, slot, {
      cinematic: opts.cinematic ?? false,
      byAi: opts.byAi ?? false,
    })
  },

  /* ---------------------------------------------------------------- */
  /* demolition                                                        */
  /* ---------------------------------------------------------------- */

  setDemolishMode: (v) =>
    set({ demolishMode: v, activeItemId: null, ghost: null, impact: null, demolishTarget: null }),

  pickDemolish: (buildingId) => {
    const cs = useCityStore.getState()
    const b = cs.city.buildings.find((x) => x.id === buildingId)
    if (!b) return

    // simulate the city without it, so the warning is a fact rather than a guess
    const without: City = {
      ...cs.city,
      buildings: cs.city.buildings.filter((x) => x.id !== buildingId),
      freeSlots: [...cs.city.freeSlots, { x: b.x, z: b.z, district: b.district }],
    }
    const after = runSimulation(without, cs.config)
    const cur = cs.current

    const impact: string[] = []
    const push = (label: string, before: number, now: number, invert = false) => {
      if (before === 0) return
      const change = ((now - before) / before) * 100
      if (Math.abs(change) < 0.5) return
      const better = invert ? change < 0 : change > 0
      impact.push(`${label} ${change > 0 ? '+' : ''}${change.toFixed(1)}%${better ? '' : ''}`)
    }
    push('Population capacity', cur.population, after.population)
    push('School pressure', cur.metrics.education.utilisation, after.metrics.education.utilisation, true)
    push('Traffic', cur.metrics.traffic.utilisation, after.metrics.traffic.utilisation, true)
    push('Grid load', cur.metrics.electricity.utilisation, after.metrics.electricity.utilisation, true)
    push('Jobs', cur.jobs, after.jobs)

    set({
      demolishTarget: {
        building: b,
        refund: Math.round(demolitionCost(b)),
        opexSaved: opexFor(b),
        impact: impact.slice(0, 4),
      },
    })
  },

  cancelDemolish: () => set({ demolishTarget: null }),

  confirmDemolish: () => {
    const target = get().demolishTarget
    if (!target) return
    const cs = useCityStore.getState()
    const b = target.building

    if (get().treasury < target.refund) {
      cs.pushEvent(
        `Insufficient funds — demolition costs $${(target.refund / 1e6).toFixed(2)}M`,
        'warn',
      )
      set({ demolishTarget: null })
      return
    }

    const city: City = {
      ...cs.city,
      buildings: cs.city.buildings.filter((x) => x.id !== b.id),
      freeSlots: [...cs.city.freeSlots, { x: b.x, z: b.z, district: b.district }],
    }
    const result = runSimulation(city, cs.config)

    useCityStore.setState({
      city,
      previous: cs.current,
      current: result,
      runProgress: 1,
      selectedBuilding: null,
      hoveredBuilding: null,
      userBuildings: cs.userBuildings.filter((x) => x.id !== b.id),
      analysis: analyseCity({ city, config: cs.config, current: result, baseline: cs.baseline }),
    })

    set((st) => ({
      treasury: st.treasury - target.refund,
      spentTotal: st.spentTotal + target.refund,
      demolishTarget: null,
    }))

    if (matchIsLive()) useChallengeStore.getState().applyHumanDemolish(b.id, target.refund)

    cs.pushEvent(`Demolished ${b.label} · $${(target.refund / 1e6).toFixed(2)}M`, 'warn')
    get().pushHistory(
      'demolish',
      `Demolished ${labelOf(b)}`,
      `${districtLabel(b.district)} · $${(target.refund / 1e6).toFixed(2)}M · saves $${(
        target.opexSaved / 1e6
      ).toFixed(2)}M/yr`,
      false,
    )
    get().refresh()
  },

  /* ---------------------------------------------------------------- */
  /* the advisor                                                       */
  /* ---------------------------------------------------------------- */

  acceptAdvice: () => {
    const a = get().advice
    if (!a?.itemId) return
    const item = adviceItem(a.itemId)
    if (!item) return
    set((st) => ({ dismissedAdvice: [...st.dismissedAdvice, a.id], advice: null }))
    useCityStore.getState().pushEvent(`Accepted AI recommendation — ${a.itemName}`, 'ai')
    get().buildItem(a.itemId, { district: a.district ?? undefined, byAi: false })
  },

  dismissAdvice: () => {
    const a = get().advice
    if (!a) return
    set((st) => ({ dismissedAdvice: [...st.dismissedAdvice, a.id], advice: null }))
  },

  /* ---------------------------------------------------------------- */
  /* the autonomous agent                                              */
  /* ---------------------------------------------------------------- */

  setAgentObjective: (id) => {
    set({ agentObjective: id })
    if (get().mode === 'autonomous') {
      get().pushAiLog(`Objective changed: ${AGENT_OBJECTIVES[id].phrase}`, 'mode')
    }
  },

  pauseAgent: () => {
    set({ agentPaused: true, agentStatus: 'Paused — current work will finish' })
    get().pushAiLog('Paused by the operator', 'mode')
    useCityStore.getState().pushEvent('AI paused — it will finish what it started', 'info')
  },

  resumeAgent: () => {
    set({ agentPaused: false, agentStatus: 'Analyzing the city…' })
    get().pushAiLog('Resumed from the current city state', 'mode')
    useCityStore.getState().pushEvent('AI resumed', 'ai')
    window.setTimeout(() => get().runAgentStep(), 400)
  },

  /** ANALYZE → PRIORITIZE → PLAN → SIMULATE → EXECUTE, once. */
  runAgentStep: () => {
    const s = get()
    if (s.mode !== 'autonomous' || s.agentPaused || s.agentBusy) return

    const opt = useOptimizerStore.getState()
    // never interrupt work already on site
    if (opt.phase === 'building' || opt.phase === 'resimulating') return

    const cs = useCityStore.getState()
    const decision = decide({
      city: cs.city,
      config: cs.config,
      current: cs.current,
      priorities: s.priorities,
      objective: AGENT_OBJECTIVES[s.agentObjective],
      treasury: s.treasury,
      reserve: s.reserve,
      recentDistricts: s.agentBuilt,
      health: s.health.score,
    })

    set({ lastDecision: decision })

    if (decision.kind !== 'build' || !decision.item) {
      set({ agentStatus: decision.reason })
      // don't spam the log with the same hold every month
      if (get().aiLog[0]?.text !== decision.reason) get().pushAiLog(decision.reason, 'observe')
      return
    }

    get().pushAiLog(
      `${decision.priority?.label} at ${decision.priority?.urgency}/100 — ${decision.priority?.reading}`,
      'analyze',
    )
    get().pushAiLog(logLineFor(decision), 'decide')
    set({ agentStatus: `Building ${decision.item.name.toLowerCase()}` })

    const ok = placeThrough(decision.item, decision.slot, {
      cinematic: decision.cinematic,
      byAi: true,
      reason: decision.reason,
      siting: decision.siting,
    })
    if (!ok) {
      set({ agentStatus: 'Could not start that work — reconsidering' })
      get().pushAiLog('Plan rejected at validation — reconsidering', 'warn')
    }
  },

  /* ---------------------------------------------------------------- */
  /* the record                                                        */
  /* ---------------------------------------------------------------- */

  pushHistory: (kind, title, detail, major = false) => {
    const cs = useCityStore.getState()
    const { tick, treasury, health } = get()
    const { year, month } = tickToDate(tick)
    set((st) => ({
      history: [
        ...st.history,
        {
          id: historyId++,
          tick,
          year,
          month,
          kind,
          title,
          detail,
          snapshot: {
            population: cs.current.population,
            health: health.score,
            treasury,
            traffic: cs.current.metrics.traffic.utilisation,
          },
          major,
        },
      ].slice(-140),
    }))
  },

  pushAiLog: (text, kind) =>
    set((st) => ({
      aiLog: [{ id: aiLogId++, tick: st.tick, at: stamp(), text, kind }, ...st.aiLog].slice(0, 60),
    })),

  /* ---------------------------------------------------------------- */
  /* persistence                                                       */
  /* ---------------------------------------------------------------- */

  refreshSlots: () => set({ slots: listSlots() }),

  saveTo: (slot) => {
    const cs = useCityStore.getState()
    const s = get()
    const ok = saveCity(slot, {
      name: slot,
      mode: s.mode,
      city: cs.city,
      config: cs.config,
      baseConfig: cs.baseConfig,
      treasury: s.treasury,
      spentTotal: s.spentTotal,
      tick: s.tick,
      occupancy: s.occupancy,
      objective: s.agentObjective,
      activeEvents: s.activeEvents.map((e) => ({
        specId: e.spec.id,
        startedTick: e.startedTick,
        endsTick: e.endsTick,
      })),
      firedEventIds: s.firedEventIds,
      history: s.history,
      aiLog: s.aiLog.map((l) => ({ id: l.id, tick: l.tick, text: l.text, kind: l.kind })),
      summary: {
        population: cs.current.population,
        health: s.health.score,
        treasury: s.treasury,
        year: tickToDate(s.tick).year,
      },
    })
    set({
      saveNotice: ok
        ? `Saved to ${slot.replace('city-', 'City ')}`
        : storageAvailable()
          ? 'Save failed — the city is too large for local storage'
          : 'Save failed — local storage is unavailable in this browser',
      slots: listSlots(),
    })
    if (ok) cs.pushEvent(`City saved to ${slot.replace('city-', 'City ')}`, 'ok')
    window.setTimeout(() => set({ saveNotice: null }), 3200)
  },

  loadFrom: (slot) => {
    const saved: SavedCity | null = loadCity(slot)
    if (!saved) {
      set({ saveNotice: 'That slot is empty' })
      window.setTimeout(() => set({ saveNotice: null }), 2600)
      return
    }
    get().stopClock()
    useOptimizerStore.getState().resetOptimizer()

    // the simulation is never saved — it is re-derived, so it can never disagree
    const result = runSimulation(saved.city, saved.config)
    const baseline = runSimulation(generateCity(saved.baseConfig), saved.baseConfig)

    useCityStore.setState({
      city: saved.city,
      config: saved.config,
      baseConfig: saved.baseConfig,
      baseline,
      current: result,
      previous: result,
      runProgress: 1,
      hasRun: true,
      selectedBuilding: null,
      hoveredBuilding: null,
      heatLayer: 'none',
      analysis: analyseCity({ city: saved.city, config: saved.config, current: result, baseline }),
    })

    set({
      mode: saved.mode,
      treasury: saved.treasury,
      spentTotal: saved.spentTotal,
      tick: saved.tick,
      occupancy: saved.occupancy,
      agentObjective: (saved.objective as AgentObjectiveId) ?? 'grow',
      activeEvents: saved.activeEvents
        .map((e) => {
          const spec = EVENT_BY_ID[e.specId]
          return spec ? { spec, startedTick: e.startedTick, endsTick: e.endsTick } : null
        })
        .filter((e): e is ActiveEvent => e !== null),
      firedEventIds: saved.firedEventIds ?? [],
      history: saved.history ?? [],
      aiLog: (saved.aiLog ?? []).map((l) => ({ ...l, at: stamp(), kind: l.kind as AiLogEntry['kind'] })),
      activeItemId: null,
      ghost: null,
      impact: null,
      demolishMode: false,
      demolishTarget: null,
      advice: null,
      dismissedAdvice: [],
      agentPaused: false,
      agentBusy: false,
      lastDecision: null,
      challenge: null,
      saveNotice: `Loaded ${slot.replace('city-', 'City ')} · Year ${tickToDate(saved.tick).year}`,
    })
    historyId = Math.max(historyId, ...(saved.history ?? []).map((h) => h.id + 1), 1)

    useCityStore.getState().pushEvent(
      `Loaded ${slot.replace('city-', 'City ')} — ${formatTick(saved.tick)}`,
      'ok',
    )
    get().refresh()
    window.setTimeout(() => set({ saveNotice: null }), 3200)
  },

  newCity: () => {
    get().stopClock()
    useOptimizerStore.getState().resetOptimizer()
    const cfg = { ...useCityStore.getState().baseConfig, seed: Math.floor(Math.random() * 100000) }
    const city = generateCity(cfg)
    const result = runSimulation(city, cfg)
    useCityStore.setState({
      config: cfg,
      baseConfig: cfg,
      baseCity: city,
      city,
      baseline: result,
      current: result,
      previous: result,
      userBuildings: [],
      scenarioBuildings: [],
      scenario: 'current',
      heatLayer: 'none',
      hasRun: false,
      runProgress: 1,
      selectedBuilding: null,
      analysis: analyseCity({ city, config: cfg, current: result, baseline: result }),
    })
    resetSandboxState(set, get, cfg.occupancyRate)
    useCityStore.getState().pushEvent('New city generated', 'ok')
  },

  resetSandbox: () => {
    get().stopClock()
    useOptimizerStore.getState().resetOptimizer()
    const cs = useCityStore.getState()
    cs.resetCity()
    useCityStore.setState({ config: cs.baseConfig })
    resetSandboxState(set, get, cs.baseConfig.occupancyRate)
    useCityStore.getState().pushEvent('City reset to its founding state', 'ok')
  },

  /* ---------------------------------------------------------------- */
  /* human vs AI                                                       */
  /* ---------------------------------------------------------------- */

  startChallenge: (side, objective, years = 10) => {
    get().resetSandbox()
    const startTick = 0
    set({
      challenge: {
        active: true,
        side,
        startTick,
        endTick: startTick + years * 12,
        objective,
        results: { ...(get().challenge?.results ?? {}) },
      },
      agentObjective: objective,
      msPerTick: 650,
    })
    useCityStore.getState().pushEvent(
      `City Challenge — ${side === 'ai' ? 'AI' : 'you'} · ${years} years · ${AGENT_OBJECTIVES[objective].phrase}`,
      'ai',
    )
    get().pushHistory('mode', 'City Challenge begins', `${side === 'ai' ? 'AI' : 'Human'} run · ${years} simulated years`, true)
    get().setMode(side === 'ai' ? 'autonomous' : 'human')
    get().startClock()
  },

  endChallenge: () => {
    const c = get().challenge
    if (!c) return
    get().stopClock()
    const cs = useCityStore.getState()
    const s = get()
    const result: ChallengeResult = {
      population: cs.current.population,
      health: s.health.score,
      treasury: s.treasury,
      traffic: cs.current.metrics.traffic.utilisation,
      co2PerCapita: cs.current.raw.co2PerCapitaKgYear,
      economy: cs.current.raw.grossValueAdded,
      netIncome: s.finance.netIncome,
    }
    set({
      challenge: { ...c, active: false, results: { ...c.results, [c.side]: result } },
      msPerTick: 2400,
    })
    useCityStore.getState().pushEvent(
      `Challenge complete — ${c.side === 'ai' ? 'AI' : 'human'} finished with City Health ${result.health}`,
      'ok',
    )
    get().pushHistory('milestone', 'Challenge complete', `City Health ${result.health} · ${result.population.toLocaleString('en-US')} residents`, true)
  },

  clearChallenge: () => set({ challenge: null }),
}))

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * The single route into the city for every placement — player, advisor or
 * agent. Validates, charges the treasury, and hands the work to the Phase 3
 * construction system.
 */
function placeThrough(
  item: CatalogueItem | LinearItem,
  slot: Slot | null,
  opts: { cinematic: boolean; byAi: boolean; reason?: string; siting?: string | null },
): boolean {
  const sandbox = useSandboxStore.getState()
  const cs = useCityStore.getState()
  const opt = useOptimizerStore.getState()

  if (opt.phase === 'building' || opt.phase === 'resimulating') {
    cs.pushEvent('Construction already in progress — wait for it to finish', 'warn')
    return false
  }

  /* ---- money first: the rule the spec is strictest about ---- */
  if (item.capex > sandbox.treasury) {
    const msg = `Insufficient funds — ${item.name} needs $${(item.capex / 1e6).toFixed(
      1,
    )}M, the treasury holds $${(sandbox.treasury / 1e6).toFixed(1)}M`
    cs.pushEvent(msg, 'warn')
    if (opts.byAi) useSandboxStore.getState().pushAiLog(msg, 'warn')
    return false
  }

  const plan = sandboxPlan(cs.city, cs.config, cs.current, item, slot, opts.byAi ? 'ai' : 'you')
  if (!plan) {
    cs.pushEvent(`Nowhere to place ${item.name.toLowerCase()}`, 'warn')
    return false
  }

  /* ---- the same validation gate the AI's own plans go through ---- */
  const check = validatePlan(plan, cs.city, { budget: sandbox.treasury, metrics: [] })
  if (!check.ok) {
    cs.pushEvent(`Build rejected — ${check.errors[0]}`, 'warn')
    if (opts.byAi) useSandboxStore.getState().pushAiLog(`Plan rejected — ${check.errors[0]}`, 'warn')
    return false
  }

  useSandboxStore.setState({ agentBusy: opts.byAi })

  useOptimizerStore.setState({
    plans: [plan],
    selectedPlanId: plan.id,
    decision: {
      recommended: plan,
      confidence: 0.9,
      why: opts.reason ?? `${opts.byAi ? 'Placed by the city AI' : 'Placed by the operator'} — ${item.blurb}.`,
      budgetConstrained: false,
      notes: opts.siting ? [opts.siting] : [],
    },
  })

  if (opts.byAi && slot) {
    useOptimizerStore.setState({
      focusDistrict: {
        district: slot.district,
        label: districtLabel(slot.district),
        x: slot.x,
        z: slot.z,
      },
    })
  }

  opt.executePlan(plan.id, {
    quiet: !opts.cinematic,
    onFinish: (p, capex) => {
      // inside a challenge the player's city *is* the match city, so the build
      // has to land there — otherwise the score would never see it
      if (matchIsLive()) {
        useChallengeStore.getState().applyHumanBuild(plan.delta, capex)
        const sb0 = useSandboxStore.getState()
        useSandboxStore.setState({ agentBusy: false })
        sb0.pushHistory(
          opts.byAi ? 'ai_build' : 'build',
          `${opts.byAi ? 'AI built' : 'Built'} ${p.name.toLowerCase()}`,
          `${slot ? districtLabel(slot.district) : 'the network'} · $${(capex / 1e6).toFixed(1)}M`,
          capex >= 10_000_000,
        )
        return
      }
      const sb = useSandboxStore.getState()
      useSandboxStore.setState({
        treasury: Math.max(0, sb.treasury - capex),
        spentTotal: sb.spentTotal + capex,
        agentBusy: false,
        agentBuilt: slot
          ? { ...sb.agentBuilt, [item.id]: [...(sb.agentBuilt[item.id] ?? []), slot.district].slice(-2) }
          : sb.agentBuilt,
      })

      const where = slot ? districtLabel(slot.district) : 'the network'
      sb.pushHistory(
        opts.byAi ? 'ai_build' : 'build',
        `${opts.byAi ? 'AI built' : 'Built'} ${p.name.toLowerCase()}`,
        `${where} · $${(capex / 1e6).toFixed(1)}M · $${(item.opex / 1e6).toFixed(2)}M/yr upkeep`,
        capex >= 10_000_000,
      )
      if (opts.byAi) {
        useSandboxStore.getState().pushAiLog(`${p.name} complete in ${where}`, 'build')
      }
      useSandboxStore.getState().refresh()
    },
  })

  // the AI's allowance tracks the treasury so the Phase 2–4 panels stay honest
  useOptimizerStore.setState({ budget: Math.max(0, sandbox.treasury - item.capex) })
  return true
}

function resetSandboxState(
  set: (partial: Partial<SandboxState>) => void,
  get: () => SandboxState,
  occupancy: number,
) {
  historyId = 0
  aiLogId = 0
  const cs = useCityStore.getState()
  const finance = cityFinance(cs.city, cs.current)
  const health = cityHealth(cs.current, finance)
  set({
    mode: 'human',
    treasury: STARTING_TREASURY,
    spentTotal: 0,
    tick: 0,
    clockRunning: false,
    occupancy,
    activeEvents: [],
    firedEventIds: [],
    history: [
      {
        id: historyId++,
        tick: 0,
        year: 1,
        month: 1,
        kind: 'founded',
        title: 'City founded',
        detail: `${cs.current.population.toLocaleString('en-US')} residents · $${(
          STARTING_TREASURY / 1e6
        ).toFixed(0)}M treasury`,
        snapshot: {
          population: cs.current.population,
          health: health.score,
          treasury: STARTING_TREASURY,
          traffic: cs.current.metrics.traffic.utilisation,
        },
        major: true,
      },
    ],
    aiLog: [],
    activeItemId: null,
    ghost: null,
    impact: null,
    demolishMode: false,
    demolishTarget: null,
    advice: null,
    dismissedAdvice: [],
    agentPaused: false,
    agentBusy: false,
    agentStatus: 'Standing by',
    lastDecision: null,
    agentBuilt: {},
  })
  get().refresh()
}

/** Demolition is a cost, not a refund — clearing a site is work. */
function demolitionCost(b: Building): number {
  const footprint = b.w * b.d * Math.max(1, b.h)
  return Math.max(180_000, Math.min(3_500_000, footprint * 1_100))
}

function opexFor(b: Building): number {
  return (
    {
      house: 0,
      residential_tower: 60_000,
      office: 120_000,
      shop: 140_000,
      school: 500_000,
      hospital: 1_200_000,
      park: 120_000,
      parking: 180_000,
      transit_hub: 1_000_000,
      industrial: 260_000,
      power_plant: 1_500_000,
      solar_farm: 300_000,
      water_facility: 900_000,
    }[b.type] ?? 0
  )
}

const labelOf = (b: Building) => b.label.replace(/^New /, '').split(' · ')[0]

/* ------------------------------------------------------------------ */
/* keep derived state in step with the city, whoever changed it        */
/* ------------------------------------------------------------------ */

/**
 * Work executed through the Phase 2-4 optimizer paths — the plan cards, AUTO
 * mode, a natural-language brief, the demo — draws on the same treasury as a
 * hand-placed building, and lands in the same history.
 */
registerTreasuryDebit((capex, planName) => {
  const s = useSandboxStore.getState()
  useSandboxStore.setState({
    treasury: Math.max(0, s.treasury - capex),
    spentTotal: s.spentTotal + capex,
  })
  s.pushHistory('ai_build', `AI built ${planName.toLowerCase()}`, `$${(capex / 1e6).toFixed(1)}M committed`, capex >= 10_000_000)
  useSandboxStore.getState().refresh()
})

/**
 * Let the natural-language layer talk about Phase 5 state — the health score,
 * the treasury, the ranked problems and what the advisor would recommend —
 * without either control plane importing the other.
 */
registerSandboxView((): SandboxView | undefined => {
  const s = useSandboxStore.getState()
  return {
    mode: s.mode,
    treasury: s.treasury,
    health: {
      score: s.health.score,
      status: s.health.status,
      weakest: { label: s.health.weakest.label, score: s.health.weakest.score },
    },
    netIncome: s.finance.netIncome,
    priorities: s.priorities.map((p) => ({
      key: p.key,
      label: p.label,
      urgency: p.urgency,
      level: p.level,
      reading: p.reading,
      why: p.why,
    })),
    recommendation: s.advice?.itemName
      ? {
          itemName: s.advice.itemName,
          capex: s.advice.capex,
          where: s.advice.districtLabel,
          outcome: s.advice.outcome,
        }
      : null,
    year: tickToDate(s.tick).year,
  }
})

let lastResult = useCityStore.getState().current
useCityStore.subscribe((state) => {
  if (state.current === lastResult) return
  lastResult = state.current
  useSandboxStore.getState().refresh()
})

export { spendableBy }
