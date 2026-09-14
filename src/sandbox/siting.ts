/**
 * WHERE TO PUT IT — plot selection for the AI, and validity for the player.
 *
 * The AI never drops a building on an arbitrary plot. It scores the free plots
 * by the district that most needs what is being built, so "where" always has
 * the same kind of reason attached as "what".
 */
import type { City, DistrictId, SimulationResult } from '../simulation/types'
import type { DemandKey } from './demand'
import { slotKey } from '../city/placement'

export type Slot = { x: number; z: number; district: DistrictId }

const DISTRICT_LABEL: Record<DistrictId, string> = {
  central: 'Central Core',
  north: 'North Quarter',
  east: 'East Ridge',
  south: 'South Gate',
  west: 'West Harbour',
}
export const districtLabel = (d: DistrictId) => DISTRICT_LABEL[d]

/** The per-district pressure that matters for a given kind of demand. */
function districtScore(r: SimulationResult, district: DistrictId, demand: DemandKey): number {
  const d = r.districts.find((x) => x.id === district)
  if (!d) return 0
  switch (demand) {
    case 'education':
      return d.education
    case 'transport':
      return d.traffic * 0.7 + d.parking * 0.3
    case 'commercial':
      return d.retail
    case 'residential':
      // put homes where there is capacity to serve them, not where it is worst
      return 1 - d.traffic * 0.5 - d.education * 0.3
    case 'industrial':
      return 0.4 + d.retail * 0.3
    case 'healthcare':
      return d.residents / Math.max(1, r.population / 5)
    case 'energy':
      return d.electricity
    case 'water':
      return d.water
    default:
      return 0.5
  }
}

/** The free plot in the district that most needs this kind of building. */
export function bestFreeSlot(
  city: City,
  r: SimulationResult,
  demand: DemandKey,
  /** districts to avoid — used so "another school" lands somewhere new */
  avoid: DistrictId[] = [],
): Slot | null {
  if (city.freeSlots.length === 0) return null

  const ranked = [...city.freeSlots].sort((a, b) => {
    const sa = districtScore(r, a.district, demand) - (avoid.includes(a.district) ? 0.55 : 0)
    const sb = districtScore(r, b.district, demand) - (avoid.includes(b.district) ? 0.55 : 0)
    return sb - sa
  })
  return ranked[0] ?? null
}

/** Why the AI chose this plot, in one clause. */
export function sitingReason(demand: DemandKey, district: DistrictId): string {
  const where = districtLabel(district)
  switch (demand) {
    case 'education':
      return `${where} has the highest unmet school demand`
    case 'transport':
      return `${where} carries the worst congestion`
    case 'commercial':
      return `${where} has the largest retail shortfall`
    case 'residential':
      return `${where} has the most capacity to absorb new residents`
    case 'healthcare':
      return `${where} has the largest population per bed`
    case 'energy':
      return `${where} draws the most grid load`
    case 'water':
      return `${where} has the highest water demand`
    default:
      return `${where} is the best available site`
  }
}

/** Is this plot still free? Placement validity for the ghost preview. */
export function slotIsFree(city: City, slot: Slot): boolean {
  const key = slotKey(slot.x, slot.z)
  return city.freeSlots.some((s) => slotKey(s.x, s.z) === key)
}

/** Nearest free plot to a world position, or null when the city is full. */
export function nearestFreeSlot(city: City, x: number, z: number): Slot | null {
  let best: Slot | null = null
  let bestD = Infinity
  for (const s of city.freeSlots) {
    const d = (s.x - x) ** 2 + (s.z - z) ** 2
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}
