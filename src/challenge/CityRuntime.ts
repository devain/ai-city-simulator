/**
 * A city that can be run forward, headlessly and deterministically.
 *
 * This is the piece Phase 6 needed that Phase 5 did not have: the sandbox
 * drives *one* city through React state, but a challenge needs two, advanced
 * in lockstep, with no rendering in the way and no way for one to receive an
 * advantage the other did not.
 *
 * Everything here is pure over an explicit snapshot. Given the same seed, the
 * same starting snapshot and the same decisions, a runtime produces the same
 * city every time — which is what makes Human-vs-AI a fair test and a replay
 * an actual replay.
 */
import { runSimulation } from '../simulation/citySimulation'
import { applyDelta, type CityDelta } from '../city/infrastructure'
import { cityFinance, type CityFinance } from '../sandbox/finance'
import { cityHealth, type CityHealth } from '../sandbox/health'
import { cityDemand, type DemandBar } from '../sandbox/demand'
import { populationPressure, stepOccupancy } from '../sandbox/population'
import { cityPriorities, type CityPriority } from '../ai/CityPriorities'
import { configWithEvents, eventDueAt, type ActiveEvent } from '../sandbox/events'
import type { CityConfig } from '../simulation/config'
import type { City, SimulationResult } from '../simulation/types'

/** One complete, self-contained city. Everything the spec's snapshot lists. */
export interface CitySnapshot {
  /** months since the challenge began */
  tick: number
  city: City
  /** the config the city is *currently* running under, events included */
  config: CityConfig
  /** the un-stressed config, so events can be re-applied cleanly each tick */
  baseConfig: CityConfig
  occupancy: number
  treasury: number
  spentTotal: number
  activeEvents: ActiveEvent[]
  /** derived, cached so panels never recompute them per frame */
  result: SimulationResult
  finance: CityFinance
  health: CityHealth
  demand: DemandBar[]
  priorities: CityPriority[]
  /** one row per simulated month, for the charts */
  series: SeriesPoint[]
}

export interface SeriesPoint {
  tick: number
  year: number
  population: number
  treasury: number
  traffic: number
  co2PerCapita: number
  quality: number
  health: number
  economy: number
  netIncome: number
  score: number
}

/** Build the derived half of a snapshot from the raw half. Pure. */
export function derive(
  city: City,
  config: CityConfig,
  treasury: number,
): Pick<CitySnapshot, 'result' | 'finance' | 'health' | 'demand' | 'priorities'> {
  const result = runSimulation(city, config)
  const finance = cityFinance(city, result)
  const health = cityHealth(result, finance)
  return {
    result,
    finance,
    health,
    demand: cityDemand(city, result),
    priorities: cityPriorities(city, result, finance, health),
  }
}

/** The starting snapshot both sides of a challenge receive. */
export function createSnapshot(
  city: City,
  baseConfig: CityConfig,
  treasury: number,
): CitySnapshot {
  const d = derive(city, baseConfig, treasury)
  return {
    tick: 0,
    city,
    config: baseConfig,
    baseConfig,
    occupancy: baseConfig.occupancyRate,
    treasury,
    spentTotal: 0,
    activeEvents: [],
    series: [],
    ...d,
  }
}

/** What happened during one simulated month. */
export interface TickOutcome {
  snapshot: CitySnapshot
  /** events that began this month */
  started: ActiveEvent[]
  /** events that lifted this month */
  ended: ActiveEvent[]
}

/**
 * Advance one simulated month.
 *
 * Order matters and is the same for both sides: weather first (neither city
 * chooses its events), then population responds to how good a place the city
 * is, then the engine re-solves, then the books settle.
 */
