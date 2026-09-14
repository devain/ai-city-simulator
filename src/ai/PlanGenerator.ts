/**
 * PlanGenerator — turns a diagnosis + objective into concrete, costed,
 * *actually simulated* candidate plans.
 *
 * Nothing here invents an outcome number. Every plan is materialised into a
 * real CityDelta, applied to a copy of the city and run through the same
 * simulation engine the dashboard uses. That is what makes the AI's claims
 * checkable.
 */
import type { CityConfig } from '../simulation/config'
import type { Building, City, DistrictId, MetricKey, SimulationResult } from '../simulation/types'
import { runSimulation } from '../simulation/citySimulation'
import {
  INFRA,
  SlotCursor,
  applyDelta,
  buildingFor,
  busRouteAlongLine,
  busiestSegments,
  emptyDelta,
  highwayAlongBusiestLine,
  type CityDelta,
  type InfraKind,
} from '../city/infrastructure'
import { TEMPLATES, makeBuilding } from '../city/placement'
import { evaluateConstraints } from './constraintCheck'
import type { CityConstraint, CityObjective, CityPlan, CityPlanStep, PlanOutcome } from './types'

/* ------------------------------------------------------------------ */
/* headroom: how many more residents can this city absorb?              */
/* ------------------------------------------------------------------ */

/** systems that decide whether the city can take more people */
const BINDING: MetricKey[] = ['traffic', 'education', 'parking', 'electricity', 'water']

/** Residents-only growth: new homes, minimal new infrastructure of their own. */
function growthTowers(city: City, residents: number, config: CityConfig): Building[] {
  if (residents <= 0) return []
  const capacity = residents / config.occupancyRate
  const count = Math.max(1, Math.round(capacity / 420))
  const slots = city.freeSlots.length > 0 ? city.freeSlots : [{ x: 0, z: 0, district: 'central' as const }]
  return Array.from({ length: count }, (_, i) => {
    const s = slots[i % slots.length]
    return makeBuilding(TEMPLATES.residential_tower, s.x, s.z, s.district, {
      id: `probe-${i}`,
      capacity: capacity / count,
      jobs: 0,
      retailSqm: 0,
      parkingSpaces: 8,
      label: `Growth probe ${i + 1}`,
    })
  })
}

function worstUtilisation(r: SimulationResult) {
  return Math.max(...BINDING.map((k) => r.metrics[k].utilisation))
}

export function bindingConstraintOf(r: SimulationResult): MetricKey | null {
  let best: MetricKey | null = null
  let top = -Infinity
  for (const k of BINDING) {
    const u = r.metrics[k].utilisation
    if (u > top) {
      top = u
      best = k
    }
  }
  return best
}

/**
 * Binary-searches the number of extra residents the city can take before any
 * binding system passes 100% of capacity. This is the "population capacity"
 * the planner quotes — a measured property of the city, not a guess.
 */
export function headroom(city: City, config: CityConfig, max = 40_000): number {
  const probe = (n: number) =>
    worstUtilisation(
      runSimulation({ ...city, buildings: [...city.buildings, ...growthTowers(city, n, config)] }, config),
    )

  if (probe(0) >= 1) return 0
  if (probe(max) < 1) return max

  let lo = 0
  let hi = max
  for (let i = 0; i < 11; i++) {
    const mid = (lo + hi) / 2
    if (probe(mid) < 1) lo = mid
    else hi = mid
  }
  return Math.round(lo / 50) * 50
}

/* ------------------------------------------------------------------ */
/* blueprints                                                          */
/* ------------------------------------------------------------------ */

interface StepSpec {
  kind: InfraKind
  count: number
}

interface Blueprint {
  id: string
  name: string
  description: string
  /** what this blueprint is good at — matched against bottlenecks + objective */
  tags: (MetricKey | 'population')[]
  base: StepSpec[]
  /** kinds the generator may add more of, in priority order, to hit the target */
  scalable: InfraKind[]
}

