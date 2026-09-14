/**
 * Phase 5 headless check — the sandbox model layer, without a browser.
 *
 *   npm run verify:sandbox
 *
 * Runs the finance, health, demand, population and priority models against the
 * generated city, then drives the autonomous agent through ten simulated years
 * so its decision loop, budget discipline and adaptation can be read as text.
 */
import { DEFAULT_CONFIG, type CityConfig } from '../src/simulation/config'
import { generateCity } from '../src/city/generateCity'
import { runSimulation } from '../src/simulation/citySimulation'
import { applyDelta } from '../src/city/infrastructure'
import { cityFinance } from '../src/sandbox/finance'
import { cityHealth } from '../src/sandbox/health'
import { cityDemand } from '../src/sandbox/demand'
import { populationPressure, stepOccupancy } from '../src/sandbox/population'
import { configWithEvents, eventDueAt, type ActiveEvent } from '../src/sandbox/events'
import { cityPriorities } from '../src/ai/CityPriorities'
import { adviseCity } from '../src/ai/CityAdvisor'
import { AGENT_OBJECTIVES, decide, spendableBy } from '../src/ai/AutonomousCityAgent'
import { CATALOGUE, LINEAR } from '../src/sandbox/catalogue'
import { tickToDate } from '../src/sandbox/history'
import type { City } from '../src/simulation/types'

