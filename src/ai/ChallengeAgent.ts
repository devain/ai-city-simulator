/**
 * THE OPPONENT.
 *
 * A personality-driven agent that runs a whole city for ten years without a
 * human. It extends the Phase 5 loop with the three things a *competitor*
 * needs that an assistant did not:
 *
 *   FORESIGHT   — it projects each system forward and acts on where the city
 *                 is heading, not only where it is. This is what lets it build
 *                 transit before congestion rather than after.
 *   MEMORY      — it judges its own past builds by what happened next, and
 *                 shifts its preferences accordingly.
 *   FALLIBILITY — it is not given an oracle. It projects from the current
 *                 trend, which is often wrong, and a Growth personality will
 *                 happily build itself into a traffic crisis before noticing.
 *
 * Every decision names the measured reading that caused it. Nothing here is
 * scripted, and nothing is tuned to make the AI win.
 */
import { runSimulation } from '../simulation/citySimulation'
import { applyDelta } from '../city/infrastructure'
import { cityFinance } from '../sandbox/finance'
import { cityHealth } from '../sandbox/health'
import { sandboxPlan } from '../sandbox/sandboxPlan'
import { bestFreeSlot, sitingReason, type Slot } from '../sandbox/siting'
import {
  CATALOGUE,
  LINEAR,
  isLinear,
  type CatalogueItem,
  type LinearItem,
} from '../sandbox/catalogue'
import type { CityPriority } from './CityPriorities'
import { biasFor, type AIMemory } from './AIMemory'
import { spendableFor, type AIPersonality } from './AIPersonality'
import type { CitySnapshot } from '../challenge/CityRuntime'
import type { CityPlan } from './types'

export interface ChallengeDecision {
  kind: 'build' | 'hold'
  /** the ranked problem that caused this */
  priority: CityPriority | null
  /** what it is building */
  item: CatalogueItem | LinearItem | null
  slot: Slot | null
  plan: CityPlan | null
  /** the measured reading, in one clause — never chain-of-thought */
  reason: string
  /** where, and why there */
  siting: string | null
  /** simulated health change */
  healthDelta: number
  /** true when this was driven by a projection rather than a present reading */
  preemptive: boolean
  /** major decisions get a camera move and a pause */
  major: boolean
  /** the options it weighed, for the decision-moment panel */
  options: DecisionOption[]
}

export interface DecisionOption {
  itemId: string
  label: string
  capex: number
  /** projected city-score change, from a real simulation */
  scoreDelta: number
  healthDelta: number
  chosen: boolean
  why: string
}

export interface ChallengeAgentInput {
  snapshot: CitySnapshot
  personality: AIPersonality
  memory: AIMemory
  /** score the city under the match objective */
  scoreOf: (s: CitySnapshot) => number
  /** districts each item was recently built in, so it spreads work out */
  recentDistricts: Record<string, string[]>
  /** how many of each item this city already has, so demand can saturate */
  builtCounts: Record<string, number>
  /** trend over the last year, for foresight */
  trend: Trend | null
}

/** Rate of change per month, per system, over a recent window. */
export interface Trend {
  /** utilisation points per month, keyed by priority */
  perMonth: Record<string, number>
  /** months of history this was measured over */
  window: number
}

/**
 * How fast each system is loading up.
 *
 * Measured from the city's own recent history, so it is an *estimate* and
 * frequently wrong — a trend that has just turned over will be extrapolated
 * straight on. That is deliberate: the agent has no oracle, and acting on a
 * bad projection is one of the ways it is allowed to lose.
 */
export function trendOf(snap: CitySnapshot, window = 10): Trend | null {
  const s = snap.series
  if (s.length < 4) return null
  const recent = s.slice(-window)
  const first = recent[0]
  const last = recent[recent.length - 1]
  const months = Math.max(1, last.tick - first.tick)

  return {
    window: months,
    perMonth: {
      traffic: (last.traffic - first.traffic) / months,
      // the series carries the headline metrics; the rest are inferred from
      // population pressure, which is what actually drives them
      housing: (last.population - first.population) / Math.max(1, first.population) / months,
      education: (last.population - first.population) / Math.max(1, first.population) / months,
      energy: (last.population - first.population) / Math.max(1, first.population) / months,
      water: (last.population - first.population) / Math.max(1, first.population) / months,
      parking: (last.traffic - first.traffic) / months,
      // finance is deliberately absent: it is a flow, not a capacity, so
      // "78% and rising" has no meaning for it and extrapolating a net-income
      // ratio through zero produces nonsense
    },
  }
}

