/**
 * CityAIPlanner — the public face of the AI planner.
 *
 * Everything the UI needs goes through this one object. The deterministic
 * implementation below needs no API key and is fully reproducible; a hosted
 * model can be dropped in later by implementing the same interface, because
 * `describeCityForModel()` already produces the structured payload such a
 * model would be prompted with.
 */
import type { CityConfig } from '../simulation/config'
import type { City, DistrictId, SimulationResult } from '../simulation/types'
import { parseRequest, OBJECTIVES } from './ObjectiveParser'
import { decide, diagnose, planCandidates, buildReport } from './OptimizationEngine'
import type {
  CityConstraint,
  CityDiagnosis,
  CityObjective,
  CityPlan,
  ParsedRequest,
} from './types'
import type { Decision } from './OptimizationEngine'

export interface PlannerInput {
  city: City
  config: CityConfig
  current: SimulationResult
  objective: CityObjective
  constraint: CityConstraint
  /** district the user named, if any */
  preferDistrict?: DistrictId
  /** blueprint families the user asked for, e.g. after "roads instead" */
  preferBlueprints?: string[]
}

export interface PlannerRun {
  diagnosis: CityDiagnosis
  plans: CityPlan[]
  decision: Decision
}

export interface CityAIPlanner {
  readonly id: string
  parse(raw: string, fallback: { objective: CityObjective; budget: number }): ParsedRequest
  diagnose(input: Omit<PlannerInput, 'objective' | 'constraint'>): CityDiagnosis
  plan(input: PlannerInput, diagnosis: CityDiagnosis): PlannerRun
  /** picks the objective that best matches the city's own worst problem */
  autoObjective(diagnosis: CityDiagnosis): CityObjective
}

const AUTO_MAP: Record<string, keyof typeof OBJECTIVES> = {
  traffic: 'traffic',
  parking: 'traffic',
  education: 'quality',
  livability: 'quality',
  electricity: 'balanced',
  water: 'balanced',
  emissions: 'co2',
  retail: 'economy',
  transit: 'traffic',
}

export const deterministicPlanner: CityAIPlanner = {
  id: 'deterministic-planner-v1',

  parse: parseRequest,

  diagnose: ({ city, config, current }) => diagnose(city, config, current),

  plan: (input, diagnosis) => {
    const plans = planCandidates({ ...input, diagnosis })
    return { diagnosis, plans, decision: decide(plans, input.objective, input.constraint, input.preferBlueprints) }
  },

  autoObjective: (diagnosis) => {
    const worst = diagnosis.bottlenecks[0]
    if (!worst) return OBJECTIVES.balanced
    if (diagnosis.headroom < 1500) {
      return { ...OBJECTIVES.population, populationTarget: 5000 }
    }
    return OBJECTIVES[AUTO_MAP[worst.metric] ?? 'balanced']
  },
}

/** The structured payload a hosted model would be prompted with. */
export function describeCityForModel(input: PlannerInput, diagnosis: CityDiagnosis) {
  return {
    disclaimer: 'Prototype simulation — illustrative estimates.',
    objective: {
      id: input.objective.id,
      label: input.objective.label,
      populationTarget: input.objective.populationTarget,
      weights: input.objective.weights,
    },
    constraint: input.constraint,
    diagnosis: {
      status: diagnosis.status,
      headroom: diagnosis.headroom,
      bindingConstraint: diagnosis.bindingConstraint,
      bottlenecks: diagnosis.bottlenecks.map((b) => ({
        metric: b.metric,
        utilisation: Number(b.utilisation.toFixed(3)),
        pressure: b.pressure,
        district: b.district,
      })),
    },
    metrics: Object.values(input.current.metrics).map((m) => ({
      key: m.key,
      value: m.value,
      unit: m.unit,
      utilisation: Number(m.utilisation.toFixed(3)),
      pressure: m.pressure,
    })),
    inventory: {
      buildings: input.city.buildings.length,
      roads: input.city.roads.length,
      busRoutes: (input.city.busRoutes ?? []).length,
      freePlots: input.city.freeSlots.length,
    },
  }
}

export const planner: CityAIPlanner = deterministicPlanner
export { buildReport }
