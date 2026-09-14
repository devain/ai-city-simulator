import type { Building, City } from './types'
import { TEMPLATES, makeBuilding, takeSlots, withBuildings } from '../city/placement'

export type ScenarioId =
  | 'current'
  | 'add_1000'
  | 'add_5000'
  | 'add_10000'
  | 'shopping_district'
  | 'residential_tower'
  | 'new_school'
  | 'transit_hub'

export interface Scenario {
  id: ScenarioId
  name: string
  short: string
  description: string
  icon: string
  accent: string
  /** produce the buildings this scenario adds to the current city */
  build: (city: City) => Building[]
}

function residentialGrowth(city: City, towers: number, capacityEach: number): Building[] {
  const slots = takeSlots(city, towers, 'east')
  return slots.map((s, i) =>
    makeBuilding(TEMPLATES.residential_tower, s.x, s.z, s.district, {
      capacity: capacityEach,
      // pure residential growth: no new jobs, no new retail, and the
      // developer under-provides parking — which is what creates the crunch
      jobs: 0,
      retailSqm: 0,
      parkingSpaces: 8,
      h: 17 + ((i * 7) % 13),
      label: `Growth Tower ${i + 1}`,
    }),
  )
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'current',
    name: 'Current City',
    short: 'BASELINE',
    description: 'The city as it stands today — no interventions applied.',
    icon: '◎',
    accent: '#7dd3fc',
    build: () => [],
  },
  {
    id: 'add_1000',
    name: '+1,000 Residents',
    short: '+1K',
    description: '3 mid-rise residential blocks infilled on vacant land.',
    icon: '↑',
    accent: '#67e8f9',
    build: (c) => residentialGrowth(c, 3, 353),
  },
  {
    id: 'add_5000',
    name: '+5,000 Residents',
    short: '+5K',
    description: 'A major residential expansion — 13 new towers, mostly in the east.',
    icon: '⇧',
    accent: '#a78bfa',
    build: (c) => residentialGrowth(c, 13, 408),
  },
  {
    id: 'add_10000',
    name: '+10,000 Residents',
    short: '+10K',
    description: 'Doubling the city. 20 high-density towers across every district.',
    icon: '⤊',
    accent: '#f472b6',
    build: (c) => residentialGrowth(c, 20, 530),
  },
  {
    id: 'shopping_district',
    name: 'New Shopping District',
    short: 'RETAIL',
    description: '4 retail anchors adding 20,800 m² of floor space and 960 jobs.',
    icon: '▦',
    accent: '#fbbf24',
    build: (c) =>
      takeSlots(c, 4, 'central').map((s, i) =>
        makeBuilding(TEMPLATES.shop, s.x, s.z, s.district, { label: `Retail Anchor ${i + 1}` }),
      ),
  },
  {
    id: 'residential_tower',
    name: 'New Residential Tower',
    short: 'TOWER',
    description: 'A single 408-resident landmark tower.',
    icon: '▮',
    accent: '#38bdf8',
    build: (c) => residentialGrowth(c, 1, 408),
  },
  {
    id: 'new_school',
    name: 'New School',
    short: 'SCHOOL',
    description: '480 additional student seats to relieve education pressure.',
    icon: '▤',
    accent: '#4ade80',
    build: (c) =>
      takeSlots(c, 1, 'east').map((s) =>
        makeBuilding(TEMPLATES.school, s.x, s.z, s.district, { label: 'New School' }),
      ),
  },
  {
    id: 'transit_hub',
    name: 'New Transit Hub',
    short: 'TRANSIT',
    description: 'An interchange that shifts 7.5% of car trips onto public transport.',
    icon: '◉',
    accent: '#22d3ee',
    build: (c) =>
      takeSlots(c, 1, 'east').map((s) =>
        makeBuilding(TEMPLATES.transit_hub, s.x, s.z, s.district, { label: 'New Transit Hub' }),
      ),
  },
]

export const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map((s) => [s.id, s])) as Record<
  ScenarioId,
  Scenario
>

export function applyScenario(city: City, id: ScenarioId): City {
  const scenario = SCENARIO_BY_ID[id]
  if (!scenario) return city
  const added = scenario.build(city)
  if (added.length === 0) return city
  return withBuildings(city, added)
}
