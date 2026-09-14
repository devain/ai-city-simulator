/**
 * THE PRIORITY SYSTEM — how the AI decides what matters most right now.
 *
 * Every city problem is scored 0-100 on urgency, drawn from the live
 * simulation and the finance model. The list is what the advisor warns about
 * in AI Assist and what the autonomous agent works down in order. Nothing in
 * Phase 5 acts without first appearing here, which is what stops the AI
 * building at random: every action traces back to a ranked, stated problem.
 */
import type { City, SimulationResult } from '../simulation/types'
import type { CityFinance } from '../sandbox/finance'
import type { CityHealth } from '../sandbox/health'
import type { DemandKey } from '../sandbox/demand'
import { CATALOGUE, type CatalogueItem, LINEAR, type LinearItem } from '../sandbox/catalogue'

export type PriorityLevel = 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL'

export interface CityPriority {
  key: string
  label: string
  /** 0-100 — how urgent, not how bad */
  urgency: number
  level: PriorityLevel
  /** the state of the system, in one clause */
  reading: string
  /** why this matters to the city, in one sentence */
  why: string
  /** the demand bar that relieves it */
  demand: DemandKey
  /** catalogue ids that address it, best first */
  remedies: string[]
}

const levelOf = (u: number): PriorityLevel =>
  u >= 85 ? 'CRITICAL' : u >= 70 ? 'WARNING' : u >= 50 ? 'WATCH' : 'NORMAL'

export const LEVEL_TONE: Record<PriorityLevel, string> = {
  NORMAL: 'text-slate-400',
  WATCH: 'text-sky-300',
  WARNING: 'text-amber-300',
  CRITICAL: 'text-rose-300',
}

/**
 * Utilisation → urgency. Flat below 70% (a system with slack is not a
 * problem), then climbs steeply so a system at its ceiling dominates.
 */
const urgencyFrom = (utilisation: number, weight = 1) =>
  Math.max(0, Math.min(100, Math.round((utilisation - 0.62) * 235 * weight)))

