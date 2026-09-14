/**
 * Where should it go?
 *
 * Two jobs: read a location out of the request ("downtown", "the residential
 * district", "phía bắc"), and — when the user does not say — pick the spot with
 * the strongest unmet demand for whatever is being built.
 */
import type { City, DistrictId, SimulationResult } from '../../simulation/types'
import type { InfraKind } from '../../city/infrastructure'
import { DISTRICT_NAMES } from '../../simulation/citySimulation'
import { LOCATION_LEX, ZONE_LEX } from './lexicon'
import { deaccent } from './numbers'
import type { LocationRef, ResolvedLocation } from './types'

export const AUTO_LOCATION: LocationRef = { kind: 'auto', label: 'auto' }

/** Read an explicit location out of the request, if there is one. */
export function extractLocation(raw: string): LocationRef {
  const text = deaccent(raw).toLowerCase()

  for (const z of ZONE_LEX) {
    if (z.patterns.test(text)) {
      return { kind: 'zone', label: `${z.zone} district`, reason: `the ${z.zone} area` }
    }
  }
  for (const l of LOCATION_LEX) {
    if (l.patterns.test(text)) {
      return { kind: 'district', district: l.id, label: l.label }
    }
  }
  return AUTO_LOCATION
}

/* ------------------------------------------------------------------ */
/* choosing a location the user did not specify                         */
/* ------------------------------------------------------------------ */

/** what "unmet demand" means for each thing the AI can build */
function demandScore(
  kind: InfraKind,
  d: SimulationResult['districts'][number],
  city: City,
): number {
  const residents = d.residents
  switch (kind) {
    case 'school':
      return d.education * 1.2 + residents / 12_000
    case 'hospital':
      return residents / 6_000 + d.education * 0.3
    case 'parking_garage':
      return d.parking * 1.3
    case 'transit_hub':
    case 'bus_route':
    case 'road_widening':
    case 'highway_link':
    case 'bridge':
    case 'intersection_upgrade':
      return d.traffic * 1.3 + d.parking * 0.3
    case 'shopping_district':
      return d.retail * 1.2 + residents / 14_000
    case 'office':
      return d.retail * 0.5 + (d.jobs < 400 ? 0.8 : 0.2)
    case 'residential_tower': {
      const free = city.freeSlots.filter((s) => s.district === d.id).length
      return Math.min(1, free / 8) + (1 - d.traffic) * 0.35
    }
    case 'park':
      return 1 - Math.min(1, d.emissions) + residents / 16_000
    case 'solar_farm':
    case 'power_plant':
      return d.electricity * 1.2
    case 'water_facility':
      return d.water * 1.2
    default:
      return 0.5
  }
}

const REASON: Partial<Record<InfraKind, string>> = {
  school: 'highest unmet education demand',
  hospital: 'largest population without nearby beds',
  parking_garage: 'tightest parking supply',
  transit_hub: 'heaviest road demand',
  bus_route: 'heaviest road demand',
  shopping_district: 'largest retail gap',
  residential_tower: 'most available land',
  park: 'least green space per resident',
  solar_farm: 'highest grid load',
  power_plant: 'highest grid load',
  water_facility: 'highest water load',
  office: 'lowest employment density',
}

/** Centre of a district's buildings, so the camera has something to fly to. */
function districtCentre(city: City, district: DistrictId) {
  const pts = city.buildings.filter((b) => b.district === district)
  if (pts.length === 0) return { x: 0, z: 0 }
  return {
    x: pts.reduce((s, b) => s + b.x, 0) / pts.length,
    z: pts.reduce((s, b) => s + b.z, 0) / pts.length,
  }
}

/** Districts with somewhere left to build. */
function buildableDistricts(city: City): Set<DistrictId> {
  const out = new Set<DistrictId>()
  for (const s of city.freeSlots) out.add(s.district)
  return out
}

export interface LocationChoice extends ResolvedLocation {
  /** ranked alternatives, for the "why here" explanation */
  runnerUp?: { district: DistrictId; label: string }
}

/**
 * Resolve a (possibly absent) location into a concrete district, preferring
 * unmet demand and avoiding a district we have just built the same thing in.
 */
export function resolveLocation(
  ref: LocationRef,
  kind: InfraKind,
  city: City,
  sim: SimulationResult,
  recentlyBuilt: { kind: InfraKind; district: DistrictId }[] = [],
): LocationChoice {
  const buildable = buildableDistricts(city)
  const needsLand = kind !== 'bus_route' && kind !== 'road_widening' && kind !== 'highway_link'

  /* explicit district — honour it when there is room */
  if (ref.kind === 'district' && ref.district) {
    if (!needsLand || buildable.has(ref.district)) {
      const c = districtCentre(city, ref.district)
      return {
        district: ref.district,
        label: DISTRICT_NAMES[ref.district],
        reason: 'you asked for this district',
        ...c,
      }
    }
  }

  /* a zone word — map it onto the district that best fits that character */
  let candidates = sim.districts.filter((d) => !needsLand || buildable.has(d.id))
  if (candidates.length === 0) candidates = sim.districts

  if (ref.kind === 'zone') {
    if (ref.label.startsWith('residential')) {
      candidates = [...candidates].sort((a, b) => b.residents - a.residents)
    } else if (ref.label.startsWith('commercial')) {
      candidates = [...candidates].sort((a, b) => b.jobs - a.jobs)
    }
    const pick = candidates[0]
    const c = districtCentre(city, pick.id)
    return {
      district: pick.id,
      label: DISTRICT_NAMES[pick.id],
      reason: `best match for the ${ref.label}`,
      ...c,
    }
  }

  /* auto — rank by unmet demand, then avoid repeating ourselves */
  const scored = candidates
    .map((d) => {
      const justBuilt = recentlyBuilt.some((r) => r.kind === kind && r.district === d.id)
      return { d, score: demandScore(kind, d, city) - (justBuilt ? 0.55 : 0) }
    })
    .sort((a, b) => b.score - a.score)

  const best = scored[0]?.d ?? sim.districts[0]
  const c = districtCentre(city, best.id)
  return {
    district: best.id,
    label: DISTRICT_NAMES[best.id],
    reason: REASON[kind] ?? 'best available site',
    runnerUp: scored[1]
      ? { district: scored[1].d.id, label: DISTRICT_NAMES[scored[1].d.id] }
      : undefined,
    ...c,
  }
}
