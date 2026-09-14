import { create } from 'zustand'
import { DEFAULT_CONFIG, type CityConfig } from '../simulation/config'
import { generateCity } from '../city/generateCity'
import { runSimulation } from '../simulation/citySimulation'
import { SCENARIO_BY_ID, type ScenarioId } from '../simulation/scenarios'
import { TEMPLATES, makeBuilding, nearestSlot, withBuildings } from '../city/placement'
import type { Building, City, SimulationResult } from '../simulation/types'
import { analyseCity, answerQuestion, type AnalystAnswer, type CityAnalysis } from '../ai/cityAnalyst'
import { clock, setHour } from '../lib/clock'

export type HeatLayer =
  | 'none'
  | 'traffic'
  | 'electricity'
  | 'water'
  | 'retail'
  | 'education'
  | 'parking'
  | 'emissions'

export interface EventEntry {
  id: number
  time: string
  text: string
  kind: 'info' | 'warn' | 'alert' | 'ai' | 'ok'
}

export interface HistoryPoint {
  t: number
  label: string
  traffic: number
  electricity: number
  water: number
  emissions: number
}

export interface ChatMessage {
  id: number
  role: 'user' | 'analyst'
  text: string
  bullets?: string[]
  confidence?: number
  followUps?: string[]
}

interface CityState {
  config: CityConfig
  /** the un-stressed config, restored when a scenario challenge is cleared */
  baseConfig: CityConfig
  baseCity: City
  city: City
  baseline: SimulationResult
  current: SimulationResult
  /** result before the last run, used to animate the metric transition */
  previous: SimulationResult
  analysis: CityAnalysis

  scenario: ScenarioId
  scenarioBuildings: Building[]
  userBuildings: Building[]

  isRunning: boolean
  runProgress: number
  hasRun: boolean

  heatLayer: HeatLayer
  compareMode: boolean
  compareSplit: number
  cinematic: boolean
  demoActive: boolean
  demoCaption: string | null
  demoStep: number

  placementTool: keyof typeof TEMPLATES | null
  hoveredBuilding: string | null
  selectedBuilding: string | null

  events: EventEntry[]
  history: HistoryPoint[]
  chat: ChatMessage[]
  analystThinking: boolean

  /* actions */
  selectScenario: (id: ScenarioId) => void
  runScenario: () => void
  resetCity: () => void
  setHeatLayer: (l: HeatLayer) => void
  toggleCompare: (v?: boolean) => void
  setCompareSplit: (v: number) => void
  setPlacementTool: (t: keyof typeof TEMPLATES | null) => void
  placeAt: (x: number, z: number) => void
  applyRecommendation: (id: string) => void
  setHovered: (id: string | null) => void
  setSelected: (id: string | null) => void
  pushEvent: (text: string, kind?: EventEntry['kind']) => void
  pushHistory: (p: Omit<HistoryPoint, 'label'>) => void
  askAnalyst: (q: string) => void
  setConfigValue: (key: keyof CityConfig, value: number) => void
  startDemo: () => void
  stopDemo: () => void
  setCinematic: (v: boolean) => void
}

const config = { ...DEFAULT_CONFIG }
const baseCity = generateCity(config)
const baseResult = runSimulation(baseCity, config)
const baseAnalysis = analyseCity({
  city: baseCity,
  config,
  current: baseResult,
  baseline: baseResult,
})

let eventId = 0
let chatId = 0
let demoTimers: number[] = []

