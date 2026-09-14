import { useEffect, useState } from 'react'

/**
 * The day/night clock lives outside React so the 3D scene can advance it at
 * 60 fps without re-rendering the whole dashboard. UI that needs the value
 * samples it a few times a second.
 */
export const clock = {
  hour: 10.4,
  /** simulated hours per real second */
  speed: 0.3,
  paused: false,
}

export function setHour(h: number) {
  clock.hour = ((h % 24) + 24) % 24
}

export function useClockHour(intervalMs = 200) {
  const [h, setH] = useState(clock.hour)
  useEffect(() => {
    const id = setInterval(() => setH(clock.hour), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return h
}

export function formatClock(h: number) {
  const hh = Math.floor(h) % 24
  const mm = Math.floor((h % 1) * 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** 0 = deep night, 1 = full day */
export function daylight(h: number) {
  // sunrise ~5.5, sunset ~19.5
  const x = Math.cos(((h - 13) / 24) * Math.PI * 2)
  return Math.max(0, Math.min(1, (x + 0.18) / 1.05))
}
