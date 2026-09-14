/**
 * WHY DID THAT SIDE WIN?
 *
 * Generated entirely from the two cities' measured histories — never from a
 * template. The explanation names the score components that actually decided
 * it and the decisions in the log that produced them, so a player can check
 * every claim against the numbers on screen.
 */
import type { ChallengeState, Side } from './ChallengeRunner'
import type { CityScore } from './ScoreEngine'
import type { CitySnapshot } from './CityRuntime'

export interface ComparisonRow {
  label: string
  human: string
  ai: string
  /** who is better on this row */
  winner: Side | 'tie'
}

export interface DecisiveFactor {
  label: string
  /** points of final score this component swung, signed toward the winner */
  swing: number
  detail: string
}

export interface PostMatch {
  winner: Side | 'draw'
  margin: number
  headline: string
  /** one sentence on why */
  summary: string
  /** the three decisions that mattered most */
  topDecisions: string[]
  factors: DecisiveFactor[]
  rows: ComparisonRow[]
}

const n = (v: number) => Math.round(v).toLocaleString('en-US')
const pct = (v: number) => `${Math.round(v * 100)}%`
const money = (v: number) =>
  Math.abs(v) >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v).toLocaleString('en-US')}`

export function analyseMatch(state: ChallengeState): PostMatch {
  const h = state.human
  const a = state.ai
  const hs = state.scores.human
  const as = state.scores.ai
  const margin = Math.round(Math.abs(hs.total - as.total) * 10) / 10
  const winner: Side | 'draw' = margin < 0.5 ? 'draw' : hs.total > as.total ? 'human' : 'ai'

  /* ---- which components actually decided it ---- */
  const factors: DecisiveFactor[] = hs.components
    .map((c, i) => {
      const other = as.components[i]
      const swing = (c.score - other.score) * c.weight
      return {
        label: c.label,
        swing: Math.round(swing * 100) / 100,
        detail:
          winner === 'human'
            ? `you ${Math.round(c.score)} · AI ${Math.round(other.score)} — ${c.detail}`
            : `AI ${Math.round(other.score)} · you ${Math.round(c.score)} — ${other.detail}`,
      }
    })
    .sort((x, y) => (winner === 'human' ? y.swing - x.swing : x.swing - y.swing))

  const rows = comparisonRows(h, a)
  const topDecisions = decisiveDecisions(state, winner)

  return {
    winner,
    margin,
    headline:
      winner === 'draw'
        ? 'DEAD HEAT'
        : winner === 'human'
          ? 'HUMAN WINS'
          : 'AI WINS',
    summary: summarise(state, winner, factors, hs, as),
    topDecisions,
    factors: factors.slice(0, 4),
    rows,
  }
}

function comparisonRows(h: CitySnapshot, a: CitySnapshot): ComparisonRow[] {
  const row = (
    label: string,
    hv: number,
    av: number,
    fmt: (v: number) => string,
    lowerIsBetter = false,
  ): ComparisonRow => ({
    label,
    human: fmt(hv),
    ai: fmt(av),
    winner:
      Math.abs(hv - av) < 1e-6
        ? 'tie'
        : (lowerIsBetter ? hv < av : hv > av)
          ? 'human'
          : 'ai',
  })

  return [
    row('Population', h.result.population, a.result.population, n),
    row('Economy (GVA)', h.result.raw.grossValueAdded, a.result.raw.grossValueAdded, money),
    row('Budget remaining', h.treasury, a.treasury, money),
    row('Net income / yr', h.finance.netIncome, a.finance.netIncome, money),
    row('Traffic', h.result.metrics.traffic.utilisation, a.result.metrics.traffic.utilisation, pct, true),
    row('Education pressure', h.result.metrics.education.utilisation, a.result.metrics.education.utilisation, pct, true),
    row('CO₂ per resident', h.result.raw.co2PerCapitaKgYear, a.result.raw.co2PerCapitaKgYear, (v) => `${n(v)} kg`, true),
    row('Quality of life', h.result.raw.livabilityIndex, a.result.raw.livabilityIndex, (v) => String(Math.round(v))),
    row('City health', h.health.score, a.health.score, (v) => String(v)),
    row('Total buildings', h.city.buildings.length, a.city.buildings.length, n),
    row('Transit routes', h.city.busRoutes?.length ?? 0, a.city.busRoutes?.length ?? 0, n),
    row('Capital committed', h.spentTotal, a.spentTotal, money),
  ]
}

/** One sentence, built from the two components that swung it furthest. */
function summarise(
  state: ChallengeState,
  winner: Side | 'draw',
  factors: DecisiveFactor[],
  hs: CityScore,
  as: CityScore,
): string {
  if (winner === 'draw') {
    return `Both cities finished within half a point — ${hs.total.toFixed(1)} against ${as.total.toFixed(
      1,
    )}. Neither strategy found an edge on this map.`
  }

  const top = factors.slice(0, 2).filter((f) => Math.abs(f.swing) > 0.15)
  const side = winner === 'human' ? 'You' : 'The AI'
  const loser = winner === 'human' ? 'the AI' : 'your city'

  if (top.length === 0) {
    return `${side} won on aggregate rather than on any single measure — no component swung the result by more than a fraction of a point.`
  }

  const names = top.map((f) => f.label.toLowerCase())
  const lead = names.length > 1 ? `${names[0]} and ${names[1]}` : names[0]

  const preemptive = state.log.filter((l) => l.side === 'ai' && /rising|projected/.test(l.text)).length
  const aiNote =
    winner === 'ai' && preemptive > 0
      ? ` It acted on ${preemptive} problem${preemptive === 1 ? '' : 's'} before ${
          preemptive === 1 ? 'it' : 'they'
        } became critical.`
      : ''

  return `${side} won on ${lead}, which together account for most of the ${Math.abs(
    hs.total - as.total,
  ).toFixed(1)}-point margin over ${loser}.${aiNote}`
}

/** The three log entries that best explain the result. */
function decisiveDecisions(state: ChallengeState, winner: Side | 'draw'): string[] {
  const out: string[] = []
  const side: Side = winner === 'human' ? 'human' : 'ai'
  const builds = state.log.filter((l) => l.side === side && l.kind === 'build')

  // a pre-emptive build is the most interesting thing either side can do
  const preemptive = builds.find((l) => /rising|projected/.test(l.text))
  if (preemptive) out.push(`Year ${preemptive.year} — ${preemptive.text}`)

  // the most expensive commitment usually shaped the city most
  const biggest = builds.filter((l) => /transit hub|university|hospital|water facility|power plant/.test(l.text))[0]
  if (biggest && biggest !== preemptive) out.push(`Year ${biggest.year} — ${biggest.text}`)

  // an adaptation is evidence of the agent noticing it was wrong
  const adapt = state.log.filter((l) => l.kind === 'adapt')[0]
  if (adapt && side === 'ai') out.push(`Year ${adapt.year} — ${adapt.text}`)

  // fall back to the first builds so the list is never empty
  for (const b of builds) {
    if (out.length >= 3) break
    const line = `Year ${b.year} — ${b.text}`
    if (!out.includes(line)) out.push(line)
  }

  if (out.length === 0) {
    out.push(
      side === 'human'
        ? 'You built nothing — the city coasted on what it started with.'
        : 'The AI held its capital rather than building.',
    )
  }
  return out.slice(0, 3)
}
