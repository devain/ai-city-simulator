/**
 * How a structure comes out of the ground.
 *
 * Buildings never simply appear. A job runs through distinct, readable phases:
 *
 *   GROUND → FOUNDATION → STRUCTURE RISES (floor by floor) → WINDOWS ACTIVATE
 *   → DETAILS → construction effects fade → part of the normal city
 *
 * Returned as plain numbers so the renderer can drive instanced matrices and
 * colours without allocating anything per frame.
 */
export type BuildPhase = 'pending' | 'foundation' | 'rising' | 'finishing' | 'done'

export interface BuildStage {
  /** 0..1 of final height */
  height: number
  /** 0..1 — bare concrete to finished facade, drives colour */
  finish: number
  /** 0..1 — window/light activation */
  windows: number
  /** 0..1 — strength of scaffolding, scan plane, sparks */
  fx: number
  /** how many floors are standing right now */
  floors: number
  phase: BuildPhase
  /** 0..1 raw timeline position */
  t: number
}

const FOUNDATION_END = 0.17
const RISE_END = 0.8
const FINISH_END = 0.94

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

export function buildStage(t: number, totalFloors: number): BuildStage {
  const floors = Math.max(2, Math.round(totalFloors))

  if (t <= 0) {
    return { height: 0, finish: 0, windows: 0, fx: t > -0.45 ? 1 : 0, floors: 0, phase: 'pending', t: 0 }
  }
  if (t >= 1) {
    return { height: 1, finish: 1, windows: 1, fx: 0, floors, phase: 'done', t: 1 }
  }

  const finish = clamp01((t - 0.12) / 0.7)

  if (t < FOUNDATION_END) {
    // a slab and a pit — something is clearly happening, but nothing has risen
    const p = t / FOUNDATION_END
    return {
      height: (0.6 / floors) * easeOutCubic(p),
      finish: finish * 0.3,
      windows: 0,
      fx: 1,
      floors: 0,
      phase: 'foundation',
      t,
    }
  }

  if (t < RISE_END) {
    // storey by storey, so the structure visibly stacks rather than stretches
    const p = (t - FOUNDATION_END) / (RISE_END - FOUNDATION_END)
    const built = Math.max(1, Math.ceil(easeOutCubic(p) * floors))
    return {
      height: built / floors,
      finish,
      windows: 0,
      fx: 1,
      floors: built,
      phase: 'rising',
      t,
    }
  }

  if (t < FINISH_END) {
    // topped out: facade completes and the lights come on
    const p = (t - RISE_END) / (FINISH_END - RISE_END)
    return { height: 1, finish, windows: easeOutCubic(p), fx: 1 - p * 0.5, floors, phase: 'finishing', t }
  }

  const p = (t - FINISH_END) / (1 - FINISH_END)
  return { height: 1, finish: 1, windows: 1, fx: 0.5 * (1 - p), floors, phase: 'done', t }
}

/** Progress of a job in execution time, or null when the object is not being built. */
export function jobProgress(
  job: { start: number; duration: number } | undefined,
  elapsed: number,
): number | null {
  if (!job) return null
  return (elapsed - job.start) / job.duration
}
