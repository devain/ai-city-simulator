import type { CityConfig } from '../simulation/config'
import type { ObjectiveId } from './types'

/**
 * Scenario Mode — pre-set situations that stress the city and hand the AI
 * planner a brief. Each one is a real change to the model, not a label.
 */
export interface CityChallenge {
  id: string
  name: string
  subtitle: string
  icon: string
  accent: string
  brief: string
  /** multipliers applied to the live config to create the pressure */
  stress?: Partial<Record<keyof CityConfig, number>>
  objectiveId: ObjectiveId
  populationTarget?: number
  budget: number
}

export const CHALLENGES: CityChallenge[] = [
  {
    id: 'population_boom',
    name: 'Population Boom',
    subtitle: '+5,000 residents',
    icon: '⇧',
    accent: '#a78bfa',
    brief: 'The region is growing. Make room for 5,000 more residents without breaking a system.',
    objectiveId: 'population',
    populationTarget: 5000,
    budget: 50_000_000,
  },
  {
    id: 'mega_boom',
    name: 'Mega Population Boom',
    subtitle: '+20,000 residents',
    icon: '⤊',
    accent: '#f472b6',
    brief: 'A generational expansion. The city must absorb 20,000 more people.',
    objectiveId: 'population',
    populationTarget: 20_000,
    budget: 160_000_000,
  },
  {
    id: 'downtown_congestion',
    name: 'Downtown Congestion',
    subtitle: 'Through traffic +40%',
    icon: '⇄',
    accent: '#fb7185',
    brief: 'Regional through-traffic has jumped 40%. Get the network moving again.',
    stress: { externalPeakTrips: 1.4 },
    objectiveId: 'traffic',
    budget: 60_000_000,
  },
  {
    id: 'economic_expansion',
    name: 'Economic Expansion',
    subtitle: 'Commercial demand +50%',
    icon: '▲',
    accent: '#fbbf24',
    brief: 'Employers want in. Grow the economy without seizing up the city.',
    stress: { jobs: 1.5 },
    objectiveId: 'economy',
    budget: 75_000_000,
  },
  {
    id: 'school_crisis',
    name: 'School Crisis',
    subtitle: 'Student population +35%',
    icon: '▤',
    accent: '#4ade80',
    brief: 'A birth-rate bulge has pushed school rolls up 35%. Find the seats.',
    stress: { childrenRate: 1.35 },
    objectiveId: 'quality',
    budget: 40_000_000,
  },
  {
    id: 'energy_crisis',
    name: 'Energy Crisis',
    subtitle: 'Energy demand +40%',
    icon: '⚡',
    accent: '#f59e0b',
    brief: 'Electrification has pushed demand up 40%. Keep the lights on.',
    stress: { electricityPerPersonKwhDay: 1.4, electricityPerJobKwhDay: 1.4 },
    objectiveId: 'balanced',
    budget: 60_000_000,
  },
  {
    id: 'climate_challenge',
    name: 'Climate Challenge',
    subtitle: 'Carbon budget cut 25%',
    icon: '☘',
    accent: '#34d399',
    brief: 'The carbon budget has been cut by a quarter. Decarbonise without wrecking the economy.',
    stress: { carbonBudgetKgDay: 0.75 },
    objectiveId: 'co2',
    budget: 70_000_000,
  },
  {
    id: 'transit_era',
    name: 'New Transit Era',
    subtitle: 'Mass transit investment',
    icon: '◉',
    accent: '#22d3ee',
    brief: 'Capital is available for public transport. Spend it where it moves the most people.',
    objectiveId: 'traffic',
    budget: 90_000_000,
  },
]

export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c])) as Record<
  string,
  CityChallenge
>
