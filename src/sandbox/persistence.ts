/**
 * SAVE / LOAD — three city slots in localStorage, no backend.
 *
 * A save holds everything needed to put the player back exactly where they
 * were: the city geometry, the config (including any active events), the
 * treasury, the simulation clock, the AI's memory and the full history. The
 * simulation itself is never saved — it is re-derived from the city on load,
 * which means a save can never disagree with the engine.
 */
import type { City } from '../simulation/types'
import type { CityConfig } from '../simulation/config'
import type { HistoryEntry } from './history'
import type { SandboxMode } from './modes'

export const SLOT_IDS = ['city-01', 'city-02', 'city-03'] as const
export type SlotId = (typeof SLOT_IDS)[number]

export const SLOT_LABEL: Record<SlotId, string> = {
  'city-01': 'City 01',
  'city-02': 'City 02',
  'city-03': 'City 03',
}

/** bump when the shape changes so old saves are rejected rather than crash */
const SAVE_VERSION = 5

export interface SavedCity {
  version: number
  savedAt: number
  name: string
  mode: SandboxMode
  city: City
  config: CityConfig
  baseConfig: CityConfig
  treasury: number
  spentTotal: number
  tick: number
  occupancy: number
  objective: string
  activeEvents: { specId: string; startedTick: number; endsTick: number }[]
  firedEventIds: string[]
  history: HistoryEntry[]
  aiLog: { id: number; tick: number; text: string; kind: string }[]
  /** headline numbers, so the slot list can be drawn without simulating */
  summary: {
    population: number
    health: number
    treasury: number
    year: number
  }
}

const key = (slot: SlotId) => `ai-city-sim:${slot}`

function storage(): Storage | null {
  try {
    // private windows and blocked site data both throw here
    const s = window.localStorage
    s.setItem('ai-city-sim:probe', '1')
    s.removeItem('ai-city-sim:probe')
    return s
  } catch {
    return null
  }
}

export function saveCity(slot: SlotId, data: Omit<SavedCity, 'version' | 'savedAt'>): boolean {
  const s = storage()
  if (!s) return false
  try {
    s.setItem(key(slot), JSON.stringify({ ...data, version: SAVE_VERSION, savedAt: Date.now() }))
    return true
  } catch {
    // quota exceeded — a large city with a long history can hit 5MB
    return false
  }
}

export function loadCity(slot: SlotId): SavedCity | null {
  const s = storage()
  if (!s) return null
  try {
    const raw = s.getItem(key(slot))
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedCity
    if (parsed.version !== SAVE_VERSION) return null
    if (!parsed.city?.buildings || !Array.isArray(parsed.city.buildings)) return null
    return parsed
  } catch {
    return null
  }
}

export function deleteCity(slot: SlotId): void {
  storage()?.removeItem(key(slot))
}

export interface SlotInfo {
  slot: SlotId
  label: string
  saved: SavedCity | null
}

export function listSlots(): SlotInfo[] {
  return SLOT_IDS.map((slot) => ({ slot, label: SLOT_LABEL[slot], saved: loadCity(slot) }))
}

export const storageAvailable = () => storage() !== null
