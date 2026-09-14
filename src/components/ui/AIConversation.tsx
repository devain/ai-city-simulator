import { useEffect, useRef } from 'react'
import { useOptimizerStore } from '../../store/useOptimizerStore'
import { describeConstraint } from '../../ai/nlu/constraints'
import { INFRA } from '../../city/infrastructure'
import type { AITurn } from '../../ai/nlu/types'

const STATUS_STYLE: Record<AITurn['status'], { dot: string; label: string }> = {
  understood: { dot: 'bg-sky-300', label: 'understood' },
  planning: { dot: 'bg-cyan-300 animate-pulseGlow', label: 'planning' },
  executing: { dot: 'bg-fuchsia-300 animate-pulseGlow', label: 'building' },
  done: { dot: 'bg-emerald-400', label: 'complete' },
  answered: { dot: 'bg-slate-400', label: 'answered' },
  rejected: { dot: 'bg-rose-400', label: 'rejected' },
}

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

/**
 * The conversation half of the command center: what the AI understood, what it
 * did about it, and what you might say next. Deliberately terse — it reports
 * decisions and outcomes, never invented reasoning.
 */
export function AIConversation() {
  const turns = useOptimizerStore((s) => s.turns)
  const thinking = useOptimizerStore((s) => s.thinking)
  const understanding = useOptimizerStore((s) => s.understanding)
  const suggestions = useOptimizerStore((s) => s.suggestions)
  const ask = useOptimizerStore((s) => s.ask)
  const clear = useOptimizerStore((s) => s.clearConversation)
  const providerId = 'local-deterministic-v1'

  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = endRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns.length, thinking])

  return (
    <Section
      title="AI command center"
      right={
        <div className="flex items-center gap-1.5">
          <span className="chip" title={`Understanding provider: ${providerId}`}>
            local NLU
          </span>
          {turns.length > 0 && (
            <button className="chip hover:!text-cyan-200" onClick={clear}>
              clear
            </button>
          )}
        </div>
      }
    >
      {/* what the AI read out of the last request */}
      {understanding && (
        <div className="mb-2.5 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300/80">
              I understand
            </span>
            <span className="font-mono text-[9px] tabular-nums text-slate-500">
              planning confidence {(understanding.parseConfidence * 100).toFixed(0)}%
            </span>
          </div>

          <dl className="mt-1.5 space-y-1">
            <Row label="Goal" value={understanding.kind.replace(/_/g, ' ')} />
            {understanding.targetPopulationIncrease != null && (
              <Row
                label="Target"
                value={`+${understanding.targetPopulationIncrease.toLocaleString('en-US')} residents`}
              />
            )}
            {understanding.budget != null && (
              <Row label="Budget" value={`$${(understanding.budget / 1e6).toFixed(0)}M`} />
            )}
            {understanding.buildKind && (
              <Row
                label="Build"
                value={`${understanding.buildCount ?? 1} × ${INFRA[understanding.buildKind].name}`}
              />
            )}
            {understanding.location.kind !== 'auto' && (
              <Row label="Location" value={understanding.location.label} />
            )}
            {understanding.constraints.map((c) => (
              <Row key={c.metric + c.op} label="Constraint" value={describeConstraint(c)} tone="text-amber-200" />
            ))}
            {understanding.language === 'vi' && <Row label="Language" value="Tiếng Việt" />}
          </dl>
        </div>
      )}

      {/* the transcript */}
      <div ref={endRef} className="max-h-[286px] space-y-2 overflow-y-auto scroll-thin pr-1">
        {turns.length === 0 && !thinking && (
          <p className="text-[11px] leading-relaxed text-slate-500">
            Talk to the city. Ask it to grow, to fix traffic, to build something specific — or just
            ask how it is doing. Every request is parsed into an objective, planned against the live
            simulation and, where appropriate, built.
          </p>
        )}

        {turns.map((t) => {
          const st = STATUS_STYLE[t.status]
          return (
            <div key={t.id} className="animate-riseIn">
              {/* the request */}
              <div className="ml-5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
                <p className="text-[11.5px] leading-snug text-slate-200">{t.request}</p>
                <span className="font-mono text-[8.5px] text-slate-600">{t.time}</span>
              </div>

              {/* the response */}
              <div className="mr-3 mt-1 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.045] px-2.5 py-2">
                <div className="mb-1 flex items-center justify-between font-mono text-[8.5px] uppercase tracking-[0.18em]">
                  <span className="text-cyan-300/70">City AI</span>
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed text-slate-300">{t.understanding}</p>

                {t.action.type === 'answer' && (
                  <>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-slate-200">
                      {t.action.text}
                    </p>
                    {t.action.bullets.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 border-l border-cyan-300/20 pl-2">
                        {t.action.bullets.map((b, i) => (
                          <li key={i} className="font-mono text-[9.5px] leading-snug text-slate-400">
                            {b}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {t.action.type === 'build' && (
                  <p className="mt-1 font-mono text-[9.5px] leading-snug text-cyan-200/80">
                    Site: {t.action.location.label} — {t.action.location.reason}
                  </p>
                )}

                {t.outcome && t.action.type !== 'answer' && (
                  <p
                    className={`mt-1.5 font-mono text-[9.5px] leading-snug ${
                      t.status === 'rejected' ? 'text-rose-300' : 'text-emerald-300/90'
                    }`}
                  >
                    {t.outcome}
                  </p>
                )}
              </div>
            </div>
          )
        })}

        {thinking && (
          <div className="mr-3 flex items-center gap-1.5 rounded-lg border border-cyan-300/15 bg-cyan-300/[0.045] px-2.5 py-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-cyan-300"
                style={{ animation: `pulseGlow 1s ${i * 0.15}s ease-in-out infinite` }}
              />
            ))}
            <span className="font-mono text-[9px] tracking-[0.16em] text-cyan-300/70">
              understanding request
            </span>
          </div>
        )}
      </div>

      {/* what to say next */}
      <div className="mt-2.5">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
          Suggested next
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => void ask(s)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-[3px] text-[10px] text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </Section>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className={`truncate text-right text-[11px] ${tone ?? 'text-slate-200'}`}>{value}</dd>
    </div>
  )
}
