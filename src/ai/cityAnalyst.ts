/**
 * cityAnalyst.ts — the "AI City Analyst".
 *
 * For the MVP this is 100% deterministic template logic: no network calls,
 * no API keys, fully reproducible. The `AnalystProvider` interface below is
 * the seam where a Claude / OpenAI / Gemini call would be dropped in later —
 * `buildAnalystContext()` already produces exactly the structured payload
 * such a model would be prompted with.
 */
import type { CityConfig } from '../simulation/config'
import type {
  City,
  DistrictId,
  DistrictLoad,
  MetricKey,
  PressureLevel,
  SimulationResult,
} from '../simulation/types'
import { PRESSURE_ORDER } from '../simulation/pressure'
import { DISTRICT_NAMES, delta, runSimulation } from '../simulation/citySimulation'
import { TEMPLATES, makeBuilding, takeSlots, withBuildings } from '../city/placement'

export interface AnalysisProblem {
  id: string
  title: string
  detail: string
  severity: PressureLevel
  metric: MetricKey
  district?: DistrictId
}

export interface Recommendation {
  id: string
  title: string
  detail: string
  impact: string
  /** what the UI should build if the user accepts the recommendation */
  action?: { template: keyof typeof TEMPLATES; count: number; district?: DistrictId }
}

export interface CityAnalysis {
  headline: string
  summary: string
  problems: AnalysisProblem[]
  recommendations: Recommendation[]
  /** 0..1 — how much the analyst trusts this read of the city */
  confidence: number
  affectedAreas: { district: DistrictId; name: string; reason: string; score: number }[]
}

export interface AnalystContext {
  city: City
  config: CityConfig
  current: SimulationResult
  baseline: SimulationResult
}

export interface AnalystAnswer {
  question: string
  answer: string
  bullets: string[]
  confidence: number
  followUps: string[]
  analysis?: CityAnalysis
}

