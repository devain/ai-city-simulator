import type { CityConfig } from './config'
import type { CityInventory } from './populationModel'

export interface ParkingResult {
  vehicles: number
  residentialDemand: number
  commercialDemand: number
  retailDemand: number
  demand: number
  supply: number
  deficit: number
  utilisation: number
  formula: string
}

/**
 * parkingDemand = population x carOwnershipRate x residentialParkingRatio
 *               + jobs x spacesPerJob
 *               + retail floor area / 100 x spacesPer100sqm
 */
export function runParkingModel(
  population: number,
  jobs: number,
  config: CityConfig,
  inv: CityInventory,
  transitShift = 0,
): ParkingResult {
  const ownership = Math.max(0.15, config.carOwnershipRate - transitShift * 0.35)
  const vehicles = population * ownership
  const residentialDemand = vehicles * config.residentialParkingRatio
  const commercialDemand = jobs * config.commercialParkingPerJob
  const retailDemand = (inv.retailSqm / 100) * config.retailParkingPer100Sqm
  const demand = residentialDemand + commercialDemand + retailDemand
  const supply = inv.parkingSpaces

  return {
    vehicles,
    residentialDemand,
    commercialDemand,
    retailDemand,
    demand,
    supply,
    deficit: Math.max(0, demand - supply),
    utilisation: demand / Math.max(1, supply),
    formula: 'parking = vehicles x 0.95 + jobs x 0.28 + retail sqm/100 x 2.6',
  }
}
