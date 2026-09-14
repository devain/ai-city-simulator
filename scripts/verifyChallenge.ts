/**
 * Phase 6 headless check — the match engine, without a browser.
 *
 *   npm run verify:challenge
 *
 * Proves the four things the whole game rests on:
 *   1. both sides genuinely start from an identical city
 *   2. the same seed produces the same match, every time
 *   3. the four AI personalities behave differently from each other
 *   4. the AI can fail, notice, and change strategy
 */
import {
  createMatch,
  runToEnd,
  step,
  verdictOf,
  type ChallengeState,
} from '../src/challenge/ChallengeRunner'
import { fingerprint } from '../src/challenge/CityRuntime'
import { DEFAULT_SETUP, CHALLENGE_OBJECTIVES, type ChallengeSetup } from '../src/challenge/ChallengeConfig'
import { AI_PERSONALITIES, PERSONALITY_LIST } from '../src/ai/AIPersonality'

const t0 = Date.now()
const money = (v: number) => (Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v)}`)
const n = (v: number) => Math.round(v).toLocaleString('en-US')
const pct = (v: number) => `${Math.round(v * 100)}%`

const setup: ChallengeSetup = { ...DEFAULT_SETUP, years: 10, population: 20_000 }

/* ------------------------------------------------------------------ */
console.log('\n=== 1. IDENTICAL STARTING STATES ===\n')
{
  const m = createMatch(setup)
  const fh = fingerprint(m.human)
  const fa = fingerprint(m.ai)
  console.log(`  human  ${fh}`)
  console.log(`  ai     ${fa}`)
  console.log(`  identical: ${fh === fa ? 'YES' : 'NO — FAIL'}`)
  console.log(`  same object: ${m.human === m.ai ? 'YES (structurally shared)' : 'no'}`)
  console.log(
    `  start: ${n(m.human.result.population)} residents · ${money(m.human.treasury)} · health ${m.human.health.score}`,
  )
  if (fh !== fa) throw new Error('starting states differ — the match would not be fair')
}

/* ------------------------------------------------------------------ */
console.log('\n=== 2. DETERMINISM ===\n')
{
  const a = runToEnd(setup)
  const b = runToEnd(setup)
  const fa = fingerprint(a.ai)
  const fb = fingerprint(b.ai)
  console.log(`  run 1 AI final  ${fa}`)
  console.log(`  run 2 AI final  ${fb}`)
  console.log(`  reproducible: ${fa === fb ? 'YES' : 'NO — FAIL'}`)
  console.log(`  events fired: ${a.log.filter((l) => l.kind === 'event').length}`)
  if (fa !== fb) throw new Error('same seed produced different matches')
}

/* ------------------------------------------------------------------ */
console.log('\n=== 3. PERSONALITIES DIVERGE ===\n')
const results: Record<string, ChallengeState> = {}
for (const p of PERSONALITY_LIST) {
  const s = runToEnd({ ...setup, personality: p.id })
  results[p.id] = s
  const ai = s.ai
  const builds = s.log.filter((l) => l.side === 'ai' && l.kind === 'build')
  console.log(
    `  ${p.label.padEnd(13)} score ${s.scores.ai.total.toFixed(1).padStart(5)}  ` +
      `pop ${n(ai.result.population).padStart(7)}  ` +
      `traffic ${pct(ai.result.metrics.traffic.utilisation).padStart(4)}  ` +
      `CO₂/head ${n(ai.result.raw.co2PerCapitaKgYear).padStart(6)}  ` +
      `cash ${money(ai.treasury).padStart(7)}  ` +
      `net ${(ai.finance.netIncome >= 0 ? '+' : '-') + money(Math.abs(ai.finance.netIncome))}`.padEnd(13) +
      `builds ${String(builds.length).padStart(2)}`,
  )
}
{
  const fps = PERSONALITY_LIST.map((p) => fingerprint(results[p.id].ai))
  const distinct = new Set(fps).size
  console.log(`\n  distinct final cities: ${distinct}/4 ${distinct === 4 ? '' : '— personalities are not diverging'}`)
  const scores = PERSONALITY_LIST.map((p) => results[p.id].scores.ai.total)
  console.log(`  score spread: ${(Math.max(...scores) - Math.min(...scores)).toFixed(1)} points`)
}

/* ------------------------------------------------------------------ */
console.log('\n=== 4. WHAT EACH PERSONALITY BUILT ===\n')
for (const p of PERSONALITY_LIST) {
  const builds = results[p.id].log.filter((l) => l.side === 'ai' && l.kind === 'build')
  const counts = new Map<string, number>()
  for (const b of builds) {
    const m = b.text.match(/building ([a-z ]+?)(?: ·|$)/)
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1)
  }
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}× ${k}`)
  console.log(`  ${p.label.padEnd(13)} ${list.join(' · ') || 'nothing'}`)
}

