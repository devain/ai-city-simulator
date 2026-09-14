/**
 * The infrastructure catalogue the AI planner builds from, plus the machinery
 * that turns an abstract plan into a concrete change to the City object.
 *
 * Costs and construction times are prototype figures — internally consistent
 * and explainable, not procurement estimates.
 */
import type {
  Building,
  BusRoute,
  City,
  DistrictId,
  RoadLoad,
  RoadSegment,
} from '../simulation/types'
import { TEMPLATES, makeBuilding, slotKey } from './placement'
import { DISTRICT_NAMES } from '../simulation/citySimulation'

export type InfraKind =
  | 'residential_tower'
  | 'office'
  | 'shopping_district'
  | 'school'
  | 'hospital'
  | 'park'
  | 'parking_garage'
  | 'transit_hub'
  | 'power_plant'
  | 'solar_farm'
  | 'water_facility'
  | 'road_widening'
  | 'highway_link'
  | 'bridge'
  | 'intersection_upgrade'
  | 'bus_route'

export interface InfraSpec {
  kind: InfraKind
  name: string
  icon: string
  /** capital cost per unit, USD */
  capex: number
  /** construction animation time per unit, ms */
  buildMs: number
  category: 'housing' | 'mobility' | 'services' | 'utilities' | 'green' | 'economy'
  blurb: string
}

export const INFRA: Record<InfraKind, InfraSpec> = {
  residential_tower: { kind: 'residential_tower', name: 'Residential tower', icon: '▮', capex: 4_200_000, buildMs: 1500, category: 'housing', blurb: '+408 residents' },
  office: { kind: 'office', name: 'Office building', icon: '▤', capex: 6_500_000, buildMs: 1800, category: 'economy', blurb: '+820 jobs' },
  shopping_district: { kind: 'shopping_district', name: 'Shopping district', icon: '▦', capex: 5_400_000, buildMs: 1700, category: 'economy', blurb: '+5,200 m² retail' },
  school: { kind: 'school', name: 'School', icon: '▤', capex: 7_800_000, buildMs: 1900, category: 'services', blurb: '+480 student seats' },
  hospital: { kind: 'hospital', name: 'Hospital', icon: '✚', capex: 22_000_000, buildMs: 2600, category: 'services', blurb: '+220 beds' },
  park: { kind: 'park', name: 'Park', icon: '❖', capex: 2_400_000, buildMs: 1200, category: 'green', blurb: '+3.6 ha green space' },
  parking_garage: { kind: 'parking_garage', name: 'Parking garage', icon: 'P', capex: 6_000_000, buildMs: 1600, category: 'mobility', blurb: '+935 spaces' },
  transit_hub: { kind: 'transit_hub', name: 'Transit hub', icon: '◉', capex: 12_500_000, buildMs: 2400, category: 'mobility', blurb: '+7.5% transit mode share' },
  power_plant: { kind: 'power_plant', name: 'Power plant', icon: '⚡', capex: 28_000_000, buildMs: 2600, category: 'utilities', blurb: '+14 MW capacity' },
  solar_farm: { kind: 'solar_farm', name: 'Solar farm', icon: '☀', capex: 14_000_000, buildMs: 2000, category: 'utilities', blurb: '+9 MW zero-carbon' },
  water_facility: { kind: 'water_facility', name: 'Water facility', icon: '≈', capex: 16_000_000, buildMs: 2200, category: 'utilities', blurb: '+2,600 m³/day treatment' },
  road_widening: { kind: 'road_widening', name: 'Corridor widening', icon: '═', capex: 1_550_000, buildMs: 700, category: 'mobility', blurb: '+2 lanes per segment' },
  highway_link: { kind: 'highway_link', name: 'Elevated expressway', icon: '⇥', capex: 4_100_000, buildMs: 800, category: 'mobility', blurb: '6-lane grade-separated corridor' },
  bridge: { kind: 'bridge', name: 'River bridge', icon: '⌒', capex: 5_600_000, buildMs: 900, category: 'mobility', blurb: 'new 4-lane crossing' },
  intersection_upgrade: { kind: 'intersection_upgrade', name: 'Smart intersection', icon: '✚', capex: 1_400_000, buildMs: 600, category: 'mobility', blurb: 'adaptive signals' },
  bus_route: { kind: 'bus_route', name: 'Bus rapid transit route', icon: '⎯', capex: 4_600_000, buildMs: 1100, category: 'mobility', blurb: '+2.5% transit mode share' },
}

