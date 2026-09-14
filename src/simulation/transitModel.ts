import type { CityConfig } from './config'
import type { CityInventory } from './populationModel'

export interface TransitResult {
  dailyRidership: number
  peakRidership: number
  capacityPerPeakHour: number
  utilisation: number
  modeShare: number
  formula: string
}

/**
 * transitRidership = population x tripsPerPerson x transitModeShare
 * capacity         = buses x capacity x tripsPerPeakHour + hubs x metroCapacity
 */
export function runTransitModel(
  population: number,
  config: CityConfig,
  inv: CityInventory,
  transitShift = 0,
): TransitResult {
  const modeShare = config.transitModeShare + transitShift
  const dailyRidership = population * config.tripsPerPersonPerDay * modeShare
  const peakRidership = dailyRidership * config.peakHourFactor
  const capacityPerPeakHour =
    (config.buses + inv.extraBuses) * config.busCapacity * config.busTripsPerPeakHour +
    inv.transitHubs * config.metroCapacityPerHub

  return {
    dailyRidership,
    peakRidership,
    capacityPerPeakHour,
    utilisation: peakRidership / Math.max(1, capacityPerPeakHour),
    modeShare,
    formula: 'ridership = pop x trips/person x transit mode share',
  }
}
