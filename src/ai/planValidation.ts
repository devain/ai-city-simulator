/**
 * Nothing reaches the city until it passes here.
 *
 * The planner is deterministic today, but the whole point of the provider seam
 * is that a language model will one day be proposing these. Validation is the
 * gate that keeps malformed or impossible output from ever touching city state.
 */
import type { City } from '../simulation/types'
import { INFRA, type InfraKind } from '../city/infrastructure'
import { slotKey } from '../city/placement'
import type { CityConstraint, CityPlan } from './types'

export interface ValidationResult {
  ok: boolean
  /** hard failures — the plan must be discarded */
  errors: string[]
  /** things worth telling the user, but not fatal */
  warnings: string[]
}

const KNOWN_KINDS = new Set<InfraKind>(Object.keys(INFRA) as InfraKind[])

export function validatePlan(
  plan: CityPlan,
  city: City,
  constraint: CityConstraint,
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  /* ---- structure ---- */
  if (plan.steps.length === 0) errors.push('Plan contains no work packages')
  if (!Number.isFinite(plan.capex) || plan.capex < 0) errors.push('Plan cost is not a valid figure')

  for (const step of plan.steps) {
    if (!KNOWN_KINDS.has(step.kind)) errors.push(`Unsupported infrastructure type: ${step.kind}`)
    if (step.count <= 0) errors.push(`${step.label} has no units to build`)
  }

  /* ---- the delta must actually create something ---- */
  const d = plan.delta
  const touches =
    d.buildings.length + d.roadUpgrades.length + d.newRoads.length + d.busRoutes.length +
    d.intersectionUpgrades.length
  if (touches === 0) errors.push('Plan would not change the city')

  /* ---- every new building must sit on a genuinely free plot ---- */
  const free = new Set(city.freeSlots.map((s) => slotKey(s.x, s.z)))
  const taken = new Set(city.buildings.map((b) => slotKey(b.x, b.z)))
  const used = new Set<string>()
  for (const b of d.buildings) {
    const key = slotKey(b.x, b.z)
    if (used.has(key)) {
      errors.push(`Two structures placed on the same plot in ${b.district}`)
      continue
    }
    used.add(key)
    if (taken.has(key)) errors.push(`${b.label} would overlap an existing building`)
    else if (!free.has(key)) warnings.push(`${b.label} sits outside the surveyed plots`)
    if (!Number.isFinite(b.x) || !Number.isFinite(b.z)) errors.push('Building has an invalid position')
  }

  /* ---- roads and routes must reference real segments ---- */
  const roadIds = new Set(city.roads.map((r) => r.id))
  for (const id of d.roadUpgrades) {
    if (!roadIds.has(id)) errors.push(`Widening targets a road that does not exist: ${id}`)
  }
  for (const route of d.busRoutes) {
    if (route.roadIds.length === 0) errors.push(`${route.name} has no corridor to run on`)
    for (const id of route.roadIds) {
      if (!roadIds.has(id)) errors.push(`${route.name} references a missing road`)
    }
  }
  const ixIds = new Set(city.intersections.map((i) => i.id))
  for (const id of d.intersectionUpgrades) {
    if (!ixIds.has(id)) errors.push(`Signal upgrade targets a missing intersection: ${id}`)
  }

  /* ---- budget ---- */
  if (plan.capex > constraint.budget + 1) {
    warnings.push(
      `Costs $${(plan.capex / 1e6).toFixed(1)}M against a $${(constraint.budget / 1e6).toFixed(0)}M budget`,
    )
  }

  /* ---- the brief ---- */
  for (const v of plan.violations) warnings.push(v)

  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}