/**
 * Urgency, adjusted for where the system is *heading*.
 *
 * A personality with foresight treats "78% and climbing two points a month"
 * as more urgent than "78% and flat" — which is the entire difference between
 * building transit before a crisis and building it after one.
 */
function projectedUrgency(p: CityPriority, personality: AIPersonality, trend: Trend | null): number {
  const rate = trend?.perMonth[p.key]
  if (!rate || rate <= 0) return p.urgency
  // where the system will be by the time a building could be finished.
  // Capped: a projection is an estimate, and one bad month should not let it
  // dominate a reading the city can actually measure.
  const drift = Math.min(30, rate * personality.foresightMonths * 100 * 2.6)
  return p.urgency + drift
}

export function decideChallenge(input: ChallengeAgentInput): ChallengeDecision {
  const { snapshot: snap, personality, memory, scoreOf, recentDistricts, builtCounts, trend } = input
  const spendable = spendableFor(personality, snap.treasury)

  const hold = (reason: string): ChallengeDecision => ({
    kind: 'hold',
    priority: null,
    item: null,
    slot: null,
    plan: null,
    reason,
    siting: null,
    healthDelta: 0,
    preemptive: false,
    major: false,
    options: [],
  })

  if (spendable < 700_000) {
    return hold(
      `Holding — $${(snap.treasury / 1e6).toFixed(1)}M in the treasury leaves nothing safe to commit above the reserve.`,
    )
  }

  /* ---- PRIORITIZE: rank through the personality, and through foresight ---- */
  const ranked = snap.priorities
    .map((p) => {
      const projected = projectedUrgency(p, personality, trend)
      return {
        p,
        projected,
        weighted: projected * (personality.weights[p.key] ?? 1),
        // "and rising": the projection is materially worse than the reading,
        // and the system is not already in crisis (then it is just a fire)
        preemptive: projected > p.urgency + 8 && p.level !== 'CRITICAL',
      }
    })
    .sort((a, b) => b.weighted - a.weighted)

  // the threshold is the personality's own: a cautious agent acts earlier
  const gate = (personality.actionThreshold - 0.62) * 235
  const candidates = ranked.filter((r) => r.projected >= gate && r.projected >= 22)
  if (candidates.length === 0) {
    return hold('No system is near its limit — holding capital rather than building for its own sake.')
  }

  /* ---- PLAN + SIMULATE: weigh real options for the top problem ---- */
  const baseScore = scoreOf(snap)
  const baseHealth = snap.health.score

  for (const cand of candidates.slice(0, 3)) {
    const p = cand.p
    const options = optionsFor(p, personality, memory, spendable)
    if (options.length === 0) continue

    const evaluated: {
      item: CatalogueItem | LinearItem
      slot: Slot | null
      plan: CityPlan
      scoreDelta: number
      healthDelta: number
      adjusted: number
    }[] = []

    for (const item of options) {
      const slot = isLinear(item)
        ? null
        : bestFreeSlot(snap.city, snap.result, p.demand, (recentDistricts[item.id] ?? []) as never)
      if (!isLinear(item) && !slot) continue

      const plan = sandboxPlan(snap.city, snap.config, snap.result, item, slot, 'ai')
      if (!plan) continue

      const nextCity = applyDelta(snap.city, plan.delta)
      const after = runSimulation(nextCity, snap.config)
      const afterFinance = cityFinance(nextCity, after)
      const afterHealth = cityHealth(after, afterFinance)
      const afterSnap: CitySnapshot = {
        ...snap,
        city: nextCity,
        treasury: Math.max(0, snap.treasury - item.capex),
        result: after,
        finance: afterFinance,
        health: afterHealth,
        demand: snap.demand,
        priorities: snap.priorities,
      }

      const scoreDelta = scoreOf(afterSnap) - baseScore
      const healthDelta = afterHealth.score - baseHealth

      evaluated.push({
        item,
        slot,
        plan,
        scoreDelta,
        healthDelta,
        /*
         * Three adjustments to the raw simulated gain:
         *   bias       — what this agent learned about this option this match
         *   saturation — the thirtieth shop does not serve the city like the
         *                first did, so repeated picks lose value. Without this
         *                the agent finds one cheap high-yield item and builds
         *                nothing else for ten years.
         *   temperament — a small thumb on the scale, never a veto
         */
        adjusted:
          scoreDelta *
            biasFor(memory, item.id) *
            saturation(builtCounts[item.id] ?? 0) +
          favourBonus(personality, item),
      })
    }

    if (evaluated.length === 0) continue
    evaluated.sort((a, b) => b.adjusted - a.adjusted)
    const pick = evaluated[0]

    /* ---- the gates. A personality that tolerates pain will push through. ---- */
    if (pick.healthDelta < -personality.painTolerance) {
      continue
    }
    /*
     * Solvency. A structure is a permanent claim on the budget, so a city
     * already running a deficit may only take on more upkeep if the build
     * genuinely improves its position — or if repairing the finances is the
     * job in hand.
     */
    const alreadyInDeficit = snap.finance.netIncome < 0
    if (alreadyInDeficit && p.key !== 'finance' && pick.scoreDelta <= 0) continue

    const optionRows: DecisionOption[] = evaluated.slice(0, 3).map((e) => ({
      itemId: e.item.id,
      label: e.item.name,
      capex: e.item.capex,
      scoreDelta: Math.round(e.scoreDelta * 100) / 100,
      healthDelta: e.healthDelta,
      chosen: e === pick,
      why:
        e === pick
          ? cand.preemptive
            ? 'Chosen — addresses where the system is heading, not only where it is'
            : 'Chosen — best simulated outcome for the money'
          : e.scoreDelta < pick.scoreDelta
            ? 'Weaker simulated outcome'
            : 'Rejected on cost or side effects',
    }))

    const reading = cand.preemptive
      ? `${p.label} is at ${p.urgency}/100 and rising — projected ${Math.round(cand.projected)}/100 within ${personality.foresightMonths} months`
      : `${p.label} at ${p.urgency}/100 — ${p.reading}`

    return {
      kind: 'build',
      priority: p,
      item: pick.item,
      slot: pick.slot,
      plan: pick.plan,
      reason: reading,
      siting: pick.slot ? sitingReason(p.demand, pick.slot.district) : 'along the busiest corridor',
      healthDelta: pick.healthDelta,
      preemptive: cand.preemptive,
      major: p.level === 'CRITICAL' || pick.item.capex >= 12_000_000 || cand.preemptive,
      options: optionRows,
    }
  }

  return hold('Nothing affordable improves the city right now — holding.')
}

