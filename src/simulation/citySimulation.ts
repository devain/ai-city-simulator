/**
 * citySimulation.ts — the engine boundary.
 *
 * Everything the UI knows about the simulation goes through `runSimulation`.
 * Swapping the deterministic models below for calibrated models, a WASM
 * micro-simulation or a remote ML service means re-implementing this one
 * function; nothing else in the app touches the individual models.
 *
 * PROTOTYPE SIMULATION — ILLUSTRATIVE ESTIMATES ONLY.
 */
import type { CityConfig } from './config'
import type { City, DistrictId, DistrictLoad, Metric, MetricKey, SimulationResult } from './types'
import { clamp01, pressureFromUtilisation } from './pressure'
import { inventory, runPopulationModel } from './populationModel'
import { runTrafficModel } from './trafficModel'
import { runEnergyModel } from './energyModel'
import { runWaterModel } from './waterModel'
import { runRetailModel } from './retailModel'
import { runEducationModel } from './educationModel'
import { runParkingModel } from './parkingModel'
import { runTransitModel } from './transitModel'
import { runEmissionsModel } from './emissionsModel'
import { runCostModel } from './costModel'
import { runEconomyModel } from './economyModel'
import { runLivabilityModel } from './livabilityModel'

export const DISTRICT_NAMES: Record<DistrictId, string> = {
  central: 'Central Core',
  north: 'North Quarter',
  east: 'East Ridge',
  south: 'South Gate',
  west: 'West Harbour',
}

export interface SimulationOptions {
  /** shift of person-trips from car to transit, e.g. after a new transit hub */
  transitShift?: number
}

