import type { SimulationResult } from '../simulation/types'

/**
 * How much room the city has left before its tightest system saturates,
 * as a 0..1 share. 1 = everything is running cold, 0 = something is full.
 *
 * A cheap proxy for the binary-searched `headroom()` in the planner: it reads
 * the utilisations that are already computed, so demand bars and the advisor
 * can refresh on every tick without re-simulating.
 */
export function headroomShare(r: SimulationResult): number {
  const worst = Math.max(
    r.metrics.traffic.utilisation,
    r.metrics.electricity.utilisation,
    r.metrics.water.utilisation,
    r.metrics.education.utilisation,
    r.metrics.parking.utilisation,
  )
  return Math.max(0, Math.min(1, 1 - worst))
}
