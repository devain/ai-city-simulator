import { DEFAULT_CONFIG } from '../src/simulation/config'
import { generateCity } from '../src/city/generateCity'
import { runSimulation } from '../src/simulation/citySimulation'
import { planner } from '../src/ai/CityAIPlanner'
import { OBJECTIVES } from '../src/ai/ObjectiveParser'
import { applyDelta } from '../src/city/infrastructure'
import { buildReport } from '../src/ai/OptimizationEngine'

const cfg = DEFAULT_CONFIG
const city = generateCity(cfg)
const current = runSimulation(city, cfg)

const t0 = Date.now()
const parsed = planner.parse('I need this city to support 5,000 additional residents.', {
  objective: OBJECTIVES.balanced,
  budget: 50_000_000,
})
console.log('--- PARSE ---')
console.log('objective:', parsed.objective.id, '| target:', parsed.objective.populationTarget, '| budget:', parsed.constraint.budget)
console.log('interpretation:', parsed.interpretation)

const diagnosis = planner.diagnose({ city, config: cfg, current })
console.log('\n--- DIAGNOSIS ---')
console.log('status', diagnosis.status, '| headroom', diagnosis.headroom, '| binding', diagnosis.bindingConstraint)
console.log(diagnosis.headline)
for (const b of diagnosis.bottlenecks) console.log(' -', b.label, (b.utilisation*100).toFixed(0)+'%', b.pressure, '·', b.district)

const run = planner.plan({ city, config: cfg, current, objective: parsed.objective, constraint: parsed.constraint }, diagnosis)
console.log('\n--- PLANS --- (' + (Date.now()-t0) + 'ms)')
for (const p of run.plans) {
  console.log(`\n[${p.code}] ${p.name}  $${(p.capex/1e6).toFixed(1)}M  score ${p.score}  budget:${p.withinBudget} target:${p.meetsTarget} trimmed:${p.trimmed}`)
  console.log('    steps:', p.steps.map(s=>s.label).join(', '))
  console.log('    capacity +' + p.outcome.capacityGain, '| traffic', p.outcome.traffic.toFixed(1)+'%',
    '| school', p.outcome.education.toFixed(1)+'%', '| parking', p.outcome.parking.toFixed(1)+'%',
    '| energy', p.outcome.electricity.toFixed(1)+'%', '| co2', p.outcome.emissions.toFixed(1)+'%',
    '| qol', p.outcome.quality.toFixed(1)+'%', '| econ', p.outcome.economy.toFixed(1)+'%')
}
console.log('\n--- DECISION ---')
console.log('recommended:', run.decision.recommended?.code, run.decision.recommended?.name)
console.log('confidence:', (run.decision.confidence*100).toFixed(0)+'%')
console.log('why:', run.decision.why)
run.decision.notes.forEach(n=>console.log('note:', n))

const best = run.decision.recommended!
const after = runSimulation(applyDelta(city, best.delta), cfg)
const report = buildReport(best, current, after, best.outcome.capacityGain)
console.log('\n--- REPORT ---')
for (const r of report.rows) {
  console.log(r.label.padEnd(20), r.beforePct.toFixed(1).padStart(9), '->', r.afterPct.toFixed(1).padStart(9),
    (r.changePct>0?'+':'')+r.changePct.toFixed(1)+'%')
}
console.log('headline:', report.headline.join(' · '))

console.log('\n--- OTHER OBJECTIVES ---')
for (const id of ['traffic','co2','economy','quality','cost'] as const) {
  const d2 = planner.diagnose({ city, config: cfg, current })
  const r2 = planner.plan({ city, config: cfg, current, objective: OBJECTIVES[id], constraint: { budget: 50_000_000 } }, d2)
  console.log(id.padEnd(9), '->', r2.decision.recommended?.name, 'score', r2.decision.recommended?.score,
    '$'+((r2.decision.recommended?.capex ?? 0)/1e6).toFixed(1)+'M', '| plans:', r2.plans.map(p=>p.code+':'+p.score).join(' '))
}

console.log('\n--- BUDGET CONSTRAINT ($10M) ---')
const r3 = planner.plan({ city, config: cfg, current, objective: parsed.objective, constraint: { budget: 10_000_000 } }, diagnosis)
console.log('recommended:', r3.decision.recommended?.code, '$'+((r3.decision.recommended?.capex ?? 0)/1e6).toFixed(1)+'M',
  'meetsTarget:', r3.decision.recommended?.meetsTarget, 'constrained:', r3.decision.budgetConstrained)
r3.decision.notes.forEach(n=>console.log('note:', n))
console.log('total time', Date.now()-t0, 'ms')
