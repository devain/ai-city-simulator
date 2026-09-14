/**
 * THE DEMO TIMELINE.
 *
 * A shot list expressed as data. Each stage declares how long it runs, what
 * the camera does, what chrome is visible, how fast the simulation runs and
 * what is narrated — and the driver in `useDemoStore` walks the list.
 *
 * No stage knows about any other stage, and nothing is a chained setTimeout,
 * so the whole sequence can be re-timed, reordered or scrubbed by editing this
 * file alone.
 *
 * The one rule everything here obeys: **narration reads the simulation, it
 * does not assert over it.** Lines that quote a number take it from live match
 * state, so a recording can never claim a crisis that did not happen or a
 * winner the simulation did not produce.
 */
import { shots } from './cameraBus'
import type { ChallengeState } from '../challenge/ChallengeRunner'

export type DemoStage =
  | 'INTRO'
  | 'SETUP'
  | 'CITY_OVERVIEW'
  | 'HUMAN_ACTION'
  | 'AI_ANALYSIS'
  | 'PLAN_GENERATION'
  | 'PLAN_SELECTION'
  | 'AI_CONSTRUCTION'
  | 'SIMULATION_FAST_FORWARD'
  | 'CRISIS'
  | 'FINAL_COMPARISON'
  | 'WINNER_REVEAL'
  | 'END'

/** What the interface shows during a stage. Everything defaults to hidden. */
export interface DemoUi {
  /** the split-screen cities */
  cities?: boolean
  /** the match HUD: year, score, transport controls */
  hud?: boolean
  /** left build toolbar and right dashboards */
  panels?: boolean
  /** the AI activity / decision panel, pulled forward */
  aiFocus?: boolean
  /** the three-plan decision card */
  plans?: boolean
  /** the end-of-match comparison table and charts */
  results?: boolean
  /** letterbox bars */
  letterbox?: boolean
  /** darken the scene slightly so overlay text reads */
  dim?: number
}

export interface StageContext {
  match: ChallengeState | null
  /** 0..1 through the current stage */
  progress: number
}

export interface StageSpec {
  id: DemoStage
  /** how long this stage runs, in seconds */
  seconds: number
  /** the act this belongs to, shown small in the corner */
  act: string
  /** big centred card; omit for no card */
  title?: string | ((c: StageContext) => string)
  /** supporting lines, revealed one at a time across the stage */
  lines?: (string | ((c: StageContext) => string))[]
  /** ms per simulated month; 0 pauses the match */
  speed: number
  ui: DemoUi
  /** fired once when the stage begins */
  enter?: (c: StageContext) => void
}

const money = (v: number) => `$${(v / 1e6).toFixed(1)}M`
const pct = (v: number) => `${Math.round(v * 100)}%`
const n = (v: number) => Math.round(v).toLocaleString('en-US')

/** The AI's most recent build site, so the camera has something real to fly to. */
function aiSite(match: ChallengeState | null): { x: number; z: number } | null {
  if (!match) return null
  const builds = match.log.filter((l) => l.side === 'ai' && l.kind === 'build' && l.at)
  return builds.length ? builds[builds.length - 1].at : null
}

