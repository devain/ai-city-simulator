import type { CityConfig } from './config'
import type { CityInventory } from './populationModel'

export interface RetailResult {
  residentDemandSqm: number
  workerDemandSqm: number
  visitorDemandSqm: number
  demandSqm: number
  supplySqm: number
  gapSqm: number
  utilisation: number
  formula: string
}

/**
 * retailDemand = population x sqmPerResident
 *              + jobs x sqmPerWorker
 *              + visitor / catchment demand (fixed)
 */
export function runRetailModel(
  population: number,
  jobs: number,
  config: CityConfig,
  inv: CityInventory,
): RetailResult {
  const residentDemandSqm = population * config.retailSqmPerResident
  const workerDemandSqm = jobs * config.retailSqmPerWorker
  const visitorDemandSqm = config.visitorRetailSqm
  const demandSqm = residentDemandSqm + workerDemandSqm + visitorDemandSqm
  const supplySqm = inv.retailSqm || config.retailFloorAreaSqm

  return {
    residentDemandSqm,
    workerDemandSqm,
    visitorDemandSqm,
    demandSqm,
    supplySqm,
    gapSqm: demandSqm - supplySqm * config.retailViableUtilisation,
    utilisation: demandSqm / Math.max(1, supplySqm),
    formula: 'retail demand = pop x 1.35 sqm + jobs x 0.9 sqm + catchment demand',
  }
}
