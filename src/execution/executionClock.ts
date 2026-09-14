/**
 * The construction clock.
 *
 * Lives outside React (like `lib/clock.ts`) so the 3D scene can read it at
 * 60 fps without re-rendering the dashboard, and so PAUSE / SKIP are a single
 * variable rather than a web of cancelled timers.
 *
 * Every construction window in the scene is expressed in *execution elapsed
 * milliseconds*, not wall-clock time — which is precisely what makes pausing
 * and replaying work.
 */
export const execClock = {
  /** ms of construction time elapsed in the current run */
  elapsed: 0,
  /** total scheduled length of the current run */
  total: 0,
  paused: false,
  running: false,
  /** playback rate — SKIP ramps this up rather than teleporting */
  rate: 1,
}

export function resetExecClock(total: number) {
  execClock.elapsed = 0
  execClock.total = total
  execClock.paused = false
  execClock.running = true
  execClock.rate = 1
}

/** how long the AI's new structures keep their "just built" highlight */
export const newBuildHighlight = { until: 0 }

export function highlightNewBuilds(ms = 14000) {
  newBuildHighlight.until = performance.now() + ms
}

export function newBuildFactor() {
  const left = newBuildHighlight.until - performance.now()
  return left <= 0 ? 0 : Math.min(1, left / 4000)
}

export function stopExecClock() {
  execClock.running = false
  execClock.paused = false
  execClock.rate = 1
}

/** 0..1 over the whole run */
export function execProgress() {
  return execClock.total > 0 ? Math.min(1, execClock.elapsed / execClock.total) : 0
}
