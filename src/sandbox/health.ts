/**
 * CITY HEALTH — one number the player can steer by, and nine that explain it.
 *
 * Every component is read straight off the live simulation or the finance
 * model, converted to a 0-100 score where 100 is "no pressure". The overall
 * score is a weighted mean, so no single system can hide behind the others —
 * and the worst component is always available as "what to fix next".
 *
 * PROTOTYPE SIMULATION — ILLUSTRATIVE ESTIMATES.
 */
import type { SimulationResult } from '../simulation/types'
import type { CityFinance } from './finance'

export type HealthStatus = 'EXCELLENT' | 'HEALTHY' | 'WARNING' | 'CRITICAL'

export interface HealthComponent {
  key: string
  label: string
  /** 0-100, higher is better */
  score: number
  weight: number
  detail: string
}

export interface CityHealth {
  /** 0-100 */
  score: number
  status: HealthStatus
  components: HealthComponent[]
  /** the lowest-scoring component — the thing most worth fixing */
  weakest: HealthComponent
  /** the highest-scoring component */
  strongest: HealthComponent
}

/** utilisation (0 = empty, 1 = at capacity) → score where low pressure is good */
const fromUtilisation = (u: number) => clamp(100 - (u - 0.45) * 145)
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

export function statusOf(score: number): HealthStatus {
  if (score >= 85) return 'EXCELLENT'
  if (score >= 70) return 'HEALTHY'
  if (score >= 50) return 'WARNING'
  return 'CRITICAL'
}

const pct = (u: number) => `${Math.round(u * 100)}% of capacity`

/**
 * Nine systems, weighted by how much each one actually limits a city.
 * Traffic and finance carry the most weight because they are the two things
 * that stop a city growing at all.
 */
export function cityHealth(r: SimulationResult, finance: CityFinance): CityHealth {
  const m = r.metrics

  // financial stability: break-even is 55, a healthy 12% margin is ~85
  const financeScore = clamp(55 + finance.margin * 250)

  const components: HealthComponent[] = [
    {
      key: 'traffic',
      label: 'Traffic',
      score: fromUtilisation(m.traffic.utilisation),
      weight: 1.4,
      detail: `${pct(m.traffic.utilisation)} · V/C ${r.raw.congestionIndex.toFixed(2)}`,
    },
    {
      key: 'finance',
      label: 'Finances',
      score: financeScore,
      weight: 1.4,
      detail:
        finance.netIncome >= 0
          ? `+$${(finance.netIncome / 1e6).toFixed(1)}M/yr · ${(finance.margin * 100).toFixed(0)}% margin`
          : `−$${(Math.abs(finance.netIncome) / 1e6).toFixed(1)}M/yr deficit`,
    },
    {
      key: 'economy',
      label: 'Economy',
      score: clamp(100 - m.economy.utilisation * 78),
      weight: 1.2,
      detail: `${Math.round(r.raw.employmentRate * 100)}% employment · $${(
        r.raw.grossValueAdded / 1e6
      ).toFixed(0)}M GVA`,
    },
    {
      key: 'livability',
      label: 'Quality of life',
      score: clamp(r.raw.livabilityIndex),
      weight: 1.2,
      detail: `index ${Math.round(r.raw.livabilityIndex)}/100`,
    },
    {
      key: 'education',
      label: 'Education',
      score: fromUtilisation(m.education.utilisation),
      weight: 1.0,
      detail: `${pct(m.education.utilisation)} · ${Math.round(r.students).toLocaleString('en-US')} students`,
    },
    {
      key: 'healthcare',
      label: 'Healthcare',
      score: healthcareScore(r),
      weight: 1.0,
      detail: `${bedsPerThousand(r).toFixed(1)} beds per 1,000 residents`,
    },
    {
      key: 'energy',
      label: 'Energy',
      score: fromUtilisation(m.electricity.utilisation),
      weight: 1.0,
      detail: `${pct(m.electricity.utilisation)} · ${r.raw.peakDemandMw.toFixed(1)} MW peak`,
    },
    {
      key: 'water',
      label: 'Water',
      score: fromUtilisation(m.water.utilisation),
      weight: 0.9,
      detail: `${pct(m.water.utilisation)} · ${Math.round(r.raw.waterM3Day).toLocaleString('en-US')} m³/day`,
    },
    {
      key: 'environment',
      label: 'Environment',
      score: fromUtilisation(m.emissions.utilisation),
      weight: 1.0,
      detail: `${Math.round(r.raw.co2PerCapitaKgYear).toLocaleString('en-US')} kg CO₂ per resident/yr`,
    },
  ]

  const totalWeight = components.reduce((s, c) => s + c.weight, 0)
  const score = Math.round(
    components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight,
  )

  const ranked = [...components].sort((a, b) => a.score - b.score)

  return {
    score,
    status: statusOf(score),
    components,
    weakest: ranked[0],
    strongest: ranked[ranked.length - 1],
  }
}

function bedsPerThousand(r: SimulationResult) {
  return r.raw.hospitalBeds / Math.max(1, r.population / 1000)
}

function healthcareScore(r: SimulationResult) {
  const per1000 = bedsPerThousand(r)
  // 3.5 beds / 1,000 is a comfortable provision; 1.0 is a city in trouble
  return clamp(((per1000 - 0.6) / 2.9) * 100)
}
