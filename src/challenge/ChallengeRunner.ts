/**
 * THE MATCH.
 *
 * Two cities, one clock, one event timeline. The runner owns no React state
 * and no rendering — it is a pure step function over a match object, so the
 * whole ten years can be executed headlessly in a verification script and
 * produce exactly the result the player sees on screen.
 *
 * Fairness is structural rather than promised: both sides start from the *same*
 * `CitySnapshot` object, and every tick reads its events from `eventDueAt(seed,
 * tick)`. Neither side can receive a different roll.
 */
import { advance, build, createSnapshot, fingerprint, type CitySnapshot } from './CityRuntime'
import { scoreCity, type CityScore } from './ScoreEngine'
import { CHALLENGE_OBJECTIVES, type ChallengeSetup } from './ChallengeConfig'
import { AI_PERSONALITIES, reserveFor, type AIPersonality } from '../ai/AIPersonality'
import {
  decideChallenge,
  trendOf,
  type ChallengeDecision,
  type DecisionOption,
} from '../ai/ChallengeAgent'
import { emptyMemory, remember, review, type AIMemory } from '../ai/AIMemory'
import { generateCity } from '../city/generateCity'
import { type CityConfig } from '../simulation/config'
import { scaleConfigTo } from './scaleCity'
import type { ActiveEvent } from '../sandbox/events'
import type { DistrictId } from '../simulation/types'

export type Side = 'human' | 'ai'

export interface LogEntry {
  id: number
  side: Side | 'match'
  tick: number
  year: number
  month: number
  kind: 'build' | 'analyse' | 'event' | 'adapt' | 'milestone' | 'hold'
  text: string
  /** where it happened, so the timeline can fly the camera there */
  at: { x: number; z: number } | null
}

export interface PendingDecision {
  side: Side
  tick: number
  year: number
  title: string
  reading: string
  options: DecisionOption[]
  chosenReason: string
}

export interface ChallengeState {
  setup: ChallengeSetup
  /** the city both sides began from — the scoring baseline */
  baseline: CitySnapshot
  baselineFingerprint: string
  human: CitySnapshot
  ai: CitySnapshot
  aiMemory: AIMemory
  aiRecentDistricts: Record<string, DistrictId[]>
  /** how many of each catalogue item the AI has built this match */
  aiBuiltCounts: Record<string, number>
  /** the AI's last decision, for the control panel */
  lastAiDecision: ChallengeDecision | null
  log: LogEntry[]
  /** set when a major decision should briefly pause the match */
  pending: PendingDecision | null
  /** the last year a decision moment was surfaced, so they stay rare */
  lastDecisionYear: number
  scores: { human: CityScore; ai: CityScore }
  /** true once the final year has been simulated */
  finished: boolean
}

let logSeq = 0

const dateOf = (tick: number) => ({
  year: Math.floor(tick / 12) + 1,
  month: (tick % 12) + 1,
})

/* ------------------------------------------------------------------ */
/* setting up a fair match                                             */
/* ------------------------------------------------------------------ */

/**
 * Both sides get this exact object. Because snapshots are immutable and every
 * mutation returns a new one, there is no way for one city to alter the other.
 */
export function createMatch(setup: ChallengeSetup): ChallengeState {
  // the whole city scales together, so a 50k match is a well-formed 50k city
  // rather than a 10k city with five times the people crammed into it
  const baseConfig: CityConfig = scaleConfigTo(setup.population, setup.seed)

  const city = generateCity(baseConfig)
  const baseline = createSnapshot(city, baseConfig, setup.budget)
  const weights = CHALLENGE_OBJECTIVES[setup.objective].weights
  const score = (s: CitySnapshot) => scoreCity({ snapshot: s, baseline, weights })

  logSeq = 0
  return {
    setup,
    baseline,
    baselineFingerprint: fingerprint(baseline),
    human: baseline,
    ai: baseline,
    aiMemory: emptyMemory(),
    aiRecentDistricts: {},
    aiBuiltCounts: {},
    lastAiDecision: null,
    pending: null,
    lastDecisionYear: 0,
    scores: { human: score(baseline), ai: score(baseline) },
    finished: false,
    log: [
      {
        id: logSeq++,
        side: 'match',
        tick: 0,
        year: 1,
        month: 1,
        kind: 'milestone',
        text: `Challenge begins — ${Math.round(baseline.result.population).toLocaleString(
          'en-US',
        )} residents, $${(setup.budget / 1e6).toFixed(0)}M, ${setup.years} years · ${
          CHALLENGE_OBJECTIVES[setup.objective].label
        }`,
        at: null,
      },
    ],
  }
}

/** The scoring function for a match, bound to its baseline and objective. */
export function scorerFor(state: ChallengeState) {
  const weights = CHALLENGE_OBJECTIVES[state.setup.objective].weights
  const baseline = state.baseline
  return (s: CitySnapshot) => scoreCity({ snapshot: s, baseline, weights })
}

/* ------------------------------------------------------------------ */
/* one simulated month                                                 */
/* ------------------------------------------------------------------ */

export interface StepResult {
  state: ChallengeState
  /** true when this step completed the match */
  finished: boolean
}

/**
 * Advance the match by one month: weather, both cities, then the AI's turn.
 *
 * The human city is advanced but never decided for — whatever the player has
 * built by now is simply carried forward.
 */