/** The seam a real LLM would plug into. */
export interface AnalystProvider {
  readonly id: string
  analyse(ctx: AnalystContext): Promise<CityAnalysis> | CityAnalysis
  ask(question: string, ctx: AnalystContext): Promise<AnalystAnswer> | AnalystAnswer
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
const num = (v: number) => Math.round(v).toLocaleString('en-US')

function worstDistrict(districts: DistrictLoad[], layer: keyof DistrictLoad): DistrictLoad {
  return [...districts].sort((a, b) => Number(b[layer]) - Number(a[layer]))[0]
}

/** The structured payload a hosted LLM would receive as its prompt context. */
export function buildAnalystContext(ctx: AnalystContext) {
  const { current, baseline } = ctx
  return {
    disclaimer: 'Prototype simulation — illustrative estimates.',
    population: { now: current.population, baseline: baseline.population },
    metrics: Object.values(current.metrics).map((m) => ({
      key: m.key,
      label: m.label,
      value: m.value,
      unit: m.unit,
      utilisation: Number(m.utilisation.toFixed(3)),
      pressure: m.pressure,
      changePct: Number(delta(m.value, baseline.metrics[m.key].value).toFixed(2)),
      formula: m.formula,
    })),
    districts: current.districts,
    worstRoads: [...current.roads]
      .sort((a, b) => b.volumeCapacityRatio - a.volumeCapacityRatio)
      .slice(0, 5)
      .map((r) => ({ ...r, name: ctx.city.roads.find((x) => x.id === r.id)?.name })),
  }
}

/* ------------------------------------------------------------------ */
/* deterministic analyst                                               */
/* ------------------------------------------------------------------ */

const METRIC_LAYER: Partial<Record<MetricKey, keyof DistrictLoad>> = {
  traffic: 'traffic',
  electricity: 'electricity',
  water: 'water',
  retail: 'retail',
  education: 'education',
  parking: 'parking',
  emissions: 'emissions',
}

export function analyseCity(ctx: AnalystContext): CityAnalysis {
  const { current, baseline, city } = ctx
  const popDelta = current.population - baseline.population
  const grew = popDelta > 1

  // Only capacity-constrained infrastructure counts as a bottleneck. Retail
  // under-supply and operating cost are reported as opportunities/consequences
  // in the recommendations instead.
  const PROBLEM_KEYS: MetricKey[] = [
    'traffic',
    'electricity',
    'water',
    'education',
    'parking',
    'transit',
    'emissions',
  ]

  /** severity first, then how much *this scenario* moved the system */
  const score = (m: (typeof current.metrics)[MetricKey]) =>
    PRESSURE_ORDER[m.pressure] +
    Math.min(1, Math.abs(delta(m.value, baseline.metrics[m.key].value)) / 30)

  const ranked = Object.values(current.metrics)
    .filter((m) => m.key !== 'population' && m.key !== 'infrastructure')
    .sort((a, b) => score(b) - score(a) || b.utilisation - a.utilisation)

  const problems: AnalysisProblem[] = ranked
    .filter((m) => PROBLEM_KEYS.includes(m.key) && PRESSURE_ORDER[m.pressure] >= 2)
    .slice(0, 5)
    .map((m) => {
      const layer = METRIC_LAYER[m.key]
      const hot = layer ? worstDistrict(current.districts, layer) : undefined
      const change = delta(m.value, baseline.metrics[m.key].value)
      return {
        id: `problem-${m.key}`,
        title: `${m.label}: ${m.pressure}`,
        detail:
          `${(m.utilisation * 100).toFixed(0)}% of modelled capacity` +
          (Math.abs(change) > 0.4 ? ` · ${pct(change)} vs baseline` : '') +
          (hot ? ` · worst in ${hot.name}` : ''),
        severity: m.pressure,
        metric: m.key,
        district: hot?.id,
      }
    })

  /* ---- recommendations, ordered by how much relief they buy ---- */
  const recommendations: Recommendation[] = []
  const edu = current.metrics.education
  const park = current.metrics.parking
  const traf = current.metrics.traffic
  const ret = current.metrics.retail
  const pow = current.metrics.electricity
  const wat = current.metrics.water

  const schoolsNeeded = Math.max(
    0,
    Math.ceil(
      (current.raw.schoolSeatsNeeded / ctx.config.schoolTargetUtilisation - current.raw.schoolSeats) /
        ctx.config.schoolCapacity,
    ),
  )
  if (schoolsNeeded > 0) {
    const hot = worstDistrict(current.districts, 'education')
    recommendations.push({
      id: 'rec-school',
      title: `Add ${schoolsNeeded} school${schoolsNeeded > 1 ? 's' : ''}`,
      detail: `School utilisation is at ${(edu.utilisation * 100).toFixed(0)}%. ${hot.name} carries the largest catchment.`,
      impact: `+${num(schoolsNeeded * ctx.config.schoolCapacity)} seats · utilisation → ${(
        (current.raw.schoolSeatsNeeded /
          (current.raw.schoolSeats + schoolsNeeded * ctx.config.schoolCapacity)) *
        100
      ).toFixed(0)}%`,
      action: { template: 'school', count: schoolsNeeded, district: hot.id },
    })
  }

  const parkingShort = Math.max(0, current.raw.parkingDemand - current.raw.parkingSupply)
  if (parkingShort > 40) {
    const rounded = Math.round(parkingShort / 100) * 100
    const hot = worstDistrict(current.districts, 'parking')
    recommendations.push({
      id: 'rec-parking',
      title: `Add ${num(rounded)} parking spaces`,
      detail: `Demand exceeds supply by ${num(parkingShort)} spaces (${(park.utilisation * 100).toFixed(0)}% utilisation). ${hot.name} is the tightest.`,
      impact: `${Math.ceil(rounded / 935)} parking structure${rounded > 935 ? 's' : ''} clears the deficit`,
      action: { template: 'parking', count: Math.ceil(rounded / 935), district: hot.id },
    })
  }

  if (traf.utilisation > 0.72 || PRESSURE_ORDER[traf.pressure] >= 2) {
    recommendations.push({
      id: 'rec-transit',
      title: 'Increase public transit capacity',
      detail: `Peak load is ${num(traf.value)} veh/h against a modelled network capacity of ${num(
        current.raw.networkCapacity,
      )}. A transit hub shifts ~6% of car trips.`,
      impact: `Congestion index ${traf.utilisation.toFixed(2)} → ~${(traf.utilisation * 0.9).toFixed(2)}`,
      action: { template: 'transit_hub', count: 1 },
    })
  }

  const worstRoad = [...current.roads].sort(
    (a, b) => b.volumeCapacityRatio - a.volumeCapacityRatio,
  )[0]
  if (worstRoad && worstRoad.volumeCapacityRatio > 0.85) {
    const segment = city.roads.find((r) => r.id === worstRoad.id)
    recommendations.push({
      id: 'rec-road',
      title: 'Add a new road connection',
      detail: `${segment?.name ?? worstRoad.id} is running at V/C ${worstRoad.volumeCapacityRatio.toFixed(
        2,
      )} (${worstRoad.speedKph.toFixed(0)} km/h). A parallel link would redistribute the load.`,
      impact: 'Relieves the single worst corridor in the network',
    })
  }

  if (ret.utilisation > 0.95) {
    recommendations.push({
      id: 'rec-retail',
      title: 'Zone additional retail floor space',
      detail: `Retail demand of ${num(ret.value)} m² exceeds the ${num(
        current.raw.retailSupplySqm,
      )} m² supplied.`,
      impact: `~${Math.ceil((current.raw.retailDemandSqm - current.raw.retailSupplySqm) / 5200)} retail anchors close the gap`,
      action: { template: 'shop', count: 1 },
    })
  }

  if (pow.utilisation > 0.9) {
    recommendations.push({
      id: 'rec-grid',
      title: 'Reinforce the distribution grid',
      detail: `Peak demand reaches ${current.raw.peakDemandMw.toFixed(1)} MW against ${ctx.config.gridCapacityMw} MW of substation capacity.`,
      impact: 'Avoids peak-hour load shedding in the densest districts',
    })
  }

  if (wat.utilisation > 0.9) {
    recommendations.push({
      id: 'rec-water',
      title: 'Expand water treatment capacity',
      detail: `Demand is ${num(wat.value)} m³/day against a ${num(ctx.config.waterPlantCapacityM3Day)} m³/day plant.`,
      impact: 'Keeps headroom for summer peaks',
    })
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'rec-none',
      title: 'No intervention required',
      detail: 'Every modelled system is inside its planning threshold.',
      impact: 'Maintain current investment programme',
    })
  }

  /* ---- affected areas ---- */
  const affectedAreas = [...current.districts]
    .map((d) => {
      const score =
        d.traffic * 0.26 +
        d.parking * 0.22 +
        d.education * 0.2 +
        d.electricity * 0.12 +
        d.water * 0.1 +
        d.retail * 0.1
      const drivers: [string, number][] = [
        ['road congestion', d.traffic],
        ['parking', d.parking],
        ['school catchment', d.education],
        ['grid load', d.electricity],
        ['water', d.water],
        ['retail gap', d.retail],
      ]
      drivers.sort((a, b) => b[1] - a[1])
      return {
        district: d.id,
        name: d.name,
        reason: `${drivers[0][0]} and ${drivers[1][0]}`,
        score,
      }
    })
    .sort((a, b) => b.score - a.score)

  /* ---- narrative ---- */
  // For a growth scenario the interesting corridor is the one this change
  // loads the most, not simply the busiest one in the city today.
  const trafficRise = [...current.districts]
    .map((d) => ({
      d,
      rise: d.traffic - (baseline.districts.find((x) => x.id === d.id)?.traffic ?? 0),
    }))
    .sort((a, b) => b.rise - a.rise)[0]
  const trafficHot =
    grew && trafficRise && trafficRise.rise > 0.005
      ? trafficRise.d
      : worstDistrict(current.districts, 'traffic')
  const BOTTLENECK_NAME: Partial<Record<MetricKey, string>> = {
    education: 'school capacity',
    parking: 'parking',
    traffic: `the ${trafficHot.name.toLowerCase()} road network`,
    electricity: 'the electricity grid',
    water: 'water supply',
    emissions: 'emissions',
    transit: 'transit capacity',
  }
  const names = problems
    .slice(0, 3)
    .map((p) => BOTTLENECK_NAME[p.metric] ?? current.metrics[p.metric].label.toLowerCase())
  const namedBottlenecks =
    names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? ''

  const headline = grew
    ? `Adding ${num(popDelta)} residents takes the city to ${num(current.population)}.`
    : popDelta < -1
      ? `The city contracts to ${num(current.population)} residents.`
      : `${num(current.population)} residents — baseline conditions.`

  const summary = grew
    ? `Adding ${num(popDelta)} residents increases residential and retail demand significantly. ` +
      `Traffic rises ${pct(delta(current.metrics.traffic.value, baseline.metrics.traffic.value))}, ` +
      `electricity ${pct(delta(current.metrics.electricity.value, baseline.metrics.electricity.value))} and ` +
      `water ${pct(delta(current.metrics.water.value, baseline.metrics.water.value))}. ` +
      `The largest bottlenecks are ${namedBottlenecks || 'well distributed'}.` +
      (affectedAreas[0] ? ` ${affectedAreas[0].name} carries the highest combined pressure.` : '')
    : problems.length > 0
      ? `The city is stable at ${num(current.population)} residents, but ${problems.length} system${
          problems.length > 1 ? 's are' : ' is'
        } already running hot: ${namedBottlenecks}. ${affectedAreas[0].name} carries the highest combined pressure.`
      : `All modelled systems sit inside their planning thresholds at ${num(current.population)} residents.`

  /* ---- confidence: lower when several systems are past capacity (extrapolation) ---- */
  const overloaded = ranked.filter((m) => m.utilisation > 1).length
  const confidence = Math.max(0.42, Math.min(0.94, 0.9 - overloaded * 0.09 - (grew ? 0.04 : 0)))

  return { headline, summary, problems, recommendations, confidence, affectedAreas }
}

