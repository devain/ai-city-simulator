/**
 * The AI optimizer's control plane.
 *
 * Kept separate from useCityStore so the Phase 1 dashboard stays exactly as it
 * was; this store reads and writes the city store when the AI actually changes
 * the city. All the thinking lives in src/ai — this file only paces it so the
 * user can watch the AI work.
 */
import { create } from 'zustand'
import { useCityStore } from './useCityStore'
import { runSimulation } from '../simulation/citySimulation'
import { analyseCity } from '../ai/cityAnalyst'
import { planner } from '../ai/CityAIPlanner'
import { buildReport, headroom, type Decision } from '../ai/OptimizationEngine'
import { OBJECTIVES } from '../ai/ObjectiveParser'
import { applyDelta } from '../city/infrastructure'
import { buildExecutionQueue } from '../execution/buildQueue'
import {
  execClock,
  highlightNewBuilds,
  resetExecClock,
  stopExecClock,
} from '../execution/executionClock'
import type { CameraShot, ConstructionStep, ExecutionQueue } from '../execution/types'
import { CHALLENGE_BY_ID, type CityChallenge } from '../ai/challenges'
import { cityAI } from '../ai/nlu/LocalCityAIProvider'
import { describeIntent, routeIntent, suggestNext, PREFER_BLUEPRINT } from '../ai/intentRouter'
import { buildSpecificPlan } from '../ai/PlanGenerator'
import { scorePlan } from '../ai/PlanScorer'
import { validatePlan } from '../ai/planValidation'
import { emptyConversation } from '../ai/nlu/types'
import { currentSandboxView, type CityAIContext } from '../ai/CityAIProvider'
import { chargeTreasury } from '../sandbox/treasury'
import type {
  AIAction,
  AIConversationState,
  AITurn,
  CityIntent,
  MetricConstraint,
} from '../ai/nlu/types'
import type { CityConfig } from '../simulation/config'
import type { City, DistrictId, SimulationResult } from '../simulation/types'
import type { CityAnalysis } from '../ai/cityAnalyst'
import type {
  AiEvent,
  CityDiagnosis,
  CityObjective,
  CityPlan,
  ObjectiveId,
  OptimizationReport,
  OptimizerPhase,
  ParsedRequest,
} from '../ai/types'

/** A camera move the cinematic director should perform. */
export interface CameraCommand extends CameraShot {
  /** bumped on every request so the director re-triggers */
  token: number
}

/** everything needed to put the city back exactly as it was before a run */
export interface CitySnapshot {
  city: City
  current: SimulationResult
  previous: SimulationResult
  analysis: CityAnalysis
  budget: number
  spent: number
  planId: string
}

/** what an optimisation round was asked to respect */
/** How a plan should be carried out. Phase 5 places single buildings quietly. */
export interface ExecuteOptions {
  /** skip the letterbox, the hero reveal and the before/after modal */
  quiet?: boolean
  /** called once the city has genuinely been changed and re-simulated */
  onFinish?: (plan: CityPlan, capex: number) => void
}

export interface OptimizeOptions {
  auto?: boolean
  autoExecute?: boolean
  hardConstraints?: MetricConstraint[]
  preferDistrict?: DistrictId
  preferBlueprints?: string[]
  /** the conversation turn that triggered this, so it can be updated */
  turnId?: number
}

/** start + duration for a construction animation, keyed by object id */
export type ConstructionMap = Record<string, { start: number; duration: number }>

interface OptimizerState {
  objective: CityObjective
  budget: number
  spent: number
  request: string
  parsed: ParsedRequest | null

  phase: OptimizerPhase
  statusLine: string
  diagnosis: CityDiagnosis | null
  plans: CityPlan[]
  decision: Decision | null
  simulatingIndex: number
  selectedPlanId: string | null
  executingPlanId: string | null
  buildLabel: string | null
  buildProgress: number
  report: OptimizationReport | null
  reportOpen: boolean
  aiEvents: AiEvent[]
  autoMode: boolean
  activeChallenge: string | null

  constructions: ConstructionMap
  cameraCommand: CameraCommand | null
  /** true while the AI is driving the camera */
  cinematic: boolean

  /* ---- autonomous execution ---- */
  /* ---- natural-language command center ---- */
  conversation: AIConversationState
  turns: AITurn[]
  understanding: CityIntent | null
  thinking: boolean
  suggestions: string[]
  /**
   * Text being typed into the command bar by something other than the user —
   * the demo narrator. When set, the bar shows it and refuses edits.
   */
  typedText: string | null
  /** the district the AI is about to work in, highlighted in the 3D view */
  focusDistrict: { district: string; label: string; x: number; z: number } | null