/* ------------------------------------------------------------------ */
/* templates for the building kinds Phase 2 adds                        */
/* ------------------------------------------------------------------ */

export const INFRA_TEMPLATE_KEY: Partial<Record<InfraKind, keyof typeof TEMPLATES>> = {
  residential_tower: 'residential_tower',
  office: 'office',
  shopping_district: 'shop',
  school: 'school',
  hospital: 'hospital',
  park: 'park',
  parking_garage: 'parking',
  transit_hub: 'transit_hub',
  power_plant: 'power_plant',
  solar_farm: 'solar_farm',
  water_facility: 'water_facility',
}

/* ------------------------------------------------------------------ */
/* a plan, materialised                                                 */
/* ------------------------------------------------------------------ */

export interface CityDelta {
  buildings: Building[]
  /** ids of existing segments to widen by two lanes */
  roadUpgrades: string[]
  newRoads: RoadSegment[]
  busRoutes: BusRoute[]
  intersectionUpgrades: string[]
}

export const emptyDelta = (): CityDelta => ({
  buildings: [],
  roadUpgrades: [],
  newRoads: [],
  busRoutes: [],
  intersectionUpgrades: [],
})

export function mergeDelta(a: CityDelta, b: CityDelta): CityDelta {
  return {
    buildings: [...a.buildings, ...b.buildings],
    roadUpgrades: [...a.roadUpgrades, ...b.roadUpgrades],
    newRoads: [...a.newRoads, ...b.newRoads],
    busRoutes: [...a.busRoutes, ...b.busRoutes],
    intersectionUpgrades: [...a.intersectionUpgrades, ...b.intersectionUpgrades],
  }
}

/** Apply a delta to a copy of the city. Pure — the original is untouched. */
export function applyDelta(city: City, d: CityDelta): City {
  const widen = new Set(d.roadUpgrades)
  const upgradeIx = new Set(d.intersectionUpgrades)
  const used = new Set(d.buildings.map((b) => slotKey(b.x, b.z)))

  return {
    ...city,
    buildings: [...city.buildings, ...d.buildings],
    roads: [
      ...city.roads.map((r) =>
        widen.has(r.id) ? { ...r, lanes: r.lanes + 2, upgraded: true } : r,
      ),
      ...d.newRoads,
    ],
    busRoutes: [...(city.busRoutes ?? []), ...d.busRoutes],
    intersections: city.intersections.map((i) =>
      upgradeIx.has(i.id) ? { ...i, signalised: true } : i,
    ),
    freeSlots: city.freeSlots.filter((s) => !used.has(slotKey(s.x, s.z))),
  }
}

/* ------------------------------------------------------------------ */
/* placement helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * Hands out free plots one at a time so a multi-step plan never places two
 * buildings on the same parcel.
 */
export class SlotCursor {
  private slots: City['freeSlots']
  private i = 0
  constructor(city: City, preferred?: DistrictId) {
    const all = [...city.freeSlots]
    if (preferred) {
      all.sort(
        (a, b) => (a.district === preferred ? 0 : 1) - (b.district === preferred ? 0 : 1),
      )
    }
    this.slots = all
  }
  next() {
    return this.slots[this.i++]
  }
  get remaining() {
    return Math.max(0, this.slots.length - this.i)
  }
}

export function buildingFor(
  kind: InfraKind,
  cursor: SlotCursor,
  labelIndex: number,
): Building | null {
  const key = INFRA_TEMPLATE_KEY[kind]
  if (!key) return null
  const slot = cursor.next()
  if (!slot) return null
  const tpl = TEMPLATES[key]
  const b = makeBuilding(tpl, slot.x, slot.z, slot.district)
  b.label = `${INFRA[kind].name} ${labelIndex}`
  b.isNew = true
  if (kind === 'residential_tower') b.h = 18 + ((labelIndex * 5) % 12)
  return b
}

