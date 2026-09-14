/**
 * OptimizationEngine — the pure core of the AI city planner.
 *
 *   diagnose()      what is wrong, and what is the binding constraint
 *   generatePlans() candidate plans, each fully simulated
 *   scorePlans()    rank them under the active objective
 *   explain()       the measurable reasons behind the pick
 *   buildReport()   before/after comparison once a plan is executed
 *
 * No React, no timers, no side effects — the store drives the pacing.
 */
import type { CityConfig } from '../simulation/config'
import type { City, DistrictId, MetricKey, SimulationResult } from '../simulation/types'
import { PRESSURE_ORDER } from '../simulation/pressure'
import { DISTRICT_NAMES } from '../simulation/citySimulation'
import { generatePlans, headroom, bindingConstraintOf, type GenerationContext } from './PlanGenerator'
import { decisionConfidence, scorePlan } from './PlanScorer'
import type {
  Bottleneck,
  CityConstraint,
  CityDiagnosis,
  CityObjective,
  CityPlan,
  ComparisonRow,
  OptimizationReport,
} from './types'

const DIAGNOSTIC_KEYS: MetricKey[] = [
  'traffic',
  'parking',
  'education',
  'electricity',
  'water',
  'retail',
  'transit',
  'emissions',
  'livability',
]

/** the systems that cap how many more residents the city can take */
const GROWTH_CRITICAL = new Set<MetricKey>([
  'traffic',
  'parking',
  'education',
  'electricity',
  'water',
])

const LAYER_FOR: Partial<Record<MetricKey, keyof import('../simulation/types').DistrictLoad>> = {
  traffic: 'traffic',
  parking: 'parking',
  education: 'education',
  electricity: 'electricity',
  water: 'water',
  retail: 'retail',
  emissions: 'emissions',
}

export function diagnose(city: City, config: CityConfig, current: SimulationResult): CityDiagnosis {
  const bottlenecks: Bottleneck[] = DIAGNOSTIC_KEYS.map((key) => {
    const m = current.metrics[key]
    const layer = LAYER_FOR[key]
    const hot = layer
      ? [...current.districts].sort((a, b) => Number(b[layer]) - Number(a[layer]))[0]
      : undefined
    return {
      metric: key,
      label: m.label,
      utilisation: m.utilisation,
      pressure: m.pressure,
      district: hot?.name ?? DISTRICT_NAMES.central,
      detail: m.detail,
      // systems that actually cap growth outrank soft gaps like retail supply
      severity: Math.max(0, Math.min(1.4, m.utilisation)) * (GROWTH_CRITICAL.has(key) ? 1.15 : 0.85),
    }
  })
    .filter((b) => PRESSURE_ORDER[b.pressure] >= 2)
    .sort((a, b) => b.severity - a.severity)

  const head = headroom(city, config)
  const binding = bindingConstraintOf(current)

  const worst = bottlenecks[0]
  const status: CityDiagnosis['status'] = !worst
    ? 'NOMINAL'
    : worst.pressure === 'CRITICAL'
      ? 'CRITICAL'
      : bottlenecks.length >= 3
        ? 'STRAINED'
        : 'WATCH'

  const headline = worst
    ? `${bottlenecks.length} system${bottlenecks.length > 1 ? 's' : ''} under pressure — ${worst.label.toLowerCase()} is worst at ${(worst.utilisation * 100).toFixed(0)}%`
    : 'All modelled systems are inside their planning thresholds'

  return { headline, status, bottlenecks, headroom: head, bindingConstraint: binding }
}

export interface OptimizationInput {
  city: City
  config: CityConfig
  current: SimulationResult
  objective: CityObjective
  constraint: CityConstraint
  diagnosis: CityDiagnosis
  preferDistrict?: DistrictId
  preferBlueprints?: string[]
}

