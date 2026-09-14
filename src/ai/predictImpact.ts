/**
 * PREDICTED IMPACT — what will happen if you build this, before you build it.
 *
 * Not an estimate table: the candidate is actually placed on a copy of the
 * city, the full simulation is re-run, and the two results are differenced.
 * Every number the preview panel shows is the same number the city will show
 * a second later if the player confirms.
 *
 * This is the single most important interaction in Phase 5 — it is what makes
 * the AI feel like it understands the city rather than describing it.
 */
import { runSimulation } from '../simulation/citySimulation'
import { withBuildings, makeBuilding } from '../city/placement'
import { applyDelta, emptyDelta, busiestSegments, highwayAlongBusiestLine, busRouteAlongLine } from '../city/infrastructure'
import { cityFinance } from '../sandbox/finance'
import { cityHealth } from '../sandbox/health'
import type { CityConfig } from '../simulation/config'
import type { Building, City, DistrictId, SimulationResult } from '../simulation/types'
import type { CatalogueItem, LinearItem } from '../sandbox/catalogue'
import { isLinear } from '../sandbox/catalogue'

export interface ImpactLine {
  key: string
  label: string
  /** percentage change, or an absolute delta where a percentage is meaningless */
  delta: number
  /** true when `delta` is a percentage rather than an absolute */
  isPercent: boolean
  /** true when an increase is a good thing */
  higherIsBetter: boolean
  display: string
}

export interface BuildImpact {
  /** the city as it would be */
  after: SimulationResult
  lines: ImpactLine[]
  /** change in the 0-100 city health score */
  healthDelta: number
  /** change in net annual income, USD */
  netIncomeDelta: number
  capex: number
  opex: number
  /** one sentence of judgement, never longer */
  verdict: string
  /** what the AI would build alongside it, if anything */
  caution: string | null
}

const pctChange = (before: number, after: number) =>
  before === 0 ? (after === 0 ? 0 : 100) : ((after - before) / before) * 100

/**
 * Place a catalogue item on a copy of the city and run the whole engine.
 * `slot` is where it would go; for linear items it is ignored.
 */
export function previewCity(
  city: City,
  item: CatalogueItem | LinearItem,
  slot: { x: number; z: number; district: DistrictId } | null,
  current: SimulationResult,
): City {
  if (isLinear(item)) {
    const d = emptyDelta()
    switch (item.kind) {
      case 'road_widening': {
        const target = busiestSegments(city, current.roads, 1)[0]
        if (target) d.roadUpgrades.push(target.id)
        break
      }
      case 'highway_link':
        d.newRoads.push(...highwayAlongBusiestLine(city, current.roads, 6, 'hw'))
        break
      case 'intersection_upgrade': {
        const ix = city.intersections.find((i) => !i.signalised) ?? city.intersections[0]
        if (ix) d.intersectionUpgrades.push(ix.id)
        break
      }
      case 'bus_route': {
        const route = busRouteAlongLine(city, current.roads, (city.busRoutes?.length ?? 0))
        if (route) d.busRoutes.push(route)
        break
      }
    }
    return applyDelta(city, d)
  }

  if (!slot) return city
  const b = makeBuilding(item.template, slot.x, slot.z, slot.district)
  b.label = item.name
  return withBuildings(city, [b])
}

/**
 * The full before/after for one candidate. Runs one extra simulation — cheap
 * enough to do on hover, so the panel can update as the player moves the
 * ghost around.
 */
