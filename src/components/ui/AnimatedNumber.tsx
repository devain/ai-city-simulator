import { useEffect, useRef, useState } from 'react'

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Counts from the previous value to the new one instead of swapping it.
 * Used everywhere the before/after result needs to land rather than blink.
 */
export function useAnimatedValue(value: number, duration = 1400, delay = 0) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const raf = useRef(0)

  useEffect(() => {
    const start = performance.now() + delay
    const origin = from.current
    const delta = value - origin
    if (Math.abs(delta) < 1e-9) {
      setShown(value)
      return
    }

    const tick = () => {
      const now = performance.now()
      if (now < start) {
        raf.current = requestAnimationFrame(tick)
        return
      }
      const t = Math.min(1, (now - start) / duration)
      setShown(origin + delta * easeOutCubic(t))
      if (t < 1) raf.current = requestAnimationFrame(tick)
      else from.current = value
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration, delay])

  return shown
}

export function AnimatedNumber({
  value,
  format,
  duration = 1400,
  delay = 0,
  className,
}: {
  value: number
  format: (n: number) => string
  duration?: number
  delay?: number
  className?: string
}) {
  const shown = useAnimatedValue(value, duration, delay)
  return <span className={className}>{format(shown)}</span>
}
