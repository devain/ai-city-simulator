import { useChallengeStore } from '../../store/useChallengeStore'
import { CHALLENGE_OBJECTIVES } from '../../challenge/ChallengeConfig'
import { AI_PERSONALITIES } from '../../ai/AIPersonality'

const SPEEDS = [
  { ms: 900, label: '1×' },
  { ms: 260, label: '5×' },
  { ms: 70, label: '20×' },
]

/**
 * The match clock: where we are, who is ahead, and the transport controls.
 * Sits above the split view so it reads as one instrument.
 */
export function ChallengeHud() {
  const match = useChallengeStore((s) => s.match)
  const phase = useChallengeStore((s) => s.phase)
  const msPerTick = useChallengeStore((s) => s.msPerTick)
  const setSpeed = useChallengeStore((s) => s.setSpeed)
  const play = useChallengeStore((s) => s.play)
  const pause = useChallengeStore((s) => s.pause)
  const skipYear = useChallengeStore((s) => s.skipYear)
  const abandon = useChallengeStore((s) => s.abandon)

  if (!match) return null

  const year = Math.min(match.setup.years, Math.floor(match.human.tick / 12) + (match.human.tick % 12 === 0 && match.human.tick > 0 ? 0 : 1))
  const progress = Math.min(1, match.human.tick / (match.setup.years * 12))
  const running = phase === 'running'
  const h = match.scores.human.total
  const a = match.scores.ai.total
  const lead = h - a
  const personality = AI_PERSONALITIES[match.setup.personality]

  return (
    <div className="relative z-30 flex h-[52px] shrink-0 items-center gap-3 overflow-x-auto border-b border-cyan-300/20 bg-[#060b16]/92 px-3 backdrop-blur-xl scroll-thin">
      {/* ---- clock ---- */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={running ? pause : play}
          disabled={match.finished}
          className={`grid h-9 w-9 place-items-center rounded-lg border font-mono text-[12px] transition-all active:scale-95 disabled:opacity-40 ${
            running
              ? 'border-amber-300/50 bg-amber-300/12 text-amber-200'
              : 'border-emerald-300/50 bg-emerald-400/12 text-emerald-200'
          }`}
          title={running ? 'Pause the match' : 'Resume the match'}
        >
          {running ? '❚❚' : '▶'}
        </button>
        <div className="leading-none">
          <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">Year</div>
          <div className="mt-[3px] font-mono text-[15px] font-bold tabular-nums text-white">
            {year} <span className="text-[11px] text-slate-500">/ {match.setup.years}</span>
          </div>
        </div>
        <div className="flex items-center gap-[3px]">
          {SPEEDS.map((s) => (
            <button
              key={s.ms}
              onClick={() => setSpeed(s.ms)}
              className={`rounded px-1.5 py-1 font-mono text-[9.5px] tabular-nums transition-colors ${
                msPerTick === s.ms
                  ? 'bg-cyan-300/20 text-white ring-1 ring-cyan-300/40'
                  : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={skipYear}
          disabled={match.finished}
          className="rounded-lg border border-white/12 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-cyan-100 disabled:opacity-40"
        >
          Skip year
        </button>
      </div>

      {/* ---- the bar ---- */}
      <div className="min-w-[120px] flex-1">
        <div className="relative h-[5px] overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-[width] duration-300"
            style={{ width: `${progress * 100}%` }}
          />
          {Array.from({ length: match.setup.years - 1 }).map((_, i) => (
            <span
              key={i}
              className="absolute top-0 h-full w-px bg-[#060b16]"
              style={{ left: `${((i + 1) / match.setup.years) * 100}%` }}
            />
          ))}
        </div>
        <div className="mt-1 truncate font-mono text-[8.5px] uppercase tracking-[0.14em] text-slate-600">
          {CHALLENGE_OBJECTIVES[match.setup.objective].label} · {match.setup.seedLabel} · vs{' '}
          {personality.label}
        </div>
      </div>

      {/* ---- the score ---- */}
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="text-right leading-none">
          <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-sky-300/70">You</div>
          <div
            className={`mt-[3px] font-mono text-[18px] font-bold tabular-nums ${
              lead > 0 ? 'text-emerald-300 text-glow' : 'text-slate-300'
            }`}
          >
            {h.toFixed(1)}
          </div>
        </div>
        <div
          className={`rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] ${
            Math.abs(lead) < 0.5
              ? 'bg-white/[0.06] text-slate-400'
              : lead > 0
                ? 'bg-emerald-400/15 text-emerald-200'
                : 'bg-fuchsia-400/15 text-fuchsia-200'
          }`}
        >
          {Math.abs(lead) < 0.5 ? 'level' : `${lead > 0 ? 'you' : 'AI'} +${Math.abs(lead).toFixed(1)}`}
        </div>
        <div className="leading-none">
          <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-fuchsia-300/70">AI</div>
          <div
            className={`mt-[3px] font-mono text-[18px] font-bold tabular-nums ${
              lead < 0 ? 'text-emerald-300 text-glow' : 'text-slate-300'
            }`}
          >
            {a.toFixed(1)}
          </div>
        </div>
      </div>

      <button
        onClick={abandon}
        className="shrink-0 rounded-lg border border-white/10 px-2.5 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500 transition-colors hover:border-rose-400/40 hover:text-rose-200"
      >
        Exit
      </button>
    </div>
  )
}
