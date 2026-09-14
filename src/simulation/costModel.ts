import type { CityConfig } from './config'
import type { CityInventory } from './populationModel'

export interface CostResult {
  energyCost: number
  waterCost: number
  roadsCost: number
  transitCost: number
  educationCost: number
  wasteCost: number
  servicesCost: number
  total: number
  perCapita: number
  formula: string
}

/** Annual municipal operating cost, aggregated from the other models. */
export function runCostModel(
  population: number,
  students: number,
  electricityKwhDay: number,
  waterM3Day: number,
  transitRidership: number,
  config: CityConfig,
  inv: CityInventory,
): CostResult {
  const energyCost = electricityKwhDay * 365 * config.electricityCostPerKwh * 0.22
  const waterCost = waterM3Day * 365 * config.waterCostPerM3 * 0.35
  const roadsCost = inv.laneKm * config.roadMaintenancePerLaneKmYear
  const transitCost = transitRidership * 365 * config.transitSubsidyPerRiderYear
  const educationCost = students * config.schoolCostPerStudentYear
  const wasteCost = population * config.wasteCostPerPersonYear
  const servicesCost = population * config.generalServicesPerPersonYear
  const total =
    energyCost + waterCost + roadsCost + transitCost + educationCost + wasteCost + servicesCost

  return {
    energyCost,
    waterCost,
    roadsCost,
    transitCost,
    educationCost,
    wasteCost,
    servicesCost,
    total,
    perCapita: total / Math.max(1, population),
    formula: 'opex = energy + water + roads + transit + education + waste + services',
  }
}
