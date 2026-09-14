/**
 * From a catalogue pick to a real, executable CityPlan.
 *
 * Phase 5 does not get its own construction system. A player placing a school
 * and the AI placing a school both produce a one-step `CityPlan`, which goes
 * through the same `validatePlan → executePlan` path the AI has used since
 * Phase 2 — so both get the site survey, the staged build, the camera work and
 * the re-simulation, and neither can corrupt city state.
 */
import { runSimulation } from '../simulation/citySimulation'
import { makeBuilding } from '../city/placement'
import {
  applyDelta,
  emptyDelta,
  busiestSegments,
  highwayAlongBusiestLine,
  busRouteAlongLine,
  type CityDelta,
  type InfraKind,
} from '../city/infrastructure'
import { isLinear, type CatalogueItem, type LinearItem } from './catalogue'
import type { CityConfig } from '../simulation/config'
import type { City, SimulationResult } from '../simulation/types'
import type { CityPlan, PlanOutcome } from '../ai/types'
import type { Slot } from './siting'

/**
 * The InfraKind each catalogue item reports as, so the construction queue can
 * order it and label it with the vocabulary it already speaks.
 */
export const ITEM_INFRA_KIND: Record<string, InfraKind> = {
  small_house: 'residential_tower',
  apartment: 'residential_tower',
  residential_tower: 'residential_tower',
  shop: 'shopping_district',
  shopping_centre: 'shopping_district',
  office: 'office',
  industrial_unit: 'office',
  logistics_hub: 'office',
  school: 'school',
  university: 'school',
  clinic: 'hospital',
  hospital: 'hospital',
  parking_garage: 'parking_garage',
  bus_stop: 'transit_hub',
  transit_hub: 'transit_hub',
  solar_farm: 'solar_farm',
  power_plant: 'power_plant',
  water_facility: 'water_facility',
  small_park: 'park',
  large_park: 'park',
}

let planSeq = 0

/** The delta one catalogue pick produces. Pure. */
export function deltaFor(
  city: City,
  current: SimulationResult,
  item: CatalogueItem | LinearItem,
  slot: Slot | null,
): CityDelta | null {
  const d = emptyDelta()

  if (isLinear(item)) {
    switch (item.kind) {
      case 'road_widening': {
        const target = busiestSegments(city, current.roads, 1)[0]
        if (!target) return null
        d.roadUpgrades.push(target.id)
        break
      }
      case 'highway_link': {
        const roads = highwayAlongBusiestLine(city, current.roads, 6, `hw${planSeq}`)
        if (roads.length === 0) return null
        d.newRoads.push(...roads)
        break
      }
      case 'intersection_upgrade': {
        const ix = city.intersections.find((i) => !i.signalised)
        if (!ix) return null
        d.intersectionUpgrades.push(ix.id)
        break
      }
      case 'bus_route': {
        const route = busRouteAlongLine(city, current.roads, city.busRoutes?.length ?? 0)
        if (!route) return null
        d.busRoutes.push(route)
        break
      }
      default:
        return null
    }
    return d
  }

  if (!slot) return null
  const b = makeBuilding(item.template, slot.x, slot.z, slot.district)
  b.label = item.name
  b.isNew = true
  d.buildings.push(b)
  return d
}

/**
 * A complete, scored-shaped plan for one catalogue pick. `score` and
 * `breakdown` are filled by the caller if it wants them — a direct placement
 * does not need ranking, it needs executing.
 */
export function sandboxPlan(
  city: City,
  config: CityConfig,
  current: SimulationResult,
  item: CatalogueItem | LinearItem,
  slot: Slot | null,
  /** who asked for it — only changes the wording */
  actor: 'you' | 'ai' = 'you',
): CityPlan | null {
  const delta = deltaFor(city, current, item, slot)
  if (!delta) return null

  const next = applyDelta(city, delta)
  const predicted = runSimulation(next, config)
  const kind = isLinear(item) ? item.kind : ITEM_INFRA_KIND[item.id] ?? 'residential_tower'

  const capacityGain = Math.round(
    delta.buildings.reduce((s, b) => s + b.capacity, 0) * config.occupancyRate,
  )

  const outcome: PlanOutcome = {
    capacityGain,
    traffic: pct(current.metrics.traffic.utilisation, predicted.metrics.traffic.utilisation),
    electricity: pct(current.metrics.electricity.utilisation, predicted.metrics.electricity.utilisation),
    water: pct(current.metrics.water.utilisation, predicted.metrics.water.utilisation),
    education: pct(current.metrics.education.utilisation, predicted.metrics.education.utilisation),
    parking: pct(current.metrics.parking.utilisation, predicted.metrics.parking.utilisation),
    emissions: pct(current.raw.co2KgDay, predicted.raw.co2KgDay),
    economy: pct(current.raw.grossValueAdded, predicted.raw.grossValueAdded),
    quality: pct(current.raw.livabilityIndex, predicted.raw.livabilityIndex),
    operatingCost: pct(current.raw.annualOperatingCost, predicted.raw.annualOperatingCost),
  }

  const id = `sandbox-${item.id}-${planSeq++}`

  return {
    id,
    blueprintId: 'sandbox',
    code: 'A',
    name: item.name,
    description:
      actor === 'ai'
        ? `Placed by the city AI — ${item.blurb}.`
        : `Placed by you — ${item.blurb}.`,
    steps: [
      {
        id: `${id}-step`,
        kind,
        label: item.name,
        count: 1,
        capex: item.capex,
        buildMs: item.buildMs,
        detail: item.blurb,
      },
    ],
    capex: item.capex,
    buildMs: item.buildMs,
    delta,
    predicted,
    outcome,
    headroomAfter: 0,
    score: 0,
    breakdown: [],
    reasons: [],
    withinBudget: true,
    trimmed: false,
    meetsTarget: true,
    violations: [],
    satisfiesConstraints: true,
  }
}

const pct = (before: number, after: number) =>
  before === 0 ? 0 : ((after - before) / before) * 100
