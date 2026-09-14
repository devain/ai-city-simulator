/**
 * Turns an approved CityPlan into an ordered, camera-directed construction
 * sequence. The order is deliberately logical rather than arbitrary — the
 * interchange goes in before the corridors that feed it, the school before the
 * route that serves it, and the network is connected last.
 */
import type { City } from '../simulation/types'
import { INFRA, type CityDelta, type InfraKind } from '../city/infrastructure'
import type { CityPlan } from '../ai/types'
import type { CameraShot, ConstructionStep, ExecutionQueue, StepType } from './types'

/** build priority — lower goes first */
const ORDER: Record<InfraKind, number> = {
  transit_hub: 0,
  road_widening: 1,
  highway_link: 1,
  bridge: 1,
  intersection_upgrade: 2,
  school: 3,
  hospital: 3,
  parking_garage: 4,
  shopping_district: 5,
  office: 5,
  residential_tower: 6,
  park: 6,
  power_plant: 7,
  solar_farm: 7,
  water_facility: 7,
  bus_route: 8,
}

const TYPE_OF: Record<InfraKind, StepType> = {
  transit_hub: 'structure',
  school: 'structure',
  hospital: 'structure',
  parking_garage: 'structure',
  shopping_district: 'structure',
  office: 'structure',
  residential_tower: 'structure',
  power_plant: 'structure',
  solar_farm: 'structure',
  water_facility: 'structure',
  park: 'structure',
  road_widening: 'road',
  highway_link: 'road',
  bridge: 'road',
  intersection_upgrade: 'road',
  bus_route: 'route',
}

/** the verb the command center uses for each kind of work */
const VERB: Record<StepType, string> = {
  site_analysis: 'ANALYZING',
  resource_allocation: 'ALLOCATING',
  structure: 'CONSTRUCTING',
  road: 'BUILDING',
  route: 'CONNECTING',
  simulate: 'RUNNING',
  complete: 'OPTIMIZATION',
}

/** Which scene objects a plan step creates. */
export function idsForStep(delta: CityDelta, kind: InfraKind): string[] {
  switch (kind) {
    case 'road_widening':
      return delta.roadUpgrades
    case 'intersection_upgrade':
      return delta.intersectionUpgrades
    case 'highway_link':
    case 'bridge':
      return delta.newRoads.map((r) => r.id)
    case 'bus_route':
      return delta.busRoutes.map((r) => r.id)
    default: {
      const type =
        kind === 'shopping_district' ? 'shop' : kind === 'parking_garage' ? 'parking' : kind
      return delta.buildings.filter((b) => b.type === type).map((b) => b.id)
    }
  }
}

function centroid(points: { x: number; z: number }[]) {
  if (points.length === 0) return null
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    z: points.reduce((s, p) => s + p.z, 0) / points.length,
  }
}

function positionOf(city: City, delta: CityDelta, kind: InfraKind, ids: string[]) {
  const set = new Set(ids)
  const pts: { x: number; z: number }[] = []
  for (const b of delta.buildings) if (set.has(b.id)) pts.push({ x: b.x, z: b.z })
  for (const r of [...city.roads, ...delta.newRoads]) {
    if (set.has(r.id)) pts.push({ x: (r.x1 + r.x2) / 2, z: (r.z1 + r.z2) / 2 })
  }
  for (const route of delta.busRoutes) {
    if (!set.has(route.id)) continue
    const segs = city.roads.filter((r) => route.roadIds.includes(r.id))
    for (const r of segs) pts.push({ x: (r.x1 + r.x2) / 2, z: (r.z1 + r.z2) / 2 })
  }
  void kind
  return centroid(pts)
}

/* how long each kind of work is given on screen — long enough to read */
const STRUCTURE_MS = 3000
const ROAD_MS = 2600
const ROUTE_MS = 2600

