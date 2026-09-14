import type { CityDelta, InfraKind } from '../city/infrastructure'
import type { MetricKey, PressureLevel, SimulationResult } from '../simulation/types'
import type { MetricConstraint } from './nlu/types'

/* ------------------------------------------------------------------ */
/* objectives                                                          */
/* ------------------------------------------------------------------ */

export type ObjectiveId =
  | 'balanced'
  | 'population'
  | 'traffic'
  | 'cost'
  | 'quality'
  | 'co2'
  | 'economy'

/** How much each dimension counts when scoring a plan. */
export interface ScoreWeights {
  capacity: number
  traffic: number
  education: number
  parking: number
  energy: number
  water: number
  emissions: number
  economy: number
  quality: number
  cost: number
}

export interface CityObjective {
  id: ObjectiveId
  label: string
  short: string
  icon: string
  description: string
  weights: ScoreWeights
  /** metrics the user explicitly cares about, from their phrasing */
  focus: MetricKey[]
  /** extra residents the city must be able to absorb, if the user asked for it */
  populationTarget?: number
}

export interface CityConstraint {
  /** capital available for this optimisation round, USD */
  budget: number
  /** set when the parser lifted a budget out of the user's own words */
  budgetFromRequest?: boolean
  /** hard limits lifted from the request, e.g. "keep traffic below 50%" */
  metrics?: MetricConstraint[]
  note?: string
}

export interface ParsedRequest {
  raw: string
  objective: CityObjective
  constraint: CityConstraint
  /** short restatement the UI shows back to the user */
  interpretation: string
  matched: boolean
}

/* ------------------------------------------------------------------ */
/* bottlenecks                                                         */
/* ------------------------------------------------------------------ */

export interface Bottleneck {
  metric: MetricKey
  label: string
  utilisation: number
  pressure: PressureLevel
  district: string
  detail: string
  /** 0..1 — how much this constrains the city right now */
  severity: number
}

export interface CityDiagnosis {
  headline: string
  status: 'NOMINAL' | 'WATCH' | 'STRAINED' | 'CRITICAL'
  bottlenecks: Bottleneck[]
  /** extra residents the city can absorb before something fails */
  headroom: number
  bindingConstraint: MetricKey | null
}

/* ------------------------------------------------------------------ */
/* plans                                                               */
/* ------------------------------------------------------------------ */

export interface CityPlanStep {
  id: string
  kind: InfraKind
  label: string
  count: number
  capex: number
  buildMs: number
  detail: string
}

/** Every field is a percentage change against the city as it stands now. */
export interface PlanOutcome {
  capacityGain: number
  traffic: number
  electricity: number
  water: number
  education: number
  parking: number
  emissions: number
  economy: number
  quality: number
  operatingCost: number
}

export interface ScoreLine {
  key: keyof ScoreWeights
  label: string
  /** 0..100 */
  score: number
  weight: number
  detail: string
}

export interface CityPlan {
  id: string
  code: string
  name: string
  description: string
  /** the blueprint family this plan came from, e.g. 'roads' */
  blueprintId: string
  steps: CityPlanStep[]
  capex: number
  buildMs: number
  delta: CityDelta
  predicted: SimulationResult
  outcome: PlanOutcome
  headroomAfter: number
  score: number
  breakdown: ScoreLine[]
  reasons: string[]
  withinBudget: boolean
  /** true when the plan had to be cut down to fit the budget */
  trimmed: boolean
  meetsTarget: boolean
  /** hard constraints this plan would break, in plain words */
  violations: string[]
  satisfiesConstraints: boolean
}

/* ------------------------------------------------------------------ */
/* optimisation run                                                    */
/* ------------------------------------------------------------------ */

export type OptimizerPhase =
  | 'idle'
  | 'analyzing'
  | 'planning'
  | 'simulating'
  | 'deciding'
  | 'review'
  | 'building'
  | 'resimulating'
  | 'complete'

export interface AiEvent {
  id: number
  time: string
  text: string
  kind: 'scan' | 'detect' | 'plan' | 'sim' | 'decide' | 'build' | 'done' | 'warn'
}

export interface ComparisonRow {
  key: MetricKey
  label: string
  beforeValue: number
  afterValue: number
  beforePct: number
  afterPct: number
  changePct: number
  /** true when a drop is an improvement (pressure metrics) */
  lowerIsBetter: boolean
  unit: string
}

export interface OptimizationReport {
  planId: string
  planName: string
  before: SimulationResult
  after: SimulationResult
  rows: ComparisonRow[]
  capacityDelta: number
  spend: number
  headline: string[]
}
