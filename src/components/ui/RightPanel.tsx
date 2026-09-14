import { useEffect, useRef, useState } from 'react'
import { useCityStore } from '../../store/useCityStore'
import { MetricTile } from './MetricTile'
import { OptimizationPanel } from './OptimizationPanel'
import { AIConversation } from './AIConversation'
import { AIAdvisorPanel } from './AIAdvisorPanel'
import { AIControlPanel } from './AIControlPanel'
import { ChallengeActivityLog, ChallengeLeaderboard } from './ChallengePanels'
import { useChallengeStore } from '../../store/useChallengeStore'
import { PRESSURE_COLORS, PRESSURE_TEXT, heatCss } from '../../lib/colors'
import type { MetricKey } from '../../simulation/types'

const TILES: MetricKey[] = [
  'population',
  'traffic',
  'electricity',
  'water',
  'retail',
  'education',
  'parking',
  'transit',
  'emissions',
  'cost',
]

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass p-3">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="panel-title">
          <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
          {title}
        </h2>
        {right}
      </header>
      {children}
    </section>
  )
}

/** reveals the analyst narrative one character at a time after a run */
function Typewriter({ text, speed = 11 }: { text: string; speed?: number }) {
  const [n, setN] = useState(text.length)
  useEffect(() => {
    setN(0)
    let i = 0
    const id = setInterval(() => {
      i += 3
      setN(i)
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text, speed])
  return (
    <p className="text-[11.5px] leading-relaxed text-slate-300">
      {text.slice(0, n)}
      {n < text.length && <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulseGlow bg-cyan-300 align-middle" />}
    </p>
  )
}

function ConfidenceRing({ value }: { value: number }) {
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid h-10 w-10 place-items-center">
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={heatCss(1 - value)}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${c * value} ${c}`}
          style={{ transition: 'stroke-dasharray 600ms ease' }}
        />
      </svg>
      <span className="font-mono text-[9px] font-semibold tabular-nums text-slate-200">
        {Math.round(value * 100)}
      </span>
    </div>
  )
}

export function RightPanel() {
  const challengePhase = useChallengeStore((st) => st.phase)
  const inMatch = challengePhase === 'running' || challengePhase === 'paused' || challengePhase === 'decision'

  const analysis = useCityStore((s) => s.analysis)
  const applyRecommendation = useCityStore((s) => s.applyRecommendation)
  const isRunning = useCityStore((s) => s.isRunning)

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto scroll-thin p-2.5">
      {/* Phase 6 — during a match the scoreboard and the AI's log come first */}
      {inMatch && <ChallengeLeaderboard />}
      {inMatch && <ChallengeActivityLog />}

      {/* Phase 5 — whichever of these is showing tells you who is in control */}
      <AIControlPanel />
      <AIAdvisorPanel />

      <AIConversation />

      <OptimizationPanel />

      <Section
        title="AI city analyst"
        right={
          <div className="flex items-center gap-2">
            <span className="chip">{isRunning ? 'analysing' : 'ready'}</span>
            <ConfidenceRing value={analysis.confidence} />
          </div>
        }
      >
        <div className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-2.5">
          <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300/80">
            Assessment
          </div>
          <Typewriter text={analysis.summary} />
        </div>

        {analysis.problems.length > 0 && (
          <ul className="mt-2.5 space-y-1.5">
            {analysis.problems.map((p) => (
              <li
                key={p.id}
                className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
              >
                <span
                  className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background: PRESSURE_COLORS[p.severity],
                    boxShadow: `0 0 10px ${PRESSURE_COLORS[p.severity]}`,
                  }}
                />
                <div className="min-w-0">
                  <div className={`text-[11px] font-medium ${PRESSURE_TEXT[p.severity]}`}>
                    {p.title}
                  </div>
                  <div className="font-mono text-[9.5px] leading-snug text-slate-500">{p.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recommended interventions">
        <ol className="space-y-1.5">
          {analysis.recommendations.map((r, i) => (
            <li
              key={r.id}
              className="group rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 transition-colors hover:border-cyan-300/25"
            >
              <div className="flex items-start gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/10 font-mono text-[10px] text-cyan-200">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11.5px] font-medium text-slate-100">{r.title}</div>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{r.detail}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="chip !text-emerald-300/90">{r.impact}</span>
                    {r.action && (
                      <button
                        className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2 py-[3px] font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-100 transition-colors hover:bg-cyan-300/20"
                        onClick={() => applyRecommendation(r.id)}
                      >
                        apply
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Live metrics">
        <div className="grid grid-cols-2 gap-1.5">
          {TILES.map((k) => (
            <MetricTile key={k} metricKey={k} />
          ))}
        </div>
      </Section>

      <Section title="Affected areas">
        <div className="space-y-1.5">
          {analysis.affectedAreas.slice(0, 5).map((a) => (
            <div key={a.district} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate font-mono text-[10px] text-slate-300">
                {a.name}
              </span>
              <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, a.score * 118)}%`,
                    background: heatCss(a.score),
                    boxShadow: `0 0 10px ${heatCss(a.score)}`,
                  }}
                />
              </div>
              <span className="w-8 shrink-0 text-right font-mono text-[9px] tabular-nums text-slate-500">
                {(a.score * 100).toFixed(0)}
              </span>
            </div>
          ))}
          <p className="pt-1 font-mono text-[9px] text-slate-600">
            Driven by {analysis.affectedAreas[0]?.reason}
          </p>
        </div>
      </Section>

      <AnalystChat />
    </div>
  )
}

