/**
 * The seam a real language model plugs into.
 *
 * `understandRequest` is the *only* thing a hosted model would need to
 * implement — everything downstream (planning, scoring, construction,
 * simulation) already works off the structured `CityIntent`. That is why
 * this file has no prompt text, no keys and no network code: swapping
 * `LocalCityAIProvider` for `ClaudeCityAIProvider` changes nothing else.
 */
import type { CityConfig } from '../simulation/config'
import type { City, SimulationResult } from '../simulation/types'
import type { CityDiagnosis } from './types'
import type { AIConversationState, CityIntent } from './nlu/types'

/**
 * Phase 5 state the AI can talk about. Optional so Phase 2-4 callers — and
 * the headless verification scripts — keep working untouched.
 */
export interface SandboxView {
  mode: 'human' | 'assist' | 'autonomous'
  treasury: number
  health: { score: number; status: string; weakest: { label: string; score: number } }
  netIncome: number
  /** ranked problems, worst first */
  priorities: { key: string; label: string; urgency: number; level: string; reading: string; why: string }[]
  /** what the advisor would recommend right now */
  recommendation: { itemName: string; capex: number; where: string | null; outcome: string | null } | null
  year: number
}

/**
 * The sandbox registers its view here at start-up. A one-way seam: the
 * understanding layer can read Phase 5 state without importing the store, so
 * there is no cycle between the two control planes.
 */
let sandboxViewGetter: (() => SandboxView | undefined) | null = null

export function registerSandboxView(fn: () => SandboxView | undefined) {
  sandboxViewGetter = fn
}

export function currentSandboxView(): SandboxView | undefined {
  return sandboxViewGetter?.()
}

export interface CityAIContext {
  /** present from Phase 5 on */
  sandbox?: SandboxView
  city: City
  config: CityConfig
  current: SimulationResult
  baseline: SimulationResult
  diagnosis: CityDiagnosis | null
  /** capital available right now */
  budget: number
  spent: number
  conversation: AIConversationState
}

export interface CityAIProvider {
  readonly id: string
  readonly label: string
  understandRequest(input: string, context: CityAIContext): Promise<CityIntent>
}

/**
 * The structured payload a hosted model would be prompted with. Kept here so
 * the local provider and a future remote one agree on what "context" means.
 */
export function describeContextForModel(ctx: CityAIContext) {
  return {
    disclaimer: 'Prototype simulation — illustrative estimates.',
    budget: ctx.budget,
    spent: ctx.spent,
    population: ctx.current.population,
    headroom: ctx.diagnosis?.headroom ?? null,
    bindingConstraint: ctx.diagnosis?.bindingConstraint ?? null,
    metrics: Object.values(ctx.current.metrics).map((m) => ({
      key: m.key,
      value: m.value,
      unit: m.unit,
      utilisation: Number(m.utilisation.toFixed(3)),
      pressure: m.pressure,
    })),
    districts: ctx.current.districts.map((d) => ({
      id: d.id,
      residents: Math.round(d.residents),
      traffic: Number(d.traffic.toFixed(2)),
      education: Number(d.education.toFixed(2)),
      parking: Number(d.parking.toFixed(2)),
    })),
    inventory: {
      buildings: ctx.city.buildings.length,
      schools: ctx.city.buildings.filter((b) => b.type === 'school').length,
      hospitals: ctx.city.buildings.filter((b) => b.type === 'hospital').length,
      transitHubs: ctx.city.buildings.filter((b) => b.type === 'transit_hub').length,
      busRoutes: (ctx.city.busRoutes ?? []).length,
      freePlots: ctx.city.freeSlots.length,
    },
    conversation: {
      lastIntent: ctx.conversation.currentIntent?.kind ?? null,
      constraints: ctx.conversation.currentConstraints,
      lastPlan: ctx.conversation.lastPlanName,
      built: ctx.conversation.built,
      recentRequests: ctx.conversation.recentRequests.slice(0, 4),
    },
  }
}
