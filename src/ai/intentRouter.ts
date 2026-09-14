/**
 * intentRouter — the bridge from "what the user meant" to "what the AI will do".
 *
 *   CityIntent → AIAction → (optimize | build | answer | clarify)
 *
 * This is deliberately the only place that decides *whether* a request causes
 * construction. Questions never build. Ambiguous requests never fail — they
 * fall through to balancing the whole city and say so.
 */
import type { CityAIContext } from './CityAIProvider'
import { OBJECTIVES } from './ObjectiveParser'
import { describeConstraint } from './nlu/constraints'
import { detectControl, CONTROL_SUMMARY } from './nlu/control'
import { resolveLocation } from './nlu/locations'
import { DISTRICT_NAMES } from '../simulation/citySimulation'
import { INFRA, type InfraKind } from '../city/infrastructure'
import type { AIAction, CityIntent, IntentKind, QuestionKind } from './nlu/types'
import type { ObjectiveId } from './types'

/** which scoring objective each intent maps onto */
const OBJECTIVE_FOR: Record<
  Exclude<IntentKind, 'build_specific' | 'question' | 'control' | 'unknown'>,
  ObjectiveId
> = {
  population_growth: 'population',
  traffic_reduction: 'traffic',
  cost_optimization: 'cost',
  quality_of_life: 'quality',
  co2_reduction: 'co2',
  economic_growth: 'economy',
  education: 'quality',
  energy: 'balanced',
  water: 'balanced',
  parking: 'traffic',
  balanced_optimization: 'balanced',
}

const money = (n: number) => `$${(n / 1e6).toFixed(0)}M`

/** every intent resolves to a scoring objective; unknown balances the city */
function objectiveIdFor(kind: IntentKind): ObjectiveId {
  if (kind === 'build_specific' || kind === 'question' || kind === 'control' || kind === 'unknown') {
    return 'balanced'
  }
  return OBJECTIVE_FOR[kind]
}

/** A plain-language restatement of what the AI thinks it was asked. */
export function describeIntent(intent: CityIntent): string {
  switch (intent.kind) {
    case 'control':
      return intent.control ? CONTROL_SUMMARY[intent.control] : 'Change who is in control'
    case 'question':
      return 'Answer a question about the city — no construction'
    case 'build_specific': {
      const spec = intent.buildKind ? INFRA[intent.buildKind].name : 'infrastructure'
      const where =
        intent.location.kind === 'district' && intent.location.district
          ? ` in ${DISTRICT_NAMES[intent.location.district]}`
          : intent.location.kind === 'zone'
            ? ` in the ${intent.location.label}`
            : ''
      const n = intent.buildCount && intent.buildCount > 1 ? `${intent.buildCount} × ` : ''
      return `Build ${n}${spec}${where}`
    }
    default: {
      const objId = objectiveIdFor(intent.kind)
      const bits: string[] = [OBJECTIVES[objId].label]
      if (intent.targetPopulationIncrease) {
        bits.push(`target +${intent.targetPopulationIncrease.toLocaleString('en-US')} residents`)
      }
      if (intent.budget) bits.push(`budget ${money(intent.budget)}`)
      for (const c of intent.constraints) bits.push(describeConstraint(c))
      return bits.join(' · ')
    }
  }
}

export function routeIntent(intent: CityIntent, ctx: CityAIContext): AIAction {
  /* ---------------- control: who is driving ---------------- */
  if (intent.kind === 'control' && intent.control) {
    const c = detectControl(intent.raw)
    return {
      type: 'control',
      control: intent.control,
      text: c?.reply ?? CONTROL_SUMMARY[intent.control],
      summary: CONTROL_SUMMARY[intent.control],
    }
  }

  /* ---------------- questions ---------------- */
  if (intent.kind === 'question' && intent.question) {
    const { text, bullets } = answerQuestion(intent.question, ctx)
    return { type: 'answer', question: intent.question, text, bullets }
  }

  /* ---------------- explicit build ---------------- */
  if (intent.kind === 'build_specific' && intent.buildKind) {
    const kind = intent.buildKind
    const location = resolveLocation(
      intent.location,
      kind,
      ctx.city,
      ctx.current,
      ctx.conversation.built.map((b) => ({ kind: b.kind, district: b.district })),
    )
    const count = Math.max(1, intent.buildCount ?? 1)
    const spec = INFRA[kind]
    return {
      type: 'build',
      kind,
      count,
      location,
      budget: intent.budget ?? ctx.budget,
      summary:
        `${count > 1 ? `${count} × ` : ''}${spec.name} in ${location.label} — ${location.reason}`,
    }
  }

  /* ---------------- anything else is an optimisation ---------------- */
  const objectiveId = objectiveIdFor(intent.kind)

  const parts: string[] = [OBJECTIVES[objectiveId].label]
  if (intent.targetPopulationIncrease) {
    parts.push(`+${intent.targetPopulationIncrease.toLocaleString('en-US')} residents`)
  }
  if (intent.secondary.length > 0) {
    parts.push(`also weighing ${intent.secondary.slice(0, 2).map((s) => s.replace(/_/g, ' ')).join(' and ')}`)
  }

  const focusDistrict =
    intent.location.kind === 'district' ? intent.location.district : undefined
  if (focusDistrict) parts.push(`focused on ${DISTRICT_NAMES[focusDistrict]}`)

  return {
    type: 'optimize',
    objectiveId,
    populationTarget: intent.targetPopulationIncrease,
    budget: intent.budget ?? ctx.budget,
    hardConstraints: intent.constraints,
    preferKinds: intent.preferKinds,
    focusDistrict,
    summary: parts.join(' · '),
  }
}

