/**
 * THE BUILD CATALOGUE — everything a player can place, in ten categories.
 *
 * Each entry is a thin variation on an existing `BuildingTemplate`, so a small
 * house, an apartment block and a residential tower all render through the
 * same instanced pipeline the city was built with. Nothing new is introduced
 * to the renderer; only footprint, height and the numbers change.
 *
 * Infrastructure that is not a building (roads, bus routes) routes through the
 * existing `InfraKind` machinery instead — see `linearItems`.
 *
 * PROTOTYPE SIMULATION — ILLUSTRATIVE ESTIMATES.
 */
import { TEMPLATES, type BuildingTemplate } from '../city/placement'
import type { InfraKind } from '../city/infrastructure'
import { ASSET_OPEX } from './finance'
import type { DemandKey } from './demand'

export type CatalogueCategory =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'education'
  | 'healthcare'
  | 'transport'
  | 'energy'
  | 'water'
  | 'parks'
  | 'roads'

export const CATEGORY_LABEL: Record<CatalogueCategory, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  industrial: 'Industrial',
  education: 'Education',
  healthcare: 'Healthcare',
  transport: 'Transport',
  energy: 'Energy',
  water: 'Water',
  parks: 'Parks',
  roads: 'Roads',
}

export const CATEGORY_ICON: Record<CatalogueCategory, string> = {
  residential: '▮',
  commercial: '▦',
  industrial: '⬛',
  education: '▤',
  healthcare: '✚',
  transport: '◉',
  energy: '⚡',
  water: '≈',
  parks: '❖',
  roads: '═',
}

/** A placeable structure: one catalogue row. */
export interface CatalogueItem {
  id: string
  name: string
  icon: string
  category: CatalogueCategory
  /** capital cost, USD */
  capex: number
  /** annual running cost, USD */
  opex: number
  /** the template the building is stamped from */
  template: BuildingTemplate
  /** one line of what it does */
  blurb: string
  /** the demand bar this item relieves */
  relieves: DemandKey
  /** construction animation length, ms */
  buildMs: number
}

/** Linear infrastructure — placed along the network rather than on a plot. */
export interface LinearItem {
  id: string
  name: string
  icon: string
  category: CatalogueCategory
  capex: number
  opex: number
  kind: InfraKind
  blurb: string
  relieves: DemandKey
  buildMs: number
}

/** Build a template variant without touching the shared TEMPLATES table. */
function variant(
  base: BuildingTemplate,
  name: string,
  over: Partial<BuildingTemplate>,
): BuildingTemplate {
  return { ...base, ...over, name }
}

const T = TEMPLATES

/* ------------------------------------------------------------------ */
/* the catalogue                                                        */
/* ------------------------------------------------------------------ */