/** The N most loaded segments in the network — what a widening programme targets. */
export function busiestSegments(city: City, loads: RoadLoad[], n: number): RoadSegment[] {
  const byId = new Map(loads.map((l) => [l.id, l.volumeCapacityRatio]))
  return [...city.roads]
    .filter((r) => !r.elevated)
    .sort((a, b) => (byId.get(b.id) ?? 0) - (byId.get(a.id) ?? 0))
    .slice(0, n)
}

/**
 * Build an elevated expressway above the busiest grid line — one segment per
 * block span so its capacity scales with the corridor it relieves.
 */
export function highwayAlongBusiestLine(
  city: City,
  loads: RoadLoad[],
  lanes = 6,
  prefix = 'hw',
): RoadSegment[] {
  const byId = new Map(loads.map((l) => [l.id, l.volumeCapacityRatio]))
  const lines = new Map<string, { total: number; roads: RoadSegment[] }>()
  for (const r of city.roads) {
    if (r.elevated) continue
    const key = `${r.axis}:${r.axis === 'x' ? r.z1 : r.x1}`
    const entry = lines.get(key) ?? { total: 0, roads: [] }
    entry.total += byId.get(r.id) ?? 0
    entry.roads.push(r)
    lines.set(key, entry)
  }
  const best = [...lines.values()].sort((a, b) => b.total - a.total)[0]
  if (!best) return []

  return best.roads.map((r, i) => ({
    ...r,
    id: `${prefix}-${r.id}`,
    lanes,
    arterial: true,
    elevated: true,
    isNew: true,
    upgraded: false,
    // an expressway attracts the through movements it was built for
    loadWeight: r.loadWeight * 1.45,
    name: `Expressway ${i + 1}`,
  }))
}

/** A bus route following one grid line end to end. */
export function busRouteAlongLine(
  city: City,
  loads: RoadLoad[],
  index: number,
  buses = 8,
): BusRoute | null {
  const byId = new Map(loads.map((l) => [l.id, l.volumeCapacityRatio]))
  const lines = new Map<string, { total: number; roads: RoadSegment[] }>()
  for (const r of city.roads) {
    if (r.elevated) continue
    const key = `${r.axis}:${r.axis === 'x' ? r.z1 : r.x1}`
    const entry = lines.get(key) ?? { total: 0, roads: [] }
    entry.total += byId.get(r.id) ?? 0
    entry.roads.push(r)
    lines.set(key, entry)
  }
  const taken = new Set((city.busRoutes ?? []).flatMap((r) => r.roadIds))
  const ranked = [...lines.values()]
    .filter((l) => !l.roads.every((r) => taken.has(r.id)))
    .sort((a, b) => b.total - a.total)
  const line = ranked[index % Math.max(1, ranked.length)]
  if (!line) return null

  const district = line.roads[Math.floor(line.roads.length / 2)].district
  return {
    id: `bus-${line.roads[0].id}`,
    name: `${DISTRICT_NAMES[district].split(' ')[0]} BRT ${index + 1}`,
    roadIds: line.roads.map((r) => r.id),
    buses,
    lengthKm: line.roads.reduce((s, r) => s + r.lengthKm, 0),
    isNew: true,
  }
}

/** Centre point of everything a delta touches — used to fly the camera there. */
export function deltaFocus(city: City, d: CityDelta): { x: number; z: number } | null {
  const pts: { x: number; z: number }[] = d.buildings.map((b) => ({ x: b.x, z: b.z }))
  const roadIds = new Set([...d.roadUpgrades, ...d.busRoutes.flatMap((r) => r.roadIds)])
  for (const r of city.roads) {
    if (roadIds.has(r.id)) pts.push({ x: (r.x1 + r.x2) / 2, z: (r.z1 + r.z2) / 2 })
  }
  for (const r of d.newRoads) pts.push({ x: (r.x1 + r.x2) / 2, z: (r.z1 + r.z2) / 2 })
  if (pts.length === 0) return null
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    z: pts.reduce((s, p) => s + p.z, 0) / pts.length,
  }
}
