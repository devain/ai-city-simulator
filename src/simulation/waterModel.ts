import type { CityConfig } from './config'
import type { CityInventory } from './populationModel'

export interface WaterResult {
  residentialM3: number
  commercialM3: number
  institutionalM3: number
  irrigationM3: number
  industrialM3: number
  lossesM3: number
  totalM3Day: number
  wastewaterM3Day: number
  capacityM3Day: number
  utilisation: number
  formula: string
}

/**
 * waterDemand = population × waterPerPerson
 *             + jobs × waterPerJob
 *             + students × waterPerStudent + hospitals × waterPerHospital
 *             + parks irrigation + industrial process water
 *             + non-revenue water (leakage), applied to the subtotal
 */
export function runWaterModel(
  population: number,
  jobs: number,
  students: number,
  config: CityConfig,
  inv: CityInventory,
): WaterResult {
  const residentialM3 = population * config.waterPerPersonM3Day
  const commercialM3 = jobs * config.waterPerJobM3Day
  const institutionalM3 =
    students * config.waterPerStudentM3Day + inv.hospitals * config.waterPerHospitalM3Day
  const irrigationM3 = inv.greenHa * config.parkIrrigationM3PerHaDay
  const industrialM3 = config.industrialWaterM3Day * (inv.industrial / 4 || 1)

  const subtotal = residentialM3 + commercialM3 + institutionalM3 + irrigationM3 + industrialM3
  const lossesM3 = subtotal * config.nonRevenueWaterRate
  const totalM3Day = subtotal + lossesM3

  const capacityM3Day = config.waterPlantCapacityM3Day + inv.waterCapacityM3Day

  return {
    residentialM3,
    commercialM3,
    institutionalM3,
    irrigationM3,
    industrialM3,
    lossesM3,
    totalM3Day,
    wastewaterM3Day: totalM3Day * config.wastewaterReturnRate,
    capacityM3Day,
    utilisation: totalM3Day / capacityM3Day,
    formula: 'water = pop × 145 L + jobs + institutions + irrigation + industry + 18% losses',
  }
}
