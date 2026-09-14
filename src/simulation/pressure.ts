import type { PressureLevel } from './types'

/** Shared mapping from a demand/capacity ratio to a headline pressure label. */
export function pressureFromUtilisation(u: number): PressureLevel {
  if (u < 0.6) return 'LOW'
  if (u < 0.8) return 'MODERATE'
  if (u < 0.95) return 'HIGH'
  return 'CRITICAL'
}

export const PRESSURE_ORDER: Record<PressureLevel, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  CRITICAL: 3,
}

export const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
export const round = (n: number, dp = 0) => {
  const f = 10 ** dp
  return Math.round(n * f) / f
}