/** The options this personality will consider for a problem, best-first. */
function optionsFor(
  p: CityPriority,
  personality: AIPersonality,
  memory: AIMemory,
  spendable: number,
): (CatalogueItem | LinearItem)[] {
  const pool = p.remedies
    .map((id) => CATALOGUE.find((c) => c.id === id) ?? LINEAR.find((l) => l.id === id))
    .filter((i): i is CatalogueItem | LinearItem => !!i && i.capex <= spendable)

  // a personality's favourites for this demand get considered even when the
  // generic remedy list would not have reached them
  const extra = [...CATALOGUE, ...LINEAR].filter(
    (i) =>
      personality.favours.includes(i.id) &&
      i.relieves === p.demand &&
      i.capex <= spendable &&
      !pool.some((x) => x.id === i.id),
  )

  return [...pool, ...extra]
    .filter((i) => !(personality.avoids.includes(i.id) && pool.length > 1))
    .sort((a, b) => biasFor(memory, b.id) - biasFor(memory, a.id))
    .slice(0, 4)
}

/** Value retained by the nth copy of the same item. */
function saturation(alreadyBuilt: number): number {
  return 1 / (1 + alreadyBuilt * 0.42)
}

/** Temperament, expressed as a small thumb on the scale — never a veto. */
function favourBonus(p: AIPersonality, item: CatalogueItem | LinearItem): number {
  if (p.favours.includes(item.id)) return 0.45
  if (p.avoids.includes(item.id)) return -0.45
  return 0
}
