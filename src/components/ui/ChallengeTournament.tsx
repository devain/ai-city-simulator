import { useEffect } from 'react'
import { useChallengeStore } from '../../store/useChallengeStore'
import { AI_PERSONALITIES } from '../../ai/AIPersonality'
import { CHALLENGE_OBJECTIVES } from '../../challenge/ChallengeConfig'
import { money } from '../../lib/format'

const MEDAL = ['🥇', '🥈', '🥉', '  ']

/**
 * All four personalities, the same city, ten years each. The interesting part
 * is not the ranking but *how* they differ — so every row carries the shape of
 * the city that personality actually built.
 */
export function ChallengeTournament() {
  const phase = useChallengeStore((s) => s.phase)
  const rows = useChallengeStore((s) => s.tournament)
  const running = useChallengeStore((s) => s.tournamentRunning)
  const run = useChallengeStore((s) => s.runTournament)
  const setup = useChallengeStore((s) => s.setup)
  const updateSetup = useChallengeStore((s) => s.updateSetup)
  const start = useChallengeStore((s) => s.start)
  const open = useChallengeStore((s) => s.open)
  const close = useChallengeStore((s) => s.close)

  useEffect(() => {
    if (phase === 'tournament' && !rows && !running) run()
  }, [phase, rows, running, run])

  if (phase !== 'tournament') return null

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 overflow-y-auto bg-[#03060d]/97 backdrop-blur-2xl scroll-thin">
      <div className="mx-auto w-[min(900px,calc(100%-24px))] py-8">
        <div className="text-center">
          <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-cyan-300/60">
            Same city · {setup.years} years each · {CHALLENGE_OBJECTIVES[setup.objective].label}
          </div>
          <h1 className="mt-2 font-mono text-[38px] font-bold leading-none tracking-[0.16em] text-white text-glow sm:text-[48px]">
            AI TOURNAMENT
          </h1>
        </div>

        {running && (
          <div className="mt-10 text-center">
            <div className="mx-auto flex w-fit items-center gap-2">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full bg-cyan-300"
                  style={{ animation: `pulseGlow 1s ${i * 0.16}s ease-in-out infinite` }}
                />
              ))}
            </div>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Simulating four cities over {setup.years} years…
            </p>
          </div>
        )}

        {rows && (
          <div className="mt-6 space-y-2">
            {rows.map((r, i) => {
              const p = AI_PERSONALITIES[r.personality]
              return (
                <div
                  key={r.personality}
                  className={`animate-riseIn rounded-xl border p-3.5 ${
                    i === 0
                      ? 'border-emerald-300/45 bg-emerald-400/[0.07] shadow-glow'
                      : 'border-white/[0.08] bg-white/[0.02]'
                  }`}
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 shrink-0 text-center text-[17px]">{MEDAL[i]}</span>
                    <span className="w-5 shrink-0 text-center font-mono text-[15px] text-cyan-200/80">
                      {p.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-white">
                        {p.label}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                        {p.style}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 font-mono text-[28px] font-bold tabular-nums ${
                        i === 0 ? 'text-emerald-300 text-glow' : 'text-slate-300'
                      }`}
                    >
                      {r.score.toFixed(1)}
                    </span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-5 gap-2 border-t border-white/[0.06] pt-2.5">
                    {[
                      ['Population', Math.round(r.population).toLocaleString('en-US')],
                      ['Traffic', `${Math.round(r.traffic * 100)}%`],
                      ['CO₂ / head', `${(r.co2 / 1000).toFixed(1)}t`],
                      ['Budget left', money(r.treasury)],
                      ['Builds', String(r.builds)],
                    ].map(([label, value]) => (
                      <div key={label} className="leading-none">
                        <div className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-slate-600">
                          {label}
                        </div>
                        <div className="mt-[4px] font-mono text-[11.5px] font-semibold tabular-nums text-slate-200">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      updateSetup({ personality: r.personality })
                      start(false)
                    }}
                    className="mt-2.5 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-slate-400 transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
                  >
                    Play against this AI
                  </button>
                </div>
              )
            })}

            <p className="pt-1 text-center text-[10.5px] leading-relaxed text-slate-500">
              Every run used the identical starting city and the identical seeded emergencies. The
              ranking is whatever the simulation produced — nothing here is weighted to favour a
              particular strategy.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={run}
                className="flex-1 rounded-xl border border-cyan-300/50 bg-cyan-300/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-100 transition-colors hover:bg-cyan-300/20"
              >
                Run again
              </button>
              <button
                onClick={open}
                className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
              >
                Setup
              </button>
              <button
                onClick={close}
                className="rounded-xl border border-white/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-slate-200"
              >
                Exit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
