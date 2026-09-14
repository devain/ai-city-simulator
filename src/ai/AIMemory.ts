/**
 * WHAT THE AGENT LEARNED THIS MATCH.
 *
 * No machine learning — a deterministic record of what each kind of build
 * actually did to the city, measured a few months after it completed. If
 * apartment blocks keep being followed by a jump in congestion, the agent
 * down-weights them and reaches for transit instead. If transit keeps paying
 * off, it reaches for it sooner.
 *
 * That is the whole mechanism, and it is enough to produce the behaviour the
 * spec asks for: "suburban expansion produced excessive traffic under current
 * road capacity" → prefer transit-oriented development.
 *
 * The shape is deliberately that of an evaluation log, so a real model could
 * be handed the same records later without changing any caller.
 */
import type { CitySnapshot } from '../challenge/CityRuntime'

export interface MemoryRecord {
  /** catalogue id of what was built */
  itemId: string
  itemName: string
  /** the problem it was meant to solve */
  priorityKey: string
  tick: number
  capex: number
  /** city readings at the moment it completed */
  before: Readings
  /** readings once the consequences had time to show, or null while pending */
  after: Readings | null
  /** set once `after` lands: did it help? */
  verdict: 'good' | 'mixed' | 'bad' | null
  /** one clause the log can print */
  lesson: string | null
}

interface Readings {
  score: number
  health: number
  traffic: number
  population: number
  netIncome: number
}

export interface AIMemory {
  records: MemoryRecord[]
  /** itemId → multiplier applied to that option's attractiveness, 0.5 … 1.5 */
  bias: Record<string, number>
  /** lessons worth showing the player, newest first */
  lessons: { tick: number; text: string }[]
}

export const emptyMemory = (): AIMemory => ({ records: [], bias: {}, lessons: [] })

/** how many months later the consequences are judged */
const REVIEW_DELAY = 9

const readingsOf = (s: CitySnapshot, score: number): Readings => ({
  score,
  health: s.health.score,
  traffic: s.result.metrics.traffic.utilisation,
  population: s.result.population,
  netIncome: s.finance.netIncome,
})

/** Record a completed build, so it can be judged later. */
export function remember(
  mem: AIMemory,
  entry: { itemId: string; itemName: string; priorityKey: string; capex: number },
  snap: CitySnapshot,
  score: number,
): AIMemory {
  return {
    ...mem,
    records: [
      ...mem.records,
      {
        ...entry,
        tick: snap.tick,
        before: readingsOf(snap, score),
        after: null,
        verdict: null,
        lesson: null,
      },
    ].slice(-60),
  }
}

/**
 * Judge any record old enough to have consequences, and fold the verdict into
 * the bias table. Called once per tick; cheap and deterministic.
 */
export function review(mem: AIMemory, snap: CitySnapshot, score: number): AIMemory {
  const due = mem.records.filter((r) => r.after === null && snap.tick - r.tick >= REVIEW_DELAY)
  if (due.length === 0) return mem

  const now = readingsOf(snap, score)
  const bias = { ...mem.bias }
  const lessons = [...mem.lessons]

  const records = mem.records.map((r) => {
    if (!due.includes(r)) return r

    const dScore = now.score - r.before.score
    const dTraffic = now.traffic - r.before.traffic
    const dHealth = now.health - r.before.health

    let verdict: MemoryRecord['verdict']
    let lesson: string
    if (dScore >= 1.2 && dHealth >= 0) {
      verdict = 'good'
      lesson = `${r.itemName} paid off — city score rose ${dScore.toFixed(1)} in the ${REVIEW_DELAY} months after it opened.`
    } else if (dScore <= -1.2 || dHealth <= -3) {
      verdict = 'bad'
      lesson =
        dTraffic > 0.04
          ? `${r.itemName} added ${Math.round(dTraffic * 100)} points of congestion under the current road capacity.`
          : `${r.itemName} left the city ${Math.abs(dScore).toFixed(1)} points worse off.`
    } else {
      verdict = 'mixed'
      lesson = `${r.itemName} made little measurable difference.`
    }

    // nudge, never slam: repeated evidence moves the bias, one result does not
    const step = verdict === 'good' ? 0.12 : verdict === 'bad' ? -0.16 : -0.02
    bias[r.itemId] = Math.max(0.5, Math.min(1.5, (bias[r.itemId] ?? 1) + step))

    if (verdict !== 'mixed') lessons.unshift({ tick: snap.tick, text: lesson })

    return { ...r, after: now, verdict, lesson }
  })

  return { records, bias, lessons: lessons.slice(0, 24) }
}

/** The learned multiplier for an option. 1 when nothing is known yet. */
export const biasFor = (mem: AIMemory, itemId: string) => mem.bias[itemId] ?? 1

/** What the agent would say about its own record, for the activity log. */
export function memorySummary(mem: AIMemory): string | null {
  const judged = mem.records.filter((r) => r.verdict !== null)
  if (judged.length < 2) return null
  const bad = judged.filter((r) => r.verdict === 'bad')
  const good = judged.filter((r) => r.verdict === 'good')
  if (bad.length > good.length && bad.length > 0) {
    return `Revising strategy — ${bad[bad.length - 1].itemName.toLowerCase()} has not been paying off.`
  }
  if (good.length > 0) {
    return `Staying the course — ${good[good.length - 1].itemName.toLowerCase()} is delivering.`
  }
  return null
}
