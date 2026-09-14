/**
 * THE AUTONOMOUS CITY AGENT.
 *
 *   ANALYZE → PRIORITIZE → PLAN → SIMULATE → SCORE → EXECUTE → OBSERVE → REPEAT
 *
 * Not a loop — a decision function. `decide()` is called once per city tick by
 * the sandbox clock, looks at the city as it stands *now*, and returns either
 * one action or a stated reason for doing nothing. Everything it knows comes
 * from the live simulation, so when the city changes underneath it (a player
 * build, an emergency event, the consequences of its own last decision) the
 * next call simply sees a different city and re-prioritises.
 *
 * That is what produces the adaptation the spec asks for: build a transit hub,
 * traffic falls, energy becomes the top priority, and the next decision is a
 * solar farm — with no script anywhere.
 *
 * Three rules it never breaks:
 *   1. Every action names the ranked problem that caused it.
 *   2. It never commits money it does not have, and never touches the reserve.
 *   3. It simulates before it builds, and abandons an action that makes the
 *      city worse.
 */
import { runSimulation } from '../simulation/citySimulation'
import { cityFinance } from '../sandbox/finance'
import { cityHealth } from '../sandbox/health'
import { applyDelta } from '../city/infrastructure'
import { sandboxPlan } from '../sandbox/sandboxPlan'
import { bestFreeSlot, sitingReason, type Slot } from '../sandbox/siting'
import { isLinear, type CatalogueItem, type LinearItem } from '../sandbox/catalogue'
import { remedyFor, type CityPriority } from './CityPriorities'
import type { CityConfig } from '../simulation/config'
import type { City, DistrictId, SimulationResult } from '../simulation/types'
import type { CityPlan } from './types'

/** What the agent is trying to achieve. Set by the player, in words. */
export type AgentObjectiveId =
  | 'grow'
  | 'economy'
  | 'traffic'
  | 'quality'
  | 'balanced'
  | 'green'

export interface AgentObjective {
  id: AgentObjectiveId
  label: string
  /** the phrase the player would say */
  phrase: string
  /** priorities the objective cares about most, and by how much */
  weights: Record<string, number>
  /** a health floor the agent must defend, if the objective states one */
  healthFloor?: number
}

export const AGENT_OBJECTIVES: Record<AgentObjectiveId, AgentObjective> = {
  grow: {
    id: 'grow',
    label: 'Grow the city',
    phrase: 'Grow the city while keeping City Health above 75.',
    weights: { housing: 1.5, jobs: 1.25, education: 1.2, water: 1.15, energy: 1.15, traffic: 1.1 },
    healthFloor: 75,
  },
  economy: {
    id: 'economy',
    label: 'Maximise the economy',
    phrase: 'Maximise economic output.',
    weights: { jobs: 1.6, commercial: 1.45, finance: 1.3, traffic: 1.1 },
  },
  traffic: {
    id: 'traffic',
    label: 'Keep traffic down',
    phrase: 'Keep traffic below 50%.',
    weights: { traffic: 1.9, parking: 1.4 },
  },
  quality: {
    id: 'quality',
    label: 'Improve quality of life',
    phrase: 'Improve quality of life.',
    weights: { healthcare: 1.5, education: 1.4, environment: 1.3, traffic: 1.15 },
  },
  balanced: {
    id: 'balanced',
    label: 'Balance the city',
    phrase: 'Balance the city.',
    weights: {},
  },
  green: {
    id: 'green',
    label: 'Cut emissions',
    phrase: 'Cut emissions without wrecking the economy.',
    weights: { environment: 1.8, energy: 1.35, traffic: 1.2 },
  },
}

export type AgentDecisionKind = 'build' | 'wait' | 'blocked'

export interface AgentDecision {
  kind: AgentDecisionKind
  /** the ranked problem this addresses */
  priority: CityPriority | null
  /** short — never a chain of reasoning */
  reason: string
  plan: CityPlan | null
  item: CatalogueItem | LinearItem | null
  slot: Slot | null
  /** where it is going, for the log and the camera */
  siting: string | null
  /** simulated health change if this is carried out */
  healthDelta: number
  /** true for work worth flying the camera to */
  cinematic: boolean
}

export interface AgentInput {
  city: City
  config: CityConfig
  current: SimulationResult
  priorities: CityPriority[]
  objective: AgentObjective
  /** the whole treasury */
  treasury: number
  /** money the agent must leave untouched */
  reserve: number
  /** districts it has recently built the same thing in */
  recentDistricts: Record<string, DistrictId[]>
  /** health right now, so it can refuse to make things worse */
  health: number
}

/** Capital the agent is allowed to commit. Never the whole treasury. */
export const spendableBy = (treasury: number, reserve: number) => Math.max(0, treasury - reserve)

/**
 * One decision. Deterministic given the city — call it again after anything
 * changes and it will reconsider from scratch.
 */