export function step(state: ChallengeState): StepResult {
  if (state.finished) return { state, finished: true }

  const scoreFull = scorerFor(state)
  const scoreOf = (s: CitySnapshot) => scoreFull(s).total
  const seed = state.setup.seed
  const log: LogEntry[] = []

  /* ---- both cities feel the same month ---- */
  const humanTick = advance(state.human, seed, scoreOf)
  const aiTick = advance(state.ai, seed, scoreOf)

  const { year, month } = dateOf(humanTick.snapshot.tick)

  // events are identical by construction, so report them once, for the match
  for (const ev of humanTick.started) {
    log.push({
      id: logSeq++,
      side: 'match',
      tick: humanTick.snapshot.tick,
      year,
      month,
      kind: 'event',
      text: `${ev.spec.name} — ${ev.spec.blurb}`,
      at: null,
    })
  }
  for (const ev of humanTick.ended) {
    log.push({
      id: logSeq++,
      side: 'match',
      tick: humanTick.snapshot.tick,
      year,
      month,
      kind: 'event',
      text: `${ev.spec.name} has passed`,
      at: null,
    })
  }

  let human = humanTick.snapshot
  let ai = aiTick.snapshot

  /* ---- the AI judges its own past work ---- */
  let memory = review(state.aiMemory, ai, scoreOf(ai))
  if (memory.lessons.length > state.aiMemory.lessons.length) {
    log.push({
      id: logSeq++,
      side: 'ai',
      tick: ai.tick,
      year,
      month,
      kind: 'adapt',
      text: memory.lessons[0].text,
      at: null,
    })
  }

  /* ---- the AI's turn ---- */
  const personality = AI_PERSONALITIES[state.setup.personality]
  const decision = decideChallenge({
    snapshot: ai,
    personality,
    memory,
    scoreOf,
    recentDistricts: state.aiRecentDistricts,
    builtCounts: state.aiBuiltCounts,
    trend: trendOf(ai),
  })

  let pending: PendingDecision | null = null
  let recentDistricts = state.aiRecentDistricts
  let builtCounts = state.aiBuiltCounts

  if (decision.kind === 'build' && decision.plan && decision.item) {
    ai = build(ai, decision.plan.delta, decision.item.capex)
    memory = remember(
      memory,
      {
        itemId: decision.item.id,
        itemName: decision.item.name,
        priorityKey: decision.priority?.key ?? 'unknown',
        capex: decision.item.capex,
      },
      ai,
      scoreOf(ai),
    )

    builtCounts = {
      ...builtCounts,
      [decision.item.id]: (builtCounts[decision.item.id] ?? 0) + 1,
    }
    if (decision.slot) {
      const prev = recentDistricts[decision.item.id] ?? []
      recentDistricts = {
        ...recentDistricts,
        [decision.item.id]: [...prev, decision.slot.district].slice(-2),
      }
    }

    log.push({
      id: logSeq++,
      side: 'ai',
      tick: ai.tick,
      year,
      month,
      kind: 'build',
      text: `${decision.reason} → building ${decision.item.name.toLowerCase()}${
        decision.slot ? ` · ${decision.siting}` : ''
      }`,
      at: decision.slot ? { x: decision.slot.x, z: decision.slot.z } : null,
    })

    // At most one decision moment per simulated year. The AI makes major calls
    // far more often than that, and stopping for every one of them would turn
    // a ten-year match into a slideshow.
    if (decision.major && decision.options.length > 1 && year > state.lastDecisionYear) {
      pending = {
        side: 'ai',
        tick: ai.tick,
        year,
        title: `${decision.priority?.label ?? 'City'} — critical decision`,
        reading: decision.reason,
        options: decision.options,
        chosenReason: decision.preemptive
          ? 'Chosen because it addresses where the system is heading, not only where it is.'
          : 'Chosen because it produced the best simulated outcome for the money.',
      }
    }
  }

  /* ---- score both sides ---- */
  const scores = { human: scoreFull(human), ai: scoreFull(ai) }

  /* ---- year milestones ---- */
  if (month === 1 && year > 1) {
    log.push({
      id: logSeq++,
      side: 'match',
      tick: human.tick,
      year,
      month,
      kind: 'milestone',
      text: `Year ${year} — Human ${scores.human.total.toFixed(1)} · AI ${scores.ai.total.toFixed(1)}`,
      at: null,
    })
  }

  const finished = human.tick >= state.setup.years * 12

  return {
    state: {
      ...state,
      human,
      ai,
      aiMemory: memory,
      aiRecentDistricts: recentDistricts,
      aiBuiltCounts: builtCounts,
      lastAiDecision: decision,
      pending: pending ?? state.pending,
      lastDecisionYear: pending ? year : state.lastDecisionYear,
      scores,
      finished,
      log: [...state.log, ...log].slice(-400),
    },
    finished,
  }
}

/** Run a match to completion without rendering. Used by tournaments and tests. */
export function runToEnd(setup: ChallengeSetup, maxSteps = 400): ChallengeState {
  let state = createMatch(setup)
  let guard = 0
  while (!state.finished && guard++ < maxSteps) {
    state = step(state).state
    state = { ...state, pending: null }
  }
  return state
}

/** Who won, and by how much. */
export function verdictOf(state: ChallengeState): {
  winner: Side | 'draw'
  margin: number
  human: number
  ai: number
} {
  const h = state.scores.human.total
  const a = state.scores.ai.total
  const margin = Math.abs(h - a)
  return {
    winner: margin < 0.5 ? 'draw' : h > a ? 'human' : 'ai',
    margin: Math.round(margin * 10) / 10,
    human: h,
    ai: a,
  }
}

export { reserveFor }
export type { AIPersonality, ActiveEvent }
