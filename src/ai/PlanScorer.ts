/**
 * PlanScorer — converts a simulated plan into a 0-100 score under the active
 * objective, and produces the measurable reasons the UI shows.
 *
 * Only decision factors are exposed: what scored well, what it cost, what it
 * traded away. No hidden deliberation.
 */
import type { CityConstraint, CityObjective, CityPlan, ScoreLine, ScoreWeights } from './types'

/** map a percentage change into 0..100 where "down is good" */
const relief = (changePct: number, scale = 25) =>
  Math.max(0, Math.min(100, 50 - (changePct / scale) * 50))

/** map a percentage change into 0..100 where "up is good" */
const gain = (changePct: number, scale = 25) =>
  Math.max(0, Math.min(100, 50 + (changePct / scale) * 50))

const LABELS: Record<keyof ScoreWeights, string> = {
  capacity: 'Population capacity',
  traffic: 'Traffic relief',
  education: 'School capacity',
  parking: 'Parking relief',
  energy: 'Grid headroom',
  water: 'Water headroom',
  emissions: 'CO₂',
  economy: 'Economic activity',
  quality: 'Quality of life',
  cost: 'Cost efficiency',
}

export function scorePlan(
  plan: CityPlan,
  objective: CityObjective,
  constraint: CityConstraint,
): { score: number; breakdown: ScoreLine[]; reasons: string[] } {
  const o = plan.outcome
  const target = objective.populationTarget

  const capacityScore = target
    ? Math.max(0, Math.min(100, (o.capacityGain / target) * 100))
    : Math.max(0, Math.min(100, 50 + (o.capacityGain / 4000) * 50))

  const budgetUse = plan.capex / Math.max(1, constraint.budget)
  const costScore = plan.withinBudget
    ? Math.max(0, Math.min(100, 100 - budgetUse * 70))
    : 0

  const raw: Record<keyof ScoreWeights, { score: number; detail: string }> = {
    capacity: {
      score: capacityScore,
      detail: target
        ? `${o.capacityGain >= 0 ? '+' : ''}${o.capacityGain.toLocaleString('en-US')} of ${target.toLocaleString('en-US')} residents`
        : `${o.capacityGain >= 0 ? '+' : ''}${o.capacityGain.toLocaleString('en-US')} residents absorbable`,
    },
    traffic: { score: relief(o.traffic, 30), detail: `${fmt(o.traffic)} congestion` },
    education: { score: relief(o.education, 35), detail: `${fmt(o.education)} school load` },
    parking: { score: relief(o.parking, 30), detail: `${fmt(o.parking)} parking load` },
    energy: { score: relief(o.electricity, 25), detail: `${fmt(o.electricity)} grid load` },
    water: { score: relief(o.water, 25), detail: `${fmt(o.water)} water load` },
    emissions: { score: relief(o.emissions, 20), detail: `${fmt(o.emissions)} CO₂` },
    economy: { score: gain(o.economy, 20), detail: `${fmt(o.economy)} economic activity` },
    quality: { score: gain(o.quality, 18), detail: `${fmt(o.quality)} quality of life` },
    cost: {
      score: costScore,
      detail: `$${(plan.capex / 1e6).toFixed(1)}M of $${(constraint.budget / 1e6).toFixed(0)}M`,
    },
  }

  const breakdown: ScoreLine[] = (Object.keys(raw) as (keyof ScoreWeights)[])
    .filter((k) => objective.weights[k] > 0.001)
    .map((k) => ({
      key: k,
      label: LABELS[k],
      score: raw[k].score,
      weight: objective.weights[k],
      detail: raw[k].detail,
    }))
    .sort((a, b) => b.weight * b.score - a.weight * a.score)

  const totalWeight = breakdown.reduce((s, l) => s + l.weight, 0) || 1
  let score = breakdown.reduce((s, l) => s + l.score * l.weight, 0) / totalWeight

  // hard penalties the user would expect
  if (!plan.withinBudget) score *= 0.35
  if (target && !plan.meetsTarget) score *= 0.72
  // a plan that breaks a stated constraint is not a candidate, it is a fallback
  if (!plan.satisfiesConstraints) score *= 0.3
  if (plan.steps.length === 0) score = 0

  const reasons: string[] = []
  const top = breakdown.slice(0, 2)
  for (const l of top) {
    if (l.score >= 55) reasons.push(`${l.label}: ${l.detail}`)
  }
  const weakest = [...breakdown].sort((a, b) => a.score - b.score)[0]
  if (weakest && weakest.score < 45) reasons.push(`Trade-off — ${weakest.label.toLowerCase()}: ${weakest.detail}`)
  reasons.push(
    plan.withinBudget
      ? `Uses $${(plan.capex / 1e6).toFixed(1)}M of the $${(constraint.budget / 1e6).toFixed(0)}M budget`
      : `Exceeds the $${(constraint.budget / 1e6).toFixed(0)}M budget`,
  )
  if (target) {
    reasons.push(
      plan.meetsTarget
        ? `Meets the +${target.toLocaleString('en-US')} resident target`
        : `Falls ${(target - o.capacityGain).toLocaleString('en-US')} residents short of the target`,
    )
  }
  if (plan.trimmed) reasons.push('Scaled down to stay inside the budget')
  for (const v of plan.violations) reasons.push(`Breaks the brief — ${v}`)

  return { score: Math.round(Math.max(0, Math.min(100, score))), breakdown, reasons }
}

function fmt(pct: number) {
  if (Math.abs(pct) < 0.05) return 'no change in'
  return `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`
}

/** Confidence falls when the field is close or every option is compromised. */
export function decisionConfidence(plans: CityPlan[]): number {
  if (plans.length === 0) return 0.4
  const sorted = [...plans].sort((a, b) => b.score - a.score)
  const best = sorted[0]
  const runnerUp = sorted[1]
  const margin = runnerUp ? (best.score - runnerUp.score) / 100 : 0.25
  let c = 0.58 + Math.min(0.3, margin * 1.8) + (best.score / 100) * 0.15
  if (!best.withinBudget) c -= 0.18
  if (!best.meetsTarget) c -= 0.1
  if (!best.satisfiesConstraints) c -= 0.16
  return Math.max(0.35, Math.min(0.97, c))
}
