import { useOptimizerStore } from '../../store/useOptimizerStore'
import { PRESSURE_COLORS } from '../../lib/colors'
import { money } from '../../lib/format'
import { ExecutionPanel } from './ExecutionPanel'
import type { AiEvent, OptimizerPhase } from '../../ai/types'

const PHASES: { id: OptimizerPhase; label: string }[] = [
  { id: 'analyzing', label: 'Analyze' },
  { id: 'planning', label: 'Plan' },
  { id: 'simulating', label: 'Simulate' },
  { id: 'deciding', label: 'Decide' },
  { id: 'building', label: 'Build' },
  { id: 'resimulating', label: 'Verify' },
  { id: 'complete', label: 'Done' },
]

const ORDER: OptimizerPhase[] = [
  'idle',
  'analyzing',
  'planning',
  'simulating',
  'deciding',
  'review',
  'building',
  'resimulating',
  'complete',
]

const EVENT_COLOUR: Record<AiEvent['kind'], string> = {
  scan: '#60a5fa',
  detect: '#fbbf24',
  plan: '#c084fc',
  sim: '#38bdf8',
  decide: '#34d399',
  build: '#f472b6',
  done: '#34d399',
  warn: '#fb7185',
}

const STATUS_COLOUR: Record<string, string> = {
  NOMINAL: '#34d399',
  WATCH: '#38bdf8',
  STRAINED: '#fbbf24',
  CRITICAL: '#fb5e6d',
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

export function OptimizationPanel() {
  const phase = useOptimizerStore((s) => s.phase)
  const statusLine = useOptimizerStore((s) => s.statusLine)
  const diagnosis = useOptimizerStore((s) => s.diagnosis)
  const plans = useOptimizerStore((s) => s.plans)
  const decision = useOptimizerStore((s) => s.decision)
  const simulatingIndex = useOptimizerStore((s) => s.simulatingIndex)
  const objective = useOptimizerStore((s) => s.objective)
  const budget = useOptimizerStore((s) => s.budget)
  const aiEvents = useOptimizerStore((s) => s.aiEvents)
  const report = useOptimizerStore((s) => s.report)
  const setReportOpen = useOptimizerStore.setState
  const executePlan = useOptimizerStore((s) => s.executePlan)
  const autoMode = useOptimizerStore((s) => s.autoMode)

  const idx = ORDER.indexOf(phase)
  const busy = phase !== 'idle' && phase !== 'complete'

  return (
    <Section
      title="AI city optimizer"
      right={
        <div className="flex items-center gap-1.5">
          {autoMode && <span className="chip !text-fuchsia-200">auto</span>}
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2 py-[3px] font-mono text-[8.5px] uppercase tracking-[0.16em] ${
              busy
                ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
                : 'border-white/10 bg-white/[0.03] text-slate-400'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${busy ? 'animate-pulseGlow bg-cyan-300' : 'bg-emerald-400'}`}
            />
            {phase === 'idle' ? 'ready' : phase}
          </span>
        </div>
      }
    >
      {/* pipeline */}
      <div className="mb-2.5 flex items-center gap-[3px]">
        {PHASES.map((p) => {
          const pos = ORDER.indexOf(p.id)
          const done = idx > pos
          const active = phase === p.id
          return (
            <div key={p.id} className="flex-1">
              <div
                className={`h-[3px] rounded-full transition-all duration-500 ${
                  active
                    ? 'bg-cyan-300 shadow-glow'
                    : done
                      ? 'bg-cyan-400/45'
                      : 'bg-white/10'
                }`}
              />
              <div
                className={`mt-1 truncate font-mono text-[7.5px] uppercase tracking-[0.1em] ${
                  active ? 'text-cyan-200' : done ? 'text-slate-500' : 'text-slate-600'
                }`}
              >
                {p.label}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.04] p-2.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300/80">
            Status
          </span>
          <span className="font-mono text-[9px] text-slate-500">{objective.short} · {money(budget)}</span>
        </div>
        <p className="mt-1 flex items-center gap-2 text-[12px] font-medium text-slate-100">
          {busy && <span className="h-1.5 w-1.5 animate-pulseGlow rounded-full bg-cyan-300" />}
          {statusLine}
        </p>
        {objective.populationTarget && (
          <p className="mt-1 font-mono text-[9.5px] text-cyan-200/80">
            Target: +{objective.populationTarget.toLocaleString('en-US')} residents
          </p>
        )}
      </div>

      <ExecutionPanel />

      {/* detected bottlenecks */}
      {diagnosis && (
        <div className="mt-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
              Detected
            </span>
            <span
              className="rounded-full px-1.5 py-[2px] font-mono text-[8px] font-bold tracking-[0.14em]"
              style={{
                color: STATUS_COLOUR[diagnosis.status],
                background: `${STATUS_COLOUR[diagnosis.status]}18`,
              }}
            >
              {diagnosis.status}
            </span>
          </div>
          {diagnosis.bottlenecks.length === 0 ? (
            <p className="text-[11px] text-slate-400">No system is past its planning threshold.</p>
          ) : (
            <ol className="space-y-1">
              {diagnosis.bottlenecks.slice(0, 4).map((b, i) => (
                <li key={b.metric} className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-slate-600">{i + 1}</span>
                  <span className="w-[86px] shrink-0 truncate text-[11px] text-slate-200">
                    {b.label}
                  </span>
                  <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, b.utilisation * 100)}%`,
                        background: PRESSURE_COLORS[b.pressure],
                        boxShadow: `0 0 8px ${PRESSURE_COLORS[b.pressure]}`,
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right font-mono text-[9px] tabular-nums text-slate-400">
                    {(b.utilisation * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-1.5 font-mono text-[9px] text-slate-500">
            Headroom: {diagnosis.headroom.toLocaleString('en-US')} more residents
            {diagnosis.bindingConstraint ? ` · limited by ${diagnosis.bindingConstraint}` : ''}
          </p>
        </div>
      )}

      {/* candidate plans */}
      {plans.length > 0 && (
        <div className="mt-2.5">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
            Candidate plans
          </span>
          <ul className="mt-1.5 space-y-1">
            {plans.map((p, i) => {
              const rec = decision?.recommended?.id === p.id
              return (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                    rec
                      ? 'border-cyan-300/45 bg-cyan-300/[0.08]'
                      : simulatingIndex === i
                        ? 'border-cyan-300/30 bg-white/[0.04]'
                        : 'border-white/[0.06] bg-white/[0.02]'
                  }`}
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/10 font-mono text-[9px] text-cyan-200">
                    {p.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-slate-200">{p.name}</span>
                  <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-slate-400">
                    ${(p.capex / 1e6).toFixed(1)}M
                  </span>
                  <span
                    className="w-7 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums"
                    style={{ color: p.score >= 70 ? '#34d399' : p.score >= 50 ? '#fbbf24' : '#fb7185' }}
                  >
                    {simulatingIndex === i ? '…' : p.score}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* recommendation */}
      {phase !== 'idle' && decision?.recommended && (
        <div className="mt-2.5 rounded-lg border border-cyan-300/30 bg-cyan-300/[0.06] p-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-cyan-300/80">
              Recommendation
            </span>
            <span className="font-mono text-[9px] tabular-nums text-slate-400">
              confidence {(decision.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <p className="mt-1 text-[12.5px] font-semibold text-white">
            Plan {decision.recommended.code} — {decision.recommended.name}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{decision.why}</p>
          {decision.notes.map((n) => (
            <p key={n} className="mt-1 font-mono text-[9px] leading-snug text-amber-200/80">
              ⚠ {n}
            </p>
          ))}
          <ul className="mt-1.5 space-y-0.5 border-l border-cyan-300/20 pl-2">
            {decision.recommended.reasons.map((r, i) => (
              <li key={i} className="font-mono text-[9.5px] leading-snug text-slate-400">
                {r}
              </li>
            ))}
          </ul>
          {phase === 'review' && (
            <button
              onClick={() => executePlan(decision.recommended!.id)}
              className="btn-primary mt-2 w-full !py-2 !text-[10px]"
            >
              Execute Plan {decision.recommended.code}
            </button>
          )}
          {phase === 'complete' && report && (
            <button
              onClick={() => setReportOpen({ reportOpen: true })}
              className="btn mt-2 w-full"
            >
              Show before / after
            </button>
          )}
        </div>
      )}

      {/* AI event timeline */}
      {aiEvents.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
              AI event log
            </span>
            <span className="chip">{aiEvents.length}</span>
          </div>
          <ul className="max-h-[168px] space-y-[3px] overflow-y-auto scroll-thin pr-1">
            {aiEvents.map((e) => (
              <li key={e.id} className="flex animate-riseIn items-start gap-2">
                <span className="shrink-0 font-mono text-[9px] tabular-nums text-slate-600">
                  {e.time}
                </span>
                <span
                  className="mt-[5px] h-1 w-1 shrink-0 rounded-full"
                  style={{ background: EVENT_COLOUR[e.kind], boxShadow: `0 0 8px ${EVENT_COLOUR[e.kind]}` }}
                />
                <span className="min-w-0 font-mono text-[9.5px] leading-snug text-slate-400">
                  {e.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}
