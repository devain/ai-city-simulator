/**
 * ObjectiveParser — turns a plain-English city request into a structured
 * objective plus constraints.
 *
 * Deterministic by design for the MVP: no API key, no network, reproducible.
 * `parseRequest` has exactly the shape an LLM-backed parser would have, so the
 * implementation can be swapped without touching a single caller.
 */
import type { MetricKey } from '../simulation/types'
import type {
  CityConstraint,
  CityObjective,
  ObjectiveId,
  ParsedRequest,
  ScoreWeights,
} from './types'

const W = (w: Partial<ScoreWeights>): ScoreWeights => ({
  capacity: 0,
  traffic: 0,
  education: 0,
  parking: 0,
  energy: 0,
  water: 0,
  emissions: 0,
  economy: 0,
  quality: 0,
  cost: 0,
  ...w,
})

export const OBJECTIVES: Record<ObjectiveId, CityObjective> = {
  balanced: {
    id: 'balanced',
    label: 'Balance the entire city',
    short: 'Balanced',
    icon: '◎',
    description: 'Relieve whatever is under the most pressure, without overspending.',
    weights: W({
      capacity: 0.16,
      traffic: 0.16,
      education: 0.12,
      parking: 0.12,
      energy: 0.08,
      water: 0.06,
      emissions: 0.08,
      economy: 0.06,
      quality: 0.1,
      cost: 0.06,
    }),
    focus: [],
  },
  population: {
    id: 'population',
    label: 'Support population growth',
    short: 'Population',
    icon: '⇧',
    description: 'Make room for more residents without breaking any system.',
    weights: W({
      capacity: 0.4,
      traffic: 0.13,
      education: 0.12,
      parking: 0.11,
      energy: 0.05,
      water: 0.04,
      emissions: 0.02,
      economy: 0.04,
      quality: 0.05,
      cost: 0.04,
    }),
    focus: ['population'],
  },
  traffic: {
    id: 'traffic',
    label: 'Minimise traffic',
    short: 'Traffic',
    icon: '⇄',
    description: 'Cut congestion and delay across the network.',
    weights: W({
      capacity: 0.08,
      traffic: 0.42,
      education: 0.03,
      parking: 0.15,
      energy: 0.02,
      water: 0.02,
      emissions: 0.08,
      economy: 0.03,
      quality: 0.11,
      cost: 0.06,
    }),
    focus: ['traffic', 'parking'],
  },
  cost: {
    id: 'cost',
    label: 'Minimise infrastructure cost',
    short: 'Cost',
    icon: '$',
    description: 'Buy the most relief per dollar and leave budget on the table.',
    weights: W({
      capacity: 0.12,
      traffic: 0.12,
      education: 0.08,
      parking: 0.08,
      energy: 0.04,
      water: 0.04,
      emissions: 0.04,
      economy: 0.04,
      quality: 0.06,
      cost: 0.38,
    }),
    focus: ['cost'],
  },
  quality: {
    id: 'quality',
    label: 'Improve quality of life',
    short: 'Quality',
    icon: '❖',
    description: 'Green space, schools, walkable amenities and calm streets.',
    weights: W({
      capacity: 0.06,
      traffic: 0.14,
      education: 0.16,
      parking: 0.06,
      energy: 0.03,
      water: 0.04,
      emissions: 0.11,
      economy: 0.04,
      quality: 0.32,
      cost: 0.04,
    }),
    focus: ['livability', 'education'],
  },
  co2: {
    id: 'co2',
    label: 'Reduce CO₂',
    short: 'CO₂',
    icon: '☘',
    description: 'Decarbonise generation and shift trips out of cars.',
    weights: W({
      capacity: 0.05,
      traffic: 0.14,
      education: 0.03,
      parking: 0.03,
      energy: 0.1,
      water: 0.02,
      emissions: 0.4,
      economy: 0.05,
      quality: 0.13,
      cost: 0.05,
    }),
    focus: ['emissions'],
  },
  economy: {
    id: 'economy',
    label: 'Maximise economic activity',
    short: 'Economy',
    icon: '▲',
    description: 'Add jobs, retail and the capacity to serve them.',
    weights: W({
      capacity: 0.12,
      traffic: 0.1,
      education: 0.05,
      parking: 0.08,
      energy: 0.05,
      water: 0.03,
      emissions: 0.02,
      economy: 0.4,
      quality: 0.09,
      cost: 0.06,
    }),
    focus: ['economy', 'retail'],
  },
}

export const OBJECTIVE_LIST = Object.values(OBJECTIVES)

/* ------------------------------------------------------------------ */

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  ten: 10,
  twenty: 20,
  fifty: 50,
  hundred: 100,
}

/** Pull "5,000" / "5k" / "twenty thousand" out of a phrase. */
function readNumber(raw: string): number | null {
  const compact = raw.match(/([\d][\d.,]*)\s*(k|m|thousand|million)?/i)
  if (compact) {
    let n = parseFloat(compact[1].replace(/,/g, ''))
    const suffix = (compact[2] ?? '').toLowerCase()
    if (suffix === 'k' || suffix === 'thousand') n *= 1_000
    if (suffix === 'm' || suffix === 'million') n *= 1_000_000
    if (!Number.isNaN(n)) return n
  }
  const words = raw.toLowerCase().match(/(one|two|three|four|five|ten|twenty|fifty|hundred)\s+thousand/)
  if (words) return (NUMBER_WORDS[words[1]] ?? 1) * 1000
  return null
}