const stamp = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(
    d.getSeconds(),
  ).padStart(2, '0')}`
}

export const useCityStore = create<CityState>((set, get) => ({
  config,
  baseConfig: config,
  baseCity,
  city: baseCity,
  baseline: baseResult,
  current: baseResult,
  previous: baseResult,
  analysis: baseAnalysis,

  scenario: 'current',
  scenarioBuildings: [],
  userBuildings: [],

  isRunning: false,
  runProgress: 1,
  hasRun: false,

  heatLayer: 'none',
  compareMode: false,
  compareSplit: 0.5,
  cinematic: false,
  demoActive: false,
  demoCaption: null,
  demoStep: 0,

  placementTool: null,
  hoveredBuilding: null,
  selectedBuilding: null,

  events: [
    { id: eventId++, time: stamp(), text: 'City model loaded · 10,000 residents', kind: 'ok' },
    { id: eventId++, time: stamp(), text: 'Baseline simulation complete', kind: 'info' },
  ],
  history: [],
  chat: [
    {
      id: chatId++,
      role: 'analyst',
      text: 'AI City Analyst online. Ask me what happens if the city grows, where to build, or which corridor fails first.',
      bullets: [
        'Baseline: 10,000 residents · 4,000 vehicles · 6,000 jobs',
        'All figures are prototype estimates, not predictions.',
      ],
      confidence: baseAnalysis.confidence,
      followUps: [
        'What happens if I add 3,000 residents?',
        'Where should I build a new school?',
        'Which road is likely to become congested?',
      ],
    },
  ],
  analystThinking: false,

  /* ---------------------------------------------------------------- */

  pushEvent: (text, kind = 'info') =>
    set((s) => ({
      events: [{ id: eventId++, time: stamp(), text, kind }, ...s.events].slice(0, 80),
    })),

  pushHistory: (p) =>
    set((s) => ({
      history: [...s.history, { ...p, label: '' }].slice(-48),
    })),

  setHeatLayer: (l) => {
    set({ heatLayer: l })
    if (l !== 'none') get().pushEvent(`Heatmap layer: ${l.toUpperCase()}`, 'info')
  },

  toggleCompare: (v) =>
    set((s) => {
      const next = v ?? !s.compareMode
      return { compareMode: next, compareSplit: next ? 0.5 : s.compareSplit }
    }),

  setCompareSplit: (v) => set({ compareSplit: Math.max(0, Math.min(1, v)) }),

  setCinematic: (v) => set({ cinematic: v }),

  setPlacementTool: (t) => set({ placementTool: t, selectedBuilding: null }),

  setHovered: (id) => set({ hoveredBuilding: id }),
  setSelected: (id) => set({ selectedBuilding: id }),

  setConfigValue: (key, value) => {
    const cfg = { ...get().config, [key]: value } as CityConfig
    const fresh = generateCity(cfg)
    const baseline = runSimulation(fresh, cfg)
    const s = get()
    const city = withBuildings(fresh, [])
    set({
      config: cfg,
      baseConfig: cfg,
      baseCity: fresh,
      city,
      baseline,
      current: baseline,
      previous: baseline,
      scenarioBuildings: [],
      userBuildings: [],
      scenario: 'current',
      hasRun: false,
      runProgress: 1,
      analysis: analyseCity({ city, config: cfg, current: baseline, baseline }),
    })
    s.pushEvent(`Parameter updated: ${String(key)} = ${value.toLocaleString()}`, 'info')
  },

  selectScenario: (id) => {
    const s = get()
    const cityWithUser = withBuildings(s.baseCity, s.userBuildings)
    const scenarioBuildings = SCENARIO_BY_ID[id].build(cityWithUser)
    set({ scenario: id, scenarioBuildings })
    s.pushEvent(`Scenario armed: ${SCENARIO_BY_ID[id].name}`, 'info')
  },

  runScenario: () => {
    const s = get()
    if (s.isRunning) return

    const cityWithUser = withBuildings(s.baseCity, s.userBuildings)
    const scenarioBuildings = SCENARIO_BY_ID[s.scenario].build(cityWithUser)
    const city = withBuildings(cityWithUser, scenarioBuildings)
    const result = runSimulation(city, s.config)
    const analysis = analyseCity({
      city,
      config: s.config,
      current: result,
      baseline: s.baseline,
    })

    set({
      isRunning: true,
      runProgress: 0,
      previous: s.current,
      city,
      scenarioBuildings,
    })

    s.pushEvent('Simulation started', 'ok')

    const start = performance.now()
    const DURATION = 2100
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / DURATION)
      // ease-out so the numbers settle rather than snap
      set({ runProgress: 1 - Math.pow(1 - p, 3) })
      if (p < 1) requestAnimationFrame(step)
      else {
        set({ isRunning: false, runProgress: 1, hasRun: true })
        get().pushEvent('AI recommendation generated', 'ai')
      }
    }
    requestAnimationFrame(step)

    // narrated event feed, timed to land while the numbers are still moving
    const schedule: [number, string, EventEntry['kind']][] = [
      [220, 'Population model updated', 'info'],
      [460, `Traffic assignment converged · V/C ${result.raw.congestionIndex.toFixed(2)}`, 'info'],
      [
        700,
        `${analysis.affectedAreas[0].name} congestion detected`,
        result.metrics.traffic.pressure === 'CRITICAL' ? 'alert' : 'warn',
      ],
      [
        980,
        `Grid peak ${result.raw.peakDemandMw.toFixed(1)} MW · water ${Math.round(
          result.raw.waterM3Day,
        ).toLocaleString()} m³/day`,
        'info',
      ],
      [
        1260,
        result.metrics.education.utilisation > 0.85
          ? `School capacity exceeded · ${Math.round(result.students).toLocaleString()} students`
          : `School utilisation ${(result.metrics.education.utilisation * 100).toFixed(0)}%`,
        result.metrics.education.utilisation > 0.85 ? 'alert' : 'info',
      ],
      [
        1540,
        result.metrics.parking.pressure === 'CRITICAL'
          ? `Parking pressure CRITICAL · deficit ${Math.round(
              result.raw.parkingDemand - result.raw.parkingSupply,
            ).toLocaleString()} spaces`
          : `Parking utilisation ${(result.metrics.parking.utilisation * 100).toFixed(0)}%`,
        result.metrics.parking.pressure === 'CRITICAL' ? 'alert' : 'warn',
      ],
      [1820, 'Emissions and cost models updated', 'info'],
    ]
    for (const [delay, text, kind] of schedule) {
      const id = window.setTimeout(() => get().pushEvent(text, kind), delay)
      demoTimers.push(id)
    }

    window.setTimeout(() => {
      set({ current: result, analysis })
    }, 30)
  },

  resetCity: () => {
    const s = get()
    set({
      city: s.baseCity,
      current: s.baseline,
      previous: s.baseline,
      scenario: 'current',
      scenarioBuildings: [],
      userBuildings: [],
      hasRun: false,
      runProgress: 1,
      compareMode: false,
      heatLayer: 'none',
      selectedBuilding: null,
      analysis: analyseCity({
        city: s.baseCity,
        config: s.config,
        current: s.baseline,
        baseline: s.baseline,
      }),
    })
    s.pushEvent('City reset to baseline', 'ok')
  },

  placeAt: (x, z) => {
    const s = get()
    const tool = s.placementTool
    if (!tool) return
    const tpl = TEMPLATES[tool]
    const slot = nearestSlot(s.city, x, z)
    if (!slot) {
      s.pushEvent('No buildable land remaining', 'warn')
      return
    }
    const b = makeBuilding(tpl, slot.x, slot.z, slot.district)
    const userBuildings = [...s.userBuildings, b]
    const cityWithUser = withBuildings(s.baseCity, userBuildings)
    const city = withBuildings(cityWithUser, s.scenarioBuildings)
    const result = runSimulation(city, s.config)
    set({
      userBuildings,
      city,
      previous: s.current,
      current: result,
      runProgress: 1,
      analysis: analyseCity({ city, config: s.config, current: result, baseline: s.baseline }),
      selectedBuilding: b.id,
    })
    s.pushEvent(`${tpl.name} placed in ${slot.district} · simulation recalculated`, 'ok')
  },

  applyRecommendation: (id) => {
    const s = get()
    const rec = s.analysis.recommendations.find((r) => r.id === id)
    if (!rec?.action) {
      s.pushEvent('That recommendation has no automated build action', 'warn')
      return
    }
    const tpl = TEMPLATES[rec.action.template]
    let city = s.city
    const added: Building[] = []
    for (let i = 0; i < rec.action.count; i++) {
      const slot = city.freeSlots.find((f) => f.district === rec.action!.district) ?? city.freeSlots[0]
      if (!slot) break
      const b = makeBuilding(tpl, slot.x, slot.z, slot.district)
      added.push(b)
      city = withBuildings(city, [b])
    }
    if (added.length === 0) {
      s.pushEvent('No buildable land remaining', 'warn')
      return
    }
    const userBuildings = [...s.userBuildings, ...added]
    const result = runSimulation(city, s.config)
    set({
      userBuildings,
      city,
      previous: s.current,
      current: result,
      runProgress: 1,
      analysis: analyseCity({ city, config: s.config, current: result, baseline: s.baseline }),
    })
    s.pushEvent(`Applied: ${rec.title}`, 'ok')
  },

  askAnalyst: (q) => {
    const s = get()
    const question = q.trim()
    if (!question) return
    set((st) => ({
      chat: [...st.chat, { id: chatId++, role: 'user', text: question }],
      analystThinking: true,
    }))
    s.pushEvent(`Analyst query: "${question}"`, 'ai')

    window.setTimeout(() => {
      const st = get()
      const ans: AnalystAnswer = answerQuestion(question, {
        city: st.city,
        config: st.config,
        current: st.current,
        baseline: st.baseline,
      })
      set((prev) => ({
        analystThinking: false,
        chat: [
          ...prev.chat,
          {
            id: chatId++,
            role: 'analyst',
            text: ans.answer,
            bullets: ans.bullets,
            confidence: ans.confidence,
            followUps: ans.followUps,
          },
        ],
      }))
    }, 620)
  },

  /* ---------------------------------------------------------------- */
  /* 30-second scripted demo                                           */
  /* ---------------------------------------------------------------- */

  startDemo: () => {
    const s = get()
    s.stopDemo()
    s.resetCity()
    setHour(10.2)
    clock.speed = 0.3
    set({ demoActive: true, cinematic: true, demoStep: 0, demoCaption: 'SMART CITY COMMAND CENTER' })

    const at = (ms: number, fn: () => void) => {
      demoTimers.push(window.setTimeout(fn, ms))
    }
    const caption = (ms: number, text: string, step: number) =>
      at(ms, () => set({ demoCaption: text, demoStep: step }))

    caption(0, 'SMART CITY COMMAND CENTER · LIVE', 0)
    caption(2600, 'BASELINE · 10,000 RESIDENTS · 4,000 VEHICLES', 1)
    at(5200, () => {
      get().selectScenario('add_5000')
      set({ demoCaption: 'SCENARIO LOADED · +5,000 RESIDENTS', demoStep: 2 })
    })
    at(7200, () => {
      get().runScenario()
      set({ demoCaption: 'RUNNING SIMULATION…', demoStep: 3 })
    })
    caption(10200, 'IMPACT DETECTED ACROSS 7 SYSTEMS', 4)
    at(12000, () => {
      get().setHeatLayer('traffic')
      set({ demoCaption: 'HEATMAP · TRAFFIC PRESSURE', demoStep: 5 })
    })
    at(15000, () => {
      get().setHeatLayer('parking')
      set({ demoCaption: 'HEATMAP · PARKING — CRITICAL', demoStep: 6 })
    })
    at(17800, () => {
      get().setHeatLayer('education')
      set({ demoCaption: 'HEATMAP · SCHOOL CATCHMENT', demoStep: 7 })
    })
    at(20400, () => {
      get().setHeatLayer('none')
      setHour(20.4)
      set({ demoCaption: 'NIGHT CYCLE · GRID LOAD', demoStep: 8 })
    })
    at(22600, () => {
      get().toggleCompare(true)
      set({ demoCaption: 'BEFORE / AFTER COMPARISON', demoStep: 9 })
    })
    at(27000, () => {
      get().toggleCompare(false)
      set({ demoCaption: 'AI RECOMMENDATIONS READY', demoStep: 10 })
    })
    at(30000, () => {
      set({ demoActive: false, cinematic: false, demoCaption: null, demoStep: 11 })
      get().pushEvent('Demo sequence complete', 'ok')
    })
  },

  stopDemo: () => {
    demoTimers.forEach((t) => window.clearTimeout(t))
    demoTimers = []
    set({ demoActive: false, cinematic: false, demoCaption: null })
  },
}))

/** Linear blend between the previous and current result while a run animates. */
export function lerpMetric(key: keyof SimulationResult['metrics']) {
  const { previous, current, runProgress } = useCityStore.getState()
  const a = previous.metrics[key].value
  const b = current.metrics[key].value
  return a + (b - a) * runProgress
}