const BLUEPRINTS: Blueprint[] = [
  {
    id: 'roads',
    name: 'Road & Corridor Expansion',
    description:
      'Widen the most loaded corridors, upgrade their signals and add an elevated expressway over the busiest line.',
    tags: ['traffic'],
    base: [
      { kind: 'road_widening', count: 10 },
      { kind: 'intersection_upgrade', count: 4 },
      { kind: 'highway_link', count: 6 },
    ],
    scalable: ['road_widening', 'intersection_upgrade'],
  },
  {
    id: 'transit',
    name: 'Transit + School Package',
    description:
      'A transit interchange with bus rapid transit routes, new school places and structured parking to absorb growth without more cars.',
    tags: ['traffic', 'parking', 'education', 'population'],
    base: [
      { kind: 'transit_hub', count: 1 },
      { kind: 'bus_route', count: 2 },
      { kind: 'school', count: 1 },
      { kind: 'parking_garage', count: 1 },
    ],
    scalable: ['bus_route', 'parking_garage', 'school', 'transit_hub'],
  },
  {
    id: 'district',
    name: 'New Residential District',
    description:
      'Build the homes outright — towers with their own school, retail anchor, parking and park.',
    tags: ['population', 'retail', 'economy'],
    base: [
      { kind: 'residential_tower', count: 6 },
      { kind: 'school', count: 1 },
      { kind: 'shopping_district', count: 1 },
      { kind: 'parking_garage', count: 1 },
      { kind: 'park', count: 1 },
    ],
    scalable: ['residential_tower', 'parking_garage', 'school', 'bus_route'],
  },
  {
    id: 'services',
    name: 'Schools & Services',
    description: 'Close the social-infrastructure gap: school places, a hospital and new parks.',
    tags: ['education', 'livability'],
    base: [
      { kind: 'school', count: 2 },
      { kind: 'park', count: 2 },
      { kind: 'hospital', count: 1 },
    ],
    scalable: ['school', 'park'],
  },
  {
    id: 'utilities',
    name: 'Utility Reinforcement',
    description: 'Raise the ceiling on generation and water treatment before demand hits it.',
    tags: ['electricity', 'water'],
    base: [
      { kind: 'solar_farm', count: 1 },
      { kind: 'water_facility', count: 1 },
      { kind: 'power_plant', count: 1 },
    ],
    scalable: ['solar_farm', 'water_facility'],
  },
  {
    id: 'green',
    name: 'Clean Energy & Green Grid',
    description:
      'Zero-carbon generation, new parks and bus routes — cut emissions without touching the economy.',
    tags: ['emissions', 'livability'],
    base: [
      { kind: 'solar_farm', count: 2 },
      { kind: 'park', count: 3 },
      { kind: 'bus_route', count: 2 },
    ],
    scalable: ['solar_farm', 'park', 'bus_route'],
  },
  {
    id: 'economy',
    name: 'Economic Expansion',
    description: 'Offices and retail anchors, with the parking and transit to serve them.',
    tags: ['economy', 'retail'],
    base: [
      { kind: 'office', count: 3 },
      { kind: 'shopping_district', count: 2 },
      { kind: 'parking_garage', count: 1 },
      { kind: 'transit_hub', count: 1 },
    ],
    scalable: ['office', 'shopping_district', 'parking_garage'],
  },
]

/* ------------------------------------------------------------------ */
/* materialising a step list into a real city change                    */
/* ------------------------------------------------------------------ */

