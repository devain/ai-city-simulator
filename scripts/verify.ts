import { DEFAULT_CONFIG } from '../src/simulation/config'
import { generateCity } from '../src/city/generateCity'
import { runSimulation, delta } from '../src/simulation/citySimulation'
import { applyScenario } from '../src/simulation/scenarios'
import { analyseCity } from '../src/ai/cityAnalyst'

const cfg = DEFAULT_CONFIG
const city = generateCity(cfg)
const base = runSimulation(city, cfg)

const counts: Record<string, number> = {}
for (const b of city.buildings) counts[b.type] = (counts[b.type] || 0) + 1
console.log('--- CITY ---')
console.log('buildings', city.buildings.length, counts)
console.log('roads', city.roads.length, 'intersections', city.intersections.length, 'freeSlots', city.freeSlots.length)

console.log('--- BASELINE ---')
for (const m of Object.values(base.metrics)) {
  console.log(
    m.label.padEnd(24),
    Math.round(m.value).toLocaleString().padStart(12),
    m.unit.padEnd(12),
    (m.utilisation * 100).toFixed(0).padStart(4) + '%',
    m.pressure,
  )
}
console.log('vehicles', Math.round(base.vehicles), 'jobs', Math.round(base.jobs), 'students', Math.round(base.students))

const city5 = applyScenario(city, 'add_5000')
const sim5 = runSimulation(city5, cfg)
console.log('--- +5,000 RESIDENTS ---')
console.log('population', Math.round(base.population), '->', Math.round(sim5.population))
for (const k of ['traffic','electricity','water','retail','emissions','cost'] as const) {
  console.log(k.padEnd(14), delta(sim5.metrics[k].value, base.metrics[k].value).toFixed(1) + '%')
}
console.log('school ', (sim5.metrics.education.utilisation*100).toFixed(0)+'%', sim5.metrics.education.pressure)
console.log('parking', (sim5.metrics.parking.utilisation*100).toFixed(0)+'%', sim5.metrics.parking.pressure)
console.log('traffic', (sim5.metrics.traffic.utilisation*100).toFixed(0)+'%', sim5.metrics.traffic.pressure)

const a = analyseCity({ city: city5, config: cfg, current: sim5, baseline: base })
console.log('--- ANALYSIS ---')
console.log(a.summary)
a.recommendations.forEach((r, i) => console.log(`${i + 1}. ${r.title} :: ${r.impact}`))
console.log('confidence', a.confidence.toFixed(2))
console.log('areas', a.affectedAreas.map((x) => `${x.name} ${(x.score*100).toFixed(0)}`).join(' | '))

for (const s of ['add_1000','add_10000','shopping_district','new_school','transit_hub','residential_tower'] as const) {
  const c = applyScenario(city, s)
  const r = runSimulation(c, cfg)
  console.log(s.padEnd(20), 'pop', Math.round(r.population).toString().padStart(6),
    'traffic', delta(r.metrics.traffic.value, base.metrics.traffic.value).toFixed(1)+'%',
    'infra', (r.metrics.infrastructure.utilisation*100).toFixed(0)+'%')
}

console.log('--- DISTRICT TRAFFIC ---')
for (const d of sim5.districts) {
  const b0 = base.districts.find((x) => x.id === d.id)!
  console.log(d.name.padEnd(16), 'base', (b0.traffic*100).toFixed(0).padStart(3), '-> now', (d.traffic*100).toFixed(0).padStart(3))
}
const worstRoads = [...sim5.roads].sort((a,b)=>b.volumeCapacityRatio-a.volumeCapacityRatio).slice(0,4)
console.log('--- WORST ROADS ---')
for (const r of worstRoads) console.log((city5.roads.find(x=>x.id===r.id)?.name ?? r.id).padEnd(28), r.volumeCapacityRatio.toFixed(2), r.level)
const a2 = analyseCity({ city: city5, config: cfg, current: sim5, baseline: base })
console.log('SUMMARY>', a2.summary)
