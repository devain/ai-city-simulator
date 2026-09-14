import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useChallengeStore } from '../../store/useChallengeStore'
import { analyseMatch } from '../../challenge/ComparisonEngine'
import { AI_PERSONALITIES, PERSONALITY_LIST } from '../../ai/AIPersonality'
import { CHALLENGE_OBJECTIVES, type AIPersonalityId } from '../../challenge/ChallengeConfig'
import { money } from '../../lib/format'

const CHARTS = [
  { key: 'score', label: 'City score', fmt: (v: number) => v.toFixed(1) },
  { key: 'population', label: 'Population', fmt: (v: number) => Math.round(v).toLocaleString('en-US') },
  { key: 'traffic', label: 'Traffic', fmt: (v: number) => `${Math.round(v * 100)}%` },
  { key: 'treasury', label: 'Budget', fmt: (v: number) => money(v) },
  { key: 'co2PerCapita', label: 'CO₂ / resident', fmt: (v: number) => `${Math.round(v / 1000)}t` },
  { key: 'quality', label: 'Quality of life', fmt: (v: number) => String(Math.round(v)) },
  { key: 'health', label: 'City health', fmt: (v: number) => String(Math.round(v)) },
] as const

type ChartKey = (typeof CHARTS)[number]['key']

/**
 * The end of the match: who won, why, the full comparison, and both cities'
 * whole ten years plotted against each other.
 */
