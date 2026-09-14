import type { CityConfig } from './config'
import type { CityInventory } from './populationModel'

export interface EconomyResult {
  jobs: number
  labourForce: number
  employmentRate: number
  jobsPerResident: number
  businessGva: number
  retailGva: number
  householdSpend: number
  grossValueAdded: number
  gvaPerCapita: number
  /** 0..1+ — economic activity against the target for a city this size */
  activityIndex: number
  /** utilisation-style value: high = weak economy */
  utilisation: number
  formula: string
}

/**
 * economicActivity = jobs x GVA/job
 *                  + retail floor area x GVA/m2
 *                  + population x local household spend
 *
 * Reported per capita and compared with a target, so growth only improves the
 * economy score if jobs and retail grow with the population.
 */
export function runEconomyModel(
  population: number,
  config: CityConfig,
  inv: CityInventory,
): EconomyResult {
  const jobs = inv.jobs
  const labourForce = population * config.labourParticipation
  const employmentRate = Math.min(1, jobs / Math.max(1, labourForce))

  const businessGva = jobs * config.gvaPerJobYear
  const retailGva = inv.retailSqm * config.gvaPerRetailSqmYear
  const householdSpend = population * config.residentSpendYear
  const grossValueAdded = businessGva + retailGva + householdSpend
  const gvaPerCapita = grossValueAdded / Math.max(1, population)
  const activityIndex = gvaPerCapita / config.targetGvaPerCapita

  return {
    jobs,
    labourForce,
    employmentRate,
    jobsPerResident: jobs / Math.max(1, population),
    businessGva,
    retailGva,
    householdSpend,
    grossValueAdded,
    gvaPerCapita,
    activityIndex,
    // a weak economy reads as "pressure" so it lines up with every other metric
    utilisation: Math.max(0, Math.min(1.6, 1.25 - activityIndex * 0.75)),
    formula: 'GVA = jobs x 68k + retail m2 x 3.1k + residents x 4.2k spend',
  }
}
