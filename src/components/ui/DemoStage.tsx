import { useEffect } from 'react'
import { useDemoStore } from '../../store/useDemoStore'
import { useChallengeStore } from '../../store/useChallengeStore'
import { DEMO_TIMELINE, DEMO_TOTAL_SECONDS } from '../../demo/DemoTimeline'

/**
 * The presentation layer for DEMO MODE.
 *
 * Letterbox, a scene dim, the act label, the centred narration, and a minimal
 * transport strip that fades out of the way. Everything here is chrome for a
 * recording — it reads the demo state and renders it, and controls nothing.
 */
export function DemoStage() {
  const active = useDemoStore((s) => s.active)
  const paused = useDemoStore((s) => s.paused)
  const ui = useDemoStore((s) => s.ui)
  const title = useDemoStore((s) => s.title)
  const lines = useDemoStore((s) => s.lines)
  const act = useDemoStore((s) => s.act)
  const stage = useDemoStore((s) => s.stage)
  const stageIndex = useDemoStore((s) => s.stageIndex)
  const elapsed = useDemoStore((s) => s.elapsed)
  const stop = useDemoStore((s) => s.stop)
  const togglePause = useDemoStore((s) => s.togglePause)
  const seek = useDemoStore((s) => s.seek)
  const skipToEnd = useDemoStore((s) => s.skipToEnd)

  // space toggles pause, escape leaves — the two keys a presenter needs
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === ' ') {
        e.preventDefault()
        togglePause()
      }
      if (e.key === 'ArrowRight') seek(stageIndex + 1)
      if (e.key === 'ArrowLeft') seek(stageIndex - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, togglePause, seek, stageIndex])

  if (!active) return null

  const progress = Math.min(1, elapsed / (DEMO_TOTAL_SECONDS * 1000))
  const bars = ui.letterbox ? 62 : 0

  return (
    <>
      {/* ---- scene dim, under everything else ---- */}
      <div
        className="pointer-events-none absolute inset-0 z-[44] bg-[#03060d] transition-opacity duration-[900ms]"
        style={{ opacity: ui.dim ?? 0 }}
      />

      {/* ---- letterbox ---- */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[46] bg-[#03060d] transition-[height] duration-[900ms]"
        style={{ height: bars }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[46] bg-[#03060d] transition-[height] duration-[900ms]"
        style={{ height: bars }}
      />

      {/* ---- act label ---- */}
      {act && (
        <div
          key={act}
          className="pointer-events-none absolute left-5 z-[48] animate-riseIn font-mono text-[9px] uppercase tracking-[0.32em] text-cyan-300/55"
          style={{ top: bars + 16 }}
        >
          {act}
        </div>
      )}

      {/* ---- narration ---- */}
      {(title || lines.length > 0) && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-[48] flex flex-col items-center gap-3 px-6 ${
            stage === 'WINNER_REVEAL' || stage === 'END' || stage === 'INTRO'
              ? 'top-1/2 -translate-y-1/2'
              : 'top-[15%]'
          }`}
        >
          {title && (
            <h2
              key={title}
              className={`animate-riseIn text-center font-mono font-bold tracking-[0.2em] text-white text-glow ${
                stage === 'WINNER_REVEAL'
                  ? 'text-[46px] leading-none sm:text-[72px]'
                  : stage === 'END' || stage === 'INTRO'
                    ? 'text-[30px] leading-none sm:text-[46px]'
                    : 'text-[19px] sm:text-[26px]'
              }`}
              style={{ textShadow: '0 0 44px rgba(94,240,255,0.45)' }}
            >
              {title}
            </h2>
          )}

          {lines.length > 0 && (
            <div className="flex max-w-[620px] flex-col items-center gap-1.5">
              {lines.map((l, i) => (
                <p
                  key={l + i}
                  className="animate-riseIn text-center text-[13px] leading-relaxed text-slate-200 sm:text-[15px]"
                  style={{ textShadow: '0 2px 18px rgba(0,0,0,0.9)' }}
                >
                  {l}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- transport, deliberately quiet ---- */}
      <div
        className="absolute inset-x-0 z-[49] flex items-center justify-center gap-2 opacity-25 transition-opacity duration-300 hover:opacity-100"
        style={{ bottom: bars + 12 }}
      >
        <button
          onClick={togglePause}
          className="pointer-events-auto grid h-8 w-8 place-items-center rounded-lg border border-white/20 bg-black/60 font-mono text-[11px] text-slate-200 backdrop-blur-sm transition-colors hover:border-cyan-300/50"
          title={paused ? 'Resume (space)' : 'Pause (space)'}
        >
          {paused ? '▶' : '❚❚'}
        </button>

        <div className="pointer-events-auto flex h-8 items-center gap-[3px] rounded-lg border border-white/15 bg-black/55 px-2 backdrop-blur-sm">
          {DEMO_TIMELINE.map((s, i) => (
            <button
              key={s.id}
              onClick={() => seek(i)}
              title={`${s.id.replace(/_/g, ' ').toLowerCase()} · ${s.seconds}s`}
              className={`h-1.5 rounded-full transition-all ${
                i === stageIndex
                  ? 'w-6 bg-cyan-300 shadow-glow'
                  : i < stageIndex
                    ? 'w-2.5 bg-cyan-300/40'
                    : 'w-2.5 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        <span className="pointer-events-none font-mono text-[9.5px] tabular-nums text-slate-400">
          {Math.floor(elapsed / 1000)}s / {DEMO_TOTAL_SECONDS}s
        </span>

        <button
          onClick={skipToEnd}
          className="pointer-events-auto rounded-lg border border-white/20 bg-black/60 px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-slate-300 backdrop-blur-sm transition-colors hover:border-cyan-300/50 hover:text-cyan-100"
        >
          Result ⏭
        </button>
        <button
          onClick={stop}
          className="pointer-events-auto rounded-lg border border-white/20 bg-black/60 px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-slate-300 backdrop-blur-sm transition-colors hover:border-rose-400/50 hover:text-rose-200"
        >
          Exit
        </button>
      </div>

      {/* ---- a thin progress hairline along the very bottom of the frame ---- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[50] h-[2px] bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */

/**
 * The entry point. Sits on the challenge setup screen and in the status strip,
 * because those are the two places someone about to record will be looking.
 */
export function DemoModeButton({ compact = false }: { compact?: boolean }) {
  const start = useDemoStore((s) => s.start)
  const active = useDemoStore((s) => s.active)
  const closeSetup = useChallengeStore((s) => s.close)

  if (active) return null

  const go = () => {
    closeSetup()
    start()
  }

  if (compact) {
    return (
      <button
        onClick={go}
        className="relative shrink-0 overflow-hidden rounded-lg border border-amber-300/50 bg-gradient-to-b from-amber-400/25 to-amber-500/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-amber-50 shadow-glow transition-all hover:from-amber-300/40 active:scale-[0.98]"
        title="Watch an AI build a city — a complete 10-year match in 107 seconds"
      >
        ▶ Demo mode
        <span className="pointer-events-none absolute inset-0 -translate-x-full animate-sweep bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      </button>
    )
  }

  return (
    <button
      onClick={go}
      className="pointer-events-auto absolute right-4 top-4 z-[60] overflow-hidden rounded-xl border border-amber-300/50 bg-gradient-to-b from-amber-400/25 to-amber-500/10 px-4 py-2.5 text-right shadow-glow transition-all hover:from-amber-300/40 active:scale-[0.98]"
    >
      <span className="block font-mono text-[12px] font-bold uppercase tracking-[0.2em] text-amber-50">
        ▶ Demo mode
      </span>
      <span className="mt-0.5 block font-mono text-[9px] tracking-[0.1em] text-amber-200/70">
        Watch an AI build a city
      </span>
      <span className="pointer-events-none absolute inset-0 -translate-x-full animate-sweep bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </button>
  )
}
