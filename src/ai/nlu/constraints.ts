/**
 * Turns constraint phrases into structured limits the scorer can actually
 * enforce, e.g.
 *
 *   "keep traffic below 50%"          → traffic  max 50
 *   "without hurting the economy"     → economy  no_decrease
 *   "without making traffic worse"    → traffic  no_increase
 *   "don't let CO2 go above 60%"      → emissions max 60
 */
import type { MetricKey } from '../../simulation/types'
import { METRIC_LEX } from './lexicon'
import { deaccent } from './numbers'
import type { MetricConstraint } from './types'

/** "without hurting / damaging / reducing X" — X must not get worse */
const PROTECT_RE =
  /\b(without|but (do not|don'?t|dont)|khong|dung|nhung dung|ma khong)\s+(hurting|hurt|damaging|damage|reducing|reduce|lowering|lower|harming|harm|worsening|worsen|making|make|increasing|increase|raising|raise|lam|giam|tang|anh huong)?\s*([^,.;]{0,42})/gi

/** "keep / stay / below / under / at most 50%" */
const LIMIT_RE =
  /\b(?:keep|hold|stay|remain|must (?:stay|be|remain)|below|under|at most|no more than|less than|not exceed|duoi|khong qua|toi da)\b[^,.;]{0,46}?(\d{1,3})\s*%/gi

/** "at least / above / minimum 80" */
const FLOOR_RE =
  /\b(?:at least|above|over|minimum|no less than|toi thieu|it nhat|tren)\b[^,.;]{0,46}?(\d{1,3})\s*%/gi

function metricIn(fragment: string): MetricKey | null {
  for (const m of METRIC_LEX) {
    if (m.patterns.test(fragment)) return m.id
  }
  return null
}

/** metrics where a *higher* number is the good outcome */
const HIGHER_IS_BETTER = new Set<MetricKey>(['economy', 'livability', 'population'])

export function extractConstraints(raw: string): MetricConstraint[] {
  const text = deaccent(raw).toLowerCase()
  const out: MetricConstraint[] = []
  const seen = new Set<string>()

  const push = (c: MetricConstraint) => {
    const key = `${c.metric}:${c.op}:${c.value ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(c)
  }

  /* ---- "keep traffic below 50%" ---- */
  LIMIT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = LIMIT_RE.exec(text)) !== null) {
    const window = text.slice(Math.max(0, m.index - 30), m.index + m[0].length)
    const metric = metricIn(window)
    const value = Number(m[1])
    if (metric && Number.isFinite(value)) {
      push({ metric, op: 'max', value, source: m[0].trim() })
    }
  }

  /* ---- "quality of life at least 80" ---- */
  FLOOR_RE.lastIndex = 0
  while ((m = FLOOR_RE.exec(text)) !== null) {
    const window = text.slice(Math.max(0, m.index - 30), m.index + m[0].length)
    const metric = metricIn(window)
    const value = Number(m[1])
    if (metric && Number.isFinite(value)) {
      push({ metric, op: 'min', value, source: m[0].trim() })
    }
  }

  /* ---- "without hurting the economy" / "without making traffic worse" ---- */
  PROTECT_RE.lastIndex = 0
  while ((m = PROTECT_RE.exec(text)) !== null) {
    const verb = (m[3] ?? '').toLowerCase()
    const tail = m[4] ?? ''
    const metric = metricIn(tail) ?? metricIn(m[0])
    if (!metric) continue

    // "without increasing traffic" vs "without hurting the economy"
    const raisesBad = /increas|raising|raise|worsen|worse|tang|te hon/.test(verb + ' ' + tail)
    const lowersBad = /hurt|damag|reduc|lower|harm|giam|anh huong/.test(verb + ' ' + tail)

    if (raisesBad) push({ metric, op: 'no_increase', source: m[0].trim() })
    else if (lowersBad) push({ metric, op: 'no_decrease', source: m[0].trim() })
    else push({
      metric,
      op: HIGHER_IS_BETTER.has(metric) ? 'no_decrease' : 'no_increase',
      source: m[0].trim(),
    })
  }

  /* ---- bare "don't make traffic worse" ---- */
  if (/\b(do not|don'?t|dont|khong|dung)\b[^,.;]{0,30}\b(worse|worsen|te hon|xau hon)\b/.test(text)) {
    const metric = metricIn(text)
    if (metric) push({ metric, op: 'no_increase', source: 'must not get worse' })
  }

  return out
}

/** Human-readable form for the command center. */
export function describeConstraint(c: MetricConstraint): string {
  const name = c.metric === 'emissions' ? 'CO₂' : c.metric
  switch (c.op) {
    case 'max':
      return `${name} ≤ ${c.value}%`
    case 'min':
      return `${name} ≥ ${c.value}%`
    case 'no_increase':
      return `${name} must not increase`
    case 'no_decrease':
      return `${name} must not fall`
  }
}