export function buildExecutionQueue(plan: CityPlan, city: City): ExecutionQueue {
  const delta = plan.delta
  const ordered = [...plan.steps].sort((a, b) => ORDER[a.kind] - ORDER[b.kind])

  const all: { x: number; z: number }[] = delta.buildings.map((b) => ({ x: b.x, z: b.z }))
  const siteFocus = centroid(all) ?? { x: 0, z: 0 }

  // the hero is the first structure in build order — usually the interchange
  const heroStep = ordered.find((s) => TYPE_OF[s.kind] === 'structure')
  const heroPos = heroStep
    ? positionOf(city, delta, heroStep.kind, idsForStep(delta, heroStep.kind))
    : siteFocus

  const steps: ConstructionStep[] = []
  const constructions: ExecutionQueue['constructions'] = {}
  let cursor = 0

  const push = (
    type: StepType,
    label: string,
    detail: string,
    duration: number,
    opts: {
      kind?: InfraKind
      targetIds?: string[]
      position?: { x: number; z: number } | null
      camera?: CameraShot | null
    } = {},
  ) => {
    steps.push({
      id: `step-${steps.length}`,
      index: steps.length,
      type,
      kind: opts.kind,
      label,
      detail,
      targetIds: opts.targetIds ?? [],
      position: opts.position ?? null,
      startAt: cursor,
      duration,
      status: 'QUEUED',
      progress: 0,
      camera: opts.camera ?? null,
    })
    cursor += duration
  }

  /* ---- 1. survey the site ---- */
  push('site_analysis', 'ANALYZING CONSTRUCTION SITE', 'Surveying parcels and access', 2100, {
    position: siteFocus,
    camera: {
      x: siteFocus.x,
      z: siteFocus.z,
      distance: 150,
      polar: 0.78,
      travel: 2000,
    },
  })

  /* ---- 2. mobilise ---- */
  push(
    'resource_allocation',
    'ALLOCATING RESOURCES',
    `$${(plan.capex / 1e6).toFixed(1)}M committed across ${plan.steps.length} work packages`,
    1500,
    {
      position: siteFocus,
      camera: { x: siteFocus.x, z: siteFocus.z, distance: 104, polar: 0.95, travel: 1400 },
    },
  )

  /* ---- 3. the work itself ---- */
  for (const step of ordered) {
    const type = TYPE_OF[step.kind]
    const ids = idsForStep(delta, step.kind)
    if (ids.length === 0) continue
    const pos = positionOf(city, delta, step.kind, ids) ?? siteFocus
    const spec = INFRA[step.kind]

    const base = type === 'structure' ? STRUCTURE_MS : type === 'road' ? ROAD_MS : ROUTE_MS
    // more units take a little longer, but never drag
    const duration = Math.round(base * (1 + Math.min(0.55, (ids.length - 1) * 0.12)))

    const camera: CameraShot =
      type === 'structure'
        ? { x: pos.x, z: pos.z, distance: 54, polar: 1.14, travel: 1300, orbit: 0.1 }
        : type === 'road'
          ? { x: pos.x, z: pos.z, distance: 108, polar: 0.92, travel: 1200 }
          : { x: pos.x, z: pos.z, distance: 146, polar: 0.8, travel: 1200 }

    push(
      type,
      `${VERB[type]} ${spec.name.toUpperCase()}`,
      `${ids.length > 1 ? `${ids.length} × ` : ''}${spec.name} · ${spec.blurb}`,
      duration,
      { kind: step.kind, targetIds: ids, position: pos, camera },
    )

    // stagger the individual objects inside the step's window
    const perStart = steps[steps.length - 1].startAt
    const stagger = Math.min(420, (duration * 0.35) / Math.max(1, ids.length))
    ids.forEach((id, i) => {
      constructions[id] = {
        start: perStart + 250 + i * stagger,
        duration: Math.max(1200, duration - 350 - i * stagger),
      }
    })
  }

  /* ---- 4. recalculate ---- */
  push('simulate', 'RUNNING NEW CITY SIMULATION', 'Re-solving every modelled system', 2400, {
    position: heroPos,
    camera: heroPos
      ? { x: heroPos.x, z: heroPos.z, distance: 78, polar: 1.02, travel: 1600, orbit: 0.16 }
      : null,
  })

  /* ---- 5. the reveal ---- */
  push('complete', 'OPTIMIZATION COMPLETE', 'Returning to city overview', 2600, {
    position: { x: 0, z: 0 },
    camera: { x: 0, z: 0, distance: 215, polar: 0.74, travel: 2400 },
  })

  return {
    planId: plan.id,
    planCode: plan.code,
    planName: plan.name,
    steps,
    totalMs: cursor,
    constructions,
    hero: heroPos,
  }
}
