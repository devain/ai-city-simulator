/**
 * AI CITY SIMULATOR — simulation constants
 * --------------------------------------------------------------
 * PROTOTYPE SIMULATION — ILLUSTRATIVE ESTIMATES ONLY.
 * Every number below is a hand-tuned demo coefficient, not a
 * calibrated real-world parameter. They exist so the prototype
 * produces plausible, internally-consistent, *deterministic*
 * behaviour that a stakeholder can reason about in 2 minutes.
 *
 * The whole file is designed to be swapped for a calibrated
 * parameter set (or a learned model) later — see
 * `citySimulation.ts` for the engine boundary.
 */

export interface CityConfig {
  /* ---------- city generation ---------- */
  seed: number
  metresPerUnit: number
  gridLines: number // road lines per axis -> (gridLines-1)^2 blocks
  blockPitch: number // world units between road centrelines
  roadWidth: number

  residentialBuildings: number
  commercialBuildings: number
  industrialBuildings: number
  schools: number
  hospitals: number
  parks: number
  parkingGarages: number
  transitHubs: number

  /* ---------- calibration targets ---------- */
  residentialCapacity: number // total dwelling capacity (persons)
  occupancyRate: number // share of dwelling capacity actually occupied
  jobs: number // jobs inside the modelled area
  retailFloorAreaSqm: number // existing retail supply
  attachedParkingSpaces: number // total parking attached to buildings
  onStreetParking: number // kerbside spaces not attached to a building
  privateResidentialParking: number // driveways / podium parking

  /* ---------- population model ---------- */
  childrenRate: number // share of population of school age
  schoolEnrollmentRate: number
  householdSize: number
  targetDensityPerHa: number
  carOwnershipRate: number // vehicles per resident

  /* ---------- traffic model ---------- */
  tripsPerPersonPerDay: number
  vehicleModeShare: number // share of person-trips made by car
  transitModeShare: number
  peakHourFactor: number // share of daily trips in the peak hour
  jobTripsPerJob: number
  jobVehicleShare: number
  externalPeakTrips: number // through traffic + freight + service vehicles
  laneCapacityPerHour: number // veh/h per lane at capacity
  tripPathFactor: number // avg. number of loaded segments per peak trip
  freeFlowSpeedKph: number
  averageTripKm: number

  /* ---------- energy model ---------- */
  electricityPerPersonKwhDay: number
  electricityPerJobKwhDay: number
  industrialBaseloadKwhDay: number
  schoolKwhDay: number
  hospitalKwhDay: number
  streetLightKwhDay: number
  waterPumpingKwhPerM3: number
  gridPeakFactor: number // daily kWh -> peak MW conversion
  gridCapacityMw: number

  /* ---------- water model ---------- */
  waterPerPersonM3Day: number
  waterPerJobM3Day: number
  waterPerStudentM3Day: number
  waterPerHospitalM3Day: number
  parkIrrigationM3PerHaDay: number
  industrialWaterM3Day: number
  nonRevenueWaterRate: number // leakage / unbilled
  waterPlantCapacityM3Day: number
  wastewaterReturnRate: number

  /* ---------- retail model ---------- */
  retailSqmPerResident: number
  retailSqmPerWorker: number
  visitorRetailSqm: number
  retailViableUtilisation: number

  /* ---------- education model ---------- */
  schoolCapacity: number
  schoolTargetUtilisation: number
  classSize: number

  /* ---------- parking model ---------- */
  residentialParkingRatio: number // spaces required per owned vehicle
  commercialParkingPerJob: number
  retailParkingPer100Sqm: number

  /* ---------- transit model ---------- */
  buses: number
  busCapacity: number
  busTripsPerPeakHour: number
  metroCapacityPerHub: number

  /* ---------- emissions model ---------- */
  vehicleGramsCo2PerKm: number
  gridKgCo2PerKwh: number
  heatingKgCo2PerPersonDay: number
  heatingBaseKgDay: number
  industrialProcessKgCo2Day: number
  waterKgCo2PerM3: number
  treeSequestrationKgPerHaDay: number
  carbonBudgetKgDay: number

  /* ---------- economy model ---------- */
  gvaPerJobYear: number
  gvaPerRetailSqmYear: number
  residentSpendYear: number
  targetGvaPerCapita: number
  labourParticipation: number

  /* ---------- livability model ---------- */
  targetGreenSqmPerResident: number
  targetRetailSqmPerResident: number
  targetTransitCoverage: number