export function planCandidates(input: OptimizationInput): CityPlan[] {
  const ctx: GenerationContext = {
    city: input.city,
    config: input.config,
    current: input.current,
    objective: input.objective,
    constraint: input.constraint,
    baseHeadroom: input.diagnosis.headroom,
    preferDistrict: input.preferDistrict,
    preferBlueprints: input.preferBlueprints,
  }
  const plans = generatePlans(ctx)
  for (const p of plans) {
    const { score, breakdown, reasons } = scorePlan(p, input.objective, input.constraint)
    p.score = score
    p.breakdown = breakdown
    p.reasons = reasons
  }
  // returned in generation order (A, B, C…) so the cards keep a stable identity;
  // `decide` does the ranking
  return plans
}

export interface Decision {
  recommended: CityPlan | null
  confidence: number
  why: string
  budgetConstrained: boolean
  notes: string[]
}

export function decide(
  plans: CityPlan[],
  objective: CityObjective,
  constraint: CityConstraint,
  /** blueprint families the user explicitly asked for, e.g. "roads instead" */
  preferBlueprints?: string[],
): Decision {
  const ranked = [...plans].sort((a, b) => b.score - a.score)
  const affordable = ranked.filter((p) => p.withinBudget)
  // constraints first, then budget, then score — a plan that breaks the brief
  // is only recommended when nothing else can be offered
  const compliant = affordable.filter((p) => p.satisfiesConstraints)
  const pool = compliant.length > 0 ? compliant : affordable.length > 0 ? affordable : ranked

  // an explicit request ("build roads instead") outranks the score, as long as
  // such a plan is actually on the table
  const asked = preferBlueprints?.length
    ? pool.find((p) => preferBlueprints.includes(p.blueprintId))
    : undefined
  const recommended = asked ?? pool[0] ?? null
  const budgetConstrained =
    affordable.length < plans.length || plans.some((p) => p.trimmed) ||
    (objective.populationTarget != null && !!recommended && !recommended.meetsTarget)

  const notes: string[] = []
  if (asked) {
    notes.push(`Recommending ${asked.name} because you asked for that kind of intervention`)
  } else if (preferBlueprints?.length) {
    notes.push('No plan of the kind you asked for fits the brief — showing the best alternative')
  }
  if (affordable.length < plans.length) {
    const cheapest = Math.min(...plans.filter((p) => !p.withinBudget).map((p) => p.capex))
    notes.push(
      `${plans.length - affordable.length} option${plans.length - affordable.length > 1 ? 's' : ''} discarded — from $${(cheapest / 1e6).toFixed(1)}M against a $${(constraint.budget / 1e6).toFixed(0)}M budget`,
    )
  }
  if (recommended?.trimmed) notes.push('Recommended plan scaled to fit the available capital')
  if (compliant.length === 0 && (constraint.metrics?.length ?? 0) > 0) {
    notes.push('No option satisfies every stated constraint — showing the closest achievable')
  }
  if (recommended && !recommended.satisfiesConstraints) {
    for (const v of recommended.violations) notes.push(`Constraint conflict — ${v}`)
  }
  if (objective.populationTarget && recommended && !recommended.meetsTarget) {
    notes.push(
      `No option reaches +${objective.populationTarget.toLocaleString('en-US')} residents inside the budget — this is the best achievable`,
    )
  }

  const why = recommended
    ? buildWhy(recommended, plans, objective)
    : 'No viable plan could be assembled within the current constraints.'

  return {
    recommended,
    confidence: decisionConfidence(pool),
    why,
    budgetConstrained,
    notes,
  }
}