  queue: ExecutionQueue | null
  steps: ConstructionStep[]
  activeStepIndex: number
  stepProgress: number
  paused: boolean
  skipping: boolean
  heroOpen: boolean
  snapshot: CitySnapshot | null

  setObjective: (id: ObjectiveId) => void
  setBudget: (v: number) => void
  setRequest: (v: string) => void
  submitRequest: (raw?: string) => void
  optimize: (opts?: OptimizeOptions) => void
  autoOptimize: () => void
  selectPlan: (id: string | null) => void
  executePlan: (id: string, opts?: ExecuteOptions) => void
  closeReport: () => void
  resetOptimizer: () => void
  runChallenge: (id: string) => void
  clearChallenge: () => void
  pushAi: (text: string, kind: AiEvent['kind']) => void
  focusCity: () => void

  /* ---- natural language ---- */
  setTypedText: (v: string | null) => void
  ask: (raw: string) => Promise<void>
  dispatchAction: (action: AIAction, turnId: number) => void
  aiContext: () => CityAIContext
  clearConversation: () => void

  /* ---- execution controls ---- */
  pauseExecution: () => void
  resumeExecution: () => void
  skipExecution: () => void
  replayOptimization: () => void
  restoreSnapshot: () => void
  closeHero: () => void
  runCamera: (shot: CameraShot) => void
}

let aiEventId = 0
let turnSeq = 0

/** display names, used to attribute a completed step to a district */
const INFRA_NAME: Partial<Record<string, string>> = {
  school: 'School',
  hospital: 'Hospital',
  transit_hub: 'Transit hub',
  parking_garage: 'Parking garage',
  shopping_district: 'Shopping district',
  residential_tower: 'Residential tower',
  office: 'Office building',
  park: 'Park',
  solar_farm: 'Solar farm',
  power_plant: 'Power plant',
  water_facility: 'Water facility',
}
let timers: number[] = []
let focusToken = 0

const clearTimers = () => {
  timers.forEach((t) => window.clearTimeout(t))
  timers = []
}
const at = (ms: number, fn: () => void) => {
  timers.push(window.setTimeout(fn, ms))
}

