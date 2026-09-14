/**
 * CITY HISTORY — the record the AI reasons from and the player scrolls back through.
 *
 * Every entry is something that actually happened to the city, stamped with
 * the simulated date it happened on. This is the memory the advisor quotes
 * ("traffic rose after the shopping district was built"), so nothing goes in
 * here that the city did not really do.
 */
export type HistoryKind =
  | 'founded'
  | 'build'
  | 'demolish'
  | 'ai_build'
  | 'event'
  | 'milestone'
  | 'mode'
  | 'finance'

export interface HistoryEntry {
  id: number
  /** absolute tick (months since founding) */
  tick: number
  year: number
  month: number
  kind: HistoryKind
  title: string
  detail: string
  /** snapshot of the headline numbers at the moment it happened */
  snapshot: {
    population: number
    health: number
    treasury: number
    traffic: number
  }
  /** true for the entries worth surfacing on a compact timeline */
  major: boolean
}

export const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export const tickToDate = (tick: number) => ({
  year: Math.floor(tick / 12) + 1,
  month: (tick % 12) + 1,
})

export const formatTick = (tick: number) => {
  const { year, month } = tickToDate(tick)
  return `Year ${year} · ${MONTH_NAMES[month - 1]}`
}

export const HISTORY_ICON: Record<HistoryKind, string> = {
  founded: '◎',
  build: '▲',
  demolish: '✕',
  ai_build: '◈',
  event: '⚠',
  milestone: '★',
  mode: '⇄',
  finance: '$',
}

export const HISTORY_TONE: Record<HistoryKind, string> = {
  founded: 'text-cyan-200',
  build: 'text-sky-200',
  demolish: 'text-rose-200',
  ai_build: 'text-fuchsia-200',
  event: 'text-amber-200',
  milestone: 'text-emerald-200',
  mode: 'text-slate-300',
  finance: 'text-emerald-200',
}

/** Population milestones worth recording, smallest first. */
export const POPULATION_MILESTONES = [
  12_500, 15_000, 20_000, 25_000, 30_000, 40_000, 50_000, 75_000, 100_000,
]