const RAW: Omit<CatalogueItem, 'opex'>[] = [
  /* ---- residential ---- */
  {
    id: 'small_house',
    name: 'Small house',
    icon: '⌂',
    category: 'residential',
    capex: 900_000,
    template: variant(T.residential_tower, 'Small house', {
      type: 'house',
      w: 6,
      d: 6,
      h: 4.5,
      capacity: 46,
      jobs: 2,
      retailSqm: 0,
      parkingSpaces: 24,
    }),
    blurb: '+46 residents · low density, cheap to run',
    relieves: 'residential',
    buildMs: 900,
  },
  {
    id: 'apartment',
    name: 'Apartment block',
    icon: '▥',
    category: 'residential',
    capex: 2_300_000,
    template: variant(T.residential_tower, 'Apartment block', {
      w: 8,
      d: 8,
      h: 11,
      capacity: 188,
      jobs: 8,
      retailSqm: 180,
      parkingSpaces: 62,
    }),
    blurb: '+188 residents · mid-rise',
    relieves: 'residential',
    buildMs: 1200,
  },
  {
    id: 'residential_tower',
    name: 'Residential tower',
    icon: '▮',
    category: 'residential',
    capex: T.residential_tower.capex,
    template: T.residential_tower,
    blurb: '+408 residents · highest density',
    relieves: 'residential',
    buildMs: 1500,
  },

  /* ---- commercial ---- */
  {
    id: 'shop',
    name: 'Shop',
    icon: '▢',
    category: 'commercial',
    capex: 1_400_000,
    template: variant(T.shop, 'Shop', {
      w: 6,
      d: 6,
      h: 4,
      jobs: 48,
      retailSqm: 1_100,
      parkingSpaces: 60,
    }),
    blurb: '+1,100 m² retail · neighbourhood scale',
    relieves: 'commercial',
    buildMs: 800,
  },
  {
    id: 'office',
    name: 'Office building',
    icon: '▤',
    category: 'commercial',
    capex: T.office.capex,
    template: T.office,
    blurb: '+820 jobs',
    relieves: 'industrial',
    buildMs: 1800,
  },
  {
    id: 'shopping_centre',
    name: 'Shopping centre',
    icon: '▦',
    category: 'commercial',
    capex: T.shop.capex,
    template: T.shop,
    blurb: '+5,200 m² retail · pulls traffic',
    relieves: 'commercial',
    buildMs: 1700,
  },

  /* ---- industrial ---- */
  {
    id: 'industrial_unit',
    name: 'Industrial unit',
    icon: '⬛',
    category: 'industrial',
    capex: 3_100_000,
    template: variant(T.office, 'Industrial unit', {
      type: 'industrial',
      w: 12,
      d: 10,
      h: 6,
      jobs: 340,
      retailSqm: 0,
      parkingSpaces: 150,
    }),
    blurb: '+340 jobs · heavier grid and water draw',
    relieves: 'industrial',
    buildMs: 1500,
  },
  {
    id: 'logistics_hub',
    name: 'Logistics hub',
    icon: '⬢',
    category: 'industrial',
    capex: 5_200_000,
    template: variant(T.office, 'Logistics hub', {
      type: 'industrial',
      w: 15,
      d: 11,
      h: 7,
      jobs: 520,
      retailSqm: 0,
      parkingSpaces: 260,
    }),
    blurb: '+520 jobs · freight generator',
    relieves: 'industrial',
    buildMs: 1800,
  },

  /* ---- education ---- */
  {
    id: 'school',
    name: 'School',
    icon: '▤',
    category: 'education',
    capex: T.school.capex,
    template: T.school,
    blurb: '+480 student seats',
    relieves: 'education',
    buildMs: 1900,
  },
  {
    id: 'university',
    name: 'University',
    icon: '▣',
    category: 'education',
    capex: 19_500_000,
    template: variant(T.school, 'University', {
      w: 17,
      d: 12,
      h: 11,
      jobs: 420,
      studentCapacity: 1_450,
      greenHa: 2.2,
      parkingSpaces: 340,
    }),
    blurb: '+1,450 seats · +420 jobs',
    relieves: 'education',
    buildMs: 2600,
  },

  /* ---- healthcare ---- */
  {
    id: 'clinic',
    name: 'Clinic',
    icon: '✛',
    category: 'healthcare',
    capex: 4_600_000,
    template: variant(T.hospital, 'Clinic', {
      w: 8,
      d: 7,
      h: 6,
      jobs: 130,
      beds: 42,
      parkingSpaces: 70,
    }),
    blurb: '+42 beds · neighbourhood care',
    relieves: 'healthcare',
    buildMs: 1400,
  },
  {
    id: 'hospital',
    name: 'Hospital',
    icon: '✚',
    category: 'healthcare',
    capex: T.hospital.capex,
    template: T.hospital,
    blurb: '+220 beds · +620 jobs',
    relieves: 'healthcare',
    buildMs: 2600,
  },

  /* ---- transport ---- */
  {
    id: 'parking_garage',
    name: 'Parking garage',
    icon: 'P',
    category: 'transport',
    capex: T.parking.capex,
    template: T.parking,
    blurb: '+935 spaces',
    relieves: 'transport',
    buildMs: 1600,
  },
  {
    id: 'bus_stop',
    name: 'Bus interchange',
    icon: '⊟',
    category: 'transport',
    capex: 2_100_000,
    template: variant(T.transit_hub, 'Bus interchange', {
      w: 9,
      d: 6,
      h: 4,
      jobs: 24,
      retailSqm: 260,
      parkingSpaces: 40,
    }),
    blurb: 'small transit node · +1.5% mode share',
    relieves: 'transport',
    buildMs: 1100,
  },
  {
    id: 'transit_hub',
    name: 'Transit hub',
    icon: '◉',
    category: 'transport',
    capex: T.transit_hub.capex,
    template: T.transit_hub,
    blurb: '+7.5% transit mode share',
    relieves: 'transport',
    buildMs: 2400,
  },

  /* ---- energy ---- */
  {
    id: 'solar_farm',
    name: 'Solar farm',
    icon: '☀',
    category: 'energy',
    capex: T.solar_farm.capex,
    template: T.solar_farm,
    blurb: '+9 MW zero-carbon',
    relieves: 'energy',
    buildMs: 2000,
  },
  {
    id: 'power_plant',
    name: 'Power plant',
    icon: '⚡',
    category: 'energy',
    capex: T.power_plant.capex,
    template: T.power_plant,
    blurb: '+14 MW · carbon cost',
    relieves: 'energy',
    buildMs: 2600,
  },

  /* ---- water ---- */
  {
    id: 'water_facility',
    name: 'Water facility',
    icon: '≈',
    category: 'water',
    capex: T.water_facility.capex,
    template: T.water_facility,
    blurb: '+2,600 m³/day treatment',
    relieves: 'water',
    buildMs: 2200,
  },

  /* ---- parks ---- */
  {
    id: 'small_park',
    name: 'Small park',
    icon: '❖',
    category: 'parks',
    capex: 780_000,
    template: variant(T.park, 'Small park', {
      w: 9,
      d: 9,
      h: 0.5,
      greenHa: 1.1,
      jobs: 2,
    }),
    blurb: '+1.1 ha green space',
    relieves: 'residential',
    buildMs: 700,
  },
  {
    id: 'large_park',
    name: 'Large park',
    icon: '✿',
    category: 'parks',
    capex: T.park.capex,
    template: T.park,
    blurb: '+3.6 ha green space · lifts quality of life',
    relieves: 'residential',
    buildMs: 1200,
  },
]

