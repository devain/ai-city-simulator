/**
 * The AI CITY OPTIMIZER presentation — roughly 85 seconds.
 *
 * A leaf module so it can drive both stores without either importing the one.
 * It only calls public actions: the demo *watches* the real pipeline run, it
 * fakes nothing. Construction, camera and metrics are all the genuine article.
 *
 * The one thing the demo does itself is type — it enters a sentence into the
 * command bar the way an operator would, then hands it to `ask()`. Everything
 * after that (objective, budget, target, plans, construction) is derived by the
 * AI from that sentence. Nothing is pre-set for it.
 */
import { useCityStore } from './useCityStore'
import { useOptimizerStore } from './useOptimizerStore'
import { OBJECTIVES } from '../ai/ObjectiveParser'
import { cameraMoves } from '../components/scene/CameraDirector'
import { clock, setHour } from '../lib/clock'

let timers: number[] = []

const at = (ms: number, fn: () => void) => {
  timers.push(window.setTimeout(fn, ms))
}

export function stopDemo() {
  timers.forEach((t) => window.clearTimeout(t))
  timers = []
  useOptimizerStore.getState().setTypedText(null)
  useCityStore.setState({ demoActive: false, cinematic: false, demoCaption: null })
}

/** The whole brief, in one ordinary English sentence. */
const REQUEST = 'I have $50M. Prepare the city for 5,000 new residents.'

/** Types the request into the command bar over `ms`, like a person would. */
function typeRequest(startMs: number, ms: number) {
  const opt = useOptimizerStore.getState()
  const perChar = ms / REQUEST.length
  for (let i = 1; i <= REQUEST.length; i++) {
    // a small stumble after the full stop reads as human rather than scripted
    const pause = REQUEST[i - 1] === '.' ? 260 : 0
    at(startMs + i * perChar + pause, () => opt.setTypedText(REQUEST.slice(0, i)))
  }
}

export function startDemo() {
  stopDemo()

  const city = useCityStore.getState()
  const opt = useOptimizerStore.getState()

  city.resetCity()
  opt.resetOptimizer()
  opt.clearChallenge()
  setHour(10.2)
  clock.speed = 0.3

  useCityStore.setState({ demoActive: true, cinematic: true, demoStep: 0 })
  // Deliberately *wrong* for the brief: a balanced objective and half the money.
  // The sentence is what moves them, and the audience gets to watch it happen.
  useOptimizerStore.setState({
    objective: { ...OBJECTIVES.balanced },
    budget: 25_000_000,
    spent: 0,
    request: '',
  })

  const caption = (ms: number, text: string | null, step: number) =>
    at(ms, () => useCityStore.setState({ demoCaption: text, demoStep: step }))

  /* 0–5s — the city as it stands */
  caption(0, 'AI CITY OPTIMIZER', 0)
  at(400, () => cameraMoves.returnToOverview(3200))

  /* 5–9s — the problem */
  caption(5000, 'POPULATION GROWTH DETECTED', 1)
  at(5200, () =>
    useOptimizerStore.getState().pushAi('Regional forecast: +5,000 residents requested', 'scan'),
  )

  /* 9–14s — move toward the pressure */
  at(9000, () => {
    useCityStore.setState({ demoCaption: 'SURVEYING THE EASTERN DISTRICTS', demoStep: 2 })
    cameraMoves.flyTo(52, 30, 128, 4200)
  })

  /* 14–19s — the operator simply says what they want, in plain English */
  caption(14000, 'JUST TELL THE CITY WHAT YOU WANT', 3)
  typeRequest(14600, 3400)
  caption(18600, null, 3)

  /* 19s — hand the sentence to the AI; it derives everything from here */
  at(19000, () => {
    useCityStore.setState({ demoCaption: 'UNDERSTANDING THE REQUEST', demoStep: 3 })
    void useOptimizerStore.getState().ask(REQUEST)
  })

  /* 20.5s — show what it actually read out of the sentence */
  at(20600, () => {
    const u = useOptimizerStore.getState().understanding
    const bits: string[] = []
    if (u) {
      bits.push(u.kind.replace(/_/g, ' ').toUpperCase())
      if (u.targetPopulationIncrease) bits.push(`+${u.targetPopulationIncrease.toLocaleString('en-US')}`)
      if (u.budget) bits.push(`$${Math.round(u.budget / 1e6)}M`)
    }
    useCityStore.setState({
      demoCaption: bits.length > 0 ? bits.join(' · ') : 'REQUEST UNDERSTOOD',
      demoStep: 3,
    })
  })
  caption(23600, null, 3)

  /* 24–30s — candidate plans appear */
  caption(25200, 'GENERATING CITY PLANS', 4)
  caption(28500, null, 4)

  /* 30–34s — the decision */
  at(31500, () => {
    const o = useOptimizerStore.getState()
    const rec = o.decision?.recommended
    useCityStore.setState({
      demoCaption: rec ? `PLAN ${rec.code} SELECTED` : 'PLAN SELECTED',
      demoStep: 5,
    })
  })
  caption(34500, null, 5)

  /* 35s — execution begins; the queue now owns the camera and the captions */
  at(35000, () => {
    const o = useOptimizerStore.getState()
    const rec = o.decision?.recommended
    if (rec && o.phase === 'review') o.executePlan(rec.id)
    useCityStore.setState({ demoStep: 6 })
  })

  /*
   * 35–62s — the construction queue runs itself: site survey, transit hub,
   * corridors, school, parking, bus routes, re-simulation, reveal. The camera
   * director follows each step, so the demo just gets out of the way.
   */
  at(48000, () => useCityStore.setState({ demoStep: 7 }))

  /* ~60s — construction lands and the hero result plays */
  at(60000, () => useCityStore.setState({ demoStep: 8 }))

  /* 64–71s — the heatmap proves the change on the city itself */
  at(64000, () => {
    const o = useOptimizerStore.getState()
    if (o.heroOpen) o.closeHero()
    useOptimizerStore.setState({ reportOpen: false })
    useCityStore.getState().setHeatLayer('traffic')
    useCityStore.setState({ demoCaption: 'HEATMAP · TRAFFIC PRESSURE', demoStep: 8 })
  })
  at(70500, () => {
    useCityStore.getState().setHeatLayer('none')
    useCityStore.setState({ demoCaption: null })
  })

  /* 72–84s — the full before/after */
  at(72500, () => {
    const o = useOptimizerStore.getState()
    if (o.report) useOptimizerStore.setState({ reportOpen: true, heroOpen: false })
  })

  at(84000, () => {
    useOptimizerStore.setState({ reportOpen: false })
    useCityStore.setState({ demoActive: false, cinematic: false, demoCaption: null, demoStep: 9 })
    useCityStore.getState().pushEvent('Demo sequence complete', 'ok')
  })
}
