import { useEffect, useRef } from 'react'
import { useChallengeStore } from '../../store/useChallengeStore'
import { AI_PERSONALITIES } from '../../ai/AIPersonality'
import { money } from '../../lib/format'
import type { LogEntry } from '../../challenge/ChallengeRunner'

const KIND_TONE: Record<LogEntry['kind'], { dot: string; text: string }> = {
  build: { dot: 'bg-emerald-400', text: 'text-emerald-200/90' },
  analyse: { dot: 'bg-sky-300', text: 'text-sky-200/90' },
  event: { dot: 'bg-amber-300', text: 'text-amber-200' },
  adapt: { dot: 'bg-fuchsia-300', text: 'text-fuchsia-200' },
  milestone: { dot: 'bg-cyan-300', text: 'text-cyan-100' },
  hold: { dot: 'bg-slate-600', text: 'text-slate-500' },
}

const SIDE_TAG: Record<string, { label: string; tone: string }> = {
  human: { label: 'YOU', tone: 'text-sky-300/80' },
  ai: { label: 'AI', tone: 'text-fuchsia-300/80' },
  match: { label: '—', tone: 'text-slate-600' },
}

/**
 * The AI's activity timeline: what it saw, what it chose, and what it learned
 * from the last thing it built. Every line was produced by an actual decision.
 */