export function decide(input: AgentInput): AgentDecision {
  const { city, config, current, objective, treasury, reserve, health } = input
  const spendable = spendableBy(treasury, reserve)

  const none = (reason: string, kind: AgentDecisionKind = 'wait'): AgentDecision => ({
    kind,
    priority: null,
    reason,
    plan: null,
    item: null,
    slot: null,
    siting: null,
    healthDelta: 0,
    cinematic: false,
  })

  if (spendable < 700_000) {
    return none(
      `Holding — $${(treasury / 1e6).toFixed(1)}M in the treasury against a $${(reserve / 1e6).toFixed(
        1,
      )}M reserve leaves nothing safe to commit.`,
      'blocked',
    )
  }

  // ---- PRIORITIZE: re-rank the live problems through the objective ----
  const ranked = [...input.priorities]
    .map((p) => ({ p, weighted: p.urgency * (objective.weights[p.key] ?? 1) }))
    .sort((a, b) => b.weighted - a.weighted)

  const worthActingOn = ranked.filter(({ p }) => p.level !== 'NORMAL')
  if (worthActingOn.length === 0) {
    return none('No system is under pressure — holding capital rather than building for its own sake.')
  }

  // ---- PLAN + SIMULATE: try each candidate until one genuinely helps ----
  const tried: string[] = []
  for (const { p } of worthActingOn.slice(0, 4)) {
    const item = remedyFor(p, spendable)
    if (!item) {
      tried.push(`${p.label.toLowerCase()} (nothing affordable)`)
      continue
    }

    const slot = isLinear(item)
      ? null
      : bestFreeSlot(city, current, p.demand, input.recentDistricts[item.id] ?? [])
    if (!isLinear(item) && !slot) {
      tried.push(`${p.label.toLowerCase()} (no free land)`)
      continue
    }

    const plan = sandboxPlan(city, config, current, item, slot, 'ai')
    if (!plan) {
      tried.push(`${p.label.toLowerCase()} (not buildable here)`)
      continue
    }

    // ---- SCORE: would this actually leave the city better off? ----
    const next = applyDelta(city, plan.delta)
    const after = runSimulation(next, config)
    const healthBefore = cityHealth(current, cityFinance(city, current))
    const healthAfter = cityHealth(after, cityFinance(next, after))
    const healthDelta = healthAfter.score - healthBefore.score

    /*
     * Three gates, in order of how hard they are.
     *
     * The floor is absolute: while the city is under the objective's health
     * target, nothing that lowers it further is allowed through. That single
     * rule is what stops a growth objective from bulldozing the city with
     * housing it cannot service — the pressure new residents create shows up
     * as a health drop *before* it is built, so the agent simply declines.
     */
    if (objective.healthFloor != null && healthAfter.score < objective.healthFloor && healthDelta < 0) {
      tried.push(`${item.name.toLowerCase()} (health is below the ${objective.healthFloor} target and this would lower it)`)
      continue
    }
    if (healthDelta < -2) {
      tried.push(`${item.name.toLowerCase()} (would cost ${Math.abs(healthDelta)} health points)`)
      continue
    }

    /*
     * Solvency. A structure is a permanent claim on the budget, so the agent
     * refuses one that deepens a deficit it is not there to fix. Without this
     * the city can be built into bankruptcy one affordable item at a time.
     */
    const financeAfter = cityFinance(next, after)
    const financeBefore = cityFinance(city, current)
    const deepensDeficit =
      financeAfter.netIncome < 0 && financeAfter.netIncome < financeBefore.netIncome
    if (deepensDeficit && p.key !== 'finance' && healthDelta <= 0) {
      tried.push(
        `${item.name.toLowerCase()} (would widen the deficit to $${(
          Math.abs(financeAfter.netIncome) / 1e6
        ).toFixed(1)}M/yr)`,
      )
      continue
    }

    return {
      kind: 'build',
      priority: p,
      reason: `${p.label} is the city's biggest constraint at ${p.urgency}/100 — ${p.reading}. ${
        item.name
      } is the highest-impact fix within the $${(spendable / 1e6).toFixed(1)}M available.`,
      plan,
      item,
      slot,
      siting: slot ? sitingReason(p.demand, slot.district) : 'along the busiest corridor',
      healthDelta,
      cinematic: p.level === 'CRITICAL' || item.capex >= 10_000_000,
    }
  }

  return none(
    health < (objective.healthFloor ?? 0)
      ? `City health is ${health} and every affordable option would make it worse — holding.`
      : `Considered ${tried.slice(0, 3).join(', ')} — none improves the city right now.`,
  )
}

/** One line for the AI control log. Short, and always with its cause. */
export function logLineFor(d: AgentDecision): string {
  if (d.kind === 'build' && d.item && d.priority) {
    return `${d.priority.label} at ${d.priority.urgency}/100 → building ${d.item.name.toLowerCase()}${
      d.slot ? '' : ' on the network'
    }`
  }
  return d.reason
}