function buildWhy(best: CityPlan, plans: CityPlan[], objective: CityObjective): string {
  const runnerUp = [...plans]
    .filter((p) => p.id !== best.id)
    .sort((a, b) => b.score - a.score)[0]
  const strongest = best.breakdown.slice(0, 2).map((l) => l.detail)
  const bits: string[] = []

  bits.push(
    `Plan ${best.code} scored ${best.score}/100 under "${objective.short.toLowerCase()}"`,
  )
  if (strongest.length > 0) bits.push(`because it delivers ${strongest.join(' and ')}`)
  bits.push(`for $${(best.capex / 1e6).toFixed(1)}M`)

  let sentence = bits.join(' ') + '.'
  if (runnerUp) {
    const gapLine =
      best.outcome.capacityGain - runnerUp.outcome.capacityGain > 250
        ? `${(best.outcome.capacityGain - runnerUp.outcome.capacityGain).toLocaleString('en-US')} more residents of capacity`
        : best.outcome.traffic < runnerUp.outcome.traffic - 1
          ? `${(runnerUp.outcome.traffic - best.outcome.traffic).toFixed(1)} points more congestion relief`
          : best.capex < runnerUp.capex
            ? `$${((runnerUp.capex - best.capex) / 1e6).toFixed(1)}M less capital`
            : `a better balance across the scored factors`
    sentence += ` It beats Plan ${runnerUp.code} (${runnerUp.score}/100) by ${gapLine}.`
  }
  return sentence
}

/* ------------------------------------------------------------------ */
/* before / after                                                      */
/* ------------------------------------------------------------------ */

/**
 * `usePressure` rows are reported as "% of capacity used", where down is good.
 * The other rows report the headline value itself, where up is good.
 */
const REPORT_KEYS: { key: MetricKey; lowerIsBetter: boolean; usePressure: boolean }[] = [
  { key: 'population', lowerIsBetter: false, usePressure: false },
  { key: 'traffic', lowerIsBetter: true, usePressure: true },
  { key: 'electricity', lowerIsBetter: true, usePressure: true },
  { key: 'water', lowerIsBetter: true, usePressure: true },
  { key: 'education', lowerIsBetter: true, usePressure: true },
  { key: 'parking', lowerIsBetter: true, usePressure: true },
  { key: 'emissions', lowerIsBetter: true, usePressure: true },
  { key: 'livability', lowerIsBetter: false, usePressure: false },
  { key: 'economy', lowerIsBetter: false, usePressure: false },
]

export function buildReport(
  plan: CityPlan,
  before: SimulationResult,
  after: SimulationResult,
  capacityDelta: number,
  headroomBefore?: number,
  headroomAfter?: number,
): OptimizationReport {
  const rows: ComparisonRow[] = REPORT_KEYS.map(({ key, lowerIsBetter, usePressure }) => {
    const b = before.metrics[key]
    const a = after.metrics[key]
    const beforePct = usePressure ? b.utilisation * 100 : b.value
    const afterPct = usePressure ? a.utilisation * 100 : a.value
    const changePct = beforePct === 0 ? 0 : ((afterPct - beforePct) / beforePct) * 100
    return {
      key,
      label: a.label,
      beforeValue: b.value,
      afterValue: a.value,
      beforePct,
      afterPct,
      changePct,
      lowerIsBetter,
      unit: a.unit,
    }
  })

  if (headroomBefore != null && headroomAfter != null) {
    rows.unshift({
      key: 'population',
      label: 'Population capacity',
      beforeValue: headroomBefore,
      afterValue: headroomAfter,
      beforePct: headroomBefore,
      afterPct: headroomAfter,
      changePct:
        headroomBefore === 0 ? 100 : ((headroomAfter - headroomBefore) / headroomBefore) * 100,
      lowerIsBetter: false,
      unit: 'residents absorbable',
    })
  }

  const headline: string[] = []
  if (capacityDelta !== 0)
    headline.push(
      `${capacityDelta > 0 ? '+' : ''}${capacityDelta.toLocaleString('en-US')} population capacity`,
    )
  for (const key of ['traffic', 'education', 'parking', 'emissions'] as MetricKey[]) {
    const row = rows.find((r) => r.key === key)
    if (row && Math.abs(row.changePct) >= 1) {
      headline.push(`${row.changePct > 0 ? '+' : ''}${row.changePct.toFixed(0)}% ${row.label.toLowerCase()}`)
    }
  }

  return {
    planId: plan.id,
    planName: plan.name,
    before,
    after,
    rows,
    capacityDelta,
    spend: plan.capex,
    headline,
  }
}

export { headroom }
