import type { CityConfig } from './config'
import type { CityInventory } from './populationModel'

export interface LivabilityFactor {
  key: string
  label: string
  /** 0..1, higher is better */
  score: number
  weight: number
  detail: string
}

export interface LivabilityResult {
  /** 0..100, higher is better */
  index: number
  factors: LivabilityFactor[]
  /** utilisation-style value: high = poor quality of life */
  utilisation: number
  formula: string
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * Quality of life as a weighted basket of things residents actually feel:
 * congestion, school places, green space, walkable retail, transit coverage,
 * parking stress and air quality. Every input is already produced by another
 * model, so the index moves whenever the city does.
 */
export function runLivabilityModel(
  population: number,
  congestionIndex: number,
  educationUtilisation: number,
  parkingUtilisation: number,
  emissionsUtilisation: number,
  transitModeShare: number,
  config: CityConfig,
  inv: CityInventory,
): LivabilityResult {
  const greenSqmPerResident = (inv.greenHa * 10_000) / Math.max(1, population)
  const retailSqmPerResident = inv.retailSqm / Math.max(1, population)

  const factors: LivabilityFactor[] = [
    {
      key: 'congestion',
      label: 'Traffic comfort',
      score: clamp01(1.25 - congestionIndex),
      weight: 0.22,
      detail: `congestion index ${congestionIndex.toFixed(2)}`,
    },
    {
      key: 'schools',
      label: 'School places',
      score: clamp01(1.3 - educationUtilisation),
      weight: 0.2,
      detail: `${(educationUtilisation * 100).toFixed(0)}% of seats used`,
    },
    {
      key: 'green',
      label: 'Green space',
      score: clamp01(greenSqmPerResident / config.targetGreenSqmPerResident),
      weight: 0.18,
      detail: `${greenSqmPerResident.toFixed(1)} m2 per resident`,
    },
    {
      key: 'amenities',
      label: 'Local amenities',
      score: clamp01(retailSqmPerResident / config.targetRetailSqmPerResident),
      weight: 0.14,
      detail: `${retailSqmPerResident.toFixed(2)} m2 retail per resident`,
    },
    {
      key: 'transit',
      label: 'Transit access',
      score: clamp01(transitModeShare / config.targetTransitCoverage),
      weight: 0.12,
      detail: `${(transitModeShare * 100).toFixed(0)}% mode share`,
    },
    {
      key: 'air',
      label: 'Air quality',
      score: clamp01(1.3 - emissionsUtilisation),
      weight: 0.08,
      detail: `${(emissionsUtilisation * 100).toFixed(0)}% of carbon budget`,
    },
    {
      key: 'parking',
      label: 'Parking ease',
      score: clamp01(1.25 - parkingUtilisation),
      weight: 0.06,
      detail: `${(parkingUtilisation * 100).toFixed(0)}% of spaces used`,
    },
  ]

  const index = factors.reduce((s, f) => s + f.score * f.weight, 0) * 100

  return {
    index,
    factors,
    utilisation: clamp01(1 - index / 100),
    formula: 'quality of life = weighted basket of traffic, schools, green space, amenities, transit, air and parking',
  }
}