export function ChallengeResults() {
  const match = useChallengeStore((s) => s.match)
  const phase = useChallengeStore((s) => s.phase)
  const replay = useChallengeStore((s) => s.replay)
  const rematch = useChallengeStore((s) => s.rematch)
  const abandon = useChallengeStore((s) => s.abandon)
  const open = useChallengeStore((s) => s.open)
  const [chart, setChart] = useState<ChartKey>('score')
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (phase === 'finished') {
      setRevealed(false)
      const t = window.setTimeout(() => setRevealed(true), 1400)
      return () => window.clearTimeout(t)
    }
  }, [phase])

  const result = useMemo(() => (match ? analyseMatch(match) : null), [match])

  const series = useMemo(() => {
    if (!match) return []
    const byTick = new Map<number, Record<string, number>>()
    for (const p of match.human.series) {
      byTick.set(p.tick, { tick: p.tick, year: p.year, [`human_${chart}`]: p[chart] })
    }
    for (const p of match.ai.series) {
      const row = byTick.get(p.tick) ?? { tick: p.tick, year: p.year }
      row[`ai_${chart}`] = p[chart]
      byTick.set(p.tick, row)
    }
    return [...byTick.values()].sort((a, b) => a.tick - b.tick)
  }, [match, chart])

  if (phase !== 'finished' || !match || !result) return null

  const personality = AI_PERSONALITIES[match.setup.personality]
  const fmt = CHARTS.find((c) => c.key === chart)!.fmt

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 overflow-y-auto bg-[#03060d]/97 backdrop-blur-2xl scroll-thin">
      <div className="mx-auto w-[min(1020px,calc(100%-24px))] py-7">
        {/* ---- the reveal ---- */}
        <div className="text-center">
          <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-cyan-300/60">
            {match.setup.years}-year city challenge complete
          </div>
          <h1
            key={String(revealed)}
            className={`mt-3 animate-riseIn font-mono text-[46px] font-bold leading-none tracking-[0.14em] sm:text-[62px] ${
              result.winner === 'ai'
                ? 'text-fuchsia-200'
                : result.winner === 'human'
                  ? 'text-sky-200'
                  : 'text-slate-200'
            } text-glow`}
          >
            {revealed ? result.headline : '…'}
          </h1>
          {revealed && (
            <div className="mt-4 flex animate-riseIn items-end justify-center gap-8">
              <div className="leading-none">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-sky-300/70">
                  Human
                </div>
                <div
                  className={`mt-2 font-mono text-[34px] font-bold tabular-nums ${
                    result.winner === 'human' ? 'text-emerald-300 text-glow' : 'text-slate-400'
                  }`}
                >
                  {match.scores.human.total.toFixed(1)}
                </div>
              </div>
              <div className="pb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-slate-600">
                {result.margin > 0 ? `by ${result.margin}` : 'level'}
              </div>
              <div className="leading-none">
                <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-fuchsia-300/70">
                  {personality.label} AI
                </div>
                <div
                  className={`mt-2 font-mono text-[34px] font-bold tabular-nums ${
                    result.winner === 'ai' ? 'text-emerald-300 text-glow' : 'text-slate-400'
                  }`}
                >
                  {match.scores.ai.total.toFixed(1)}
                </div>
              </div>
            </div>
          )}
        </div>

        {revealed && (
          <div className="mt-6 animate-riseIn space-y-3">
            {/* ---- why ---- */}
            <section className="glass-strong p-4">
              <h2 className="panel-title mb-2">
                <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
                Why {result.winner === 'draw' ? 'it was a draw' : `${result.winner === 'ai' ? 'the AI' : 'you'} won`}
              </h2>
              <p className="text-[13px] leading-relaxed text-slate-200">{result.summary}</p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1.5 font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
                    Decisive components
                  </div>
                  <div className="space-y-1">
                    {result.factors.map((f) => (
                      <div key={f.label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[11px] text-slate-200">{f.label}</span>
                          <span
                            className={`font-mono text-[10px] tabular-nums ${
                              Math.abs(f.swing) < 0.05 ? 'text-slate-500' : 'text-emerald-300'
                            }`}
                          >
                            {f.swing > 0 ? '+' : ''}
                            {f.swing.toFixed(2)} pts
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-[9.5px] text-slate-500">{f.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
                    Top 3 decisions
                  </div>
                  <ol className="space-y-1">
                    {result.topDecisions.map((d, i) => (
                      <li
                        key={i}
                        className="flex gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5"
                      >
                        <span className="font-mono text-[11px] text-cyan-300/70">{i + 1}</span>
                        <span className="text-[10.5px] leading-snug text-slate-300">{d}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </section>

            {/* ---- charts ---- */}
            <section className="glass-strong p-4">
              <header className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="panel-title">
                  <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
                  Ten years, side by side
                </h2>
                <div className="flex flex-wrap gap-1">
                  {CHARTS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setChart(c.key)}
                      className={`rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-all ${
                        chart === c.key
                          ? 'bg-cyan-300/20 text-white ring-1 ring-cyan-300/40'
                          : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </header>
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 6, right: 10, bottom: 0, left: 2 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 9, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      width={46}
                      tickFormatter={(v) => fmt(Number(v))}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#070d1a',
                        border: '1px solid rgba(94,240,255,0.25)',
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                      labelFormatter={(v) => `Year ${v}`}
                      formatter={(v: number, name: string) => [
                        fmt(v),
                        name.startsWith('human') ? 'Human' : 'AI',
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey={`human_${chart}`}
                      stroke="#7dd3fc"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey={`ai_${chart}`}
                      stroke="#f0abfc"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 flex justify-center gap-4 font-mono text-[9px] uppercase tracking-[0.14em]">
                <span className="text-sky-300">▬ Human</span>
                <span className="text-fuchsia-300">▬ {personality.label} AI</span>
              </div>
            </section>

            {/* ---- the full table ---- */}
            <section className="glass-strong p-4">
              <h2 className="panel-title mb-2.5">
                <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
                Final comparison
              </h2>
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-slate-600" />
                <span className="text-right font-mono text-[8.5px] uppercase tracking-[0.16em] text-sky-300/70">
                  Human
                </span>
                <span className="text-right font-mono text-[8.5px] uppercase tracking-[0.16em] text-fuchsia-300/70">
                  AI
                </span>
                {result.rows.map((r) => (
                  <div key={r.label} className="contents">
                    <span className="truncate text-[11px] text-slate-400">{r.label}</span>
                    <span
                      className={`text-right font-mono text-[11px] tabular-nums ${
                        r.winner === 'human' ? 'font-bold text-emerald-300' : 'text-slate-300'
                      }`}
                    >
                      {r.human}
                    </span>
                    <span
                      className={`text-right font-mono text-[11px] tabular-nums ${
                        r.winner === 'ai' ? 'font-bold text-emerald-300' : 'text-slate-300'
                      }`}
                    >
                      {r.ai}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 font-mono text-[9px] text-slate-600">
                Objective: {CHALLENGE_OBJECTIVES[match.setup.objective].label} · seed{' '}
                {match.setup.seedLabel} ({match.setup.seed}) · both cities started from the identical
                snapshot
              </p>
            </section>

            {/* ---- what next ---- */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={replay}
                className="flex-1 rounded-xl border border-cyan-300/55 bg-gradient-to-b from-cyan-400/25 to-cyan-500/10 px-4 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-50 shadow-glow transition-all hover:from-cyan-300/40"
                title="Same seed, same events, same starting city"
              >
                Replay challenge
              </button>
              <div className="flex flex-1 flex-wrap gap-1">
                {PERSONALITY_LIST.filter((p) => p.id !== match.setup.personality).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => rematch(p.id as AIPersonalityId)}
                    className="flex-1 rounded-xl border border-fuchsia-300/40 bg-fuchsia-400/10 px-2.5 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-fuchsia-100 transition-all hover:bg-fuchsia-400/20"
                    title={`Rematch on the same city against the ${p.label} AI`}
                  >
                    vs {p.label}
                  </button>
                ))}
              </div>
              <button
                onClick={open}
                className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
              >
                New setup
              </button>
              <button
                onClick={abandon}
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