export function advance(
  snap: CitySnapshot,
  seed: number,
  /** scoring weights, so the series carries a score for the charts */
  scoreOf: (s: CitySnapshot) => number,
): TickOutcome {
  const tick = snap.tick + 1

  /* ---- 1. weather — identical for both cities, by construction ---- */
  const ended = snap.activeEvents.filter((e) => e.endsTick <= tick)
  let activeEvents = snap.activeEvents.filter((e) => e.endsTick > tick)
  const started: ActiveEvent[] = []

  const due = eventDueAt(seed, tick)
  if (due && !activeEvents.some((e) => e.spec.id === due.id)) {
    const ev: ActiveEvent = { spec: due, startedTick: tick, endsTick: tick + due.months }
    activeEvents = [...activeEvents, ev]
    started.push(ev)
  }

  /* ---- 2. population argues for itself ---- */
  const pressure = populationPressure(snap.result, snap.occupancy, snap.result.raw.livabilityIndex)
  const occupancy = stepOccupancy(snap.occupancy, pressure)
  const config = { ...configWithEvents(snap.baseConfig, activeEvents), occupancyRate: occupancy }

  /* ---- 3. the engine re-solves ---- */
  const d = derive(snap.city, config, snap.treasury)

  /* ---- 4. the books settle ---- */
  const treasury = Math.max(0, snap.treasury + d.finance.netIncome / 12)

  const next: CitySnapshot = {
    ...snap,
    tick,
    config,
    occupancy,
    treasury,
    activeEvents,
    ...d,
  }

  next.series = [...snap.series, seriesPoint(next, scoreOf(next))].slice(-260)
  return { snapshot: next, started, ended }
}

/** Apply a construction to a snapshot, charging the treasury. Pure. */
export function build(snap: CitySnapshot, delta: CityDelta, capex: number): CitySnapshot {
  const city = applyDelta(snap.city, delta)
  const treasury = Math.max(0, snap.treasury - capex)
  return {
    ...snap,
    city,
    treasury,
    spentTotal: snap.spentTotal + capex,
    ...derive(city, snap.config, treasury),
  }
}

/** Remove a building, charging the clearance cost. Pure. */
export function demolish(snap: CitySnapshot, buildingId: string, cost: number): CitySnapshot {
  const b = snap.city.buildings.find((x) => x.id === buildingId)
  if (!b) return snap
  const city: City = {
    ...snap.city,
    buildings: snap.city.buildings.filter((x) => x.id !== buildingId),
    freeSlots: [...snap.city.freeSlots, { x: b.x, z: b.z, district: b.district }],
  }
  const treasury = Math.max(0, snap.treasury - cost)
  return {
    ...snap,
    city,
    treasury,
    spentTotal: snap.spentTotal + cost,
    ...derive(city, snap.config, treasury),
  }
}

function seriesPoint(s: CitySnapshot, score: number): SeriesPoint {
  return {
    tick: s.tick,
    year: Math.floor(s.tick / 12) + 1,
    population: Math.round(s.result.population),
    treasury: s.treasury,
    traffic: s.result.metrics.traffic.utilisation,
    co2PerCapita: s.result.raw.co2PerCapitaKgYear,
    quality: s.result.raw.livabilityIndex,
    health: s.health.score,
    economy: s.result.raw.grossValueAdded,
    netIncome: s.finance.netIncome,
    score,
  }
}

/** A compact fingerprint of a city's measurable state — used to prove two
 *  starting snapshots really are identical. */
export function fingerprint(s: CitySnapshot): string {
  const r = s.result
  return [
    s.city.buildings.length,
    s.city.roads.length,
    s.city.busRoutes?.length ?? 0,
    s.city.freeSlots.length,
    Math.round(r.population),
    Math.round(r.jobs),
    r.metrics.traffic.utilisation.toFixed(6),
    r.metrics.electricity.utilisation.toFixed(6),
    r.metrics.water.utilisation.toFixed(6),
    r.metrics.education.utilisation.toFixed(6),
    r.raw.co2KgDay.toFixed(3),
    r.raw.grossValueAdded.toFixed(2),
    s.treasury.toFixed(2),
    s.health.score,
  ].join('|')
}
