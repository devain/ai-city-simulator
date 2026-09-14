import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useCityStore } from '../../store/useCityStore'
import { useOptimizerStore } from '../../store/useOptimizerStore'
import type { City, SimulationResult } from '../../simulation/types'
import type { CityConfig } from '../../simulation/config'
import type { HeatLayer } from '../../store/useCityStore'

/**
 * WHICH CITY AM I RENDERING?
 *
 * Until Phase 6 there was only ever one city, so every scene component read
 * the store directly. A Human-vs-AI match needs two on screen at once, so the
 * scene now reads its city from context instead.
 *
 * The default provider is the live store, which is exactly what Phases 1-5
 * had — so the single-city view is unchanged, and the split view is just the
 * same components under a different provider. No scene code is duplicated.
 */
export interface CityView {
  /** which city this is: the live sandbox, or one side of a match */
  side: 'live' | 'human' | 'ai'
  city: City
  baseCity: City
  config: CityConfig
  current: SimulationResult
  baseline: SimulationResult
  heatLayer: HeatLayer
  /** execution-time windows for anything under construction */
  constructions: Record<string, { start: number; duration: number }>
  /**
   * False for a city the player is only watching. Disables hover, selection,
   * placement and demolition, so the AI's city cannot be edited by hand.
   */
  interactive: boolean
}

const CityViewContext = createContext<CityView | null>(null)

/** The live sandbox city — the default everywhere outside a match. */
export function LiveCityView({ children }: { children: ReactNode }) {
  const city = useCityStore((s) => s.city)
  const baseCity = useCityStore((s) => s.baseCity)
  const config = useCityStore((s) => s.config)
  const current = useCityStore((s) => s.current)
  const baseline = useCityStore((s) => s.baseline)
  const heatLayer = useCityStore((s) => s.heatLayer)
  const constructions = useOptimizerStore((s) => s.constructions)

  const value = useMemo<CityView>(
    () => ({
      side: 'live',
      city,
      baseCity,
      config,
      current,
      baseline,
      heatLayer,
      constructions,
      interactive: true,
    }),
    [city, baseCity, config, current, baseline, heatLayer, constructions],
  )
  return <CityViewContext.Provider value={value}>{children}</CityViewContext.Provider>
}

/** One side of a match. Read-only unless it is the player's own city. */
export function MatchCityView({
  side,
  city,
  baseCity,
  config,
  current,
  baseline,
  heatLayer,
  constructions,
  interactive,
  children,
}: Omit<CityView, 'side'> & { side: 'human' | 'ai'; children: ReactNode }) {
  const value = useMemo<CityView>(
    () => ({
      side,
      city,
      baseCity,
      config,
      current,
      baseline,
      heatLayer,
      constructions,
      interactive,
    }),
    [side, city, baseCity, config, current, baseline, heatLayer, constructions, interactive],
  )
  return <CityViewContext.Provider value={value}>{children}</CityViewContext.Provider>
}

/**
 * The city the surrounding scene should draw.
 *
 * Falls back to the live store when no provider is present, so a scene
 * component can still be dropped in anywhere without ceremony.
 */
export function useCityView(): CityView {
  const ctx = useContext(CityViewContext)
  const city = useCityStore((s) => s.city)
  const baseCity = useCityStore((s) => s.baseCity)
  const config = useCityStore((s) => s.config)
  const current = useCityStore((s) => s.current)
  const baseline = useCityStore((s) => s.baseline)
  const heatLayer = useCityStore((s) => s.heatLayer)
  const constructions = useOptimizerStore((s) => s.constructions)

  return (
    ctx ?? {
      side: 'live',
      city,
      baseCity,
      config,
      current,
      baseline,
      heatLayer,
      constructions,
      interactive: true,
    }
  )
}
