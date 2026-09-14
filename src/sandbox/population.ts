/**
 * POPULATION DYNAMICS — why people move in, and why they leave.
 *
 * The engine already derives population from `residentialCapacity ×
 * occupancyRate`. Phase 5 stops treating occupancy as a constant and lets the
 * city argue for it: build housing and capacity rises, but the flats only fill
 * if the city is worth living in. Six factors decide that, all read off the
 * live simulation.
 *
 * The result is the loop the sandbox needs — build towers and the population
 * climbs, but keep building them without schools, roads or jobs and occupancy
 * stalls or reverses.
 *
 * PROTOTYPE SIMULATION — ILLUSTRATIVE ESTIMATES.
 */
import type { SimulationResult } from '../simulation/types'

export interface AttractivenessFactor {
  key: string
  label: string
  /** −1 .. +1 — how this factor is pushing occupancy */
  push: number
  /** what the player sees: High / Medium / Low */
  rating: 'High' | 'Medium' | 'Low'
  detail: string
}

export interface PopulationPressure {
  /** the occupancy rate the city is drifting toward, 0..1 */
  equilibrium: number
  /** implied annual growth at the current occupancy, as a share */
  annualGrowth: number
  factors: AttractivenessFactor[]
  /** the factor holding the city back the most */
  limiting: AttractivenessFactor
}

const rate = (push: number): AttractivenessFactor['rating'] =>
  push > 0.12 ? 'High' : push < -0.12 ? 'Low' : 'Medium'

/** pressure (0 = empty, 1 = full) → push, positive while there is slack */
const relief = (utilisation: number, weight: number) =>
  Math.max(-1, Math.min(1, (0.82 - utilisation) * weight))

/**
 * Where occupancy wants to settle, and how fast it is moving there.
 *
 * Housing supply is deliberately *not* a factor: it sets the ceiling
 * (capacity), not the desire. These six decide how much of that ceiling the
 * city can actually fill.
 */
export function populationPressure(
  r: SimulationResult,
  occupancy: number,
  livability: number,
): PopulationPressure {
  const factors: AttractivenessFactor[] = [
    {
      key: 'jobs',
      label: 'Jobs',
      push: Math.max(-1, Math.min(1, (r.raw.employmentRate - 0.86) * 3.2)),
      rating: 'Medium',
      detail: `${Math.round(r.raw.employmentRate * 100)}% employment`,
    },
    {
      key: 'schools',
      label: 'Schools',
      push: relief(r.metrics.education.utilisation, 1.1),
      rating: 'Medium',
      detail: `${Math.round(r.metrics.education.utilisation * 100)}% of seats taken`,
    },
    {
      key: 'healthcare',
      label: 'Healthcare',
      push: Math.max(
        -1,
        Math.min(1, (r.raw.hospitalBeds / Math.max(1, r.population / 1000) - 1.6) * 0.55),
      ),
      rating: 'Medium',
      detail: `${(r.raw.hospitalBeds / Math.max(1, r.population / 1000)).toFixed(1)} beds / 1,000`,
    },
    {
      key: 'traffic',
      label: 'Traffic',
      push: relief(r.metrics.traffic.utilisation, 1.35),
      rating: 'Medium',
      detail: `V/C ${r.raw.congestionIndex.toFixed(2)}`,
    },
    {
      key: 'livability',
      label: 'Quality of life',
      push: Math.max(-1, Math.min(1, (livability - 66) / 26)),
      rating: 'Medium',
      detail: `index ${Math.round(livability)}/100`,
    },
    {
      key: 'utilities',
      label: 'Utilities',
      push: Math.min(
        relief(r.metrics.electricity.utilisation, 1.0),
        relief(r.metrics.water.utilisation, 1.0),
      ),
      rating: 'Medium',
      detail: `grid ${Math.round(r.metrics.electricity.utilisation * 100)}% · water ${Math.round(
        r.metrics.water.utilisation * 100,
      )}%`,
    },
  ].map((f) => ({ ...f, rating: rate(f.push) }))

  const mean = factors.reduce((s, f) => s + f.push, 0) / factors.length

  // a neutral city settles at 92% occupancy; a great one fills up, a failing
  // one empties out — but never past the bounds the engine can simulate
  const equilibrium = Math.max(0.55, Math.min(0.995, 0.92 + mean * 0.26))
  // occupancy closes ~22% of the gap to equilibrium per simulated year
  const annualGrowth = (equilibrium - occupancy) * 0.22

  const limiting = [...factors].sort((a, b) => a.push - b.push)[0]

  return { equilibrium, annualGrowth, factors, limiting }
}

/** One month of drift toward equilibrium. */
export function stepOccupancy(occupancy: number, p: PopulationPressure): number {
  const next = occupancy + p.annualGrowth / 12
  return Math.max(0.4, Math.min(0.999, next))
}