  /* ---------- cost model ---------- */
  electricityCostPerKwh: number
  waterCostPerM3: number
  roadMaintenancePerLaneKmYear: number
  transitSubsidyPerRiderYear: number
  schoolCostPerStudentYear: number
  wasteCostPerPersonYear: number
  generalServicesPerPersonYear: number
  opexBudgetPerCapitaYear: number
}

export const DEFAULT_CONFIG: CityConfig = {
  seed: 20260913,
  metresPerUnit: 10, // 1 world unit in the 3D scene = 10 m
  gridLines: 7,
  blockPitch: 28,
  roadWidth: 9,

  residentialBuildings: 50,
  commercialBuildings: 10,
  industrialBuildings: 4,
  schools: 5,
  hospitals: 2,
  parks: 5,
  parkingGarages: 4,
  transitHubs: 1,

  residentialCapacity: 10_600,
  occupancyRate: 0.9434, // -> 10,000 residents at baseline
  jobs: 6_000,
  retailFloorAreaSqm: 32_000,
  attachedParkingSpaces: 3_740,
  onStreetParking: 2_200,
  privateResidentialParking: 1_400,

  childrenRate: 0.16,
  schoolEnrollmentRate: 0.92,
  householdSize: 2.45,
  targetDensityPerHa: 70,
  carOwnershipRate: 0.4, // -> 4,000 vehicles at baseline

  tripsPerPersonPerDay: 3.1,
  vehicleModeShare: 0.52,
  transitModeShare: 0.22,
  peakHourFactor: 0.11,
  jobTripsPerJob: 1.7,
  jobVehicleShare: 0.6,
  externalPeakTrips: 2_450,
  laneCapacityPerHour: 650,
  tripPathFactor: 23,
  freeFlowSpeedKph: 52,
  averageTripKm: 7.4,

  electricityPerPersonKwhDay: 8.6,
  electricityPerJobKwhDay: 26,
  industrialBaseloadKwhDay: 74_000,
  schoolKwhDay: 5_800,
  hospitalKwhDay: 24_000,
  streetLightKwhDay: 0.45,
  waterPumpingKwhPerM3: 0.55,
  gridPeakFactor: 0.072, // peak MW = daily kWh * factor / 1000
  gridCapacityMw: 38,

  waterPerPersonM3Day: 0.155,
  waterPerJobM3Day: 0.075,
  waterPerStudentM3Day: 0.025,
  waterPerHospitalM3Day: 180,
  parkIrrigationM3PerHaDay: 40,
  industrialWaterM3Day: 3_000,
  nonRevenueWaterRate: 0.18,
  waterPlantCapacityM3Day: 9_500,
  wastewaterReturnRate: 0.82,

  retailSqmPerResident: 1.35,
  retailSqmPerWorker: 0.9,
  visitorRetailSqm: 9_300,
  retailViableUtilisation: 0.92,

  schoolCapacity: 480,
  schoolTargetUtilisation: 0.85,
  classSize: 26,

  residentialParkingRatio: 0.95,
  commercialParkingPerJob: 0.28,
  retailParkingPer100Sqm: 2.6,

  buses: 12,
  busCapacity: 62,
  busTripsPerPeakHour: 1.6,
  metroCapacityPerHub: 600,

  vehicleGramsCo2PerKm: 155,
  gridKgCo2PerKwh: 0.31,
  heatingKgCo2PerPersonDay: 1.1,
  heatingBaseKgDay: 30_000,
  industrialProcessKgCo2Day: 110_000,
  waterKgCo2PerM3: 0.35,
  treeSequestrationKgPerHaDay: 24,
  carbonBudgetKgDay: 420_000,

  gvaPerJobYear: 68_000,
  gvaPerRetailSqmYear: 3_100,
  residentSpendYear: 4_200,
  targetGvaPerCapita: 62_000,
  labourParticipation: 0.62,

  targetGreenSqmPerResident: 16,
  targetRetailSqmPerResident: 1.35,
  targetTransitCoverage: 0.34,

  electricityCostPerKwh: 0.19,
  waterCostPerM3: 1.45,
  roadMaintenancePerLaneKmYear: 9_800,
  transitSubsidyPerRiderYear: 0.62,
  schoolCostPerStudentYear: 7_400,
  wasteCostPerPersonYear: 128,
  generalServicesPerPersonYear: 940,
  opexBudgetPerCapitaYear: 4_000,
}

export const DISCLAIMER = 'Prototype simulation — illustrative estimates.'
