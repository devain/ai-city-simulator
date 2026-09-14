/**
 * Phase 4 vocabulary — the structured shape a natural-language request is
 * turned into before it ever touches the planner.
 *
 * Nothing in here knows how the request was understood. That keeps the
 * deterministic parser and a future hosted model interchangeable.
 */
import type { InfraKind } from '../../city/infrastructure'
import type { DistrictId, MetricKey } from '../../simulation/types'

export type Language = 'en' | 'vi'

export type IntentKind =
  | 'population_growth'
  | 'traffic_reduction'
  | 'cost_optimization'
  | 'quality_of_life'
  | 'co2_reduction'
  | 'economic_growth'
  | 'education'
  | 'energy'
  | 'water'
  | 'parking'
  | 'balanced_optimization'
  | 'build_specific'
  | 'question'
  /** Phase 5 — hand control over, take it back, pause or resume the AI */
  | 'control'
  | 'unknown'

/** Phase 5 — what the operator wants done with control of the city. */
export type ControlKind = 'take_control' | 'assist' | 'human' | 'pause' | 'resume'

export type QuestionKind =
  /** Phase 5 — "what should I build?" */
  | 'what_to_build'
  | 'city_status'
  | 'biggest_problem'
  | 'capacity'
  | 'what_built'
  | 'budget_left'
  | 'why_plan'
  | 'metric_detail'

/** how a constraint restricts a metric */
export type ConstraintOp =
  | 'max' // "keep traffic below 50%"
  | 'min' // "quality of life at least 80"
  | 'no_increase' // "without making traffic worse"
  | 'no_decrease' // "without hurting the economy"

export interface MetricConstraint {
  metric: MetricKey
  op: ConstraintOp
  /** % of capacity for max/min; undefined for the relative operators */
  value?: number
  /** the phrase this came from, shown back to the user */
  source: string
}

export interface LocationRef {
  kind: 'auto' | 'district' | 'zone'
  district?: DistrictId
  /** "downtown", "North Quarter", "auto" */
  label: string
  /** why the AI picked this spot, when it chose for itself */
  reason?: string
}

export interface CityIntent {
  kind: IntentKind
  raw: string
  language: Language
  /** goals mentioned alongside the primary one */
  secondary: IntentKind[]
  targetPopulationIncrease?: number
  budget?: number
  /** for build_specific */
  buildKind?: InfraKind
  buildCount?: number
  location: LocationRef
  constraints: MetricConstraint[]
  question?: QuestionKind
  /** set when the request is about who is in control */
  control?: ControlKind
  /** true when this reads as a follow-up to the previous request */
  isFollowUp: boolean
  /** the user asking for a different kind of solution, e.g. "roads instead" */
  preferKinds: InfraKind[]
  /** 0..1 — how cleanly the request parsed */
  parseConfidence: number
  /** the phrases that drove the parse, surfaced in the UI */
  matched: string[]
}

/* ------------------------------------------------------------------ */
/* what the AI decides to do about an intent                           */
/* ------------------------------------------------------------------ */

export interface ResolvedLocation {
  district: DistrictId
  label: string
  reason: string
  /** world-space centre the camera can fly to */
  x: number
  z: number
}

export type AIAction =
  | {
      type: 'optimize'
      objectiveId: string
      populationTarget?: number
      budget: number
      hardConstraints: MetricConstraint[]
      preferKinds: InfraKind[]
      /** district the user named, so the work lands where they asked */
      focusDistrict?: DistrictId
      summary: string
    }
  | {
      type: 'build'
      kind: InfraKind
      count: number
      location: ResolvedLocation
      budget: number
      summary: string
    }
  | {
      type: 'answer'
      question: QuestionKind
      text: string
      bullets: string[]
    }
  | {
      type: 'clarify'
      text: string
      suggestions: string[]
    }
  | {
      /** Phase 5 — change who is driving. Never touches the city itself. */
      type: 'control'
      control: ControlKind
      text: string
      summary: string
    }

export interface AIActionResult {
  ok: boolean
  /** set when a plan was rejected by validation */
  rejected?: string
  planId?: string
  planName?: string
  spend?: number
}

/* ------------------------------------------------------------------ */
/* conversation                                                        */
/* ------------------------------------------------------------------ */

export interface AIConversationState {
  currentIntent: CityIntent | null
  currentConstraints: MetricConstraint[]
  lastPlanId: string | null
  lastPlanName: string | null
  lastAction: AIAction | null
  lastResult: AIActionResult | null
  /** most recent first, capped */
  recentRequests: string[]
  /** what the AI has actually built this session, for "what did you build?" */
  built: { kind: InfraKind; count: number; district: DistrictId; at: string }[]
}

export const emptyConversation = (): AIConversationState => ({
  currentIntent: null,
  currentConstraints: [],
  lastPlanId: null,
  lastPlanName: null,
  lastAction: null,
  lastResult: null,
  recentRequests: [],
  built: [],
})

/* ------------------------------------------------------------------ */
/* transcript shown in the command center                              */
/* ------------------------------------------------------------------ */

export interface AITurn {
  id: number
  time: string
  request: string
  intent: CityIntent
  /** the AI's reading of the request, in plain words */
  understanding: string
  action: AIAction
  /** filled in once the action resolves */
  outcome?: string
  status: 'understood' | 'planning' | 'executing' | 'done' | 'answered' | 'rejected'
}