export function cityPriorities(
  city: City,
  r: SimulationResult,
  finance: CityFinance,
  health: CityHealth,
): CityPriority[] {
  const m = r.metrics
  const bedsPer1000 = r.raw.hospitalBeds / Math.max(1, r.population / 1000)
  const housingUse = r.population / Math.max(1, city.buildings.reduce((s, b) => s + b.capacity, 0))

  const draft: Omit<CityPriority, 'level'>[] = [
    {
      key: 'traffic',
      label: 'Traffic',
      urgency: urgencyFrom(m.traffic.utilisation, 1.35),
      reading: `${Math.round(m.traffic.utilisation * 100)}% of network capacity · V/C ${r.raw.congestionIndex.toFixed(2)}`,
      why: 'Congestion is the first thing that stops a city growing — it suppresses jobs, retail and quality of life at once.',
      demand: 'transport',
      remedies: ['transit_hub', 'bus_stop', 'bus_route', 'road_widening', 'highway_link'],
    },
    {
      key: 'education',
      label: 'Education',
      urgency: urgencyFrom(m.education.utilisation),
      reading: `${Math.round(m.education.utilisation * 100)}% of school seats taken`,
      why: 'Families leave when the schools fill up, and occupancy falls with them.',
      demand: 'education',
      remedies: ['school', 'university'],
    },
    {
      key: 'energy',
      label: 'Energy',
      urgency: urgencyFrom(m.electricity.utilisation),
      reading: `${Math.round(m.electricity.utilisation * 100)}% of grid capacity · ${r.raw.peakDemandMw.toFixed(1)} MW peak`,
      why: 'A grid at its ceiling caps every other system that depends on it.',
      demand: 'energy',
      remedies: ['solar_farm', 'power_plant'],
    },
    {
      key: 'water',
      label: 'Water',
      urgency: urgencyFrom(m.water.utilisation),
      reading: `${Math.round(m.water.utilisation * 100)}% of treatment capacity`,
      why: 'Treatment capacity is a hard limit on how many people the city can hold.',
      demand: 'water',
      remedies: ['water_facility'],
    },
    {
      key: 'parking',
      label: 'Parking',
      urgency: urgencyFrom(m.parking.utilisation, 0.85),
      reading: `${Math.round(m.parking.utilisation * 100)}% of spaces occupied`,
      why: 'Parking overspill pushes cars onto the network and worsens congestion.',
      demand: 'transport',
      remedies: ['parking_garage', 'transit_hub'],
    },
    {
      key: 'healthcare',
      label: 'Healthcare',
      urgency: Math.max(0, Math.min(100, Math.round((2.6 - bedsPer1000) * 42))),
      reading: `${bedsPer1000.toFixed(1)} beds per 1,000 residents`,
      why: 'Thin healthcare provision drags quality of life and slows population growth.',
      demand: 'healthcare',
      remedies: ['clinic', 'hospital'],
    },
    {
      key: 'housing',
      label: 'Housing',
      urgency: urgencyFrom(housingUse, 1.02),
      reading: `${Math.round(housingUse * 100)}% of dwellings occupied`,
      why: 'Without spare homes the city cannot take the people who want to move in.',
      demand: 'residential',
      remedies: ['apartment', 'residential_tower', 'small_house'],
    },
    {
      key: 'jobs',
      label: 'Employment',
      urgency: Math.max(0, Math.min(100, Math.round((0.97 - r.raw.employmentRate) * 175))),
      reading: `${Math.round(r.raw.employmentRate * 100)}% employment · ${r.jobs.toLocaleString('en-US')} jobs`,
      why: 'Residents without work leave, and the tax base leaves with them.',
      demand: 'industrial',
      remedies: ['office', 'industrial_unit', 'logistics_hub'],
    },
    {
      key: 'finance',
      label: 'Finances',
      urgency: financeUrgency(finance),
      reading:
        finance.netIncome >= 0
          ? `+$${(finance.netIncome / 1e6).toFixed(1)}M a year`
          : `−$${(Math.abs(finance.netIncome) / 1e6).toFixed(1)}M a year`,
      why: 'A city running a deficit eventually cannot maintain what it has already built.',
      demand: 'commercial',
      remedies: ['shopping_centre', 'office', 'shop'],
    },
    {
      key: 'environment',
      label: 'Environment',
      urgency: urgencyFrom(m.emissions.utilisation, 0.8),
      reading: `${Math.round(r.raw.co2PerCapitaKgYear).toLocaleString('en-US')} kg CO₂ per resident/yr`,
      why: 'Emissions are the constraint the city will be judged on long after the roads are fixed.',
      demand: 'energy',
      remedies: ['solar_farm', 'large_park', 'transit_hub'],
    },
    {
      key: 'commercial',
      label: 'Retail provision',
      urgency: urgencyFrom(
        r.raw.retailSupplySqm > 0 ? r.raw.retailDemandSqm / r.raw.retailSupplySqm : 1.2,
        0.78,
      ),
      reading: `${Math.round(r.raw.retailDemandSqm).toLocaleString('en-US')} m² wanted · ${Math.round(
        r.raw.retailSupplySqm,
      ).toLocaleString('en-US')} m² built`,
      why: 'Under-supplied retail means residents spend their money somewhere else.',
      demand: 'commercial',
      remedies: ['shop', 'shopping_centre'],
    },
  ]

  const list: CityPriority[] = draft.map((p) => ({ ...p, level: levelOf(p.urgency) }))

  // health acts as a tiebreak: the weakest component gets a nudge up the list
  for (const p of list) {
    if (p.key === health.weakest.key) p.urgency = Math.min(100, p.urgency + 6)
  }

  return list.sort((a, b) => b.urgency - a.urgency)
}

function financeUrgency(f: CityFinance): number {
  if (f.netIncome >= 0) {
    // thin margins are still worth watching
    return Math.max(0, Math.round((0.08 - f.margin) * 420))
  }
  return Math.min(100, 62 + Math.round((Math.abs(f.netIncome) / Math.max(1, f.annualRevenue)) * 220))
}

/**
 * The best affordable remedy for a priority. `remedies` is a preference
 * order, not a price order — the first entry the treasury can cover wins.
 */
export function remedyFor(
  p: CityPriority,
  affordable: number,
): CatalogueItem | LinearItem | null {
  for (const id of p.remedies) {
    const item =
      CATALOGUE.find((c) => c.id === id) ?? LINEAR.find((l) => l.id === id) ?? null
    if (item && item.capex <= affordable) return item
  }
  return null
}
