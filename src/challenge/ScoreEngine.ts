/**
 * CITY SCORE — one number, from seven transparent components.
 *
 *   score = population × wp + economy × we + traffic × wt + education × wed
 *         + environment × wenv + quality × wq + financial × wf
 *
 * Every component is 0-100 and reads off the live simulation. The weights come
 * from the match objective, so a Sustainable challenge and an Economic one are
 * genuinely different games rather than the same game with a different label.
 *
 * The components are deliberately *relative to the starting city*, not
 * absolute: a challenge asks "who improved this city most", so a side is
 * measured against where it began, not against an arbitrary ideal.
 */
import type { CitySnapshot } from './CityRuntime'
import type { ScoreWeights } from './ChallengeConfig'

export interface ScoreComponent {
  key: keyof ScoreWeights
  label: string
  /** 0-100 */
  score: number
  weight: number
  /** the reading behind it */
  detail: string
}

export interface CityScore {
  total: number
  components: ScoreComponent[]
  /** the component contributing most, and least */
  best: ScoreComponent
  worst: ScoreComponent
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

/** A ratio against the baseline, mapped so parity = 50 and +60% = 100. */
const growth = (now: number, base: number) =>
  clamp(50 + ((now - base) / Math.max(1, base)) * 83)

/** Utilisation where less is better: 45% → 100, 100% → 20. */
const relief = (u: number) => clamp(100 - (u - 0.45) * 145)

export interface ScoreInput {
  snapshot: CitySnapshot
  /** the city both sides started from */
  baseline: CitySnapshot
  weights: ScoreWeights
}

export function scoreCity({ snapshot: s, baseline: b, weights }: ScoreInput): CityScore {
  const r = s.result
  const br = b.result

  const raw: Omit<ScoreComponent, 'weight'>[] = [
    {
      key: 'population',
      label: 'Population',
      score: growth(r.population, br.population),
      detail: `${Math.round(r.population).toLocaleString('en-US')} residents (from ${Math.round(
        br.population,
      ).toLocaleString('en-US')})`,
    },
    {
      key: 'economy',
      label: 'Economy',
      score: growth(r.raw.grossValueAdded, br.raw.grossValueAdded),
      detail: `$${(r.raw.grossValueAdded / 1e6).toFixed(0)}M GVA · ${Math.round(
        r.raw.employmentRate * 100,
      )}% employment`,
    },
    {
      key: 'traffic',
      label: 'Traffic',
      score: relief(r.metrics.traffic.utilisation),
      detail: `${Math.round(r.metrics.traffic.utilisation * 100)}% of network capacity`,
    },
    {
      key: 'education',
      label: 'Education',
      score: relief(r.metrics.education.utilisation),
      detail: `${Math.round(r.metrics.education.utilisation * 100)}% of school seats taken`,
    },
    {
      key: 'environment',
      label: 'Environment',
      // per-resident emissions: growing without raising them is the win
      score: clamp(
        50 + ((br.raw.co2PerCapitaKgYear - r.raw.co2PerCapitaKgYear) / Math.max(1, br.raw.co2PerCapitaKgYear)) * 160,
      ),
      detail: `${Math.round(r.raw.co2PerCapitaKgYear).toLocaleString('en-US')} kg CO₂ per resident/yr`,
    },
    {
      key: 'quality',
      label: 'Quality of life',
      score: clamp(r.raw.livabilityIndex),
      detail: `index ${Math.round(r.raw.livabilityIndex)}/100`,
    },
    {
      key: 'financial',
      label: 'Financial health',
      score: financialScore(s),
      detail:
        s.finance.netIncome >= 0
          ? `+$${(s.finance.netIncome / 1e6).toFixed(1)}M/yr · $${(s.treasury / 1e6).toFixed(1)}M in hand`
          : `−$${(Math.abs(s.finance.netIncome) / 1e6).toFixed(1)}M/yr · $${(s.treasury / 1e6).toFixed(1)}M in hand`,
    },
  ]

  const components: ScoreComponent[] = raw.map((c) => ({ ...c, weight: weights[c.key] }))
  const total = components.reduce((sum, c) => sum + c.score * c.weight, 0)
  const ranked = [...components].sort((a, b2) => b2.score * b2.weight - a.score * a.weight)

  return {
    total: Math.round(total * 10) / 10,
    components,
    best: ranked[0],
    worst: ranked[ranked.length - 1],
  }
}

/**
 * Solvency plus reserves. A city running a surplus with money in the bank
 * scores near the top; one bleeding money with an empty treasury near zero.
 */
function financialScore(s: CitySnapshot): number {
  const margin = s.finance.margin
  const marginScore = clamp(55 + margin * 250)
  // a year of operating cost in hand is comfortable
  const runway = s.treasury / Math.max(1, s.finance.annualOperatingCost)
  const runwayScore = clamp(runway * 78)
  return Math.round(marginScore * 0.62 + runwayScore * 0.38)
}

/** Just the number, for the per-tick series. */
export const quickScore = (input: ScoreInput) => scoreCity(input).total
