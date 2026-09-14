import type { CityConfig } from './config'
import type { CityInventory } from './populationModel'

export interface EmissionsResult {
  transportKg: number
  electricityKg: number
  heatingKg: number
  industrialKg: number
  waterKg: number
  sequestrationKg: number
  totalKgDay: number
  tonnesPerYear: number
  perCapitaKgYear: number
  utilisation: number
  formula: string
}

/**
 * CO2 = vehicleKm x gCO2/km
 *     + electricity kWh x gridIntensity
 *     + heating (population-scaled + fixed base)
 *     + industrial process emissions
 *     + water and wastewater treatment
 *     - park sequestration
 */
export function runEmissionsModel(
  population: number,
  vehicleKmPerDay: number,
  electricityKwhDay: number,
  waterM3Day: number,
  config: CityConfig,
  inv: CityInventory,
  cleanShare = 0,
): EmissionsResult {
  const transportKg = (vehicleKmPerDay * config.vehicleGramsCo2PerKm) / 1000
  // zero-carbon generation displaces grid emissions one-for-one
  const electricityKg = electricityKwhDay * config.gridKgCo2PerKwh * (1 - cleanShare)
  const heatingKg = population * config.heatingKgCo2PerPersonDay + config.heatingBaseKgDay
  const industrialKg = config.industrialProcessKgCo2Day * (inv.industrial / 4 || 1)
  const waterKg = waterM3Day * config.waterKgCo2PerM3
  const sequestrationKg = inv.greenHa * config.treeSequestrationKgPerHaDay + inv.co2OffsetKgDay

  const totalKgDay =
    transportKg + electricityKg + heatingKg + industrialKg + waterKg - sequestrationKg
  const perCapitaKgYear = (totalKgDay * 365) / Math.max(1, population)

  return {
    transportKg,
    electricityKg,
    heatingKg,
    industrialKg,
    waterKg,
    sequestrationKg,
    totalKgDay,
    tonnesPerYear: (totalKgDay * 365) / 1000,
    perCapitaKgYear,
    utilisation: totalKgDay / config.carbonBudgetKgDay,
    formula: 'CO2 = transport + grid electricity + heating + industry + water - parks',
  }
}