const stamp = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
    d.getSeconds(),
  ).padStart(2, '0')}`
}

/** multiply selected config fields — how a challenge applies pressure */
function stressConfig(config: CityConfig, stress: CityChallenge['stress']): CityConfig {
  if (!stress) return config
  const next = { ...config }
  for (const [k, mult] of Object.entries(stress)) {
    const key = k as keyof CityConfig
    const base = next[key]
    if (typeof base === 'number' && typeof mult === 'number') {
      ;(next as Record<string, number>)[key] = base * mult
    }
  }
  return next
}

export const useOptimizerStore = create<OptimizerState>((set, get) => ({
  objective: OBJECTIVES.balanced,
  budget: 50_000_000,
  spent: 0,
  request: '',
  parsed: null,

  phase: 'idle',
  statusLine: 'Standing by',
  diagnosis: null,
  plans: [],
  decision: null,
  simulatingIndex: -1,
  selectedPlanId: null,
  executingPlanId: null,
  buildLabel: null,
  buildProgress: 0,
  report: null,
  reportOpen: false,
  aiEvents: [],
  autoMode: false,
  activeChallenge: null,

  constructions: {},
  cameraCommand: null,
  cinematic: false,

  conversation: emptyConversation(),
  turns: [],
  understanding: null,
  thinking: false,
  typedText: null,
  suggestions: [
    'I have $50M. Prepare the city for 5,000 new residents.',
    'Fix downtown traffic under $20M.',
    'Build a school',
    'Reduce CO2 without hurting the economy',
  ],
  focusDistrict: null,

  queue: null,
  steps: [],
  activeStepIndex: -1,
  stepProgress: 0,
  paused: false,
  skipping: false,
  heroOpen: false,
  snapshot: null,

  pushAi: (text, kind) =>
    set((s) => ({
      aiEvents: [{ id: aiEventId++, time: stamp(), text, kind }, ...s.aiEvents].slice(0, 60),
    })),

  setObjective: (id) => {
    const objective = { ...OBJECTIVES[id], populationTarget: get().objective.populationTarget }
    set({ objective })
    useCityStore.getState().pushEvent(`Objective set: ${objective.label}`, 'ai')
  },

  setBudget: (v) => set({ budget: Math.max(0, v) }),
  setRequest: (v) => set({ request: v }),
  setTypedText: (v) => set({ typedText: v }),

  /** Kept for existing callers; every request now goes through `ask`. */
  submitRequest: (raw) => {
    const text = (raw ?? get().request).trim()
    if (!text) return
    void get().ask(text)
  },

  /* ---------------------------------------------------------------- */
  /* natural language — the Phase 4 entry point                        */
  /* ---------------------------------------------------------------- */

  ask: async (raw) => {
    const text = raw.trim()
    if (!text) return
    const cs = useCityStore.getState()

    set({ thinking: true, request: text, typedText: null })
    cs.pushEvent(`Operator: "${text}"`, 'ai')

    // the diagnosis is context for understanding, so make sure we have one
    const diagnosis =
      get().diagnosis ?? planner.diagnose({ city: cs.city, config: cs.config, current: cs.current })

    const ctx: CityAIContext = {
      city: cs.city,
      config: cs.config,
      current: cs.current,
      baseline: cs.baseline,
      diagnosis,
      budget: get().budget,
      spent: get().spent,
      conversation: get().conversation,
    }

    const intent = await cityAI.understandRequest(text, ctx)
    const action = routeIntent(intent, ctx)
    const understanding = describeIntent(intent)

    const turn: AITurn = {
      id: ++turnSeq,
      time: stamp(),
      request: text,
      intent,
      understanding,
      action,
      status: action.type === 'answer' ? 'answered' : 'understood',
    }

    set((st) => ({
      thinking: false,
      understanding: intent,
      diagnosis,
      turns: [...st.turns, turn].slice(-24),
      conversation: {
        ...st.conversation,
        currentIntent: intent,
        currentConstraints: intent.constraints,
        lastAction: action,
        recentRequests: [text, ...st.conversation.recentRequests].slice(0, 8),
      },
    }))

    get().pushAi(`Request understood — ${understanding}`, 'scan')
    if (intent.matched.length > 0) {
      get().pushAi(`Read: ${intent.matched.slice(0, 4).join(' · ')}`, 'detect')
    }

    get().dispatchAction(action, turn.id)
  },

  /** Carry out whatever the router decided. */
  dispatchAction: (action: AIAction, turnRef: number) => {
    const turnId = turnRef
    const patchTurn = (patch: Partial<AITurn>) =>
      set((st) => ({ turns: st.turns.map((t) => (t.id === turnId ? { ...t, ...patch } : t)) }))

    switch (action.type) {
      /* ---- Phase 5: hand control over, or take it back ---- */
      case 'control': {
        get().pushAi(action.text, 'decide')
        patchTurn({ outcome: action.text, status: 'answered' })
        // the sandbox owns modes; it is imported lazily so this store stays a leaf
        void import('./useSandboxStore').then(({ useSandboxStore }) => {
          const sb = useSandboxStore.getState()
          switch (action.control) {
            case 'take_control':
              sb.setMode('autonomous')
              break
            case 'assist':
              sb.setMode('assist')
              break
            case 'human':
              sb.setMode('human')
              break
            case 'pause':
              if (sb.mode === 'autonomous') sb.pauseAgent()
              sb.stopClock()
              break
            case 'resume':
              if (sb.mode === 'autonomous') sb.resumeAgent()
              sb.startClock()
              break
          }
          set({ suggestions: suggestNext(get().aiContext()) })
        })
        return
      }

      /* ---- informational: never touches the city ---- */
      case 'answer': {
        get().pushAi(action.text, 'detect')
        patchTurn({ outcome: action.text, status: 'answered' })
        set({ suggestions: suggestNext(get().aiContext()) })
        return
      }

      case 'clarify': {
        get().pushAi(action.text, 'warn')
        patchTurn({ outcome: action.text, status: 'answered' })
        set({ suggestions: action.suggestions })
        return
      }

      /* ---- an explicit build order ---- */
      case 'build': {
        const cs = useCityStore.getState()
        const diagnosis =
          get().diagnosis ?? planner.diagnose({ city: cs.city, config: cs.config, current: cs.current })
        const constraint = { budget: action.budget, metrics: [] as MetricConstraint[] }

        const plan = buildSpecificPlan(
          {
            city: cs.city,
            config: cs.config,
            current: cs.current,
            objective: { ...OBJECTIVES.balanced },
            constraint,
            baseHeadroom: diagnosis.headroom,
          },
          action.kind,
          action.count,
          action.location.district,
        )

        if (!plan) {
          const msg = `No buildable land remains for a ${action.kind.replace(/_/g, ' ')}.`
          get().pushAi(msg, 'warn')
          patchTurn({ outcome: msg, status: 'rejected' })
          return
        }

        const check = validatePlan(plan, cs.city, constraint)
        if (!check.ok) {
          const msg = `Plan rejected — ${check.errors[0]}`
          get().pushAi(msg, 'warn')
          patchTurn({ outcome: msg, status: 'rejected' })
          return
        }

        const scored = scorePlan(plan, OBJECTIVES.balanced, constraint)
        plan.score = scored.score
        plan.breakdown = scored.breakdown
        plan.reasons = scored.reasons

        set({
          plans: [plan],
          decision: {
            recommended: plan,
            confidence: 0.9,
            why: `Direct order — ${action.summary}.`,
            budgetConstrained: !plan.withinBudget,
            notes: check.warnings,
          },
          phase: 'review',
          statusLine: `Ready to build · ${action.summary}`,
          selectedPlanId: plan.id,
          diagnosis,
          focusDistrict: {
            district: action.location.district,
            label: action.location.label,
            x: action.location.x,
            z: action.location.z,
          },
        })

        get().pushAi(`Site selected — ${action.location.label} (${action.location.reason})`, 'decide')
        // show the operator where before anything is built
        get().runCamera({ x: action.location.x, z: action.location.z, distance: 120, polar: 0.85, travel: 1500 })
        patchTurn({ status: 'executing', outcome: `Construction planned — ${action.summary}` })

        at(1500, () => get().executePlan(plan.id))
        return
      }

      /* ---- an optimisation brief ---- */
      case 'optimize': {
        const objective = {
          ...OBJECTIVES[action.objectiveId as keyof typeof OBJECTIVES],
          populationTarget: action.populationTarget,
        }
        const preferBlueprints = action.preferKinds
          .map((k) => PREFER_BLUEPRINT[k])
          .filter((v): v is string => !!v)

        set({
          objective,
          budget: action.budget,
          focusDistrict: null,
        })
        patchTurn({ status: 'planning' })

        get().optimize({
          hardConstraints: action.hardConstraints,
          preferDistrict: action.focusDistrict,
          preferBlueprints,
          turnId,
        })
        return
      }
    }
  },

  /** The context object the provider and the router both read. */
  aiContext: (): CityAIContext => {
    const cs = useCityStore.getState()
    return {
      city: cs.city,
      config: cs.config,
      current: cs.current,
      baseline: cs.baseline,
      diagnosis: get().diagnosis,
      budget: get().budget,
      spent: get().spent,
      conversation: get().conversation,
      sandbox: currentSandboxView(),
    }
  },

  clearConversation: () =>
    set({ turns: [], conversation: emptyConversation(), understanding: null, focusDistrict: null }),

  autoOptimize: () => {
    const city = useCityStore.getState()
    const diagnosis = planner.diagnose({
      city: city.city,
      config: city.config,
      current: city.current,
    })
    const objective = planner.autoObjective(diagnosis)
    set({ objective, autoMode: true, parsed: null, request: '' })
    get().pushAi(
      `Auto mode — primary problem: ${diagnosis.bottlenecks[0]?.label ?? 'capacity headroom'}`,
      'detect',
    )
    get().optimize({ auto: true, autoExecute: true })
  },

  optimize: (opts: OptimizeOptions = {}) => {
    clearTimers()
    const { objective, budget } = get()
    const cityState = useCityStore.getState()
    const hardConstraints = opts.hardConstraints ?? get().conversation.currentConstraints

    set({
      phase: 'analyzing',
      statusLine: 'Analyzing city',
      plans: [],
      decision: null,
      report: null,
      reportOpen: false,
      selectedPlanId: null,
      executingPlanId: null,
      simulatingIndex: -1,
      buildLabel: null,
      buildProgress: 0,
      autoMode: opts.auto ?? false,
    })
    get().pushAi('Scanning city systems…', 'scan')
    cityState.pushEvent('AI optimizer engaged', 'ai')

    /* ---- 1. diagnose ---- */
    at(900, () => {
      const diagnosis = planner.diagnose({
        city: cityState.city,
        config: cityState.config,
        current: cityState.current,
      })
      set({ diagnosis, phase: 'planning', statusLine: 'Generating candidate plans' })
      get().pushAi(diagnosis.headline, 'detect')
      diagnosis.bottlenecks.slice(0, 3).forEach((b, i) => {
        at(120 * i, () =>
          get().pushAi(
            `Bottleneck ${i + 1}: ${b.label} at ${(b.utilisation * 100).toFixed(0)}% · ${b.district}`,
            'detect',
          ),
        )
      })
      get().pushAi(
        `Current headroom: ${diagnosis.headroom.toLocaleString('en-US')} more residents before ${
          diagnosis.bindingConstraint ?? 'a system'
        } fails`,
        'detect',
      )

      /* ---- 2. generate + simulate ---- */
      at(1000, () => {
        const run = planner.plan(
          {
            city: cityState.city,
            config: cityState.config,
            current: cityState.current,
            objective,
            constraint: { budget, metrics: hardConstraints },
            preferDistrict: opts.preferDistrict,
            preferBlueprints: opts.preferBlueprints,
          },
          diagnosis,
        )
        set({ plans: run.plans, phase: 'simulating', statusLine: 'Simulating outcomes' })
        get().pushAi(`${run.plans.length} candidate plans generated`, 'plan')

        const per = 620
        run.plans.forEach((p, i) => {
          at(per * i, () => {
            set({ simulatingIndex: i })
            get().pushAi(`Testing Plan ${p.code} — ${p.name}`, 'sim')
          })
        })

        /* ---- 3. decide ---- */
        at(per * run.plans.length + 250, () => {
          set({
            simulatingIndex: -1,
            decision: run.decision,
            phase: 'deciding',
            statusLine: 'Scoring and ranking',
          })
          run.plans.forEach((p) =>
            get().pushAi(`Plan ${p.code} scored ${p.score}/100 · $${(p.capex / 1e6).toFixed(1)}M`, 'sim'),
          )
          if (run.decision.budgetConstrained) {
            get().pushAi('Budget constraint detected — searching within available capital', 'warn')
          }
          for (const note of run.decision.notes) {
            if (note.startsWith('Constraint conflict')) get().pushAi(note, 'warn')
          }

          at(750, () => {
            const rec = run.decision.recommended
            set({
              phase: 'review',
              statusLine: rec ? `Recommending Plan ${rec.code}` : 'No viable plan',
              selectedPlanId: rec?.id ?? null,
            })
            if (rec) {
              set((st) => ({
                conversation: {
                  ...st.conversation,
                  lastPlanId: rec.id,
                  lastPlanName: rec.name,
                },
                // honest status: it has only recommended until the build actually starts
                turns: opts.turnId != null
                  ? st.turns.map((t) =>
                      t.id === opts.turnId
                        ? {
                            ...t,
                            status: (opts.autoExecute ? 'executing' : 'planning') as AITurn['status'],
                            outcome: opts.autoExecute
                              ? `Recommending ${rec.name} — starting construction`
                              : `Recommending ${rec.name} — awaiting your go-ahead`,
                          }
                        : t,
                    )
                  : st.turns,
              }))
              get().pushAi(
                `Recommendation: Plan ${rec.code} — ${rec.name} (confidence ${(run.decision.confidence * 100).toFixed(0)}%)`,
                'decide',
              )
              cityState.pushEvent(
                `AI recommends Plan ${rec.code}: ${rec.name} · $${(rec.capex / 1e6).toFixed(1)}M`,
                'ai',
              )
              if (opts.autoExecute) at(1100, () => get().executePlan(rec.id))
            } else {
              /* nothing met the brief — say so plainly, then say what IS reachable */
              const target = objective.populationTarget
              const reach = diagnosis.headroom
              const limit = diagnosis.bindingConstraint ?? 'infrastructure capacity'
              const cheapest = run.plans.length ? Math.min(...run.plans.map((p) => p.capex)) : null

              const reasons: string[] = []
              if (target != null && target > reach) {
                reasons.push(
                  `+${target.toLocaleString('en-US')} residents is beyond what this city can absorb — measured headroom is ${reach.toLocaleString(
                    'en-US',
                  )}, limited by ${limit}`,
                )
              }
              if (cheapest != null && cheapest > budget) {
                reasons.push(
                  `the cheapest plan that meets the brief costs $${(cheapest / 1e6).toFixed(
                    1,
                  )}M, above the $${(budget / 1e6).toFixed(1)}M available`,
                )
              }
              for (const n of run.decision.notes) {
                if (n.startsWith('Constraint conflict')) reasons.push(n.replace('Constraint conflict — ', ''))
              }
              if (reasons.length === 0) {
                reasons.push(`no intervention fits within $${(budget / 1e6).toFixed(1)}M`)
              }

              const headline = `Constraint conflict detected — ${reasons[0]}.`
              const best = `Best achievable now: about ${reach.toLocaleString(
                'en-US',
              )} additional residents before ${limit} fails. Raise the budget or lower the target and ask again.`

              get().pushAi(headline, 'warn')
              if (reasons.length > 1) get().pushAi(`Also blocking: ${reasons[1]}`, 'warn')
              get().pushAi(best, 'decide')
              cityState.pushEvent('AI found no viable plan within the brief', 'warn')

              set((st) => ({
                focusDistrict: null,
                turns: opts.turnId != null
                  ? st.turns.map((t) =>
                      t.id === opts.turnId
                        ? { ...t, status: 'rejected' as const, outcome: `${headline} ${best}` }
                        : t,
                    )
                  : st.turns,
              }))
              set({ suggestions: suggestNext(get().aiContext()) })
            }
          })
        })
      })
    })
  },

  selectPlan: (id) => set({ selectedPlanId: id }),

  /* ---------------------------------------------------------------- */
  /* execution — the AI physically builds the plan                     */
  /* ---------------------------------------------------------------- */

  /* ---------------------------------------------------------------- */
  /* execution — the AI physically builds the plan, on a pausable clock */
  /* ---------------------------------------------------------------- */

  runCamera: (shot) => set({ cameraCommand: { ...shot, token: ++focusToken } }),

  executePlan: (id, exec = {}) => {
    clearTimers()
    const plan = get().plans.find((p) => p.id === id)
    if (!plan) return

    const cityStore = useCityStore.getState()
    const before = cityStore.current
    const beforeHead = get().diagnosis?.headroom ?? headroom(cityStore.city, cityStore.config)

    // snapshot everything so REPLAY and RESET can put the city back exactly
    const snapshot: CitySnapshot = {
      city: cityStore.city,
      current: cityStore.current,
      previous: cityStore.previous,
      analysis: cityStore.analysis,
      budget: get().budget,
      spent: get().spent,
      planId: plan.id,
    }

    const queue = buildExecutionQueue(plan, cityStore.city)

    set({
      phase: 'building',
      statusLine: `Executing Plan ${plan.code}`,
      executingPlanId: plan.id,
      selectedPlanId: plan.id,
      buildProgress: 0,
      reportOpen: false,
      heroOpen: false,
      cinematic: !exec.quiet,
      paused: false,
      skipping: false,
      snapshot,
      queue,
      steps: queue.steps.map((st) => ({ ...st })),
      activeStepIndex: -1,
      stepProgress: 0,
      constructions: queue.constructions,
    })

    // the open turn is only now genuinely building
    set((st) => ({
      turns: st.turns.map((t) =>
        t.status === 'planning' ? { ...t, status: 'executing' as const, outcome: `Building ${plan.name}` } : t,
      ),
    }))

    get().pushAi(`Executing Plan ${plan.code} — ${plan.name}`, 'build')
    cityStore.pushEvent(`AI selected Plan ${plan.code} — ${plan.name}`, 'ai')
    cityStore.pushEvent('Construction site initialized', 'ok')

    // the whole delta lands on the city now, but every object is held at zero
    // scale until its construction window opens in execution time
    useCityStore.setState({ city: applyDelta(cityStore.city, plan.delta) })

    resetExecClock(queue.totalMs)

    let lastFrame = performance.now()
    let finished = false

    const finish = () => {
      if (finished) return
      finished = true
      stopExecClock()
      highlightNewBuilds()

      const cs = useCityStore.getState()
      const after = runSimulation(cs.city, cs.config)
      const afterHead = headroom(cs.city, cs.config)
      const capacityDelta = Math.round(afterHead - beforeHead)
      const report = buildReport(plan, before, after, capacityDelta, beforeHead, afterHead)

      useCityStore.setState({
        previous: cs.current,
        current: after,
        runProgress: 1,
        hasRun: true,
        analysis: analyseCity({
          city: cs.city,
          config: cs.config,
          current: after,
          baseline: cs.baseline,
        }),
      })

      const diagnosis = planner.diagnose({ city: cs.city, config: cs.config, current: after })

      set((st) => ({
        phase: 'complete',
        statusLine: exec.quiet ? 'Construction complete' : 'Optimization complete',
        report,
        heroOpen: !exec.quiet,
        diagnosis,
        spent: st.spent + plan.capex,
        budget: Math.max(0, st.budget - plan.capex),
        activeStepIndex: queue.steps.length - 1,
        stepProgress: 1,
        buildProgress: 1,
        skipping: false,
        steps: st.steps.map((x) => ({ ...x, status: 'COMPLETE' as const, progress: 1 })),
      }))
      // the conversation only ever records work that genuinely completed
      const builtNow = plan.steps.map((st) => ({
        kind: st.kind,
        count: st.count,
        district:
          plan.delta.buildings.find((b) => b.label.includes(INFRA_NAME[st.kind] ?? ''))?.district ??
          plan.delta.buildings[0]?.district ??
          'central',
        at: stamp(),
      }))

      set((st) => ({
        conversation: {
          ...st.conversation,
          lastPlanId: plan.id,
          lastPlanName: plan.name,
          lastResult: { ok: true, planId: plan.id, planName: plan.name, spend: plan.capex },
          built: [...st.conversation.built, ...builtNow],
        },
        turns: st.turns.map((t) =>
          t.status === 'executing' || t.status === 'planning'
            ? {
                ...t,
                status: 'done' as const,
                outcome: `${plan.name} complete — ${report.headline.join(' · ')}`,
              }
            : t,
        ),
        focusDistrict: null,
      }))
      set({ suggestions: suggestNext(get().aiContext()) })

      get().pushAi(`Optimization complete — ${report.headline.join(' · ')}`, 'done')
      cityStore.pushEvent(`Optimization complete: ${plan.name}`, 'ok')

      // whoever asked for this gets told once the city has genuinely changed
      if (exec.onFinish) exec.onFinish(plan, plan.capex)
      // a plan executed through the Phase 2-4 paths still costs the city money
      else chargeTreasury(plan.capex, plan.name)

      if (exec.quiet) {
        set({ cinematic: false })
      } else {
        // hero moment first, then the full before/after table
        at(6200, () => {
          if (get().heroOpen) set({ heroOpen: false, reportOpen: true, cinematic: false })
        })
      }
    }

    let simulated = false
    let lastStep = -1

    const tick = () => {
      if (!execClock.running || get().executingPlanId !== plan.id) return
      const now = performance.now()
      const dt = Math.min(80, now - lastFrame)
      lastFrame = now
      if (!execClock.paused) execClock.elapsed += dt * execClock.rate

      const e = execClock.elapsed
      const steps = queue.steps
      let active = steps.findIndex((st) => e >= st.startAt && e < st.startAt + st.duration)
      if (active === -1) active = e >= queue.totalMs ? steps.length - 1 : 0

      const st = steps[active]
      const progress = Math.max(0, Math.min(1, (e - st.startAt) / st.duration))

      if (active !== lastStep) {
        lastStep = active
        const step = steps[active]
        set((prev) => ({
          activeStepIndex: active,
          buildLabel: step.label,
          statusLine: step.label,
          steps: prev.steps.map((x, i) => ({
            ...x,
            status: i < active ? ('COMPLETE' as const) : i === active ? ('BUILDING' as const) : ('QUEUED' as const),
            progress: i < active ? 1 : 0,
          })),
        }))
        get().pushAi(`STEP ${String(active + 1).padStart(2, '0')} · ${step.label}`, 'build')
        useCityStore
          .getState()
          .pushEvent(step.label.toLowerCase(), step.type === 'complete' ? 'ok' : 'info')
        if (step.camera) get().runCamera(step.camera)
      }

      set({ stepProgress: progress, buildProgress: Math.min(1, e / queue.totalMs) })

      // the real simulation runs the moment the SIMULATE step begins
      if (!simulated && st.type === 'simulate') {
        simulated = true
        get().pushAi('Re-running the full simulation…', 'sim')
        useCityStore.getState().pushEvent('Simulation recalculated after construction', 'info')
      }

      if (e >= queue.totalMs) {
        finish()
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  },

  pauseExecution: () => {
    execClock.paused = true
    set({ paused: true, statusLine: 'Execution paused' })
    get().pushAi('Execution paused by operator', 'warn')
  },

  resumeExecution: () => {
    execClock.paused = false
    const s = get()
    set({ paused: false, statusLine: s.steps[s.activeStepIndex]?.label ?? 'Executing' })
    get().pushAi('Execution resumed', 'build')
  },

  skipExecution: () => {
    // fast-forward rather than teleport, so the city never lands in a half state
    execClock.paused = false
    execClock.rate = 14
    set({ paused: false, skipping: true, statusLine: 'Fast-forwarding construction' })
    get().pushAi('Skipping ahead — completing construction', 'warn')
  },

  closeHero: () => set({ heroOpen: false, reportOpen: true, cinematic: false }),

  restoreSnapshot: () => {
    const snap = get().snapshot
    if (!snap) return
    clearTimers()
    stopExecClock()
    const cs = useCityStore.getState()
    useCityStore.setState({
      city: snap.city,
      current: snap.current,
      previous: snap.previous,
      analysis: snap.analysis,
    })
    cs.pushEvent('City restored to pre-optimization state', 'info')
    // the diagnosis has to come back with it, or the panel keeps quoting
    // headroom the restored city no longer has
    const diagnosis = planner.diagnose({
      city: snap.city,
      config: cs.config,
      current: snap.current,
    })
    set({
      diagnosis,
      budget: snap.budget,
      spent: snap.spent,
      constructions: {},
      steps: [],
      queue: null,
      activeStepIndex: -1,
      stepProgress: 0,
      buildProgress: 0,
      buildLabel: null,
      paused: false,
      skipping: false,
      heroOpen: false,
      reportOpen: false,
      report: null,
      cinematic: false,
      executingPlanId: null,
      phase: 'review',
      statusLine: 'Ready to execute',
    })
    get().pushAi('City restored — plan ready to run again', 'scan')
    get().runCamera({ x: 0, z: 0, distance: 215, polar: 0.74, travel: 1600 })
  },

  replayOptimization: () => {
    const snap = get().snapshot
    if (!snap) return
    const planId = snap.planId
    get().restoreSnapshot()
    at(900, () => get().executePlan(planId))
  },

  closeReport: () => set({ reportOpen: false }),

  focusCity: () =>
    set({
      cameraCommand: { x: 0, z: 0, distance: 215, polar: 0.74, travel: 1600, token: ++focusToken },
      cinematic: false,
    }),

  resetOptimizer: () => {
    clearTimers()
    set({
      phase: 'idle',
      statusLine: 'Standing by',
      plans: [],
      decision: null,
      diagnosis: null,
      report: null,
      reportOpen: false,
      selectedPlanId: null,
      executingPlanId: null,
      simulatingIndex: -1,
      buildLabel: null,
      buildProgress: 0,
      constructions: {},
      autoMode: false,
      cameraCommand: null,
      cinematic: false,
      queue: null,
      steps: [],
      activeStepIndex: -1,
      stepProgress: 0,
      paused: false,
      skipping: false,
      heroOpen: false,
    })
  },

  runChallenge: (id) => {
    const challenge = CHALLENGE_BY_ID[id]
    if (!challenge) return
    clearTimers()

    const cs = useCityStore.getState()
    // challenges stress the model itself, not just the wording of the brief
    const config = stressConfig(cs.baseConfig ?? cs.config, challenge.stress)
    const baseline = runSimulation(cs.baseCity, config)
    const current = runSimulation(cs.city, config)
    useCityStore.setState({
      config,
      baseline,
      previous: cs.current,
      current,
      analysis: analyseCity({ city: cs.city, config, current, baseline }),
    })

    const objective: CityObjective = {
      ...OBJECTIVES[challenge.objectiveId],
      populationTarget: challenge.populationTarget,
    }
    set({
      objective,
      budget: challenge.budget,
      activeChallenge: id,
      request: challenge.brief,
      parsed: null,
    })
    get().pushAi(`Scenario loaded: ${challenge.name} — ${challenge.subtitle}`, 'scan')
    cs.pushEvent(`Scenario: ${challenge.name} (${challenge.subtitle})`, 'warn')
    at(500, () => get().optimize())
  },

  clearChallenge: () => {
    const cs = useCityStore.getState()
    if (cs.baseConfig) {
      const baseline = runSimulation(cs.baseCity, cs.baseConfig)
      const current = runSimulation(cs.city, cs.baseConfig)
      useCityStore.setState({
        config: cs.baseConfig,
        baseline,
        current,
        previous: cs.current,
        analysis: analyseCity({ city: cs.city, config: cs.baseConfig, current, baseline }),
      })
    }
    set({ activeChallenge: null })
  },
}))

/** Which scene objects a step created, so each gets its own build window. */
function idsForStep(plan: CityPlan, kind: string): string[] {
  const d = plan.delta
  switch (kind) {
    case 'road_widening':
      return d.roadUpgrades
    case 'intersection_upgrade':
      return d.intersectionUpgrades
    case 'highway_link':
    case 'bridge':
      return d.newRoads.map((r) => r.id)
    case 'bus_route':
      return d.busRoutes.map((r) => r.id)
    default: {
      const type = kind === 'shopping_district' ? 'shop' : kind === 'parking_garage' ? 'parking' : kind
      return d.buildings.filter((b) => b.type === type).map((b) => b.id)
    }
  }
}
