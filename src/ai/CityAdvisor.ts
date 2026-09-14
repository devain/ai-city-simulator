/**
 * THE ADVISOR — the AI's voice in AI ASSIST mode.
 *
 * It watches the city, ranks what is wrong, works out what would fix it, and
 * *simulates that fix* before recommending it. The number it quotes for the
 * outcome is the number the city will actually reach, because it comes from
 * the same engine the city runs on.
 *
 * Two rules keep it from becoming a nuisance:
 *   1. It only speaks when something crosses a threshold, or when the player
 *      has just changed the city and the consequences are worth knowing.
 *   2. It never builds. Every recommendation is an offer with a button on it.
 */
import { runSimulation } from '../simulation/citySimulation'
import { previewCity } from './predictImpact'
import { cityFinance } from '../sandbox/finance'
import { cityHealth } from '../sandbox/health'
import { CATALOGUE_BY_ID, LINEAR_BY_ID, type CatalogueItem, type LinearItem } from '../sandbox/catalogue'
import { remedyFor, type CityPriority } from './CityPriorities'
import { bestFreeSlot } from '../sandbox/siting'
import type { CityConfig } from '../simulation/config'
import type { City, DistrictId, SimulationResult } from '../simulation/types'

export type AdviceSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface Advice {
  /** stable id so a dismissed piece of advice stays dismissed */
  id: string
  severity: AdviceSeverity
  /** the headline — one short clause */
  title: string
  /** the reading that triggered it */
  reading: string
  /** what the AI suggests, in one sentence */
  recommendation: string
  /** the item it wants built, if any */
  itemId: string | null
  itemName: string | null
  capex: number
  opex: number
  /** where it would go */
  district: DistrictId | null
  districtLabel: string | null
  /** the simulated outcome of taking the advice */
  outcome: string | null
  /** change in city health if taken */
  healthDelta: number | null
  /** true when the treasury cannot cover it */
  unaffordable: boolean
  /** the priority that produced this */
  priorityKey: string
}

const SEVERITY_OF: Record<string, AdviceSeverity> = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  WATCH: 'INFO',
  NORMAL: 'INFO',
}

export interface AdvisorInput {
  city: City
  config: CityConfig
  current: SimulationResult
  priorities: CityPriority[]
  treasury: number
  /** advice ids the player has already waved away */
  dismissed: string[]
}

/**
 * The one thing most worth saying right now, or null when the city is fine.
 * Only WATCH and above ever produce advice, so a healthy city stays quiet.
 */
export function adviseCity(input: AdvisorInput): Advice | null {
  const { city, config, current, priorities, treasury, dismissed } = input

  // Simulate each candidate and prefer one that genuinely helps. A
  // recommendation that would cost the city health is not advice, it is noise.
  let fallback: Advice | null = null

  for (const p of priorities) {
    if (p.level === 'NORMAL') break // the list is sorted, so nothing below matters
    const id = `${p.key}:${p.level}`
    if (dismissed.includes(id)) continue

    const item = remedyFor(p, Number.MAX_SAFE_INTEGER)
    if (!item) continue

    const slot = 'kind' in item ? null : bestFreeSlot(city, current, p.demand)
    const advice: Advice = {
      ...simulateAdvice(city, config, current, p, item, slot),
      id,
      unaffordable: item.capex > treasury,
    }

    if ((advice.healthDelta ?? 0) >= 0) return advice
    // keep the least-bad option in case nothing improves things
    if (!fallback || (advice.healthDelta ?? 0) > (fallback.healthDelta ?? 0)) fallback = advice
  }

  if (fallback) {
    return {
      ...fallback,
      recommendation: `${fallback.recommendation} It is the best available move, but nothing affordable improves the city right now.`,
    }
  }
  return null
}

function simulateAdvice(
  city: City,
  config: CityConfig,
  current: SimulationResult,
  p: CityPriority,
  item: CatalogueItem | LinearItem,
  slot: { x: number; z: number; district: DistrictId } | null,
): Omit<Advice, 'id' | 'unaffordable'> {
  const next = previewCity(city, item, slot, current)
  const after = runSimulation(next, config)

  const healthBefore = cityHealth(current, cityFinance(city, current))
  const healthAfter = cityHealth(after, cityFinance(next, after))

  return {
    severity: SEVERITY_OF[p.level] ?? 'INFO',
    title: `${p.label} ${p.level === 'CRITICAL' ? 'critical' : p.level === 'WARNING' ? 'under pressure' : 'worth watching'}`,
    reading: p.reading,
    recommendation: `Build ${article(item.name)} ${item.name.toLowerCase()}${
      slot ? ` in ${districtName(slot.district)}` : ''
    }.`,
    itemId: item.id,
    itemName: item.name,
    capex: item.capex,
    opex: item.opex,
    district: slot?.district ?? null,
    districtLabel: slot ? districtName(slot.district) : null,
    outcome: outcomeLine(p, current, after),
    healthDelta: healthAfter.score - healthBefore.score,
    priorityKey: p.key,
  }
}

/** "Education 84% → 63%" — the specific promise the advice is making. */
function outcomeLine(p: CityPriority, before: SimulationResult, after: SimulationResult): string | null {
  const read = (r: SimulationResult): number | null => {
    switch (p.key) {
      case 'traffic':
        return r.metrics.traffic.utilisation
      case 'education':
        return r.metrics.education.utilisation
      case 'energy':
        return r.metrics.electricity.utilisation
      case 'water':
        return r.metrics.water.utilisation
      case 'parking':
        return r.metrics.parking.utilisation
      case 'environment':
        return r.metrics.emissions.utilisation
      case 'housing':
        return null
      default:
        return null
    }
  }
  const a = read(before)
  const b = read(after)
  if (a == null || b == null) {
    if (p.key === 'housing') {
      const gain = Math.round(after.population - before.population)
      return gain > 0 ? `room for ${gain.toLocaleString('en-US')} more residents` : null
    }
    if (p.key === 'jobs') {
      const gain = Math.round(after.jobs - before.jobs)
      return gain > 0 ? `+${gain.toLocaleString('en-US')} jobs` : null
    }
    return null
  }
  return `${p.label.toLowerCase()} ${Math.round(a * 100)}% → ${Math.round(b * 100)}%`
}

const article = (name: string) => (/^[aeiou]/i.test(name) ? 'an' : 'a')

const DISTRICT_LABEL: Record<DistrictId, string> = {
  central: 'Central Core',
  north: 'North Quarter',
  east: 'East Ridge',
  south: 'South Gate',
  west: 'West Harbour',
}
const districtName = (d: DistrictId) => DISTRICT_LABEL[d]

/** Resolve an advice item id back to a catalogue entry. */
export function adviceItem(id: string | null): CatalogueItem | LinearItem | null {
  if (!id) return null
  return CATALOGUE_BY_ID[id] ?? LINEAR_BY_ID[id] ?? null
}
