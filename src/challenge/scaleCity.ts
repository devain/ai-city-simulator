/**
 * A well-formed city at any size.
 *
 * The default config describes a coherent 10,000-resident city: housing, jobs,
 * schools, roads, grid and water capacity are all in proportion. Asking for
 * 20,000 residents by doubling only the housing produces a city that is
 * already in crisis on turn one — traffic over 100%, schools overflowing — and
 * every match becomes a salvage operation rather than a contest.
 *
 * So a challenge scales the *whole* city together. The result is a city under
 * ordinary pressure at any starting size, which is what makes 10k, 20k and 50k
 * genuinely different scenarios rather than the same one with worse numbers.
 */
import { DEFAULT_CONFIG, type CityConfig } from '../simulation/config'

/** Baseline population the default config was tuned for. */
const BASE_POPULATION = 10_000

export function scaleConfigTo(population: number, seed: number): CityConfig {
  const k = population / BASE_POPULATION
  // the street grid grows with the square root of population, so density rises
  // with size the way it does in a real city
  const gridLines = Math.max(6, Math.round(DEFAULT_CONFIG.gridLines * Math.sqrt(k)))

  const round = (v: number, f = k) => Math.round(v * f)

  return {
    ...DEFAULT_CONFIG,
    seed,
    gridLines,

    /* ---- the built stock ---- */
    residentialBuildings: round(DEFAULT_CONFIG.residentialBuildings),
    commercialBuildings: round(DEFAULT_CONFIG.commercialBuildings),
    industrialBuildings: round(DEFAULT_CONFIG.industrialBuildings),
    schools: Math.max(1, round(DEFAULT_CONFIG.schools)),
    hospitals: Math.max(1, round(DEFAULT_CONFIG.hospitals)),
    parks: Math.max(1, round(DEFAULT_CONFIG.parks)),
    parkingGarages: Math.max(1, round(DEFAULT_CONFIG.parkingGarages)),
    transitHubs: Math.max(1, round(DEFAULT_CONFIG.transitHubs)),

    /* ---- calibration targets ---- */
    residentialCapacity: round(DEFAULT_CONFIG.residentialCapacity),
    jobs: round(DEFAULT_CONFIG.jobs),
    retailFloorAreaSqm: round(DEFAULT_CONFIG.retailFloorAreaSqm),
    attachedParkingSpaces: round(DEFAULT_CONFIG.attachedParkingSpaces),
    onStreetParking: round(DEFAULT_CONFIG.onStreetParking),
    privateResidentialParking: round(DEFAULT_CONFIG.privateResidentialParking),

    /* ---- network and utilities ---- */
    externalPeakTrips: round(DEFAULT_CONFIG.externalPeakTrips),
    gridCapacityMw: DEFAULT_CONFIG.gridCapacityMw * k,
    waterPlantCapacityM3Day: DEFAULT_CONFIG.waterPlantCapacityM3Day * k,
    industrialBaseloadKwhDay: DEFAULT_CONFIG.industrialBaseloadKwhDay * k,
    industrialWaterM3Day: DEFAULT_CONFIG.industrialWaterM3Day * k,
  }
}