function readBudget(text: string): number | null {
  const m = text.match(/\$\s*([\d][\d.,]*)\s*(k|m|b|million|billion|thousand)?/i)
  if (!m) return null
  let n = parseFloat(m[1].replace(/,/g, ''))
  const suffix = (m[2] ?? '').toLowerCase()
  if (suffix === 'k' || suffix === 'thousand') n *= 1_000
  else if (suffix === 'm' || suffix === 'million') n *= 1_000_000
  else if (suffix === 'b' || suffix === 'billion') n *= 1_000_000_000
  else if (n < 1000) n *= 1_000_000 // "$50" in a planning context means $50M
  return Number.isNaN(n) ? null : n
}

interface Rule {
  id: ObjectiveId
  test: RegExp
  focus?: MetricKey[]
}

const RULES: Rule[] = [
  { id: 'population', test: /\b(residents?|people|population|inhabitants?|grow|growth|growing|housing|homes?|dwellings?|absorb)\b/ },
  { id: 'traffic', test: /\b(traffic|congestion|congested|gridlock|commutes?|jams?|roads?|corridors?)\b/, focus: ['traffic'] },
  { id: 'co2', test: /\b(co2|carbon|emissions?|climate|greenhouse|decarbonise|decarbonize|pollution)\b/, focus: ['emissions'] },
  { id: 'quality', test: /\b(livable|liveable|livability|liveability|quality of life|nicer|wellbeing|green space|parks?)\b/, focus: ['livability'] },
  { id: 'economy', test: /\b(economy|economic|jobs?|business|businesses|retail|commercial|gdp|investment|prosperity)\b/, focus: ['economy'] },
  { id: 'cost', test: /\b(cheap|cheaper|costs?|budget|afford|affordable|savings?|spend less)\b/, focus: ['cost'] },
  { id: 'quality', test: /\b(schools?|students?|education|classrooms?|teachers?)\b/, focus: ['education'] },
  { id: 'traffic', test: /\b(parking|garages?)\b/, focus: ['parking'] },
  { id: 'balanced', test: /\b(balance|balanced|overall|everything|whole city|general)\b/ },
]

/** Blend two objectives, e.g. "reduce CO2 without hurting the economy". */
function blend(a: CityObjective, b: CityObjective, bShare = 0.35): ScoreWeights {
  const out = { ...a.weights }
  for (const k of Object.keys(out) as (keyof ScoreWeights)[]) {
    out[k] = a.weights[k] * (1 - bShare) + b.weights[k] * bShare
  }
  return out
}

export function parseRequest(
  raw: string,
  fallback: { objective: CityObjective; budget: number },
): ParsedRequest {
  const text = raw.toLowerCase().trim()
  const hits: Rule[] = RULES.filter((r) => r.test.test(text))

  let objective: CityObjective = hits.length > 0 ? { ...OBJECTIVES[hits[0].id] } : { ...fallback.objective }
  const focus = new Set<MetricKey>(objective.focus)
  for (const h of hits) (h.focus ?? []).forEach((f) => focus.add(f))

  // "X without hurting Y" / "X but keep Y" — blend the two objectives
  const secondary = hits.slice(1).find((h) => h.id !== objective.id)
  if (secondary && /\b(without|but|while|keep|maintain|and still)\b/.test(text)) {
    objective = {
      ...objective,
      weights: blend(OBJECTIVES[objective.id], OBJECTIVES[secondary.id]),
      label: `${OBJECTIVES[objective.id].label} · protect ${OBJECTIVES[secondary.id].short.toLowerCase()}`,
    }
  }

  // population target: "support 5,000 additional residents", "prepare for 20,000 new residents"
  let populationTarget: number | undefined
  const popPhrase = text.match(
    /(?:add|support|absorb|house|prepare (?:the city )?for|room for|fit|handle|grow by|plus)\s+(?:up to\s+)?([\d][\d.,]*\s*(?:k|m|thousand|million)?)/,
  )
  const popTrailing = text.match(/([\d][\d.,]*\s*(?:k|thousand)?)\s+(?:additional|more|new|extra)?\s*(?:residents|people|inhabitants)/)
  const found = popPhrase?.[1] ?? popTrailing?.[1]
  if (found && /\b(residents?|people|inhabitants?|population|grow|growth)\b/.test(text)) {
    const n = readNumber(found)
    if (n && n >= 100 && n <= 200_000) {
      populationTarget = Math.round(n)
      objective = { ...OBJECTIVES.population, weights: objective.weights, focus: objective.focus }
      if (hits[0]?.id !== 'population') objective.weights = blend(OBJECTIVES.population, objective, 0.3)
    }
  }

  const budget = readBudget(raw)
  const constraint: CityConstraint = {
    budget: budget ?? fallback.budget,
    budgetFromRequest: budget != null,
  }

  const result: CityObjective = {
    ...objective,
    focus: [...focus],
    populationTarget,
  }

  const bits: string[] = [result.label]
  if (populationTarget) bits.push(`target +${populationTarget.toLocaleString('en-US')} residents`)
  bits.push(`budget $${(constraint.budget / 1e6).toFixed(0)}M`)

  return {
    raw,
    objective: result,
    constraint,
    interpretation: bits.join(' · '),
    matched: hits.length > 0 || populationTarget != null || budget != null,
  }
}