const SUGGESTIONS = [
  'What happens if I add 3,000 residents?',
  'Where should I build a new school?',
  'Which road is likely to become congested?',
  'What should I build next?',
]

function AnalystChat() {
  const chat = useCityStore((s) => s.chat)
  const ask = useCityStore((s) => s.askAnalyst)
  const thinking = useCityStore((s) => s.analystThinking)
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.length, thinking])

  const send = (q: string) => {
    ask(q)
    setText('')
  }

  return (
    <Section title="Ask the analyst">
      <div ref={listRef} className="max-h-[300px] space-y-2 overflow-y-auto scroll-thin pr-1">
        {chat.map((m) => (
          <div
            key={m.id}
            className={`animate-riseIn rounded-lg px-2.5 py-2 text-[11px] leading-relaxed ${
              m.role === 'user'
                ? 'ml-6 border border-white/10 bg-white/[0.05] text-slate-200'
                : 'mr-2 border border-cyan-300/15 bg-cyan-300/[0.045] text-slate-300'
            }`}
          >
            {m.role === 'analyst' && (
              <div className="mb-1 flex items-center justify-between font-mono text-[8.5px] uppercase tracking-[0.18em] text-cyan-300/70">
                <span>AI analyst</span>
                {m.confidence !== undefined && (
                  <span className="tabular-nums">confidence {(m.confidence * 100).toFixed(0)}%</span>
                )}
              </div>
            )}
            <p>{m.text}</p>
            {m.bullets && m.bullets.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 border-l border-cyan-300/20 pl-2">
                {m.bullets.map((b, i) => (
                  <li key={i} className="font-mono text-[9.5px] leading-snug text-slate-400">
                    {b}
                  </li>
                ))}
              </ul>
            )}
            {m.followUps && m.followUps.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {m.followUps.map((f) => (
                  <button key={f} className="chip hover:!text-cyan-200" onClick={() => send(f)}>
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div className="mr-2 flex items-center gap-1.5 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.045] px-2.5 py-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-cyan-300"
                style={{ animation: `pulseGlow 1s ${i * 0.15}s ease-in-out infinite` }}
              />
            ))}
            <span className="font-mono text-[9px] tracking-[0.16em] text-cyan-300/70">
              reasoning over simulation state
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip hover:!text-cyan-200" onClick={() => send(s)}>
            {s}
          </button>
        ))}
      </div>

      <form
        className="mt-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) send(text)
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask about growth, capacity or bottlenecks…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-300/40"
        />
        <button type="submit" className="btn !px-3">
          Ask
        </button>
      </form>
    </Section>
  )
}