const t0 = Date.now()
const money = (v: number) =>
  Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v).toLocaleString('en-US')}`
const n = (v: number) => Math.round(v).toLocaleString('en-US')
const pct = (v: number) => `${Math.round(v * 100)}%`

const baseConfig: CityConfig = { ...DEFAULT_CONFIG }
let city: City = generateCity(baseConfig)
let config = baseConfig
let result = runSimulation(city, config)

/* ------------------------------------------------------------------ */
console.log('\n=== CATALOGUE ===\n')
console.log(`${CATALOGUE.length} placeable structures · ${LINEAR.length} linear items`)
const cats = new Map<string, number>()
for (const c of CATALOGUE) cats.set(c.category, (cats.get(c.category) ?? 0) + 1)
for (const l of LINEAR) cats.set(l.category, (cats.get(l.category) ?? 0) + 1)
console.log([...cats.entries()].map(([k, v]) => `${k} ${v}`).join(' · '))

/* ------------------------------------------------------------------ */
console.log('\n=== OPENING BOOKS ===\n')
let finance = cityFinance(city, result)
console.log(`Revenue          ${money(finance.annualRevenue)}/yr`)
for (const l of finance.revenue) console.log(`  ${l.label.padEnd(22)} ${money(l.amount).padStart(9)}  ${l.detail}`)
console.log(`Operating cost   ${money(finance.annualOperatingCost)}/yr`)
for (const l of finance.costs) console.log(`  ${l.label.padEnd(22)} ${money(l.amount).padStart(9)}  ${l.detail}`)
console.log(`NET              ${finance.netIncome >= 0 ? '+' : '−'}${money(Math.abs(finance.netIncome))}/yr · margin ${(finance.margin * 100).toFixed(1)}%`)

/* ------------------------------------------------------------------ */
console.log('\n=== CITY HEALTH ===\n')
let health = cityHealth(result, finance)
console.log(`${health.score}/100 — ${health.status}`)
for (const c of health.components) {
  console.log(`  ${c.label.padEnd(16)} ${String(c.score).padStart(3)}  ×${c.weight}  ${c.detail}`)
}
console.log(`weakest: ${health.weakest.label} · strongest: ${health.strongest.label}`)

/* ------------------------------------------------------------------ */
console.log('\n=== DEMAND ===\n')
for (const d of cityDemand(city, result)) {
  const bar = '█'.repeat(Math.round(Math.min(1, d.value) * 10)).padEnd(10, '░')
  console.log(`  ${d.label.padEnd(13)} ${bar} ${pct(d.value).padStart(4)}  ${d.detail}`)
}

/* ------------------------------------------------------------------ */
console.log('\n=== PRIORITIES ===\n')
let priorities = cityPriorities(city, result, finance, health)
for (const p of priorities.slice(0, 6)) {
  console.log(`  ${p.label.padEnd(16)} ${p.level.padEnd(8)} ${String(p.urgency).padStart(3)}  ${p.reading}`)
}

/* ------------------------------------------------------------------ */
console.log('\n=== ADVISOR (AI ASSIST) ===\n')
const advice = adviseCity({ city, config, current: result, priorities, treasury: 100_000_000, dismissed: [] })
if (advice) {
  console.log(`  [${advice.severity}] ${advice.title} — ${advice.reading}`)
  console.log(`  → ${advice.recommendation}`)
  console.log(`     cost ${money(advice.capex)} · upkeep ${money(advice.opex)}/yr · health ${advice.healthDelta! >= 0 ? '+' : ''}${advice.healthDelta}`)
  if (advice.outcome) console.log(`     expected: ${advice.outcome}`)
} else {
  console.log('  nothing worth saying — the city is inside every threshold')
}

/* ------------------------------------------------------------------ */
console.log('\n=== AUTONOMOUS AGENT · 10 SIMULATED YEARS ===\n')

const objective = AGENT_OBJECTIVES.grow
let treasury = 100_000_000
const reserve = 5_000_000
let occupancy = config.occupancyRate
let activeEvents: ActiveEvent[] = []
const built: Record<string, number> = {}
const recentDistricts: Record<string, ('central' | 'north' | 'east' | 'south' | 'west')[]> = {}
let holds = 0

console.log(`objective: "${objective.phrase}"`)
console.log(`start: ${n(result.population)} residents · health ${health.score} · ${money(treasury)}\n`)

for (let tick = 1; tick <= 120; tick++) {
  /* weather */
  activeEvents = activeEvents.filter((e) => e.endsTick > tick)
  const due = eventDueAt(config.seed, tick)
  if (due && !activeEvents.some((e) => e.spec.id === due.id)) {
    activeEvents = [...activeEvents, { spec: due, startedTick: tick, endsTick: tick + due.months }]
    const { year, month } = tickToDate(tick)
    console.log(`  Y${year}M${month}  ⚠ EVENT  ${due.name} (${due.months} months) — ${due.response}`)
  }

  /* population responds */
  const pressure = populationPressure(result, occupancy, result.raw.livabilityIndex)
  occupancy = stepOccupancy(occupancy, pressure)
  config = { ...configWithEvents(baseConfig, activeEvents), occupancyRate: occupancy }
  result = runSimulation(city, config)

  /* books */
  finance = cityFinance(city, result)
  treasury = Math.max(0, treasury + finance.netIncome / 12)
  health = cityHealth(result, finance)
  priorities = cityPriorities(city, result, finance, health)

  /* the agent's turn */
  const d = decide({
    city,
    config,
    current: result,
    priorities,
    objective,
    treasury,
    reserve,
    recentDistricts,
    health: health.score,
  })

  if (d.kind === 'build' && d.plan && d.item) {
    const { year, month } = tickToDate(tick)
    city = applyDelta(city, d.plan.delta)
    treasury -= d.item.capex
    built[d.item.name] = (built[d.item.name] ?? 0) + 1
    if (d.slot) {
      recentDistricts[d.item.id] = [...(recentDistricts[d.item.id] ?? []), d.slot.district].slice(-2)
    }
    result = runSimulation(city, config)
    console.log(
      `  Y${year}M${month}  BUILD    ${d.item.name.padEnd(20)} ${money(d.item.capex).padStart(7)}  ` +
        `${d.priority!.label} ${d.priority!.urgency}/100 → health ${d.healthDelta >= 0 ? '+' : ''}${d.healthDelta}`,
    )
  } else {
    holds++
  }

  if (treasury < 0) throw new Error('agent overspent — budget rule violated')
  if (treasury < reserve && d.kind === 'build') {
    throw new Error('agent dipped into the emergency reserve')
  }
}

finance = cityFinance(city, result)
health = cityHealth(result, finance)

console.log(`\n  held ${holds} of 120 months rather than build for the sake of it`)
console.log('\n--- YEAR 10 ---')
console.log(`  Population   ${n(result.population)}`)
console.log(`  City health  ${health.score}/100 — ${health.status}`)
console.log(`  Treasury     ${money(treasury)}`)
console.log(`  Net income   ${finance.netIncome >= 0 ? '+' : '−'}${money(Math.abs(finance.netIncome))}/yr`)
console.log(`  Traffic      ${pct(result.metrics.traffic.utilisation)}`)
console.log(`  CO₂/head     ${n(result.raw.co2PerCapitaKgYear)} kg/yr`)
console.log(`  Economy      ${money(result.raw.grossValueAdded)}`)
console.log(`  Built        ${Object.entries(built).map(([k, v]) => `${v}× ${k}`).join(' · ') || 'nothing'}`)
console.log(`  Spendable    ${money(spendableBy(treasury, reserve))} (reserve ${money(reserve)} untouched)`)

/* ------------------------------------------------------------------ */
console.log('\n=== DETERMINISM ===\n')
const a = Array.from({ length: 120 }, (_, i) => eventDueAt(baseConfig.seed, i + 1)?.id ?? '-')
const b = Array.from({ length: 120 }, (_, i) => eventDueAt(baseConfig.seed, i + 1)?.id ?? '-')
console.log(`  event schedule reproducible: ${a.join() === b.join() ? 'YES' : 'NO'}`)
console.log(`  events in 10 years: ${a.filter((x) => x !== '-').length}`)

console.log(`\ntotal time ${Date.now() - t0} ms\n`)
