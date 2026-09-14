import type { CityConfig } from './config'
import type { CityInventory } from './populationModel'

export interface EnergyResult {
  residentialKwh: number
  commercialKwh: number
  industrialKwh: number
  institutionalKwh: number
  municipalKwh: number
  totalKwhDay: number
  peakDemandMw: number
  capacityMw: number
  /** share of supply covered by zero-carbon generation */
  cleanShare: number
  utilisation: number
  formula: string
}

/**
 * electricityDemand = population × electricityPerPerson
 *                   + jobs × electricityPerJob
 *                   + industrial baseload
 *                   + schools × schoolLoad + hospitals × hospitalLoad
 *                   + street lighting + water pumping
 */
export function runEnergyModel(
  population: number,
  jobs: number,
  waterM3Day: number,
  config: CityConfig,
  inv: CityInventory,
): EnergyResult {
  const residentialKwh = population * config.electricityPerPersonKwhDay
  const commercialKwh = jobs * config.electricityPerJobKwhDay
  const industrialKwh = config.industrialBaseloadKwhDay * (inv.industrial / 4 || 1)
  const institutionalKwh = inv.schools * config.schoolKwhDay + inv.hospitals * config.hospitalKwhDay
  const municipalKwh =
    inv.streetLights * config.streetLightKwhDay + waterM3Day * config.waterPumpingKwhPerM3

  const totalKwhDay = residentialKwh + commercialKwh + industrialKwh + institutionalKwh + municipalKwh
  // peak MW = daily kWh × peakFactor / 1000
  const peakMw = (totalKwhDay * config.gridPeakFactor) / 1000

  const capacityMw = config.gridCapacityMw + inv.gridMw
  const cleanShare = Math.min(0.85, inv.cleanMw / Math.max(1, peakMw))

  return {
    residentialKwh,
    commercialKwh,
    industrialKwh,
    institutionalKwh,
    municipalKwh,
    totalKwhDay,
    peakDemandMw: peakMw,
    capacityMw,
    cleanShare,
    utilisation: peakMw / capacityMw,
    formula: 'electricity = pop × 8.6 kWh + jobs × 26 kWh + industry + institutions + municipal',
  }
}