function materialise(
  city: City,
  specs: StepSpec[],
  base: SimulationResult,
  preferred?: DistrictId,
): CityDelta {
  const delta = emptyDelta()
  const cursor = new SlotCursor(city, preferred)
  let labelIndex = 1

  for (const spec of specs) {
    if (spec.count <= 0) continue
    switch (spec.kind) {
      case 'road_widening': {
        const taken = new Set(delta.roadUpgrades)
        const targets = busiestSegments(city, base.roads, spec.count + taken.size).filter(
          (r) => !taken.has(r.id),
        )
        delta.roadUpgrades.push(...targets.slice(0, spec.count).map((r) => r.id))
        break
      }
      case 'intersection_upgrade': {
        const hot = [...city.intersections]
          .filter((i) => !i.signalised)
          .slice(0, spec.count)
          .map((i) => i.id)
        delta.intersectionUpgrades.push(
          ...(hot.length > 0 ? hot : city.intersections.slice(0, spec.count).map((i) => i.id)),
        )
        break
      }
      case 'highway_link':
      case 'bridge': {
        if (delta.newRoads.length === 0) {
          const lanes = spec.kind === 'bridge' ? 4 : 6
          delta.newRoads.push(
            ...highwayAlongBusiestLine(city, base.roads, lanes, spec.kind).slice(0, spec.count),
          )
        }
        break
      }
      case 'bus_route': {
        for (let i = 0; i < spec.count; i++) {
          const staged = applyDelta(city, delta)
          const route = busRouteAlongLine(staged, base.roads, delta.busRoutes.length)
          if (route) delta.busRoutes.push(route)
        }
        break
      }
      default: {
        for (let i = 0; i < spec.count; i++) {
          const b = buildingFor(spec.kind, cursor, labelIndex++)
          if (b) delta.buildings.push(b)
        }
      }
    }
  }
  return delta
}

function specCapex(specs: StepSpec[]): number {
  return specs.reduce((s, x) => s + INFRA[x.kind].capex * x.count, 0)
}

function toSteps(specs: StepSpec[], delta: CityDelta): CityPlanStep[] {
  return specs
    .filter((s) => s.count > 0)
    .map((s, i) => {
      const spec = INFRA[s.kind]
      // report what was actually placed, not what was requested
      let built = s.count
      if (s.kind === 'road_widening') built = Math.min(s.count, delta.roadUpgrades.length)
      if (s.kind === 'bus_route') built = Math.min(s.count, delta.busRoutes.length)
      if (s.kind === 'highway_link' || s.kind === 'bridge') built = Math.min(s.count, delta.newRoads.length)
      return {
        id: `${s.kind}-${i}`,
        kind: s.kind,
        label: built > 1 ? `${built} × ${spec.name}` : spec.name,
        count: built,
        capex: spec.capex * built,
        buildMs: spec.buildMs * Math.min(built, 4),
        detail: spec.blurb,
      }
    })
    .filter((s) => s.count > 0)
}

/* ------------------------------------------------------------------ */
/* outcomes                                                            */
/* ------------------------------------------------------------------ */

const pctChange = (after: number, before: number) =>
  before === 0 ? 0 : ((after - before) / before) * 100

function outcomeOf(
  before: SimulationResult,
  after: SimulationResult,
  capacityGain: number,
): PlanOutcome {
  const u = (k: MetricKey) => pctChange(after.metrics[k].utilisation, before.metrics[k].utilisation)
  return {
    capacityGain,
    traffic: u('traffic'),
    electricity: u('electricity'),
    water: u('water'),
    education: u('education'),
    parking: u('parking'),
    emissions: pctChange(after.metrics.emissions.value, before.metrics.emissions.value),
    economy: pctChange(after.metrics.economy.value, before.metrics.economy.value),
    quality: pctChange(after.metrics.livability.value, before.metrics.livability.value),
    operatingCost: pctChange(after.metrics.cost.value, before.metrics.cost.value),
  }
}

/* ------------------------------------------------------------------ */
/* generation                                                          */
/* ------------------------------------------------------------------ */

export interface GenerationContext {
  city: City
  config: CityConfig
  current: SimulationResult
  objective: CityObjective
  constraint: CityConstraint
  baseHeadroom: number
  /** the user named a district — put the work there when there is room */
  preferDistrict?: DistrictId
  /** the user asked for a kind of solution, e.g. "roads instead" */
  preferBlueprints?: string[]
}

interface Built {
  specs: StepSpec[]
  delta: CityDelta
  predicted: SimulationResult
  head: number
  capex: number
}