export const DEMO_TIMELINE: StageSpec[] = [
  /* ---------------- ACT 1 — THE CHALLENGE ---------------- */
  {
    id: 'INTRO',
    seconds: 4,
    act: 'Act I — The challenge',
    title: 'AI CITY SIMULATOR',
    lines: ['Same city.', 'Same resources.', 'Ten years.'],
    speed: 0,
    ui: { cities: true, letterbox: true, dim: 0.34 },
    enter: () => {
      shots.establishing('human', 5400)
      shots.establishing('ai', 5400)
    },
  },
  {
    id: 'SETUP',
    seconds: 5,
    act: 'Act I — The challenge',
    title: 'HUMAN  vs  AI',
    lines: [
      ({ match }) => (match ? `${n(match.baseline.result.population)} residents each` : ''),
      ({ match }) => (match ? `${money(match.setup.budget)} each` : ''),
      'Ten simulated years. One score.',
    ],
    speed: 0,
    ui: { cities: true, hud: true, letterbox: true, dim: 0.22 },
    enter: () => {
      shots.splitComparison(3200)
    },
  },

  /* ---------------- ACT 2 — EARLY GROWTH ---------------- */
  {
    id: 'CITY_OVERVIEW',
    seconds: 5,
    act: 'Act II — Early growth',
    lines: ['One city. Two operators.', 'Only one of them is human.'],
    speed: 0,
    ui: { cities: true, hud: true, letterbox: true },
    enter: () => {
      shots.panAcrossCity('human', 7200)
      shots.panAcrossCity('ai', 7200)
    },
  },
  {
    id: 'HUMAN_ACTION',
    seconds: 9,
    act: 'Act II — Early growth',
    title: 'YEAR 1',
    lines: [
      'You build where demand is loudest — housing first.',
      'The AI is reading the same city, and building somewhere else.',
    ],
    speed: 300,
    ui: { cities: true, hud: true, panels: true },
    enter: () => {
      shots.flyTo('human', 0, 0, 150, 3000)
      shots.overview('ai', 3000)
    },
  },

  /* ---------------- ACT 3 — THE PROBLEM ---------------- */
  {
    id: 'AI_ANALYSIS',
    seconds: 7,
    act: 'Act III — The problem',
    title: 'ANALYSING CITY',
    lines: [
      ({ match }) =>
        match ? `Housing ${match.ai.priorities.find((p) => p.key === 'housing')?.urgency ?? 0}/100` : '',
      ({ match }) =>
        match
          ? `Traffic ${pct(match.ai.result.metrics.traffic.utilisation)} of network capacity`
          : '',
      ({ match }) => {
        const p = match?.ai.priorities[0]
        return p ? `Top constraint: ${p.label.toLowerCase()} — ${p.reading}` : ''
      },
    ],
    speed: 320,
    ui: { cities: true, hud: true, aiFocus: true, dim: 0.3, letterbox: true },
    enter: () => {
      shots.overview('ai', 3600)
      shots.overview('human', 3600)
    },
  },
  {
    id: 'PLAN_GENERATION',
    seconds: 5,
    act: 'Act III — The problem',
    title: 'GENERATING PLANS',
    lines: ['Each option is placed on a copy of the city and simulated in full.'],
    speed: 260,
    ui: { cities: true, hud: true, aiFocus: true, plans: true, dim: 0.34, letterbox: true },
    enter: ({ match }) => {
      const site = aiSite(match)
      if (site) shots.flyTo('ai', site.x, site.z, 130, 3000)
    },
  },

  /* ---------------- ACT 4 — AI DECISION ---------------- */
  {
    id: 'PLAN_SELECTION',
    seconds: 5,
    act: 'Act IV — The decision',
    // The AI does not always decide to build. Announcing "PLAN SELECTED" over
    // a decision to hold would be the demo lying about the simulation, so the
    // card reports whichever actually happened.
    title: ({ match }) =>
      match?.lastAiDecision?.kind === 'build' ? 'PLAN SELECTED' : 'HOLDING CAPITAL',
    lines: [
      ({ match }) => match?.lastAiDecision?.reason ?? '',
      ({ match }) =>
        match?.lastAiDecision?.item
          ? `→ ${match.lastAiDecision.item.name} · ${money(match.lastAiDecision.item.capex)}`
          : 'No option improves the city enough to be worth the money yet.',
    ],
    speed: 0,
    ui: { cities: true, hud: true, aiFocus: true, plans: true, dim: 0.34, letterbox: true },
    enter: ({ match }) => {
      const site = aiSite(match)
      if (site) shots.focusOnObject('ai', site.x, site.z, 88, 2400)
    },
  },

  /* ---------------- ACT 5 — CONSTRUCTION ---------------- */
  {
    id: 'AI_CONSTRUCTION',
    seconds: 9,
    act: 'Act V — Construction',
    lines: [
      ({ match }) =>
        match?.lastAiDecision?.kind === 'build'
          ? (match.lastAiDecision.siting ?? 'Work begins.')
          : 'The AI keeps working the ranked problem list.',
      'Roads connect. Traffic starts using it.',
    ],
    speed: 340,
    ui: { cities: true, hud: true, aiFocus: true, letterbox: true },
    enter: ({ match }) => {
      const site = aiSite(match)
      if (site) shots.followConstruction('ai', site.x, site.z, 2800)
      shots.flyTo('human', 0, 0, 165, 2800)
    },
  },

  /* ---------------- ACT 6 — YEARS PASS ---------------- */
  {
    id: 'SIMULATION_FAST_FORWARD',
    seconds: 12,
    act: 'Act VI — Years pass',
    title: ({ match }) => (match ? `YEAR ${Math.floor(match.human.tick / 12) + 1}` : 'YEARS PASS'),
    lines: [
      'Population, congestion, emissions and money, month by month.',
      'The AI keeps re-reading the city it just changed.',
    ],
    // ~80 months still to run across 12 seconds — fast enough to read as a
    // time-lapse, slow enough that the year counter is legible
    speed: 135,
    ui: { cities: true, hud: true, panels: true },
    enter: () => {
      shots.panAcrossCity('human', 13000)
      shots.panAcrossCity('ai', 13000)
    },
  },

  /* ---------------- ACT 6b — CRISIS ---------------- */
  {
    id: 'CRISIS',
    seconds: 7,
    act: 'Act VI — Consequences',
    // reads the simulation rather than asserting a crisis that may not exist
    title: ({ match }) => {
      if (!match) return ''
      const h = match.human.result.metrics.traffic.utilisation
      const a = match.ai.result.metrics.traffic.utilisation
      if (h > 0.85 && h > a + 0.06) return 'TRAFFIC CRISIS'
      if (a > 0.85 && a > h + 0.06) return 'THE AI OVERBUILT'
      return 'THE GAP OPENS'
    },
    lines: [
      ({ match }) =>
        match
          ? `Your traffic  ${pct(match.human.result.metrics.traffic.utilisation)}`
          : '',
      ({ match }) =>
        match ? `AI traffic  ${pct(match.ai.result.metrics.traffic.utilisation)}` : '',
      ({ match }) => {
        if (!match) return ''
        const lead = match.scores.ai.total - match.scores.human.total
        if (Math.abs(lead) < 0.5) return 'Level on score.'
        return lead > 0
          ? `AI leads by ${lead.toFixed(1)} points.`
          : `You lead by ${Math.abs(lead).toFixed(1)} points.`
      },
    ],
    speed: 150,
    ui: { cities: true, hud: true, dim: 0.26, letterbox: true },
    enter: ({ match }) => {
      const h = match?.human.result.metrics.traffic.utilisation ?? 0
      const a = match?.ai.result.metrics.traffic.utilisation ?? 0
      // emphasise whichever city is actually in trouble
      if (h >= a) shots.emphasise('human', 0, 0)
      else shots.emphasise('ai', 0, 0)
      shots.flyTo(h >= a ? 'ai' : 'human', 0, 0, 200, 2200)
    },
  },

  /* ---------------- ACT 7 — FINAL COMPARISON ---------------- */
  {
    id: 'FINAL_COMPARISON',
    seconds: 8,
    act: 'Act VII — Year ten',
    title: 'TEN YEARS LATER',
    lines: [
      ({ match }) =>
        match
          ? `Population  ${n(match.human.result.population)}  vs  ${n(match.ai.result.population)}`
          : '',
      ({ match }) =>
        match ? `Budget  ${money(match.human.treasury)}  vs  ${money(match.ai.treasury)}` : '',
      ({ match }) =>
        match
          ? `City health  ${match.human.health.score}  vs  ${match.ai.health.score}`
          : '',
    ],
    speed: 0,
    ui: { cities: true, hud: true, letterbox: true, dim: 0.2 },
    enter: () => {
      shots.splitComparison(3400)
    },
  },

  /* ---------------- ACT 8 — WINNER ---------------- */
  {
    id: 'WINNER_REVEAL',
    seconds: 8,
    act: 'Act VIII — The result',
    // whatever the simulation produced, and nothing else
    title: ({ match }) => {
      if (!match) return ''
      const d = match.scores.human.total - match.scores.ai.total
      if (Math.abs(d) < 0.5) return 'DEAD HEAT'
      return d > 0 ? 'HUMAN WINS' : 'AI WINS'
    },
    lines: [
      ({ match }) =>
        match
          ? `Human ${match.scores.human.total.toFixed(1)}   ·   AI ${match.scores.ai.total.toFixed(1)}`
          : '',
    ],
    speed: 0,
    ui: { cities: true, letterbox: true, dim: 0.52 },
    enter: () => {
      shots.pullBack('human', 4600)
      shots.pullBack('ai', 4600)
    },
  },
  {
    id: 'END',
    seconds: 4,
    act: '',
    title: 'CAN YOU DO BETTER?',
    lines: ['Same city. Same money. Ten years.'],
    speed: 0,
    ui: { cities: true, letterbox: true, dim: 0.66 },
    enter: () => {
      shots.pullBack('human', 5000)
      shots.pullBack('ai', 5000)
    },
  },
]

export const DEMO_TOTAL_SECONDS = DEMO_TIMELINE.reduce((s, x) => s + x.seconds, 0)

/** Cumulative start time of each stage, in ms. */
export const STAGE_STARTS: number[] = (() => {
  const out: number[] = []
  let acc = 0
  for (const s of DEMO_TIMELINE) {
    out.push(acc)
    acc += s.seconds * 1000
  }
  return out
})()

/** Which stage is running at `elapsed` ms, and how far through it. */
export function stageAt(elapsedMs: number): { index: number; spec: StageSpec; progress: number } {
  let i = 0
  while (i < DEMO_TIMELINE.length - 1 && elapsedMs >= STAGE_STARTS[i + 1]) i++
  const spec = DEMO_TIMELINE[i]
  const within = elapsedMs - STAGE_STARTS[i]
  return { index: i, spec, progress: Math.max(0, Math.min(1, within / (spec.seconds * 1000))) }
}

/** Resolve a value that may depend on live match state. */
export const resolve = <T,>(v: T | ((c: StageContext) => T), c: StageContext): T =>
  typeof v === 'function' ? (v as (c: StageContext) => T)(c) : v
