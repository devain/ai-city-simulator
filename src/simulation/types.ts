export type BuildingType =
  | 'residential_tower'
  | 'house'
  | 'office'
  | 'shop'
  | 'school'
  | 'hospital'
  | 'park'
  | 'parking'
  | 'transit_hub'
  | 'industrial'
  | 'power_plant'
  | 'solar_farm'
  | 'water_facility'

export type DistrictId = 'central' | 'north' | 'east' | 'south' | 'west'

export interface Building {
  id: string
  type: BuildingType
  /** world-space footprint centre */
  x: number
  z: number
  w: number
  d: number
  h: number
  rotation: number
  district: DistrictId
  /** dwelling capacity in persons (residential only) */
  capacity: number
  jobs: number
  retailSqm: number
  parkingSpaces: number
  studentCapacity: number
  beds: number
  /** hectares of green space (parks only) */
  greenHa: number
  /** MW of generation capacity added to the grid (power plants / solar farms) */
  gridMw?: number
  /** MW of that generation that is zero-carbon */
  cleanMw?: number
  /** m3/day of treatment capacity added (water facilities) */
  waterCapacityM3Day?: number
  /** kg/day of CO2 removed or avoided */
  co2OffsetKgDay?: number
  /** added by a scenario or by the user, rather than part of the base city */
  isNew?: boolean
  /** cosmetic seed so the renderer can vary silhouettes deterministically */
  variant: number
  label: string
}

export interface RoadSegment {
  id: string
  axis: 'x' | 'z'
  /** endpoints in world space */
  x1: number
  z1: number
  x2: number
  z2: number
  lanes: number
  arterial: boolean
  district: DistrictId
  /** relative share of the network's peak load this segment attracts */
  loadWeight: number
  lengthKm: number
  name: string
  /** widened by an AI plan — rendered with a highlight */
  upgraded?: boolean
  /** a new grade-separated link (highway / bridge) built above the grid */
  elevated?: boolean
  /** built by a plan rather than part of the base network */
  isNew?: boolean
}

export interface BusRoute {
  id: string
  name: string
  /** ids of the road segments the route runs along */
  roadIds: string[]
  buses: number
  lengthKm: number
  isNew?: boolean
}

export interface Intersection {
  id: string
  x: number
  z: number
  signalised: boolean
  district: DistrictId
}

export interface City {
  buildings: Building[]
  roads: RoadSegment[]
  busRoutes: BusRoute[]
  intersections: Intersection[]
  bounds: number
  gridPositions: number[]
  /** block slots that are still empty — used by scenarios and the build tool */
  freeSlots: { x: number; z: number; district: DistrictId }[]
}

export type PressureLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'

export type MetricKey =
  | 'population'
  | 'traffic'
  | 'electricity'
  | 'water'
  | 'retail'
  | 'education'
  | 'parking'
  | 'transit'
  | 'emissions'
  | 'infrastructure'
  | 'cost'
  | 'economy'
  | 'livability'

export interface Metric {
  key: MetricKey
  label: string
  value: number
  unit: string
  /** 0..1+ — demand divided by available capacity */
  utilisation: number
  pressure: PressureLevel
  /** short human-readable formula used to produce `value` */
  formula: string
  detail: string
}

export interface DistrictLoad {
  id: DistrictId
  name: string
  residents: number
  jobs: number
  students: number
  /** 0..1 normalised pressure per layer */
  traffic: number
  electricity: number
  water: number
  retail: number
  education: number
  parking: number
  emissions: number
}

export interface RoadLoad {
  id: string
  volumeCapacityRatio: number
  speedKph: number
  level: PressureLevel
}

export interface SimulationResult {
  population: number
  households: number
  children: number
  students: number
  jobs: number
  vehicles: number
  metrics: Record<MetricKey, Metric>
  districts: DistrictLoad[]
  roads: RoadLoad[]
  /** raw model outputs, kept so panels / the analyst can dig in */
  raw: {
    peakVehicleTrips: number
    networkCapacity: number
    congestionIndex: number
    averageSpeedKph: number
    dailyDelayHours: number
    electricityKwhDay: number
    peakDemandMw: number
    waterM3Day: number
    wastewaterM3Day: number
    retailDemandSqm: number
    retailSupplySqm: number
    schoolSeatsNeeded: number
    schoolSeats: number
    classroomsShort: number
    parkingDemand: number
    parkingSupply: number
    transitRidership: number
    transitCapacity: number
    gridCapacityMw: number
    waterCapacityM3Day: number
    grossValueAdded: number
    employmentRate: number
    livabilityIndex: number
    co2KgDay: number
    co2PerCapitaKgYear: number
    annualOperatingCost: number
    hospitalBeds: number
    greenHa: number
  }
}
