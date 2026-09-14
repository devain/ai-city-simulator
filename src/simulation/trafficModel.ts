import type { CityConfig } from './config'
import type { City, RoadLoad } from './types'
import { pressureFromUtilisation } from './pressure'
import type { CityInventory } from './populationModel'

export interface TrafficResult {
  dailyPersonTrips: number
  dailyVehicleTrips: number
  residentPeakTrips: number
  jobPeakTrips: number
  externalPeakTrips: number
  peakVehicleTrips: number
  networkCapacity: number
  congestionIndex: number
  averageSpeedKph: number
  dailyDelayHours: number
  vehicleKmPerDay: number
  roads: RoadLoad[]
  formula: string
}

/**
 * trafficDemand (peak hour, vehicles) =
 *     population × tripsPerPerson × vehicleModeShare × peakHourFactor
 *   + jobs × tripsPerJob × jobVehicleShare × peakHourFactor
 *   + externalPeakTrips            (through traffic, freight, service)
 *
 * Network performance uses a simplified BPR curve:
 *     speed = freeFlow / (1 + 0.15 × (V/C)^4)
 */
export function runTrafficModel(
  population: number,
  jobs: number,
  city: City,
  config: CityConfig,
  inv: CityInventory,
  transitShift = 0,
): TrafficResult {
  const vehicleShare = Math.max(0.15, config.vehicleModeShare - transitShift)

  const dailyPersonTrips = population * config.tripsPerPersonPerDay
  const residentVehicleTrips = dailyPersonTrips * vehicleShare
  const jobVehicleTrips = jobs * config.jobTripsPerJob * config.jobVehicleShare

  const residentPeakTrips = residentVehicleTrips * config.peakHourFactor
  const jobPeakTrips = jobVehicleTrips * config.peakHourFactor
  const externalPeakTrips = config.externalPeakTrips
  const peakVehicleTrips = residentPeakTrips + jobPeakTrips + externalPeakTrips

  // capacity of the whole network, expressed in comparable "peak trips"
  const laneSegments = city.roads.reduce((s, r) => s + r.lanes, 0)
  const networkCapacity = (laneSegments * config.laneCapacityPerHour) / config.tripPathFactor

  const vc = peakVehicleTrips / Math.max(1, networkCapacity)
  const congestionIndex = vc
  const averageSpeedKph = config.freeFlowSpeedKph / (1 + 0.15 * Math.pow(vc, 4))

  const dailyVehicleTrips = residentVehicleTrips + jobVehicleTrips + externalPeakTrips / config.peakHourFactor
  const vehicleKmPerDay = dailyVehicleTrips * config.averageTripKm
  const freeFlowHours = vehicleKmPerDay / config.freeFlowSpeedKph
  const actualHours = vehicleKmPerDay / Math.max(5, averageSpeedKph)
  const dailyDelayHours = Math.max(0, actualHours - freeFlowHours)

  /*
   * Assign the peak load to segments. Each segment's share combines its static
   * weight (centrality + road class) with the trip generation of the buildings
   * around it, so new development actually shows up on the streets next to it.
   */
  const weights = city.roads.map((r) => {
    const mx = (r.x1 + r.x2) / 2
    const mz = (r.z1 + r.z2) / 2
    let local = 0
    for (const b of city.buildings) {
      const d2 = (b.x - mx) ** 2 + (b.z - mz) ** 2
      const falloff = Math.exp(-d2 / (2 * 26 * 26))
      if (falloff < 0.02) continue
      local += (b.capacity * 0.6 + b.jobs * 0.9 + b.retailSqm * 0.02) * falloff
    }
    return { id: r.id, local, base: r.loadWeight }
  })
  const maxLocal = Math.max(...weights.map((w) => w.local), 1)
  const combined = weights.map((w) => w.base * (0.62 + 0.85 * (w.local / maxLocal)))

  const totalWeight = combined.reduce((s, w) => s + w, 0) || 1
  const roads: RoadLoad[] = city.roads.map((r, i) => {
    const share = (combined[i] / totalWeight) * peakVehicleTrips * config.tripPathFactor
    const cap = r.lanes * config.laneCapacityPerHour
    const ratio = share / Math.max(1, cap)
    return {
      id: r.id,
      volumeCapacityRatio: ratio,
      speedKph: config.freeFlowSpeedKph / (1 + 0.15 * Math.pow(ratio, 4)),
      level: pressureFromUtilisation(ratio),
    }
  })

  return {
    dailyPersonTrips,
    dailyVehicleTrips,
    residentPeakTrips,
    jobPeakTrips,
    externalPeakTrips,
    peakVehicleTrips,
    networkCapacity,
    congestionIndex,
    averageSpeedKph,
    dailyDelayHours,
    vehicleKmPerDay,
    roads,
    formula:
      'peak vehicles = pop × trips/person × carShare × peakFactor + job trips + through traffic',
  }
}
