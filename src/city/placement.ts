/**
 * Building templates + placement helpers shared by the scenario system
 * and the interactive build tool.
 */
import type { Building, BuildingType, City, DistrictId } from '../simulation/types'
import { DISTRICT_NAMES } from '../simulation/citySimulation'

export interface BuildingTemplate {
  type: BuildingType
  name: string
  icon: string
  blurb: string
  /** capital cost, USD — used by the AI planner's budget maths */
  capex: number
  w: number
  d: number
  h: number
  capacity: number
  jobs: number
  retailSqm: number
  parkingSpaces: number
  studentCapacity: number
  beds: number
  greenHa: number
  gridMw?: number
  cleanMw?: number
  waterCapacityM3Day?: number
  co2OffsetKgDay?: number
}

export const TEMPLATES: Record<string, BuildingTemplate> = {
  residential_tower: {
    type: 'residential_tower',
    name: 'Residential tower',
    icon: '▮',
    blurb: '+408 residents',
    capex: 4_200_000,
    w: 8,
    d: 8,
    h: 20,
    capacity: 408,
    jobs: 14,
    retailSqm: 420,
    parkingSpaces: 120,
    studentCapacity: 0,
    beds: 0,
    greenHa: 0,
  },
  school: {
    type: 'school',
    name: 'School',
    icon: '▤',
    blurb: '+480 student seats',
    capex: 7_800_000,
    w: 13,
    d: 9,
    h: 5.5,
    capacity: 0,
    jobs: 55,
    retailSqm: 0,
    parkingSpaces: 60,
    studentCapacity: 480,
    beds: 0,
    greenHa: 0.9,
  },
  hospital: {
    type: 'hospital',
    name: 'Hospital',
    icon: '✚',
    blurb: '+220 beds, +620 jobs',
    capex: 22_000_000,
    w: 12,
    d: 10,
    h: 13,
    capacity: 0,
    jobs: 620,
    retailSqm: 0,
    parkingSpaces: 220,
    studentCapacity: 0,
    beds: 220,
    greenHa: 0,
  },
  shop: {
    type: 'shop',
    name: 'Shopping centre',
    icon: '▦',
    blurb: '+5,200 m² retail',
    capex: 5_400_000,
    w: 9,
    d: 9,
    h: 7,
    capacity: 0,
    jobs: 240,
    retailSqm: 5200,
    parkingSpaces: 300,
    studentCapacity: 0,
    beds: 0,
    greenHa: 0,
  },
  parking: {
    type: 'parking',
    name: 'Parking garage',
    icon: 'P',
    blurb: '+935 spaces',
    capex: 6_000_000,
    w: 8,
    d: 8,
    h: 5,
    capacity: 0,
    jobs: 12,
    retailSqm: 0,
    parkingSpaces: 935,
    studentCapacity: 0,
    beds: 0,
    greenHa: 0,
  },
  park: {
    type: 'park',
    name: 'Park',
    icon: '❖',
    blurb: '+3.6 ha green space',
    capex: 2_400_000,
    w: 17,
    d: 17,
    h: 0.6,
    capacity: 0,
    jobs: 6,
    retailSqm: 0,
    parkingSpaces: 0,
    studentCapacity: 0,
    beds: 0,
    greenHa: 3.6,
  },
  transit_hub: {
    type: 'transit_hub',
    name: 'Transit hub',
    icon: '◉',
    blurb: '+7.5% transit mode share',
    capex: 12_500_000,
    w: 14,
    d: 8,
    h: 7,
    capacity: 0,
    jobs: 140,
    retailSqm: 1800,
    parkingSpaces: 180,
    studentCapacity: 0,
    beds: 0,
    greenHa: 0,
  },
  office: {
    type: 'office',
    name: 'Office building',
    icon: '▤',
    blurb: '+820 jobs',
    capex: 6_500_000,
    w: 8.2,
    d: 8.2,
    h: 24,
    capacity: 0,
    jobs: 820,
    retailSqm: 900,
    parkingSpaces: 240,
    studentCapacity: 0,
    beds: 0,
    greenHa: 0,
  },
  power_plant: {
    type: 'power_plant',
    name: 'Power plant',
    icon: '⚡',
    blurb: '+14 MW capacity',
    capex: 28_000_000,
    w: 12,
    d: 10,
    h: 9,
    capacity: 0,
    jobs: 90,
    retailSqm: 0,
    parkingSpaces: 70,
    studentCapacity: 0,
    beds: 0,
    greenHa: 0,
    gridMw: 14,
  },
  solar_farm: {
    type: 'solar_farm',
    name: 'Solar farm',
    icon: '☀',
    blurb: '+9 MW zero-carbon',
    capex: 14_000_000,
    w: 17,
    d: 17,
    h: 1.2,
    capacity: 0,
    jobs: 12,
    retailSqm: 0,
    parkingSpaces: 10,
    studentCapacity: 0,
    beds: 0,
    greenHa: 0,
    gridMw: 9,
    cleanMw: 9,
    co2OffsetKgDay: 1800,
  },
  water_facility: {
    type: 'water_facility',
    name: 'Water facility',
    icon: '≈',
    blurb: '+2,600 m³/day treatment',
    capex: 16_000_000,
    w: 14,
    d: 11,
    h: 5,
    capacity: 0,
    jobs: 45,
    retailSqm: 0,
    parkingSpaces: 40,
    studentCapacity: 0,
    beds: 0,
    greenHa: 0,
    waterCapacityM3Day: 2600,
  },
}

