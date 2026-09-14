import { useEffect, useState } from 'react'
import { useOptimizerStore } from '../../store/useOptimizerStore'
import { useCityStore } from '../../store/useCityStore'
import type { OptimizerPhase } from '../../ai/types'

const BANNER: Partial<Record<OptimizerPhase, string>> = {
  analyzing: 'ANALYZING CITY',
  planning: 'GENERATING CITY PLANS',
  simulating: 'SIMULATING OUTCOMES',
  deciding: 'SCORING OPTIONS',
  building: 'CONSTRUCTION IN PROGRESS',
  resimulating: 'SIMULATING',
  complete: 'OPTIMIZATION COMPLETE',
}

/**
 * The cinematic layer: letterbox bars while the AI has the camera, a state
 * banner that fades through each phase, and a step readout during execution.
 * Deliberately restrained — it frames the 3D city rather than covering it.
 */
export function CinematicOverlay() {
  const phase = useOptimizerStore((s) => s.phase)
  const cinematic = useOptimizerStore((s) => s.cinematic)
  const steps = useOptimizerStore((s) => s.steps)
  const activeIndex = useOptimizerStore((s) => s.activeStepIndex)
  const paused = useOptimizerStore((s) => s.paused)
  const planCode = useOptimizerStore((s) => s.queue?.planCode)
  // the demo narrates in the same place — one voice at a time
  const demoCaption = useCityStore((s) => s.demoCaption)

  const [banner, setBanner] = useState<string | null>(null)

  // show each phase banner briefly, then let the city breathe
  useEffect(() => {
    const text = BANNER[phase]
    if (!text) {
      setBanner(null)
      return
    }
    setBanner(text)
    const id = window.setTimeout(() => setBanner(null), phase === 'building' ? 1800 : 2200)
    return () => window.clearTimeout(id)
  }, [phase])

  const active = steps[activeIndex]
  const showBanner = banner && !demoCaption
  const executing = phase === 'building' && !!active

  return (
    <>
      {/* letterbox — only while the AI is driving */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-black/85 to-transparent transition-all duration-700"
        style={{ height: cinematic ? 54 : 0, opacity: cinematic ? 1 : 0 }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 to-transparent transition-all duration-700"
        style={{ height: cinematic ? 54 : 0, opacity: cinematic ? 1 : 0 }}
      />

      {/* scanline wash while the AI works */}
      {cinematic && (
        <div
          className="pointer-events-none absolute inset-0 z-20 opacity-[0.055]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(140,230,255,0.5) 0px, rgba(140,230,255,0.5) 1px, transparent 1px, transparent 6px)',
          }}
        />
      )}

      {/* phase banner */}
      {showBanner && (
        <div className="pointer-events-none absolute inset-x-0 top-[22%] z-30 flex justify-center">
          <div
            key={banner}
            className="animate-riseIn rounded-xl border border-cyan-300/25 bg-[#040810]/70 px-6 py-3 backdrop-blur-md"
            style={{ boxShadow: '0 0 60px -18px rgba(56,240,255,0.6)' }}
          >
            <p className="text-center font-mono text-[14px] font-bold tracking-[0.3em] text-white text-glow sm:text-[17px]">
              {banner}
            </p>
          </div>
        </div>
      )}

      {/* step readout during construction */}
      {executing && (
        <div className="pointer-events-none absolute left-1/2 top-[62px] z-30 w-[min(460px,calc(100%-24px))] -translate-x-1/2">
          <div className="rounded-lg border border-cyan-300/25 bg-[#040a14]/80 px-3 py-2 backdrop-blur-md">
            <div className="flex items-center justify-between font-mono text-[8.5px] uppercase tracking-[0.22em]">
              <span className="text-cyan-300/80">
                Plan {planCode} · Step {String(activeIndex + 1).padStart(2, '0')} /{' '}
                {String(steps.length).padStart(2, '0')}
              </span>
              <span className={paused ? 'text-amber-300' : 'text-slate-500'}>
                {paused ? 'PAUSED' : 'AI EXECUTING'}
              </span>
            </div>
            <p className="mt-1 font-mono text-[13px] font-bold tracking-[0.08em] text-white">
              {active.label}
            </p>
            <div className="mt-1.5 flex gap-[3px]">
              {steps.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${
                    i < activeIndex
                      ? 'bg-cyan-400/50'
                      : i === activeIndex
                        ? 'bg-cyan-300 shadow-glow'
                        : 'bg-white/12'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