function build(ctx: GenerationContext, specs: StepSpec[]): Built {
  const delta = materialise(ctx.city, specs, ctx.current, ctx.preferDistrict)
  const next = applyDelta(ctx.city, delta)
  const predicted = runSimulation(next, ctx.config)
  const added = delta.buildings.reduce((s, b) => s + b.capacity, 0) * ctx.config.occupancyRate
  const head = headroom(next, ctx.config) + added
  return { specs, delta, predicted, head, capex: specCapex(specs) }
}

/** Drop units, cheapest-value-last, until the plan fits the budget. */
function trimToBudget(specs: StepSpec[], budget: number): { specs: StepSpec[]; trimmed: boolean } {
  const out = specs.map((s) => ({ ...s }))
  let trimmed = false
  let guard = 200
  while (specCapex(out) > budget && guard-- > 0) {
    // remove one unit of the most expensive remaining line
    let idx = -1
    let worst = -1
    for (let i = 0; i < out.length; i++) {
      if (out[i].count <= 0) continue
      const c = INFRA[out[i].kind].capex
      if (c > worst) {
        worst = c
        idx = i
      }
    }
    if (idx < 0) break
    out[idx].count -= 1
    trimmed = true
  }
  return { specs: out.filter((s) => s.count > 0), trimmed }
}

/**
 * Grow a plan until it meets the population target, adding whichever scalable
 * item buys the most headroom per dollar. Each candidate is fully simulated.
 */
function fitToTarget(ctx: GenerationContext, bp: Blueprint, start: Built): Built {
  const target = ctx.objective.populationTarget
  if (!target) return start

  let best = start
  let guard = 8
  while (guard-- > 0) {
    const gain = best.head - ctx.baseHeadroom
    if (gain >= target) break

    let winner: Built | null = null
    let winnerValue = -Infinity
    for (const kind of bp.scalable) {
      const specs = best.specs.map((s) => ({ ...s }))
      const line = specs.find((s) => s.kind === kind)
      if (line) line.count += 1
      else specs.push({ kind, count: 1 })
      if (specCapex(specs) > ctx.constraint.budget) continue

      const candidate = build(ctx, specs)
      // headroom bought per million spent
      const value =
        (candidate.head - best.head) / Math.max(0.5, INFRA[kind].capex / 1_000_000)
      if (value > winnerValue && candidate.head > best.head + 10) {
        winnerValue = value
        winner = candidate
      }
    }
    if (!winner) break
    best = winner
  }
  return best
}