/* ------------------------------------------------------------------ */
console.log('\n=== 5. THE AI CAN FAIL AND ADAPT ===\n')
{
  // Growth is the personality most likely to overbuild and get caught out
  const s = results.growth
  const lessons = s.aiMemory.lessons
  const bad = s.aiMemory.records.filter((r) => r.verdict === 'bad')
  const good = s.aiMemory.records.filter((r) => r.verdict === 'good')
  console.log(`  Growth judged ${s.aiMemory.records.filter((r) => r.verdict).length} of its own builds`)
  console.log(`    good ${good.length} · bad ${bad.length} · mixed ${
    s.aiMemory.records.filter((r) => r.verdict === 'mixed').length
  }`)
  for (const l of lessons.slice(0, 4)) {
    console.log(`    Y${Math.floor(l.tick / 12) + 1}  ${l.text}`)
  }
  const biases = Object.entries(s.aiMemory.bias).filter(([, v]) => Math.abs(v - 1) > 0.01)
  console.log(`  learned preferences: ${
    biases.map(([k, v]) => `${k} ${v > 1 ? '+' : ''}${((v - 1) * 100).toFixed(0)}%`).join(' · ') || 'none yet'
  }`)
  const adapts = s.log.filter((l) => l.kind === 'adapt')
  console.log(`  strategy revisions logged: ${adapts.length}`)
}

/* ------------------------------------------------------------------ */
console.log('\n=== 6. FORESIGHT ===\n')
for (const p of PERSONALITY_LIST) {
  const pre = results[p.id].log.filter((l) => l.side === 'ai' && /rising|projected/.test(l.text))
  console.log(`  ${p.label.padEnd(13)} pre-emptive builds: ${pre.length}`)
  if (pre[0]) console.log(`      e.g. Y${pre[0].year} ${pre[0].text.slice(0, 108)}`)
}

/* ------------------------------------------------------------------ */
console.log('\n=== 7. OBJECTIVES CHANGE THE GAME ===\n')
for (const obj of Object.values(CHALLENGE_OBJECTIVES)) {
  const ranked = PERSONALITY_LIST.map((p) => ({
    p,
    score: runToEnd({ ...setup, objective: obj.id, personality: p.id }).scores.ai.total,
  })).sort((a, b) => b.score - a.score)
  console.log(
    `  ${obj.label.padEnd(18)} ${ranked.map((r) => `${r.p.label} ${r.score.toFixed(1)}`).join('  ·  ')}`,
  )
}

/* ------------------------------------------------------------------ */
console.log('\n=== 8. A MATCH, YEAR BY YEAR (human does nothing) ===\n')
{
  let s = createMatch(setup)
  let lastYear = 0
  let guard = 0
  while (!s.finished && guard++ < 400) {
    s = step(s).state
    s = { ...s, pending: null }
    const year = Math.floor(s.human.tick / 12) + 1
    if (year !== lastYear) {
      lastYear = year
      console.log(
        `  Y${String(year).padStart(2)}  human ${s.scores.human.total.toFixed(1).padStart(5)} ` +
          `(${n(s.human.result.population).padStart(6)} · traffic ${pct(s.human.result.metrics.traffic.utilisation)})` +
          `   ai ${s.scores.ai.total.toFixed(1).padStart(5)} ` +
          `(${n(s.ai.result.population).padStart(6)} · traffic ${pct(s.ai.result.metrics.traffic.utilisation)})`,
      )
    }
  }
  const v = verdictOf(s)
  console.log(`\n  RESULT: ${v.winner === 'draw' ? 'DRAW' : v.winner.toUpperCase() + ' WINS'} by ${v.margin} — human ${v.human.toFixed(1)} · AI ${v.ai.toFixed(1)}`)
  console.log(`  (the human side built nothing, so the AI is expected to win this one)`)

  console.log('\n  score breakdown — AI:')
  for (const c of s.scores.ai.components) {
    console.log(`    ${c.label.padEnd(16)} ${String(Math.round(c.score)).padStart(3)} × ${c.weight.toFixed(2)}  ${c.detail}`)
  }
}

console.log(`\ntotal time ${Date.now() - t0} ms\n`)