export function predictImpact(
  city: City,
  config: CityConfig,
  current: SimulationResult,
  item: CatalogueItem | LinearItem,
  slot: { x: number; z: number; district: DistrictId } | null,
): BuildImpact {
  const next = previewCity(city, item, slot, current)
  const after = runSimulation(next, config)

  const financeBefore = cityFinance(city, current)
  const financeAfter = cityFinance(next, after)
  const healthBefore = cityHealth(current, financeBefore)
  const healthAfter = cityHealth(after, financeAfter)

  const lines: ImpactLine[] = [
    line('population', 'Population', current.population, after.population, false, true),
    line('traffic', 'Traffic', current.metrics.traffic.utilisation, after.metrics.traffic.utilisation, true, false),
    line('parking', 'Parking', current.metrics.parking.utilisation, after.metrics.parking.utilisation, true, false),
    line('education', 'School pressure', current.metrics.education.utilisation, after.metrics.education.utilisation, true, false),
    line('energy', 'Grid load', current.metrics.electricity.utilisation, after.metrics.electricity.utilisation, true, false),
    line('water', 'Water load', current.metrics.water.utilisation, after.metrics.water.utilisation, true, false),
    line('co2', 'CO₂', current.raw.co2KgDay, after.raw.co2KgDay, true, false),
    line('jobs', 'Jobs', current.jobs, after.jobs, false, true),
  ].filter((l) => Math.abs(l.delta) >= (l.isPercent ? 0.35 : 1))

  const netIncomeDelta = financeAfter.netIncome - financeBefore.netIncome
  const healthDelta = healthAfter.score - healthBefore.score

  return {
    after,
    lines,
    healthDelta,
    netIncomeDelta,
    capex: item.capex,
    opex: item.opex,
    verdict: verdictFor(item, healthDelta, netIncomeDelta, after),
    caution: cautionFor(current, after),
  }
}

function line(
  key: string,
  label: string,
  before: number,
  after: number,
  isPercent: boolean,
  higherIsBetter: boolean,
): ImpactLine {
  const delta = pctChange(before, after)
  const abs = after - before
  return {
    key,
    label,
    delta: isPercent ? delta : abs,
    isPercent,
    higherIsBetter,
    display: isPercent
      ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`
      : `${abs >= 0 ? '+' : ''}${Math.round(abs).toLocaleString('en-US')}`,
  }
}

/** One sentence. Never a paragraph, never a chain of reasoning. */
function verdictFor(
  item: CatalogueItem | LinearItem,
  healthDelta: number,
  netIncomeDelta: number,
  after: SimulationResult,
): string {
  if (healthDelta <= -4) {
    return `This would cost the city ${Math.abs(healthDelta)} health points — only worth it if you have a plan for the fallout.`
  }
  if (healthDelta >= 4) return `Strong choice — city health rises ${healthDelta} points.`
  if (netIncomeDelta > 400_000) {
    return `Pays for its own upkeep: net income improves by $${(netIncomeDelta / 1e6).toFixed(1)}M a year.`
  }
  if (netIncomeDelta < -600_000) {
    return `Adds $${(Math.abs(netIncomeDelta) / 1e6).toFixed(1)}M a year to the running cost — make sure it earns that back.`
  }
  if (after.metrics.traffic.utilisation > 0.95) {
    return 'Recommended only once traffic is under control — the network is already at its limit.'
  }
  return `Modest, safe improvement. ${item.blurb}.`
}

/** What the AI would want built alongside this, based on the simulated result. */
function cautionFor(before: SimulationResult, after: SimulationResult): string | null {
  const worsened: [string, number, string][] = [
    ['traffic', after.metrics.traffic.utilisation, 'a transit connection'],
    ['parking', after.metrics.parking.utilisation, 'parking capacity'],
    ['school places', after.metrics.education.utilisation, 'a school'],
    ['the grid', after.metrics.electricity.utilisation, 'generation capacity'],
    ['water treatment', after.metrics.water.utilisation, 'a water facility'],
  ]
  const beforeVals: Record<string, number> = {
    traffic: before.metrics.traffic.utilisation,
    parking: before.metrics.parking.utilisation,
    'school places': before.metrics.education.utilisation,
    'the grid': before.metrics.electricity.utilisation,
    'water treatment': before.metrics.water.utilisation,
  }

  for (const [name, value, fix] of worsened) {
    if (value > 0.92 && value > beforeVals[name]) {
      return `This pushes ${name} to ${Math.round(value * 100)}% — pair it with ${fix}.`
    }
  }
  return null
}
