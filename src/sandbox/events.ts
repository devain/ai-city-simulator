/**
 * CITY EVENTS — the pressure the player did not choose.
 *
 * Seeded and deterministic: the same city seed replays the same events in the
 * same months, so a Human-vs-AI run is a fair comparison and a demo is
 * reproducible. Each event nudges real config values for a number of months
 * and then lifts, which means the AI has to actually notice and respond rather
 * than read a script.
 *
 * PROTOTYPE SIMULATION — ILLUSTRATIVE ESTIMATES.
 */
import type { CityConfig } from '../simulation/config'

export type EventSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface CityEventSpec {
  id: string
  name: string
  icon: string
  severity: EventSeverity
  /** what the player is told */
  blurb: string
  /** how many simulated months it lasts */
  months: number
  /** multiplicative changes applied to the config while active */
  effects: Partial<Record<keyof CityConfig, number>>
  /** what a sensible response looks like — the advisor quotes this */
  response: string
}

export const EVENT_SPECS: CityEventSpec[] = [
  {
    id: 'traffic_surge',
    name: 'Traffic surge',
    icon: '⇄',
    severity: 'WARNING',
    blurb: 'Regional through-traffic has jumped. Corridors are carrying loads they were not sized for.',
    months: 18,
    effects: { externalPeakTrips: 1.42 },
    response: 'transit capacity or corridor widening',
  },
  {
    id: 'energy_shortage',
    name: 'Energy shortage',
    icon: '⚡',
    severity: 'CRITICAL',
    blurb: 'Regional supply has been curtailed. The grid is running far closer to its ceiling.',
    months: 24,
    effects: { gridCapacityMw: 0.74 },
    response: 'new generation, ideally zero-carbon',
  },
  {
    id: 'water_shortage',
    name: 'Water shortage',
    icon: '≈',
    severity: 'CRITICAL',
    blurb: 'Drought has cut what the treatment works can draw.',
    months: 20,
    effects: { waterPlantCapacityM3Day: 0.78 },
    response: 'additional treatment capacity',
  },
  {
    id: 'population_boom',
    name: 'Population boom',
    icon: '⇧',
    severity: 'WARNING',
    blurb: 'The region is growing fast and this city is where people want to be.',
    months: 24,
    effects: { targetDensityPerHa: 1.18 },
    response: 'housing, then the schools and roads that follow it',
  },
  {
    id: 'economic_boom',
    name: 'Economic boom',
    icon: '▲',
    severity: 'INFO',
    blurb: 'Business confidence is high — output per job has risen sharply.',
    months: 18,
    effects: { gvaPerJobYear: 1.24, residentSpendYear: 1.12 },
    response: 'bank the surplus or invest it in capacity',
  },
  {
    id: 'recession',
    name: 'Economic recession',
    icon: '▼',
    severity: 'CRITICAL',
    blurb: 'A downturn has cut output and household spending. Revenue will fall with it.',
    months: 24,
    effects: { gvaPerJobYear: 0.79, residentSpendYear: 0.86 },
    response: 'protect the balance sheet; avoid new operating commitments',
  },
  {
    id: 'school_crisis',
    name: 'School capacity crisis',
    icon: '▤',
    severity: 'WARNING',
    blurb: 'A demographic bulge has pushed enrolment well above projections.',
    months: 30,
    effects: { schoolEnrollmentRate: 1.22, childrenRate: 1.12 },
    response: 'school places, quickly',
  },
  {
    id: 'fuel_spike',
    name: 'Fuel price spike',
    icon: '$',
    severity: 'WARNING',
    blurb: 'Energy prices have jumped; running the city just got more expensive.',
    months: 16,
    effects: { electricityCostPerKwh: 1.55 },
    response: 'cheaper generation and lower demand',
  },
]

export const EVENT_BY_ID: Record<string, CityEventSpec> = Object.fromEntries(
  EVENT_SPECS.map((e) => [e.id, e]),
)

export interface ActiveEvent {
  spec: CityEventSpec
  /** absolute tick the event started on */
  startedTick: number
  /** absolute tick it lifts on */
  endsTick: number
}

/* ------------------------------------------------------------------ */
/* deterministic scheduling                                            */
/* ------------------------------------------------------------------ */

/** mulberry32 — small, fast, and identical across runs for a given seed */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Should an event fire on this tick? Deterministic in (seed, tick), so the
 * same city always meets the same weather.
 *
 * Nothing happens in the first year — the player gets a clear run at the city
 * before it starts arguing back — and events then average roughly one every
 * 14 months.
 */
export function eventDueAt(seed: number, tick: number): CityEventSpec | null {
  if (tick < 12) return null
  const r = rng(seed * 7919 + tick * 104729)
  if (r() > 1 / 14) return null
  const spec = EVENT_SPECS[Math.floor(r() * EVENT_SPECS.length)]
  return spec ?? null
}

/** Apply every active event's multipliers to a config. Pure. */
export function configWithEvents(base: CityConfig, active: ActiveEvent[]): CityConfig {
  if (active.length === 0) return base
  const cfg = { ...base } as Record<string, number>
  for (const ev of active) {
    for (const [key, mult] of Object.entries(ev.spec.effects)) {
      if (typeof cfg[key] === 'number') cfg[key] = cfg[key] * (mult as number)
    }
  }
  return cfg as unknown as CityConfig
}
