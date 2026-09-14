/**
 * THE 60-SECOND AI vs HUMAN DEMO.
 *
 * Sets up a match, plays the human side with a handful of plausible-but-late
 * decisions, and lets the AI do whatever it does. Nothing about the result is
 * fixed: the human moves are scripted, the AI's are not, and the winner is
 * whatever the simulation produces. Run it twice with different personalities
 * and it will not always end the same way.
 *
 * A leaf module, like the Phase 4 demo, so it can drive the stores without
 * either of them importing it.
 */
import { useChallengeStore } from '../store/useChallengeStore'
import { useCityStore } from '../store/useCityStore'
import { CATALOGUE_BY_ID } from '../sandbox/catalogue'
import { sandboxPlan } from '../sandbox/sandboxPlan'
import { bestFreeSlot } from '../sandbox/siting'
import { DEFAULT_SETUP } from './ChallengeConfig'

let timers: number[] = []
let captionSetter: ((c: DemoCaption | null) => void) | null = null

export interface DemoCaption {
  title: string
  detail: string
  /** 0..1 through the demo */
  progress: number
}

export function onDemoCaption(fn: ((c: DemoCaption | null) => void) | null) {
  captionSetter = fn
}

const at = (ms: number, fn: () => void) => {
  timers.push(window.setTimeout(fn, ms))
}

export function stopChallengeDemo() {
  timers.forEach((t) => window.clearTimeout(t))
  timers = []
  captionSetter?.(null)
}

/**
 * The human side's moves.
 *
 * Deliberately *reasonable but reactive* — housing first, services after the
 * problems appear. That is how most people play, and it is exactly the habit
 * the AI's foresight is meant to beat. It is not sabotage: every one of these
 * is a sensible building in a sensible place.
 */
const HUMAN_MOVES: { atMs: number; itemId: string; note: string }[] = [
  { atMs: 12_000, itemId: 'residential_tower', note: 'You add housing — demand is high' },
  { atMs: 20_000, itemId: 'residential_tower', note: 'More housing while the money lasts' },
  { atMs: 30_000, itemId: 'shopping_centre', note: 'Retail to serve the new residents' },
  { atMs: 42_000, itemId: 'school', note: 'Schools are filling up — you react' },
  { atMs: 54_000, itemId: 'transit_hub', note: 'Traffic is biting; transit goes in late' },
  { atMs: 64_000, itemId: 'solar_farm', note: 'The grid needs headroom' },
]

/** Place a building in the player's match city, the same way a click would. */
function humanBuild(itemId: string) {
  const store = useChallengeStore.getState()
  const match = store.match
  if (!match) return
  const item = CATALOGUE_BY_ID[itemId]
  if (!item || item.capex > match.human.treasury) return

  const snap = match.human
  const slot = bestFreeSlot(snap.city, snap.result, item.relieves)
  if (!slot) return
  const plan = sandboxPlan(snap.city, snap.config, snap.result, item, slot, 'you')
  if (!plan) return

  store.applyHumanBuild(plan.delta, item.capex)
  useCityStore.getState().pushEvent(`You built ${item.name.toLowerCase()}`, 'ok')
}

const TOTAL_MS = 86_000

export function startChallengeDemo() {
  stopChallengeDemo()

  const store = useChallengeStore.getState()
  store.updateSetup({
    ...DEFAULT_SETUP,
    seed: DEFAULT_SETUP.seed,
    seedLabel: 'Meridian',
    budget: 100_000_000,
    population: 20_000,
    years: 10,
    objective: 'balanced',
    personality: 'balanced',
  })

  const caption = (ms: number, title: string, detail: string) =>
    at(ms, () => captionSetter?.({ title, detail, progress: ms / TOTAL_MS }))

  /* ---- 0-4s: the terms ---- */
  caption(0, 'AI vs HUMAN', 'Same city. Same $100M. Ten years.')

  /* ---- 4s: both cities begin ---- */
  at(4_000, () => {
    useChallengeStore.getState().start(false)
    useChallengeStore.getState().setSpeed(260)
  })
  caption(4_200, 'YEAR 1', 'Two identical cities. One has an AI running it.')

  /* ---- the human plays reactively ---- */
  for (const move of HUMAN_MOVES) {
    at(move.atMs, () => humanBuild(move.itemId))
    caption(move.atMs, 'YOUR CITY', move.note)
    caption(move.atMs + 3_400, '', '')
  }

  /* ---- narration over the middle years ---- */
  caption(16_000, 'THE AI IS AHEAD OF THE PROBLEM', 'It builds against where systems are heading, not where they are.')
  caption(24_000, '', '')
  caption(36_000, 'CONSEQUENCES ARRIVE', 'Population growth loads the network, the schools and the grid.')
  caption(40_000, '', '')
  caption(48_000, 'THE AI ADAPTS', 'It judges its own builds by what happened next, and changes tack.')
  caption(52_000, '', '')

  /* ---- run the rest out quickly ---- */
  at(70_000, () => useChallengeStore.getState().setSpeed(70))
  caption(70_000, 'FINAL YEARS', 'Ten years of decisions, settling into two different cities.')
  caption(75_000, '', '')

  /* ---- the result is whatever the simulation produced ---- */
  at(TOTAL_MS, () => {
    captionSetter?.(null)
    const s = useChallengeStore.getState()
    // if the clock has not quite reached year 10, finish it off
    if (s.match && !s.match.finished) {
      s.pause()
      let guard = 0
      while (guard++ < 40 && !useChallengeStore.getState().match?.finished) {
        useChallengeStore.getState().skipYear()
      }
    }
  })
}

/** Jump straight to the end of whatever the demo was doing. */
export function skipChallengeDemo() {
  stopChallengeDemo()
  const s = useChallengeStore.getState()
  if (!s.match) return
  s.pause()
  let guard = 0
  while (guard++ < 40 && !useChallengeStore.getState().match?.finished) {
    useChallengeStore.getState().skipYear()
  }
}

export const demoLengthMs = TOTAL_MS