export const PLACEABLE: BuildingTemplate[] = [
  TEMPLATES.residential_tower,
  TEMPLATES.school,
  TEMPLATES.hospital,
  TEMPLATES.shop,
  TEMPLATES.parking,
  TEMPLATES.park,
  TEMPLATES.transit_hub,
  TEMPLATES.office,
  TEMPLATES.power_plant,
  TEMPLATES.solar_farm,
  TEMPLATES.water_facility,
]

let uid = 0
export function makeBuilding(
  tpl: BuildingTemplate,
  x: number,
  z: number,
  district: DistrictId,
  overrides: Partial<Building> = {},
): Building {
  return {
    id: `new-${tpl.type}-${(uid++).toString(36)}-${Math.round(x)}-${Math.round(z)}`,
    type: tpl.type,
    x,
    z,
    w: tpl.w,
    d: tpl.d,
    h: tpl.h,
    rotation: 0,
    district,
    capacity: tpl.capacity,
    jobs: tpl.jobs,
    retailSqm: tpl.retailSqm,
    parkingSpaces: tpl.parkingSpaces,
    studentCapacity: tpl.studentCapacity,
    beds: tpl.beds,
    greenHa: tpl.greenHa,
    gridMw: tpl.gridMw,
    cleanMw: tpl.cleanMw,
    waterCapacityM3Day: tpl.waterCapacityM3Day,
    co2OffsetKgDay: tpl.co2OffsetKgDay,
    isNew: true,
    variant: Math.floor(Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * 1000),
    label: `New ${tpl.name} · ${DISTRICT_NAMES[district]}`,
    ...overrides,
  }
}

/** Take `count` free slots, preferring the districts already under pressure. */
export function takeSlots(city: City, count: number, preferred?: DistrictId): City['freeSlots'] {
  const slots = [...city.freeSlots]
  if (preferred) {
    slots.sort((a, b) => (a.district === preferred ? -1 : 0) - (b.district === preferred ? -1 : 0))
  }
  return slots.slice(0, count)
}

/** Add buildings to a *copy* of the city and consume the slots they occupy. */
export function withBuildings(city: City, added: Building[]): City {
  const used = new Set(added.map((b) => slotKey(b.x, b.z)))
  return {
    ...city,
    buildings: [...city.buildings, ...added],
    freeSlots: city.freeSlots.filter((s) => !used.has(slotKey(s.x, s.z))),
  }
}

export const slotKey = (x: number, z: number) => `${Math.round(x * 10)}:${Math.round(z * 10)}`

/** Nearest free slot to an arbitrary world position (used by click-to-build). */
export function nearestSlot(city: City, x: number, z: number) {
  let best = city.freeSlots[0]
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