/* ------------------------------------------------------------------ */
/* informational answers, straight from live state                     */
/* ------------------------------------------------------------------ */

const n = (v: number) => Math.round(v).toLocaleString('en-US')
const pct = (v: number) => `${(v * 100).toFixed(0)}%`

function answerQuestion(
  q: QuestionKind,
  ctx: CityAIContext,
): { text: string; bullets: string[] } {
  const cur = ctx.current
  const diag = ctx.diagnosis

  switch (q) {
    case 'what_built': {
      const built = ctx.conversation.built
      if (built.length === 0) {
        return {
          text: "I haven't built anything yet this session. Give me an objective and I'll plan one.",
          bullets: [],
        }
      }
      return {
        text: `I've completed ${built.reduce((s, b) => s + b.count, 0)} structures across ${
          new Set(built.map((b) => b.district)).size
        } districts this session.`,
        bullets: built.map(
          (b) =>
            `${b.count > 1 ? `${b.count} × ` : ''}${INFRA[b.kind].name} — ${DISTRICT_NAMES[b.district]} (${b.at})`,
        ),
      }
    }

    case 'budget_left':
      return {
        text: `${money(ctx.budget)} of capital remains${ctx.spent > 0 ? `, after committing ${money(ctx.spent)}` : ''}.`,
        bullets: [
          `Available: ${money(ctx.budget)}`,
          `Committed this session: ${money(ctx.spent)}`,
        ],
      }

    case 'capacity': {
      const head = diag?.headroom ?? 0
      return {
        text: `The city holds ${n(cur.population)} residents and can absorb about ${n(head)} more before ${
          diag?.bindingConstraint ?? 'a system'
        } passes 100% of capacity.`,
        bullets: [
          `Current population: ${n(cur.population)}`,
          `Spare capacity: ${n(head)} residents`,
          `Binding constraint: ${diag?.bindingConstraint ?? 'none'}`,
        ],
      }
    }

    case 'what_to_build': {
      const sb = ctx.sandbox
      const rec = sb?.recommendation
      if (!rec) {
        const top = sb?.priorities.find((pr) => pr.level !== 'NORMAL')
        return {
          text: top
            ? `${top.label} is the tightest system at ${top.urgency}/100 — ${top.reading} — but nothing in the catalogue improves the city enough to be worth the money yet.`
            : 'Nothing needs building right now. Every system has slack and the books balance.',
          bullets: sb ? [`City health ${sb.health.score}/100 · ${sb.health.status}`] : [],
        }
      }
      return {
        text: `Build ${rec.itemName.toLowerCase()}${rec.where ? ` in ${rec.where}` : ''} — ${money(
          rec.capex,
        )}.`,
        bullets: [
          ...(rec.outcome ? [`Expected: ${rec.outcome}`] : []),
          ...(sb ? [`Why: ${sb.priorities[0].label} is at ${sb.priorities[0].urgency}/100 — ${sb.priorities[0].reading}`] : []),
          ...(sb ? [`Treasury: ${money(sb.treasury)}`] : []),
        ],
      }
    }

    case 'biggest_problem': {
      // Phase 5 ranks problems by urgency, which is a better answer than
      // raw utilisation — fall back to the planner's bottlenecks without it
      const top = ctx.sandbox?.priorities.find((pr) => pr.level !== 'NORMAL')
      if (top) {
        return {
          text: `${top.label} — ${top.urgency}/100 and rising. ${top.reading}. ${top.why}`,
          bullets: (ctx.sandbox?.priorities ?? [])
            .filter((pr) => pr.level !== 'NORMAL')
            .slice(0, 4)
            .map((pr) => `${pr.label}: ${pr.urgency}/100 (${pr.level}) · ${pr.reading}`),
        }
      }
      const worst = diag?.bottlenecks[0]
      if (!worst) {
        return { text: 'Nothing is past its planning threshold right now.', bullets: [] }
      }
      return {
        text: `${worst.label} is the worst, at ${pct(worst.utilisation)} of capacity — hardest in ${worst.district}.`,
        bullets: (diag?.bottlenecks ?? [])
          .slice(0, 4)
          .map((b) => `${b.label}: ${pct(b.utilisation)} (${b.pressure}) · ${b.district}`),
      }
    }

    case 'why_plan': {
      const name = ctx.conversation.lastPlanName
      if (!name) return { text: "I haven't chosen a plan yet.", bullets: [] }
      const action = ctx.conversation.lastAction
      return {
        text: `I chose ${name} because it scored highest against your brief${
          action?.type === 'optimize' ? ` (${action.summary})` : ''
        }.`,
        bullets: ctx.conversation.lastResult?.planName
          ? [`Executed: ${ctx.conversation.lastResult.planName}`]
          : [],
      }
    }

    case 'city_status':
    case 'metric_detail':
    default: {
      const worst = diag?.bottlenecks[0]
      return {
        text:
          `${n(cur.population)} residents · infrastructure pressure ${cur.metrics.infrastructure.value.toFixed(0)}/100 · ` +
          `quality of life ${cur.metrics.livability.value.toFixed(0)}/100. ` +
          (worst
            ? `${worst.label} is the tightest system at ${pct(worst.utilisation)}.`
            : 'Every modelled system is inside its threshold.'),
        bullets: [
          ...(ctx.sandbox
            ? [
                `City health ${ctx.sandbox.health.score}/100 — ${ctx.sandbox.health.status} · weakest: ${ctx.sandbox.health.weakest.label}`,
                `Treasury ${money(ctx.sandbox.treasury)} · net ${
                  ctx.sandbox.netIncome >= 0 ? '+' : '−'
                }${money(Math.abs(ctx.sandbox.netIncome))}/yr · Year ${ctx.sandbox.year}`,
              ]
            : []),
          `Traffic ${pct(cur.metrics.traffic.utilisation)} · Parking ${pct(cur.metrics.parking.utilisation)}`,
          `Schools ${pct(cur.metrics.education.utilisation)} · Grid ${pct(cur.metrics.electricity.utilisation)}`,
          `Water ${pct(cur.metrics.water.utilisation)} · CO₂ ${pct(cur.metrics.emissions.utilisation)}`,
          `Spare capacity: ${n(diag?.headroom ?? 0)} residents`,
        ],
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* what to suggest next                                                */
/* ------------------------------------------------------------------ */

export function suggestNext(ctx: CityAIContext): string[] {
  const out: string[] = []
  const diag = ctx.diagnosis
  const worst = diag?.bottlenecks[0]

  if (worst) {
    const byMetric: Partial<Record<string, string>> = {
      traffic: 'Fix downtown traffic',
      parking: 'Solve the parking shortage',
      education: 'Build another school',
      electricity: 'Reinforce the power grid',
      water: 'Expand water treatment',
      emissions: 'Reduce CO2',
      retail: 'Expand the economy',
      livability: 'Make this city more livable',
    }
    const s = byMetric[worst.metric]
    if (s) out.push(s)
  }

  if ((diag?.headroom ?? 0) < 4000) out.push('Add 5,000 residents')
  else out.push('Add 10,000 residents')

  if (ctx.sandbox?.mode === 'autonomous') {
    return ['Pause.', 'What should I build?', "I'll do it myself.", 'How is the city doing?']
  }
  if (ctx.sandbox && ctx.sandbox.health.score < 70) out.unshift('What should I build?')
  if (!out.some((s) => /CO2/i.test(s))) out.push('Reduce CO2 without hurting the economy')
  out.push('How is the city doing?')
  if (ctx.sandbox?.mode === 'human') out.push('Take control.')

  return [...new Set(out)].slice(0, 4)
}

/** kinds a "roads instead" style preference maps onto */
export const PREFER_BLUEPRINT: Partial<Record<InfraKind, string>> = {
  road_widening: 'roads',
  highway_link: 'roads',
  bridge: 'roads',
  intersection_upgrade: 'roads',
  transit_hub: 'transit',
  bus_route: 'transit',
  school: 'services',
  hospital: 'services',
  park: 'green',
  solar_farm: 'green',
  power_plant: 'utilities',
  water_facility: 'utilities',
  office: 'economy',
  shopping_district: 'economy',
  residential_tower: 'district',
  parking_garage: 'transit',
}
