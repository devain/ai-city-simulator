/**
 * Hard-constraint evaluation.
 *
 * A constraint the user stated in words ("keep traffic below 50%", "without
 * hurting the economy") becomes a pass/fail test against a plan's *simulated*
 * outcome — so the AI can genuinely refuse a plan that breaks its brief rather
 * than claiming compliance it never checked.
 */
import type { MetricKey, SimulationResult } from '../simulation/types'
import type { MetricConstraint } from './nlu/types'

/** metrics where a bigger headline number is the good outcome */
const HIGHER_IS_BETTER = new Set<MetricKey>(['economy', 'livability', 'population'])

/** The number the user means when they say "traffic" or "the economy". */
export function constraintReading(metric: MetricKey, sim: SimulationResult): number {
  const m = sim.metrics[metric]
  return HIGHER_IS_BETTER.has(metric) ? m.value : m.utilisation * 100
}

/** How bad this metric currently is — always "lower is better". */
function worseness(metric: MetricKey, sim: SimulationResult): number {
  const m = sim.metrics[metric]
  return HIGHER_IS_BETTER.has(metric) ? -m.value : m.utilisation
}

const LABEL: Partial<Record<MetricKey, string>> = {
  emissions: 'CO₂',
  education: 'school capacity',
  livability: 'quality of life',
  economy: 'economic activity',
  electricity: 'grid load',
}

const name = (m: MetricKey) => LABEL[m] ?? m

export interface ConstraintCheck {
  satisfied: boolean
  violations: string[]
  /** the ones that held, for the "why this plan" explanation */
  respected: string[]
}

/**
 * @param after   the plan's simulated city
 * @param before  the city as it stands now (for the relative operators)
 */
export function evaluateConstraints(
  after: SimulationResult,
  before: SimulationResult,
  constraints: MetricConstraint[] | undefined,
): ConstraintCheck {
  if (!constraints || constraints.length === 0) {
    return { satisfied: true, violations: [], respected: [] }
  }

  const violations: string[] = []
  const respected: string[] = []
  // relative operators get a little slack so rounding noise is not a "breach"
  const SLACK = 0.005

  for (const c of constraints) {
    const readAfter = constraintReading(c.metric, after)

    switch (c.op) {
      case 'max': {
        if (c.value == null) break
        if (readAfter > c.value + 0.5) {
          violations.push(`${name(c.metric)} would reach ${readAfter.toFixed(0)}% (limit ${c.value}%)`)
        } else {
          respected.push(`${name(c.metric)} held at ${readAfter.toFixed(0)}% (limit ${c.value}%)`)
        }
        break
      }
      case 'min': {
        if (c.value == null) break
        if (readAfter < c.value - 0.5) {
          violations.push(`${name(c.metric)} would fall to ${readAfter.toFixed(0)} (floor ${c.value})`)
        } else {
          respected.push(`${name(c.metric)} kept at ${readAfter.toFixed(0)} (floor ${c.value})`)
        }
        break
      }
      case 'no_increase':
      case 'no_decrease': {
        const w0 = worseness(c.metric, before)
        const w1 = worseness(c.metric, after)
        const rel = w0 === 0 ? w1 - w0 : (w1 - w0) / Math.abs(w0)
        if (rel > SLACK) {
          const pct = Math.abs(rel * 100).toFixed(1)
          violations.push(
            c.op === 'no_increase'
              ? `${name(c.metric)} would rise ${pct}%`
              : `${name(c.metric)} would fall ${pct}%`,
          )
        } else {
          respected.push(
            c.op === 'no_increase'
              ? `${name(c.metric)} does not rise`
              : `${name(c.metric)} is protected`,
          )
        }
        break
      }
    }
  }

  return { satisfied: violations.length === 0, violations, respected }
}