/* ------------------------------------------------------------------ */
/* natural-language question handling                                  */
/* ------------------------------------------------------------------ */

function hypothetical(ctx: AnalystContext, residents: number) {
  const capacity = residents / ctx.config.occupancyRate
  const towers = Math.max(1, Math.round(capacity / 420))
  const slots = takeSlots(ctx.city, towers, 'east')
  const added = slots.map((s, i) =>
    makeBuilding(TEMPLATES.residential_tower, s.x, s.z, s.district, {
      capacity: capacity / Math.max(1, slots.length),
      label: `Hypothetical Tower ${i + 1}`,
    }),
  )
  const city = withBuildings(ctx.city, added)
  return runSimulation(city, ctx.config)
}

const FOLLOW_UPS = [
  'What happens if I add 3,000 residents?',
  'Where should I build a new school?',
  'Which road is likely to become congested?',
  'What should I build next?',
  'How much would operating costs rise?',
]

export function answerQuestion(question: string, ctx: AnalystContext): AnalystAnswer {
  const q = question.toLowerCase().trim()
  const analysis = analyseCity(ctx)
  const base = { question, confidence: analysis.confidence, followUps: pickFollowUps(q) }

  /* --- "what happens if I add N residents" --- */
  const addMatch = q.match(/([\d][\d.,]*)\s*(k|thousand)?\s*(more\s+)?(residents|people|inhabitants)/)
  if (addMatch && /(add|more|extra|grow|build|what if|increase)/.test(q)) {
    let n = parseFloat(addMatch[1].replace(/,/g, ''))
    if (addMatch[2]) n *= 1000
    const sim = hypothetical(ctx, n)
    const d = (k: MetricKey) => pct(delta(sim.metrics[k].value, ctx.current.metrics[k].value))
    return {
      ...base,
      confidence: Math.min(base.confidence, 0.82),
      answer:
        `Adding ${num(n)} residents would take the city from ${num(ctx.current.population)} to ${num(
          sim.population,
        )}. Traffic ${d('traffic')}, electricity ${d('electricity')}, water ${d('water')} and retail demand ${d(
          'retail',
        )}. School capacity would reach ${(sim.metrics.education.utilisation * 100).toFixed(
          0,
        )}% (${sim.metrics.education.pressure}) and parking ${(
          sim.metrics.parking.utilisation * 100
        ).toFixed(0)}% (${sim.metrics.parking.pressure}).`,
      bullets: [
        `Population ${num(ctx.current.population)} → ${num(sim.population)}`,
        `Peak traffic ${d('traffic')} · congestion index ${sim.raw.congestionIndex.toFixed(2)}`,
        `Electricity ${d('electricity')} · peak ${sim.raw.peakDemandMw.toFixed(1)} MW`,
        `Water ${d('water')} · ${num(sim.raw.waterM3Day)} m³/day`,
        `Parking deficit ${num(Math.max(0, sim.raw.parkingDemand - sim.raw.parkingSupply))} spaces`,
        `Operating cost ${pct(delta(sim.raw.annualOperatingCost, ctx.current.raw.annualOperatingCost))}`,
      ],
    }
  }

  /* --- "where should I build a school" --- */
  if (/school|education|classroom|student/.test(q)) {
    const hot = worstDistrict(ctx.current.districts, 'education')
    const need = Math.max(
      0,
      Math.ceil(
        (ctx.current.raw.schoolSeatsNeeded / ctx.config.schoolTargetUtilisation -
          ctx.current.raw.schoolSeats) /
          ctx.config.schoolCapacity,
      ),
    )
    return {
      ...base,
      answer:
        need > 0
          ? `Build in ${hot.name}. It has the highest student-to-seat ratio in the city and ${num(
              hot.residents,
            )} residents inside the catchment. The city needs ${need} additional school${
              need > 1 ? 's' : ''
            } to bring utilisation back under ${(ctx.config.schoolTargetUtilisation * 100).toFixed(0)}%.`
          : `No new school is needed yet — utilisation is ${(
              ctx.current.metrics.education.utilisation * 100
            ).toFixed(0)}%. If you do build, ${hot.name} has the tightest catchment.`,
      bullets: [
        `Students ${num(ctx.current.students)} · seats ${num(ctx.current.raw.schoolSeats)}`,
        `Utilisation ${(ctx.current.metrics.education.utilisation * 100).toFixed(0)}% (${ctx.current.metrics.education.pressure})`,
        `Highest pressure district: ${hot.name}`,
        `Each school adds ${ctx.config.schoolCapacity} seats and ${ctx.config.schoolCapacity / ctx.config.classSize < 1 ? 1 : Math.round(ctx.config.schoolCapacity / ctx.config.classSize)} classrooms`,
      ],
    }
  }

  /* --- "which road will be congested" --- */
  if (/road|congest|traffic|corridor|junction|intersection|street/.test(q)) {
    const sorted = [...ctx.current.roads].sort(
      (a, b) => b.volumeCapacityRatio - a.volumeCapacityRatio,
    )
    const names = sorted
      .slice(0, 3)
      .map((r) => ctx.city.roads.find((x) => x.id === r.id)?.name ?? r.id)
    const hot = worstDistrict(ctx.current.districts, 'traffic')
    return {
      ...base,
      answer: `${names[0]} is the first corridor to fail, at V/C ${sorted[0].volumeCapacityRatio.toFixed(
        2,
      )} and ${sorted[0].speedKph.toFixed(0)} km/h in the peak hour. ${hot.name} carries the highest average network load. City-wide the congestion index is ${ctx.current.raw.congestionIndex.toFixed(
        2,
      )} with an average speed of ${ctx.current.raw.averageSpeedKph.toFixed(0)} km/h.`,
      bullets: sorted.slice(0, 4).map((r, i) => {
        const nm = ctx.city.roads.find((x) => x.id === r.id)?.name ?? r.id
        return `${i + 1}. ${nm} — V/C ${r.volumeCapacityRatio.toFixed(2)} (${r.level})`
      }),
    }
  }

  /* --- "what should I build next" --- */
  if (/what.*(build|do|next)|recommend|advice|suggest|priorit/.test(q)) {
    return {
      ...base,
      answer: `${analysis.recommendations[0].title}. ${analysis.recommendations[0].detail}`,
      bullets: analysis.recommendations
        .slice(0, 4)
        .map((r, i) => `${i + 1}. ${r.title} — ${r.impact}`),
      analysis,
    }
  }

  /* --- cost --- */
  if (/cost|budget|expensive|money|spend|opex/.test(q)) {
    const c = ctx.current.raw.annualOperatingCost
    const b = ctx.baseline.raw.annualOperatingCost
    return {
      ...base,
      answer: `Modelled municipal operating cost is $${(c / 1e6).toFixed(
        1,
      )}M per year (${pct(delta(c, b))} vs baseline), which is $${num(
        c / Math.max(1, ctx.current.population),
      )} per resident. Education and general services dominate the increase.`,
      bullets: [
        `Total opex $${(c / 1e6).toFixed(1)}M/yr`,
        `Per resident $${num(c / Math.max(1, ctx.current.population))}`,
        `Students ${num(ctx.current.students)} × $${num(ctx.config.schoolCostPerStudentYear)}/yr`,
        `Change vs baseline ${pct(delta(c, b))}`,
      ],
    }
  }

  /* --- energy / water / emissions / parking / retail quick reads --- */
  const lookups: [RegExp, MetricKey][] = [
    [/electric|energy|power|grid|kwh/, 'electricity'],
    [/water|sewage|wastewater/, 'water'],
    [/co2|carbon|emission|climate/, 'emissions'],
    [/park(ing)?\s*(space|garage|pressure|demand)?/, 'parking'],
    [/retail|shop|commerce|store/, 'retail'],
    [/transit|bus|metro|public transport/, 'transit'],
  ]
  for (const [re, key] of lookups) {
    if (re.test(q)) {
      const m = ctx.current.metrics[key]
      const layer = METRIC_LAYER[key]
      const hot = layer ? worstDistrict(ctx.current.districts, layer) : undefined
      return {
        ...base,
        answer: `${m.label} is at ${num(m.value)} ${m.unit}, ${(m.utilisation * 100).toFixed(
          0,
        )}% of modelled capacity — ${m.pressure}. ${pct(
          delta(m.value, ctx.baseline.metrics[key].value),
        )} against the baseline city.${hot ? ` Highest pressure in ${hot.name}.` : ''}`,
        bullets: [m.detail, `Formula: ${m.formula}`, `Pressure level: ${m.pressure}`],
      }
    }
  }

  /* --- fallback: give the standing analysis --- */
  return {
    ...base,
    answer: analysis.summary,
    bullets: analysis.problems.map((p) => `${p.title} — ${p.detail}`),
    analysis,
  }
}

function pickFollowUps(q: string) {
  return FOLLOW_UPS.filter((f) => !q.includes(f.toLowerCase().slice(0, 12))).slice(0, 3)
}

/* ------------------------------------------------------------------ */

export const deterministicAnalyst: AnalystProvider = {
  id: 'deterministic-v1',
  analyse: analyseCity,
  ask: answerQuestion,
}

/**
 * Swap this for an LLM-backed provider later, e.g.
 *
 *   export const analyst = createClaudeAnalyst({ apiKey, model: 'claude-opus-5' })
 *
 * The rest of the app only ever touches `analyst.analyse` / `analyst.ask`.
 */
export const analyst: AnalystProvider = deterministicAnalyst