export function runSimulation(
  city: City,
  config: CityConfig,
  options: SimulationOptions = {},
): SimulationResult {
  const inv = inventory(city, config)
  // every transit hub above the baseline shifts trips from car to transit
  const autoShift = Math.min(
    0.2,
    Math.max(0, inv.transitHubs - config.transitHubs) * 0.075 + inv.busRoutes * 0.025,
  )
  const transitShift = options.transitShift ?? autoShift

  const pop = runPopulationModel(city, config, inv)
  const education = runEducationModel(pop.population, config, inv)
  const water = runWaterModel(pop.population, inv.jobs, education.students, config, inv)
  const energy = runEnergyModel(pop.population, inv.jobs, water.totalM3Day, config, inv)
  const traffic = runTrafficModel(pop.population, inv.jobs, city, config, inv, transitShift)
  const retail = runRetailModel(pop.population, inv.jobs, config, inv)
  const parking = runParkingModel(pop.population, inv.jobs, config, inv, transitShift)
  const transit = runTransitModel(pop.population, config, inv, transitShift)
  const emissions = runEmissionsModel(
    pop.population,
    traffic.vehicleKmPerDay,
    energy.totalKwhDay,
    water.totalM3Day,
    config,
    inv,
    energy.cleanShare,
  )
  const economy = runEconomyModel(pop.population, config, inv)
  const livability = runLivabilityModel(
    pop.population,
    traffic.congestionIndex,
    education.utilisation,
    parking.utilisation,
    emissions.utilisation,
    transit.modeShare,
    config,
    inv,
  )
  const cost = runCostModel(
    pop.population,
    education.students,
    energy.totalKwhDay,
    water.totalM3Day,
    transit.dailyRidership,
    config,
    inv,
  )

  const infraUtil =
    traffic.congestionIndex * 0.24 +
    energy.utilisation * 0.16 +
    water.utilisation * 0.14 +
    education.utilisation * 0.16 +
    parking.utilisation * 0.18 +
    retail.utilisation * 0.06 +
    transit.utilisation * 0.06

  const metric = (
    key: MetricKey,
    label: string,
    value: number,
    unit: string,
    utilisation: number,
    formula: string,
    detail: string,
  ): Metric => ({
    key,
    label,
    value,
    unit,
    utilisation,
    pressure: pressureFromUtilisation(utilisation),
    formula,
    detail,
  })

  const n = (v: number) => Math.round(v).toLocaleString('en-US')

  const metrics: Record<MetricKey, Metric> = {
    population: metric(
      'population',
      'Population',
      pop.population,
      'residents',
      pop.densityPerHa / config.targetDensityPerHa,
      pop.formula,
      n(pop.households) + ' households · ' + pop.densityPerHa.toFixed(0) + ' residents/ha',
    ),
    traffic: metric(
      'traffic',
      'Traffic',
      traffic.peakVehicleTrips,
      'veh/peak-h',
      traffic.congestionIndex,
      traffic.formula,
      'V/C ' +
        traffic.congestionIndex.toFixed(2) +
        ' · average speed ' +
        traffic.averageSpeedKph.toFixed(0) +
        ' km/h',
    ),
    electricity: metric(
      'electricity',
      'Electricity',
      energy.totalKwhDay,
      'kWh/day',
      energy.utilisation,
      energy.formula,
      'Peak ' +
        energy.peakDemandMw.toFixed(1) +
        ' MW of ' +
        energy.capacityMw.toFixed(0) +
        ' MW capacity' +
        (energy.cleanShare > 0.01
          ? ' · ' + (energy.cleanShare * 100).toFixed(0) + '% zero-carbon'
          : ''),
    ),
    water: metric(
      'water',
      'Water',
      water.totalM3Day,
      'm³/day',
      water.utilisation,
      water.formula,
      n(water.capacityM3Day) + ' m³/day treatment capacity · ' + n(water.wastewaterM3Day) + ' m³/day wastewater',
    ),
    retail: metric(
      'retail',
      'Retail demand',
      retail.demandSqm,
      'm² demand',
      retail.utilisation,
      retail.formula,
      n(retail.supplySqm) + ' m² of retail floor space supplied',
    ),
    education: metric(
      'education',
      'School capacity',
      education.students,
      'students',
      education.utilisation,
      education.formula,
      n(education.seats) + ' seats across ' + inv.schools + ' schools',
    ),
    parking: metric(
      'parking',
      'Parking',
      parking.demand,
      'spaces',
      parking.utilisation,
      parking.formula,
      n(parking.supply) + ' spaces supplied · deficit ' + n(parking.deficit),
    ),
    transit: metric(
      'transit',
      'Public transit',
      transit.dailyRidership,
      'riders/day',
      transit.utilisation,
      transit.formula,
      n(transit.capacityPerPeakHour) +
        ' peak-hour places · ' +
        (transit.modeShare * 100).toFixed(0) +
        '% mode share',
    ),
    emissions: metric(
      'emissions',
      'CO₂ emissions',
      emissions.totalKgDay,
      'kg/day',
      emissions.utilisation,
      emissions.formula,
      emissions.perCapitaKgYear.toFixed(0) + ' kg per resident per year',
    ),
    infrastructure: metric(
      'infrastructure',
      'Infrastructure pressure',
      infraUtil * 100,
      'index',
      infraUtil,
      'weighted mean of network, grid, water, school, parking and transit utilisation',
      'Composite index across all modelled systems',
    ),
    economy: metric(
      'economy',
      'Economic activity',
      economy.grossValueAdded,
      'USD GVA/yr',
      economy.utilisation,
      economy.formula,
      '$' +
        n(economy.gvaPerCapita) +
        ' per resident · ' +
        (economy.employmentRate * 100).toFixed(0) +
        '% of the labour force employed locally',
    ),
    livability: metric(
      'livability',
      'Quality of life',
      livability.index,
      'index /100',
      livability.utilisation,
      livability.formula,
      livability.factors
        .slice(0, 3)
        .map((f) => f.label + ' ' + (f.score * 100).toFixed(0))
        .join(' · '),
    ),
    cost: metric(
      'cost',
      'Operating cost',
      cost.total,
      'USD/year',
      cost.perCapita / config.opexBudgetPerCapitaYear,
      cost.formula,
      '$' + n(cost.perCapita) + ' per resident per year',
    ),
  }

  const districts = buildDistrictLoads(city, config, inv, {
    trafficUtil: traffic.congestionIndex,
    energyUtil: energy.utilisation,
    waterUtil: water.utilisation,
    retailUtil: retail.utilisation,
    educationUtil: education.utilisation,
    parkingUtil: parking.utilisation,
    emissionsUtil: emissions.utilisation,
    roadLoads: traffic.roads,
  })

  return {
    population: pop.population,
    households: pop.households,
    children: pop.children,
    students: education.students,
    jobs: inv.jobs,
    vehicles: parking.vehicles,
    metrics,
    districts,
    roads: traffic.roads,
    raw: {
      peakVehicleTrips: traffic.peakVehicleTrips,
      networkCapacity: traffic.networkCapacity,
      congestionIndex: traffic.congestionIndex,
      averageSpeedKph: traffic.averageSpeedKph,
      dailyDelayHours: traffic.dailyDelayHours,
      electricityKwhDay: energy.totalKwhDay,
      peakDemandMw: energy.peakDemandMw,
      waterM3Day: water.totalM3Day,
      wastewaterM3Day: water.wastewaterM3Day,
      retailDemandSqm: retail.demandSqm,
      retailSupplySqm: retail.supplySqm,
      schoolSeatsNeeded: education.students,
      schoolSeats: education.seats,
      classroomsShort: education.classroomsShort,
      parkingDemand: parking.demand,
      parkingSupply: parking.supply,
      transitRidership: transit.dailyRidership,
      transitCapacity: transit.capacityPerPeakHour,
      gridCapacityMw: energy.capacityMw,
      waterCapacityM3Day: water.capacityM3Day,
      grossValueAdded: economy.grossValueAdded,
      employmentRate: economy.employmentRate,
      livabilityIndex: livability.index,
      co2KgDay: emissions.totalKgDay,
      co2PerCapitaKgYear: emissions.perCapitaKgYear,
      annualOperatingCost: cost.total,
      hospitalBeds: inv.hospitalBeds,
      greenHa: inv.greenHa,
    },
  }
}

