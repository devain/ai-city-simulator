import type { CityConfig } from './config'
import type { Building, City, DistrictId } from './types'

export interface CityInventory {
  residentialCapacity: number
  jobs: number
  retailSqm: number
  schoolSeats: number
  schools: number
  hospitals: number
  hospitalBeds: number
  parkingSpaces: number
  greenHa: number
  transitHubs: number
  industrial: number
  streetLights: number
  laneKm: number
  /** generation capacity added by power plants / solar farms */
  gridMw: number
  cleanMw: number
  /** treatment capacity added by water facilities */
  waterCapacityM3Day: number
  co2OffsetKgDay: number
  /** buses running on AI-built routes, and the km of route they cover */
  extraBuses: number
  busRouteKm: number
  busRoutes: number
  upgradedRoads: number
  newRoads: number
  byDistrict: Record<DistrictId, { residentialCapacity: number; jobs: number; retailSqm: number; parkingSpaces: number; schoolSeats: number; greenHa: number }>
}

const EMPTY_DISTRICT = () => ({
  residentialCapacity: 0,
  jobs: 0,
  retailSqm: 0,
  parkingSpaces: 0,
  schoolSeats: 0,
  greenHa: 0,
})

/** Roll the building list up into the aggregates every downstream model needs. */
export function inventory(city: City, config: CityConfig): CityInventory {
  const byDistrict: CityInventory['byDistrict'] = {
    central: EMPTY_DISTRICT(),
    north: EMPTY_DISTRICT(),
    east: EMPTY_DISTRICT(),
    south: EMPTY_DISTRICT(),
    west: EMPTY_DISTRICT(),
  }

  let residentialCapacity = 0
  let jobs = 0
  let retailSqm = 0
  let schoolSeats = 0
  let schools = 0
  let hospitals = 0
  let hospitalBeds = 0
  let parkingSpaces = 0
  let greenHa = 0
  let transitHubs = 0
  let industrial = 0
  let gridMw = 0
  let cleanMw = 0
  let waterCapacityM3Day = 0
  let co2OffsetKgDay = 0

  for (const b of city.buildings) {
    const d = byDistrict[b.district]
    residentialCapacity += b.capacity
    d.residentialCapacity += b.capacity
    jobs += b.jobs
    d.jobs += b.jobs
    retailSqm += b.retailSqm
    d.retailSqm += b.retailSqm
    parkingSpaces += b.parkingSpaces
    d.parkingSpaces += b.parkingSpaces
    schoolSeats += b.studentCapacity
    d.schoolSeats += b.studentCapacity
    greenHa += b.greenHa
    d.greenHa += b.greenHa
    hospitalBeds += b.beds
    if (b.type === 'school') schools += 1
    if (b.type === 'hospital') hospitals += 1
    if (b.type === 'transit_hub') transitHubs += 1
    if (b.type === 'industrial') industrial += 1
    gridMw += b.gridMw ?? 0
    cleanMw += b.cleanMw ?? 0
    waterCapacityM3Day += b.waterCapacityM3Day ?? 0
    co2OffsetKgDay += b.co2OffsetKgDay ?? 0
  }

  const busRoutes = city.busRoutes ?? []
  const extraBuses = busRoutes.reduce((s, r) => s + r.buses, 0)
  const busRouteKm = busRoutes.reduce((s, r) => s + r.lengthKm, 0)

  const laneKm = city.roads.reduce((sum, r) => sum + r.lengthKm * r.lanes, 0)
  // one light every ~22 m along both kerbs
  const streetLights = Math.round(city.roads.reduce((s, r) => s + r.lengthKm, 0) * 1000 / 22) * 2

  return {
    residentialCapacity,
    jobs: jobs || config.jobs,
    retailSqm,
    schoolSeats,
    schools,
    hospitals,
    hospitalBeds,
    parkingSpaces: parkingSpaces + config.onStreetParking + config.privateResidentialParking,
    greenHa,
    transitHubs,
    industrial,
    streetLights,
    laneKm,
    gridMw,
    cleanMw,
    waterCapacityM3Day,
    co2OffsetKgDay,
    extraBuses,
    busRouteKm,
    busRoutes: busRoutes.length,
    upgradedRoads: city.roads.filter((r) => r.upgraded).length,
    newRoads: city.roads.filter((r) => r.isNew).length,
    byDistrict,
  }
}

export interface PopulationResult {
  population: number
  households: number
  children: number
  students: number
  vehicles: number
  jobs: number
  densityPerHa: number
  formula: string
}

/**
 * population = occupied dwelling capacity
 *            = SUM(residential building capacity) * occupancyRate
 */
export function runPopulationModel(
  city: City,
  config: CityConfig,
  inv: CityInventory,
): PopulationResult {
  const population = inv.residentialCapacity * config.occupancyRate
  const households = population / config.householdSize
  const children = population * config.childrenRate
  const students = children * config.schoolEnrollmentRate
  const vehicles = population * config.carOwnershipRate
  const areaM = city.bounds * 2 * config.metresPerUnit
  const areaHa = (areaM ** 2) / 10_000

  return {
    population,
    households,
    children,
    students,
    vehicles,
    jobs: inv.jobs,
    densityPerHa: population / Math.max(1, areaHa),
    formula: 'population = Σ(dwelling capacity) × occupancyRate',
  }
}

export function residentialBuildings(city: City): Building[] {
  return city.buildings.filter((b) => b.capacity > 0)
}
