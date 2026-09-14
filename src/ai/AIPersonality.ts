/**
 * FOUR WAYS TO RUN A CITY.
 *
 * A personality is not a different algorithm — all four use the same
 * analyse → prioritise → simulate → decide loop. What changes is what the
 * agent *values*: which problems it weights, how much money it insists on
 * keeping, how close to a ceiling it lets a system get before acting, and how
 * much short-term pain it will accept for long-term capacity.
 *
 * That is deliberate. It means the personalities can genuinely beat each
 * other under different objectives, and none of them is hard-coded to win.
 */
import type { AIPersonalityId } from '../challenge/ChallengeConfig'

export interface AIPersonality {
  id: AIPersonalityId
  label: string
  icon: string
  blurb: string
  /** one line on how it plays, for the setup screen */
  style: string
  accent: string

  /** priority weights, multiplied onto urgency */
  weights: Record<string, number>
  /**
   * Share of the treasury it refuses to commit. Conservative hoards; Growth
   * spends nearly everything.
   */
  reserveRatio: number
  /** absolute floor on the reserve, USD */
  reserveFloor: number
  /**
   * How loaded a system must be before it counts as a problem. Lower means it
   * acts earlier — which costs money but avoids crises.
   */
  actionThreshold: number
  /** health points it will accept losing for a build that serves its goals */
  painTolerance: number
  /** catalogue families it reaches for first, before the generic remedy list */
  favours: string[]
  /** families it avoids unless nothing else will do */
  avoids: string[]
  /**
   * Months it looks ahead when deciding whether a system is *about* to fail.
   * This is what lets an agent build transit before congestion, not after.
   */
  foresightMonths: number
}

export const AI_PERSONALITIES: Record<AIPersonalityId, AIPersonality> = {
  conservative: {
    id: 'conservative',
    label: 'Conservative',
    icon: '▣',
    blurb: 'Preserve capital, fix what is breaking, expand only when the city can carry it.',
    style: 'Slow, solvent, rarely caught out — and rarely first.',
    accent: 'sky',
    weights: { finance: 1.9, water: 1.3, energy: 1.3, traffic: 1.15, housing: 0.7, commercial: 0.9 },
    reserveRatio: 0.32,
    reserveFloor: 12_000_000,
    actionThreshold: 0.74,
    painTolerance: 0,
    favours: ['water_facility', 'solar_farm', 'shop'],
    avoids: ['hospital', 'university', 'logistics_hub'],
    foresightMonths: 6,
  },
  growth: {
    id: 'growth',
    label: 'Growth',
    icon: '⇧',
    blurb: 'Housing and commerce first. Deal with the consequences when they arrive.',
    style: 'Fast population and economy — and the congestion that comes with it.',
    accent: 'amber',
    weights: { housing: 1.9, jobs: 1.5, commercial: 1.45, finance: 1.1, traffic: 0.7, environment: 0.55 },
    reserveRatio: 0.04,
    reserveFloor: 2_000_000,
    actionThreshold: 0.62,
    painTolerance: 4,
    favours: ['residential_tower', 'apartment', 'shopping_centre', 'office'],
    avoids: ['large_park', 'small_park'],
    foresightMonths: 2,
  },
  sustainable: {
    id: 'sustainable',
    label: 'Sustainable',
    icon: '☘',
    blurb: 'Transit, clean generation and green space before towers.',
    style: 'Lower emissions and better places to live; slower on the economy.',
    accent: 'emerald',
    weights: {
      environment: 1.95,
      traffic: 1.6,
      energy: 1.35,
      healthcare: 1.2,
      education: 1.2,
      housing: 0.85,
      jobs: 0.8,
    },
    reserveRatio: 0.16,
    reserveFloor: 6_000_000,
    actionThreshold: 0.66,
    painTolerance: 2,
    favours: ['solar_farm', 'transit_hub', 'bus_route', 'large_park', 'bus_stop'],
    avoids: ['power_plant', 'logistics_hub', 'highway_link'],
    foresightMonths: 8,
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced',
    icon: '◎',
    blurb: 'Work the ranked problem list, keep the books straight, do not over-commit.',
    style: 'No obvious weakness, no obvious edge.',
    accent: 'cyan',
    weights: { traffic: 1.2, housing: 1.15, finance: 1.15, education: 1.1, energy: 1.05 },
    reserveRatio: 0.12,
    reserveFloor: 5_000_000,
    actionThreshold: 0.68,
    painTolerance: 2,
    favours: [],
    avoids: [],
    foresightMonths: 5,
  },
}

export const PERSONALITY_LIST = Object.values(AI_PERSONALITIES)

/** The capital a personality is willing to commit right now. */
export function spendableFor(p: AIPersonality, treasury: number): number {
  const reserve = Math.max(p.reserveFloor, treasury * p.reserveRatio)
  return Math.max(0, treasury - reserve)
}

export function reserveFor(p: AIPersonality, treasury: number): number {
  return Math.max(p.reserveFloor, treasury * p.reserveRatio)
}
