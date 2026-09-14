/**
 * The terms of a match. Both sides receive this object, unmodified.
 */
export type ChallengeObjectiveId =
  | 'balanced'
  | 'economy'
  | 'quality'
  | 'sustainable'
  | 'population'
  | 'traffic'

export interface ChallengeObjective {
  id: ChallengeObjectiveId
  label: string
  blurb: string
  /** how the city score is weighted under this objective — sums to 1 */
  weights: ScoreWeights
}

export interface ScoreWeights {
  population: number
  economy: number
  traffic: number
  education: number
  environment: number
  quality: number
  financial: number
}

/** The default weighting from the spec, used by the Balanced objective. */
const BALANCED_WEIGHTS: ScoreWeights = {
  population: 0.15,
  economy: 0.2,
  traffic: 0.15,
  education: 0.1,
  environment: 0.15,
  quality: 0.15,
  financial: 0.1,
}

const w = (over: Partial<ScoreWeights>): ScoreWeights => {
  const merged = { ...BALANCED_WEIGHTS, ...over }
  const total = Object.values(merged).reduce((s, v) => s + v, 0)
  // always normalise, so a score is comparable across objectives
  return Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, v / total]),
  ) as unknown as ScoreWeights
}

export const CHALLENGE_OBJECTIVES: Record<ChallengeObjectiveId, ChallengeObjective> = {
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    blurb: 'Grow the city without letting any one system fail.',
    weights: BALANCED_WEIGHTS,
  },
  economy: {
    id: 'economy',
    label: 'Economic growth',
    blurb: 'Maximise output, jobs and the tax base.',
    weights: w({ economy: 0.34, financial: 0.18, population: 0.16, environment: 0.08 }),
  },
  quality: {
    id: 'quality',
    label: 'Quality of life',
    blurb: 'Build the city people most want to live in.',
    weights: w({ quality: 0.3, education: 0.2, environment: 0.18, traffic: 0.16, economy: 0.08 }),
  },
  sustainable: {
    id: 'sustainable',
    label: 'Sustainable city',
    blurb: 'Grow while cutting emissions per resident.',
    weights: w({ environment: 0.34, quality: 0.2, traffic: 0.18, economy: 0.1, population: 0.08 }),
  },
  population: {
    id: 'population',
    label: 'Maximum population',
    blurb: 'Fit as many residents as the city can genuinely support.',
    weights: w({ population: 0.4, traffic: 0.14, education: 0.12, quality: 0.1, economy: 0.1 }),
  },
  traffic: {
    id: 'traffic',
    label: 'Traffic reduction',
    blurb: 'Keep the network moving whatever else happens.',
    weights: w({ traffic: 0.4, quality: 0.16, environment: 0.14, economy: 0.12, population: 0.08 }),
  },
}

export const OBJECTIVE_LIST = Object.values(CHALLENGE_OBJECTIVES)

/* ------------------------------------------------------------------ */
/* the dials on the setup screen                                       */
/* ------------------------------------------------------------------ */

export const BUDGET_OPTIONS = [50_000_000, 100_000_000, 250_000_000]
export const POPULATION_OPTIONS = [10_000, 20_000, 50_000]
export const LENGTH_OPTIONS = [5, 10, 20]

/** Named seeds so a match can be shared and reproduced by name. */
export const NAMED_SEEDS: { id: string; label: string; seed: number; blurb: string }[] = [
  { id: 'meridian', label: 'Meridian', seed: 20250114, blurb: 'The default grid — balanced districts' },
  { id: 'harbour', label: 'Harbour', seed: 77341, blurb: 'Dense core, weak periphery' },
  { id: 'ridgeway', label: 'Ridgeway', seed: 4812, blurb: 'Sprawling, road-heavy' },
  { id: 'kestrel', label: 'Kestrel', seed: 991237, blurb: 'Tight land supply' },
]

export interface ChallengeSetup {
  seed: number
  seedLabel: string
  budget: number
  population: number
  years: number
  objective: ChallengeObjectiveId
  personality: AIPersonalityId
  /** true when nobody is playing the human side */
  watchOnly: boolean
}

export const DEFAULT_SETUP: ChallengeSetup = {
  seed: NAMED_SEEDS[0].seed,
  seedLabel: NAMED_SEEDS[0].label,
  budget: 100_000_000,
  population: 20_000,
  years: 10,
  objective: 'balanced',
  personality: 'balanced',
  watchOnly: false,
}

export type AIPersonalityId = 'conservative' | 'growth' | 'sustainable' | 'balanced'