export function ChallengeActivityLog() {
  const match = useChallengeStore((s) => s.match)
  const filter = useChallengeStore((s) => s.logFilter)
  const setFilter = useChallengeStore((s) => s.setLogFilter)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [match?.log.length])

  if (!match) return null
  const shown = match.log.filter((l) => filter === 'all' || l.side === filter || l.side === 'match')
  const personality = AI_PERSONALITIES[match.setup.personality]
  const decision = match.lastAiDecision

  return (
    <section className="glass p-3">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="panel-title !text-fuchsia-300/80">
          <span className="inline-block h-1 w-1 rounded-full bg-fuchsia-300 shadow-glow" />
          AI activity
        </h2>
        <div className="flex gap-1">
          {(['all', 'ai', 'human'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`chip transition-colors ${
                filter === f ? '!border-cyan-300/45 !text-cyan-200' : 'hover:!text-cyan-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {/* ---- what it is doing now ---- */}
      {decision && (
        <div className="mb-2.5 rounded-lg border border-fuchsia-300/25 bg-fuchsia-400/[0.06] p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-fuchsia-300/70">
              {personality.label} AI
            </span>
            {decision.preemptive && (
              <span className="rounded-full bg-amber-300/20 px-2 py-[2px] font-mono text-[8px] uppercase tracking-[0.12em] text-amber-200">
                pre-emptive
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-100">{decision.reason}</p>
          {decision.item && (
            <p className="mt-1 font-mono text-[9.5px] leading-snug text-cyan-200/80">
              → {decision.item.name} · {money(decision.item.capex)}
              {decision.siting && ` · ${decision.siting}`}
            </p>
          )}
        </div>
      )}

      <div ref={ref} className="max-h-[260px] space-y-[5px] overflow-y-auto scroll-thin pr-1">
        {shown.length === 0 && <p className="text-[10px] text-slate-600">Nothing yet.</p>}
        {shown.map((l) => {
          const tone = KIND_TONE[l.kind]
          const tag = SIDE_TAG[l.side]
          return (
            <div key={l.id} className="flex gap-2">
              <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full">
                <span className={`block h-1 w-1 rounded-full ${tone.dot}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`mr-1.5 font-mono text-[8px] uppercase tracking-[0.1em] ${tag.tone}`}>
                  {tag.label}
                </span>
                <span className={`text-[10.5px] leading-snug ${tone.text}`}>{l.text}</span>
                <span className="ml-1.5 font-mono text-[8.5px] text-slate-600">Y{l.year}</span>
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

/**
 * The live leaderboard — the two scores and the components behind them, so it
 * is always obvious *why* one side is ahead.
 */
export function ChallengeLeaderboard() {
  const match = useChallengeStore((s) => s.match)
  if (!match) return null

  const h = match.scores.human
  const a = match.scores.ai
  const personality = AI_PERSONALITIES[match.setup.personality]

  return (
    <section className="glass p-3">
      <header className="mb-2.5">
        <h2 className="panel-title">
          <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
          City challenge
        </h2>
      </header>

      <div className="space-y-1.5">
        {[
          { name: 'Human', score: h.total, tone: 'sky' as const },
          { name: `${personality.label} AI`, score: a.total, tone: 'fuchsia' as const },
        ]
          .sort((x, y) => y.score - x.score)
          .map((row, i) => (
            <div
              key={row.name}
              className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 ${
                i === 0
                  ? 'border-emerald-300/35 bg-emerald-400/[0.07]'
                  : 'border-white/[0.07] bg-white/[0.02]'
              }`}
            >
              <span className="w-3 shrink-0 font-mono text-[11px] text-slate-600">{i + 1}</span>
              <span
                className={`min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-[0.12em] ${
                  row.tone === 'sky' ? 'text-sky-200' : 'text-fuchsia-200'
                }`}
              >
                {row.name}
              </span>
              <span
                className={`shrink-0 font-mono text-[19px] font-bold tabular-nums ${
                  i === 0 ? 'text-emerald-300 text-glow' : 'text-slate-300'
                }`}
              >
                {row.score.toFixed(1)}
              </span>
              {i === 0 && <span className="shrink-0 text-[10px] text-emerald-300">▲</span>}
            </div>
          ))}
      </div>

      {/* ---- component-by-component ---- */}
      <div className="mt-2.5 space-y-1">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 font-mono text-[8px] uppercase tracking-[0.14em] text-slate-600">
          <span>Component</span>
          <span className="text-right text-sky-300/70">You</span>
          <span className="text-right text-fuchsia-300/70">AI</span>
        </div>
        {h.components.map((c, i) => {
          const ai = a.components[i]
          const youWin = c.score > ai.score
          const tie = Math.abs(c.score - ai.score) < 0.5
          return (
            <div key={c.key} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-2" title={c.detail}>
              <span className="truncate text-[10px] text-slate-400">
                {c.label}
                <span className="ml-1 font-mono text-[8px] text-slate-600">
                  ×{c.weight.toFixed(2)}
                </span>
              </span>
              <span
                className={`text-right font-mono text-[10px] tabular-nums ${
                  tie ? 'text-slate-400' : youWin ? 'font-bold text-emerald-300' : 'text-slate-500'
                }`}
              >
                {Math.round(c.score)}
              </span>
              <span
                className={`text-right font-mono text-[10px] tabular-nums ${
                  tie ? 'text-slate-400' : !youWin ? 'font-bold text-emerald-300' : 'text-slate-500'
                }`}
              >
                {Math.round(ai.score)}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */

/**
 * A major AI decision, shown while the match is briefly stopped. The options
 * are the ones it actually simulated, with the real score deltas it measured.
 */
const DECISION_HOLD_MS = 5000

export function DecisionMoment() {
  const match = useChallengeStore((s) => s.match)
  const phase = useChallengeStore((s) => s.phase)
  const resolve = useChallengeStore((s) => s.resolveDecision)
  const tick = match?.pending?.tick ?? -1

  // The match resumes on its own. A decision moment is there to be *seen*,
  // not to demand an answer — the AI has already chosen, and the player
  // should never have to click to stop waiting.
  useEffect(() => {
    if (phase !== 'decision') return
    const t = window.setTimeout(resolve, DECISION_HOLD_MS)
    return () => window.clearTimeout(t)
  }, [phase, tick, resolve])

  if (phase !== 'decision' || !match?.pending) return null
  const d = match.pending
  const personality = AI_PERSONALITIES[match.setup.personality]

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/60 backdrop-blur-sm">
      <div className="w-[min(520px,calc(100%-32px))] animate-riseIn rounded-xl border border-fuchsia-300/35 bg-[#080614]/97 p-4 shadow-glass">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-fuchsia-300/70">
            {personality.label} AI · critical decision
          </span>
          <span className="font-mono text-[9px] tabular-nums text-slate-500">Year {d.year}</span>
        </div>
        <h3 className="mt-1.5 text-[18px] font-semibold uppercase tracking-wide text-white">
          {d.title}
        </h3>
        <p className="mt-1 font-mono text-[10.5px] leading-snug text-slate-400">{d.reading}</p>

        <div className="mt-3 space-y-1.5">
          {d.options.map((o, i) => (
            <div
              key={o.itemId}
              className={`rounded-lg border px-2.5 py-2 ${
                o.chosen
                  ? 'border-fuchsia-300/55 bg-fuchsia-400/[0.1] shadow-glow'
                  : 'border-white/[0.08] bg-white/[0.02]'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[12px] text-slate-100">
                  <span className="mr-1.5 font-mono text-[10px] text-slate-500">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {o.label}
                </span>
                <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-emerald-200">
                  {money(o.capex)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-3 font-mono text-[9.5px] tabular-nums">
                <span className={o.scoreDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                  score {o.scoreDelta >= 0 ? '+' : ''}
                  {o.scoreDelta.toFixed(2)}
                </span>
                <span className={o.healthDelta >= 0 ? 'text-emerald-300/80' : 'text-amber-300'}>
                  health {o.healthDelta >= 0 ? '+' : ''}
                  {o.healthDelta}
                </span>
                <span className="truncate text-slate-500">{o.why}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 rounded-lg border border-fuchsia-300/20 bg-fuchsia-400/[0.05] px-2.5 py-2 text-[11px] leading-relaxed text-fuchsia-100/90">
          {d.chosenReason}
        </p>

        <button
          onClick={resolve}
          className="relative mt-3.5 w-full overflow-hidden rounded-lg border border-cyan-300/55 bg-gradient-to-b from-cyan-400/25 to-cyan-500/10 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-50 shadow-glow transition-all hover:from-cyan-300/40 active:scale-[0.99]"
        >
          Continue the match
          <span
            key={d.tick}
            className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-cyan-200/70"
            style={{ animation: `decisionHold ${DECISION_HOLD_MS}ms linear forwards` }}
          />
        </button>
      </div>
    </div>
  )
}
