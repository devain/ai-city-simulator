/**
 * Municipal finance — the money loop that turns the simulator into a sandbox.
 *
 * The engine already computes a city-wide `annualOperatingCost` from the
 * service models (energy, water, roads, transit, education, waste). Phase 5
 * adds the two things a city manager actually plays against:
 *
 *   1. ASSET OPEX — every structure you build costs money to run, for ever.
 *   2. REVENUE    — residents, business, retail, transit and utilities pay in.
 *
 * Deliberately simple: six revenue lines, one opex addition, one net figure.
 * The point is that a building is a commitment, not a one-off purchase.
 *
 * PROTOTYPE SIMULATION — ILLUSTRATIVE ESTIMATES.
 */
import type { Building, BuildingType, City, SimulationResult } from '../simulation/types'

/* ------------------------------------------------------------------ */
/* asset operating cost, USD / year                                    */
/* ------------------------------------------------------------------ */

/** Annual running cost of one structure, by kind. */
export const ASSET_OPEX: Record<BuildingType, number> = {
  house: 0,
  residential_tower: 60_000,
  office: 120_000,
  shop: 140_000,
  school: 500_000,
  hospital: 1_200_000,
  park: 120_000,
  parking: 180_000,
  transit_hub: 1_000_000,
  industrial: 260_000,
  power_plant: 1_500_000,
  solar_farm: 300_000,
  water_facility: 900_000,
}

/** Annual running cost of one bus route. */
const BUS_ROUTE_OPEX = 820_000
/** Annual running cost of one kilometre of elevated corridor. */
const ELEVATED_OPEX_PER_KM = 240_000

export interface FinanceLine {
  label: string
  amount: number
  detail: string
}

export interface CityFinance {
  /** every revenue line, largest first */
  revenue: FinanceLine[]
  /** every cost line, largest first */
  costs: FinanceLine[]
  annualRevenue: number
  annualOperatingCost: number
  /** revenue − operating cost, USD / year */
  netIncome: number
  /** net income as a share of revenue; negative means the city is bleeding */
  margin: number
  /** structures whose opex the city carries */
  assetCount: number
  /** the single biggest cost line, for the advisor to talk about */
  largestCost: FinanceLine
}

const sum = (lines: FinanceLine[]) => lines.reduce((s, l) => s + l.amount, 0)
const byAmount = (a: FinanceLine, b: FinanceLine) => b.amount - a.amount

/** Annual opex carried by everything the city owns. */
export function assetOperatingCost(city: City): number {
  let total = 0
  for (const b of city.buildings) total += ASSET_OPEX[b.type] ?? 0
  total += (city.busRoutes?.length ?? 0) * BUS_ROUTE_OPEX
  for (const r of city.roads) {
    if (r.elevated) total += r.lengthKm * ELEVATED_OPEX_PER_KM
  }
  return total
}

/**
 * The city's books for one year, derived entirely from the live simulation.
 *
 * Revenue scales with what the city actually has: residents pay council tax,
 * business rates follow jobs and retail floor area, transit fares follow
 * ridership, and utilities recover part of what they sell. None of it is a
 * free-floating number — grow the city and revenue grows with it.
 */
export function cityFinance(city: City, r: SimulationResult): CityFinance {
  const residents = r.population
  const jobs = r.jobs

  const revenue: FinanceLine[] = [
    {
      label: 'Council tax',
      // Residents cost the city roughly $3,100/yr in services. At the old
      // $1,240 every new resident was a loss, so growth bankrupted any city
      // that tried it and the financial score stopped discriminating. At
      // $1,850 a resident still does not quite pay their own way — housing
      // must be matched with jobs and retail — but the city has a margin to
      // work with, which is the strategic question rather than a death spiral.
      amount: residents * 1_850,
      detail: `${residents.toLocaleString('en-US')} residents × $1,850`,
    },
    {
      label: 'Business rates',
      amount: jobs * 1_850,
      detail: `${jobs.toLocaleString('en-US')} jobs × $1,850`,
    },
    {
      label: 'Retail & commercial',
      amount: r.raw.retailSupplySqm * 138,
      detail: `${Math.round(r.raw.retailSupplySqm).toLocaleString('en-US')} m² × $138`,
    },
    {
      label: 'Transit fares',
      amount: r.raw.transitRidership * 365 * 1.35,
      detail: `${Math.round(r.raw.transitRidership).toLocaleString('en-US')} riders/day × $1.35`,
    },
    {
      label: 'Utility charges',
      amount: r.raw.electricityKwhDay * 365 * 0.031 + r.raw.waterM3Day * 365 * 0.42,
      detail: 'metered electricity and water',
    },
    {
      label: 'Parking & permits',
      amount: Math.min(r.raw.parkingDemand, r.raw.parkingSupply) * 620,
      detail: `${Math.round(Math.min(r.raw.parkingDemand, r.raw.parkingSupply)).toLocaleString('en-US')} occupied spaces × $620`,
    },
  ].sort(byAmount)

  const assetOpex = assetOperatingCost(city)
  const costs: FinanceLine[] = [
    {
      label: 'City services',
      amount: r.raw.annualOperatingCost,
      detail: 'energy, water, roads, transit, education, waste',
    },
    {
      label: 'Asset upkeep',
      amount: assetOpex,
      detail: `${city.buildings.length.toLocaleString('en-US')} structures · ${
        city.busRoutes?.length ?? 0
      } bus routes`,
    },
  ].sort(byAmount)

  const annualRevenue = sum(revenue)
  const annualOperatingCost = sum(costs)
  const netIncome = annualRevenue - annualOperatingCost

  return {
    revenue,
    costs,
    annualRevenue,
    annualOperatingCost,
    netIncome,
    margin: annualRevenue > 0 ? netIncome / annualRevenue : 0,
    assetCount: city.buildings.length,
    largestCost: costs[0],
  }
}

/** What one more structure of this kind adds to the annual bill. */
export function opexOf(b: Pick<Building, 'type'>): number {
  return ASSET_OPEX[b.type] ?? 0
}
