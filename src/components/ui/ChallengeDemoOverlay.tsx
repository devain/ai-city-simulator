import { useEffect, useState } from 'react'
import {
  onDemoCaption,
  skipChallengeDemo,
  startChallengeDemo,
  stopChallengeDemo,
  type DemoCaption,
} from '../../challenge/challengeDemo'
import { useChallengeStore } from '../../store/useChallengeStore'

/**
 * The narration layer for the 60-second demo. Captions only — the match
 * underneath is the real thing, running at real speed, and the winner is
 * whatever it produces.
 */
export function ChallengeDemoOverlay() {
  const [caption, setCaption] = useState<DemoCaption | null>(null)
  const [running, setRunning] = useState(false)
  const phase = useChallengeStore((s) => s.phase)

  useEffect(() => {
    onDemoCaption(setCaption)
    return () => onDemoCaption(null)
  }, [])

  // the demo is over once the results screen appears
  useEffect(() => {
    if (phase === 'finished') setRunning(false)
  }, [phase])

  useEffect(() => () => stopChallengeDemo(), [])

  const stop = () => {
    skipChallengeDemo()
    setCaption(null)
    setRunning(false)
  }

  if (!running) {
    // the entry point lives on the setup screen
    if (phase !== 'setup') return null
    return (
      <button
        onClick={() => {
          setRunning(true)
          startChallengeDemo()
        }}
        className="pointer-events-auto absolute right-4 top-4 z-[60] rounded-xl border border-amber-300/50 bg-gradient-to-b from-amber-400/25 to-amber-500/10 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-amber-50 shadow-glow transition-all hover:from-amber-300/40 active:scale-[0.98]"
        title="Watch a complete 10-year match in about 90 seconds"
      >
        ▶ Start demo
      </button>
    )
  }

  return (
    <>
      {caption?.title && (
        <div className="pointer-events-none absolute inset-x-0 top-[16%] z-[55] flex flex-col items-center gap-2.5">
          <div
            key={caption.title + caption.detail}
            className="animate-riseIn rounded-2xl border border-cyan-300/25 bg-[#040810]/80 px-7 py-4 backdrop-blur-md"
            style={{ boxShadow: '0 0 60px -18px rgba(56,240,255,0.6)' }}
          >
            <p className="text-center font-mono text-[15px] font-bold tracking-[0.26em] text-white text-glow sm:text-[19px]">
              {caption.title}
            </p>
            {caption.detail && (
              <p className="mt-2 max-w-[520px] text-center text-[12px] leading-relaxed text-slate-300">
                {caption.detail}
              </p>
            )}
          </div>
          <div className="h-[3px] w-[220px] overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-[width] duration-500"
              style={{ width: `${Math.min(100, caption.progress * 100)}%` }}
            />
          </div>
        </div>
      )}

      <button
        onClick={stop}
        className="pointer-events-auto absolute right-4 top-4 z-[60] rounded-lg border border-white/20 bg-black/50 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-200 backdrop-blur-sm transition-colors hover:border-rose-400/50 hover:text-rose-200"
      >
        Skip ⏭
      </button>
    </>
  )
}