export function generatePlans(ctx: GenerationContext): CityPlan[] {
  const { objective, constraint, current } = ctx

  // rank blueprints by how well they match the city's actual problems
  const pressure = (k: MetricKey) => current.metrics[k]?.utilisation ?? 0
  const relevance = (bp: Blueprint) => {
    let r = 0
    for (const tag of bp.tags) {
      if (tag === 'population') r += objective.populationTarget ? 1.4 : 0.3
      else r += pressure(tag) * 1.2
      if (objective.focus.includes(tag as MetricKey)) r += 0.9
    }
    // objective affinity
    if (objective.id === 'traffic' && bp.tags.includes('traffic')) r += 0.8
    if (objective.id === 'co2' && bp.tags.includes('emissions')) r += 1.4
    if (objective.id === 'economy' && bp.tags.includes('economy')) r += 1.4
    if (objective.id === 'quality' && bp.tags.includes('livability')) r += 1.2
    if (objective.id === 'population' && bp.tags.includes('population')) r += 1.0
    // the user explicitly asked for this sort of solution
    if (ctx.preferBlueprints?.includes(bp.id)) r += 2.5
    return r / bp.tags.length
  }

  const ranked = [...BLUEPRINTS].sort((a, b) => relevance(b) - relevance(a))
  const chosen = ranked.slice(0, 3)
  // always keep one contrasting option so the user sees a real trade-off
  const contrast = ranked.find((b) => !chosen.includes(b) && b.id !== 'roads')
  if (contrast && chosen.length < 4) chosen.push(contrast)

  const codes = ['A', 'B', 'C', 'D', 'E']
  const plans: CityPlan[] = []

  chosen.forEach((bp, i) => {
    const fitted = trimToBudget(bp.base, constraint.budget)
    let built = build(ctx, fitted.specs)
    built = fitToTarget(ctx, bp, built)

    const overBudget = built.capex > constraint.budget
    const finalSpecs = overBudget ? trimToBudget(built.specs, constraint.budget).specs : built.specs
    const finalBuilt = overBudget ? build(ctx, finalSpecs) : built

    const capacityGain = Math.round(finalBuilt.head - ctx.baseHeadroom)
    const steps = toSteps(finalSpecs, finalBuilt.delta)
    const capex = steps.reduce((s, x) => s + x.capex, 0)
    const check = evaluateConstraints(finalBuilt.predicted, current, constraint.metrics)

    plans.push({
      id: `plan-${bp.id}`,
      blueprintId: bp.id,
      code: codes[i] ?? String(i + 1),
      name: bp.name,
      description: bp.description,
      steps,
      capex,
      buildMs: steps.reduce((s, x) => s + x.buildMs, 0),
      delta: finalBuilt.delta,
      predicted: finalBuilt.predicted,
      outcome: outcomeOf(current, finalBuilt.predicted, capacityGain),
      headroomAfter: Math.round(finalBuilt.head),
      score: 0,
      breakdown: [],
      reasons: [],
      withinBudget: capex <= constraint.budget + 1,
      trimmed: fitted.trimmed || overBudget,
      meetsTarget: objective.populationTarget ? capacityGain >= objective.populationTarget : true,
      violations: check.violations,
      satisfiesConstraints: check.satisfied,
    })
  })

  return plans.filter((p) => p.steps.length > 0)
}

/* ------------------------------------------------------------------ */
/* a direct "build me one of these" order                              */
/* ------------------------------------------------------------------ */

/**
 * Turns an explicit build request into a one-step plan that goes through the
 * exact same simulate → score → construct path as a generated plan. There is
 * no second code path for "the user asked for it" — which is why a hand-placed
 * school and an AI-chosen school behave identically afterwards.
 */
export function buildSpecificPlan(
  ctx: GenerationContext,
  kind: InfraKind,
  count: number,
  district?: DistrictId,
): CityPlan | null {
  const specs: StepSpec[] = [{ kind, count: Math.max(1, count) }]
  const delta = materialise(ctx.city, specs, ctx.current, district)
  const steps = toSteps(specs, delta)
  if (steps.length === 0) return null

  const next = applyDelta(ctx.city, delta)
  const predicted = runSimulation(next, ctx.config)
  const added = delta.buildings.reduce((s, b) => s + b.capacity, 0) * ctx.config.occupancyRate
  const head = headroom(next, ctx.config) + added
  const capacityGain = Math.round(head - ctx.baseHeadroom)
  const capex = steps.reduce((s, x) => s + x.capex, 0)
  const check = evaluateConstraints(predicted, ctx.current, ctx.constraint.metrics)
  const spec = INFRA[kind]
  const built = steps[0].count

  return {
    id: `plan-direct-${kind}`,
    blueprintId: 'direct',
    code: 'A',
    name: built > 1 ? `${built} × ${spec.name}` : spec.name,
    description: `Direct build requested by the operator — ${spec.blurb}.`,
    steps,
    capex,
    buildMs: steps.reduce((s, x) => s + x.buildMs, 0),
    delta,
    predicted,
    outcome: outcomeOf(ctx.current, predicted, capacityGain),
    headroomAfter: Math.round(head),
    score: 0,
    breakdown: [],
    reasons: [],
    withinBudget: capex <= ctx.constraint.budget + 1,
    trimmed: built < Math.max(1, count),
    meetsTarget: true,
    violations: check.violations,
    satisfiesConstraints: check.satisfied,
  }
}