const DISTRICTS: DistrictId[] = ['central', 'north', 'east', 'south', 'west']

function buildDistrictLoads(
  city: City,
  config: CityConfig,
  inv: ReturnType<typeof inventory>,
  ctx: {
    trafficUtil: number
    energyUtil: number
    waterUtil: number
    retailUtil: number
    educationUtil: number
    parkingUtil: number
    emissionsUtil: number
    roadLoads: { id: string; volumeCapacityRatio: number }[]
  },
): DistrictLoad[] {
  const roadById = new Map(ctx.roadLoads.map((r) => [r.id, r.volumeCapacityRatio]))

  const raw = DISTRICTS.map((id) => {
    const d = inv.byDistrict[id]
    const residents = d.residentialCapacity * config.occupancyRate
    const students = residents * config.childrenRate * config.schoolEnrollmentRate
    const roads = city.roads.filter((r) => r.district === id)
    const roadPressure =
      roads.length > 0
        ? roads.reduce((s, r) => s + (roadById.get(r.id) ?? 0), 0) / roads.length
        : ctx.trafficUtil

    return {
      id,
      residents,
      jobs: d.jobs,
      students,
      trafficRaw: roadPressure,
      energyRaw:
        residents * config.electricityPerPersonKwhDay + d.jobs * config.electricityPerJobKwhDay,
      waterRaw: residents * config.waterPerPersonM3Day + d.jobs * config.waterPerJobM3Day,
      retailRaw:
        residents * config.retailSqmPerResident + d.jobs * config.retailSqmPerWorker - d.retailSqm,
      educationRaw: students / Math.max(140, d.schoolSeats),
      parkingRaw:
        (residents * config.carOwnershipRate * config.residentialParkingRatio +
          d.jobs * config.commercialParkingPerJob) /
        Math.max(200, d.parkingSpaces + config.onStreetParking / 5),
      emissionsRaw: residents * 1.1 + d.jobs * 2.2 - d.greenHa * 40,
    }
  })

  const maxOf = (k: 'energyRaw' | 'waterRaw' | 'retailRaw' | 'educationRaw' | 'parkingRaw' | 'emissionsRaw') =>
    Math.max(...raw.map((r) => Math.abs(r[k]) || 0), 1e-6)

  const mx = {
    energy: maxOf('energyRaw'),
    water: maxOf('waterRaw'),
    retail: maxOf('retailRaw'),
    education: maxOf('educationRaw'),
    parking: maxOf('parkingRaw'),
    emissions: maxOf('emissionsRaw'),
  }

  /** blend the spatial share with the city-wide utilisation so the heatmap reacts to scenarios */
  const blend = (share: number, globalUtil: number) =>
    clamp01(0.3 + 0.7 * share) * clamp01(0.3 + 0.8 * globalUtil)

  return raw.map((r) => ({
    id: r.id,
    name: DISTRICT_NAMES[r.id],
    residents: r.residents,
    jobs: r.jobs,
    students: r.students,
    traffic: clamp01(r.trafficRaw / 1.5),
    electricity: blend(r.energyRaw / mx.energy, ctx.energyUtil),
    water: blend(r.waterRaw / mx.water, ctx.waterUtil),
    retail: blend(Math.max(0, r.retailRaw) / mx.retail, ctx.retailUtil),
    education: blend(r.educationRaw / mx.education, ctx.educationUtil),
    parking: blend(r.parkingRaw / mx.parking, ctx.parkingUtil),
    emissions: blend(Math.max(0, r.emissionsRaw) / mx.emissions, ctx.emissionsUtil),
  }))
}

/** percentage change helper used throughout the UI */
export function delta(current: number, baseline: number): number {
  if (!baseline) return 0
  return ((current - baseline) / baseline) * 100
}
