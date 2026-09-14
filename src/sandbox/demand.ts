/**
 * CITY DEMAND — what the city is asking for, expressed as five bars.
 *
 * Each bar is demand ÷ supply read off the live simulation, so it moves the
 * moment anything is built. High residential demand means people want to live
 * here and there is nowhere to put them; high education demand means the
 * schools are about to overflow. The player builds against these; so does the
 * autonomous agent.
 *
 * PROTOTYPE SIMULATION — ILLUSTRATIVE ESTIMATES.
 */
import type { City, SimulationResult } from '../simulation/types'
import { headroomShare } from './headroomShare'

export type DemandKey =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'education'
  | 'healthcare'
  | 'transport'
  | 'energy'
  | 'water'

export interface DemandBar {
  key: DemandKey
  label: string
  /** 0..1+, where 1 means demand has caught up with supply */
  value: number
  detail: string
  /** the catalogue item that relieves this bar */
  relievedBy: string
}

const ratio = (demand: number, supply: number) =>
  supply > 0 ? demand / supply : demand > 0 ? 1.4 : 0

/**
 * Residential demand is the one bar that is not a shortage of capacity but a
 * shortage of *room to grow*: it rises as the occupied share of housing
 * approaches full, and as the city's measured headroom falls away.
 */
export function cityDemand(city: City, r: SimulationResult): DemandBar[] {
  const housingUse = r.population / Math.max(1, dwellingCapacity(city))
  const bars: DemandBar[] = [
    {
      key: 'residential',
      label: 'Residential',
      value: Math.max(housingUse, 1 - headroomShare(r)),
      detail: `${Math.round(housingUse * 100)}% of dwellings occupied`,
      relievedBy: 'Apartment or residential tower',
    },
    {
      key: 'commercial',
      label: 'Commercial',
      value: ratio(r.raw.retailDemandSqm, r.raw.retailSupplySqm),
      detail: `${Math.round(r.raw.retailDemandSqm).toLocaleString('en-US')} m² wanted · ${Math.round(
        r.raw.retailSupplySqm,
      ).toLocaleString('en-US')} m² built`,
      relievedBy: 'Shop or shopping centre',
    },
    {
      key: 'industrial',
      label: 'Industrial',
      value: jobsGap(r),
      detail: `${Math.round(r.raw.employmentRate * 100)}% employment · ${r.jobs.toLocaleString(
        'en-US',
      )} jobs for ${r.population.toLocaleString('en-US')} residents`,
      relievedBy: 'Office or industrial unit',
    },
    {
      key: 'education',
      label: 'Education',
      value: ratio(r.raw.schoolSeatsNeeded, r.raw.schoolSeats),
      detail: `${Math.round(r.raw.schoolSeatsNeeded).toLocaleString('en-US')} students · ${Math.round(
        r.raw.schoolSeats,
      ).toLocaleString('en-US')} seats`,
      relievedBy: 'School or university',
    },
    {
      key: 'healthcare',
      label: 'Healthcare',
      value: healthcareDemand(r),
      detail: `${r.raw.hospitalBeds.toLocaleString('en-US')} beds for ${r.population.toLocaleString(
        'en-US',
      )} residents`,
      relievedBy: 'Clinic or hospital',
    },
    {
      key: 'transport',
      label: 'Transport',
      value: r.metrics.traffic.utilisation,
      detail: `V/C ${r.raw.congestionIndex.toFixed(2)} · ${Math.round(
        r.raw.transitRidership,
      ).toLocaleString('en-US')} transit riders/day`,
      relievedBy: 'Transit hub, bus route or wider roads',
    },
    {
      key: 'energy',
      label: 'Energy',
      value: r.metrics.electricity.utilisation,
      detail: `${r.raw.peakDemandMw.toFixed(1)} MW peak of ${r.raw.gridCapacityMw.toFixed(0)} MW`,
      relievedBy: 'Solar farm or power plant',
    },
    {
      key: 'water',
      label: 'Water',
      value: r.metrics.water.utilisation,
      detail: `${Math.round(r.raw.waterM3Day).toLocaleString('en-US')} of ${Math.round(
        r.raw.waterCapacityM3Day,
      ).toLocaleString('en-US')} m³/day`,
      relievedBy: 'Water facility',
    },
  ]
  return bars
}

/** The five bars worth putting on screen by default — the rest live in metrics. */
export const HEADLINE_DEMAND: DemandKey[] = [
  'residential',
  'commercial',
  'industrial',
  'education',
  'healthcare',
]

function dwellingCapacity(city: City) {
  return city.buildings.reduce((s, b) => s + b.capacity, 0)
}

/** A city with fewer jobs than workers wants employers. */
function jobsGap(r: SimulationResult) {
  return Math.max(0, Math.min(1.5, 1.08 - r.raw.employmentRate))
}

/** 3.5 beds per 1,000 residents is comfortable; below that demand climbs. */
function healthcareDemand(r: SimulationResult) {
  const per1000 = r.raw.hospitalBeds / Math.max(1, r.population / 1000)
  return Math.max(0, Math.min(1.5, 1 - (per1000 - 0.6) / 2.9))
}