export const CATALOGUE: CatalogueItem[] = RAW.map((item) => ({
  ...item,
  opex: ASSET_OPEX[item.template.type] ?? 0,
}))

export const CATALOGUE_BY_ID: Record<string, CatalogueItem> = Object.fromEntries(
  CATALOGUE.map((c) => [c.id, c]),
)

/* ------------------------------------------------------------------ */
/* linear infrastructure                                               */
/* ------------------------------------------------------------------ */

export const LINEAR: LinearItem[] = [
  {
    id: 'road_widening',
    name: 'Widen corridor',
    icon: '═',
    category: 'roads',
    capex: 1_550_000,
    opex: 0,
    kind: 'road_widening',
    blurb: '+2 lanes on the busiest segment',
    relieves: 'transport',
    buildMs: 700,
  },
  {
    id: 'highway_link',
    name: 'Elevated expressway',
    icon: '⇥',
    category: 'roads',
    capex: 4_100_000,
    opex: 240_000,
    kind: 'highway_link',
    blurb: '6-lane grade-separated corridor',
    relieves: 'transport',
    buildMs: 800,
  },
  {
    id: 'intersection_upgrade',
    name: 'Smart intersection',
    icon: '✜',
    category: 'roads',
    capex: 1_400_000,
    opex: 0,
    kind: 'intersection_upgrade',
    blurb: 'adaptive signals on a busy junction',
    relieves: 'transport',
    buildMs: 600,
  },
  {
    id: 'bus_route',
    name: 'Bus rapid transit',
    icon: '⎯',
    category: 'transport',
    capex: 4_600_000,
    opex: 820_000,
    kind: 'bus_route',
    blurb: '+2.5% transit mode share',
    relieves: 'transport',
    buildMs: 1100,
  },
]

export const LINEAR_BY_ID: Record<string, LinearItem> = Object.fromEntries(
  LINEAR.map((l) => [l.id, l]),
)

export const CATEGORY_ORDER: CatalogueCategory[] = [
  'residential',
  'commercial',
  'industrial',
  'education',
  'healthcare',
  'transport',
  'energy',
  'water',
  'parks',
  'roads',
]

/** Everything in one category, buildings then linear infrastructure. */
export function itemsIn(cat: CatalogueCategory): (CatalogueItem | LinearItem)[] {
  return [
    ...CATALOGUE.filter((c) => c.category === cat),
    ...LINEAR.filter((l) => l.category === cat),
  ]
}

export const isLinear = (i: CatalogueItem | LinearItem): i is LinearItem => 'kind' in i

/** The cheapest catalogue item that relieves a given demand bar. */
export function cheapestFor(demand: DemandKey): CatalogueItem | undefined {
  return CATALOGUE.filter((c) => c.relieves === demand).sort((a, b) => a.capex - b.capex)[0]
}

/** The item with the most impact on a demand bar that still fits a budget. */
export function bestFor(demand: DemandKey, budget: number): CatalogueItem | undefined {
  return CATALOGUE.filter((c) => c.relieves === demand && c.capex <= budget).sort(
    (a, b) => b.capex - a.capex,
  )[0]
}
