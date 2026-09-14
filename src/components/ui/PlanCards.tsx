import { useOptimizerStore } from '../../store/useOptimizerStore'
import { INFRA } from '../../city/infrastructure'
import { signedPct } from '../../lib/format'
import type { CityPlan } from '../../ai/types'

function scoreColour(score: number) {
  if (score >= 70) return '#34d399'
  if (score >= 50) return '#fbbf24'
  return '#fb7185'
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-0.5 font-mono text-[13px] font-semibold tabular-nums ${tone ?? 'text-slate-100'}`}>
        {value}
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  recommended,
  testing,
  selected,
  onSelect,
  onExecute,
}: {
  plan: CityPlan
  recommended: boolean
  testing: boolean
  selected: boolean
  onSelect: () => void
  onExecute: () => void
}) {
  const o = plan.outcome
  return (
    <div
      onClick={onSelect}
      className={`group relative w-[224px] shrink-0 cursor-pointer overflow-hidden rounded-xl border p-3 backdrop-blur-xl transition-all duration-300 ${
        recommended
          ? 'border-cyan-300/60 bg-cyan-300/[0.07] shadow-glow'
          : selected
            ? 'border-white/25 bg-white/[0.05]'
            : 'border-white/10 bg-[#070d1a]/85 hover:border-white/25'
      } ${testing ? 'ring-1 ring-cyan-300/70' : ''}`}
    >
      {testing && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden">
          <span className="block h-full w-1/3 animate-sweep bg-cyan-300" />
        </span>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/70">
            Plan {plan.code}
          </div>
          <h4 className="mt-0.5 text-[12.5px] font-semibold leading-tight text-white">{plan.name}</h4>
        </div>
        <div className="shrink-0 text-right">
          <div
            className="font-mono text-[20px] font-bold leading-none tabular-nums"
            style={{ color: scoreColour(plan.score) }}
          >
            {plan.score}
          </div>
          <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">score</div>
        </div>
      </div>

      {recommended && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-cyan-300/50 bg-cyan-300/15 px-2 py-[2px] font-mono text-[8px] font-bold uppercase tracking-[0.18em] text-cyan-100">
          ★ Recommended
        </div>
      )}
      {!plan.withinBudget && (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-rose-400/50 bg-rose-400/15 px-2 py-[2px] font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-rose-200">
          over budget
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-2">
        <Stat label="Cost" value={`$${(plan.capex / 1e6).toFixed(1)}M`} />
        <Stat
          label="Capacity"
          value={`${o.capacityGain >= 0 ? '+' : ''}${o.capacityGain.toLocaleString('en-US')}`}
          tone={o.capacityGain > 0 ? 'text-emerald-300' : 'text-slate-400'}
        />
        <Stat
          label="Traffic"
          value={signedPct(o.traffic, 0)}
          tone={o.traffic < -0.5 ? 'text-emerald-300' : o.traffic > 0.5 ? 'text-rose-300' : 'text-slate-400'}
        />
        <Stat
          label="Build time"
          value={`${(plan.buildMs / 1000).toFixed(0)}s`}
          tone="text-slate-300"
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {plan.steps.slice(0, 4).map((s) => (
          <span
            key={s.id}
            className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-[2px] font-mono text-[8.5px] text-slate-400"
            title={s.detail}
          >
            {INFRA[s.kind].icon} {s.count > 1 ? `${s.count}×` : ''}
            {INFRA[s.kind].name}
          </span>
        ))}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onExecute()
        }}
        className={`mt-2.5 w-full rounded-lg border px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-all active:scale-[0.98] ${
          recommended
            ? 'border-cyan-300/60 bg-cyan-300/20 text-cyan-50 hover:bg-cyan-300/30'
            : 'border-white/15 bg-white/[0.04] text-slate-300 hover:border-cyan-300/40 hover:text-white'
        }`}
      >
        {recommended ? 'Execute' : 'Build this'}
      </button>
    </div>
  )
}

export function PlanCards() {
  const phase = useOptimizerStore((s) => s.phase)
  const plans = useOptimizerStore((s) => s.plans)
  const decision = useOptimizerStore((s) => s.decision)
  const simulatingIndex = useOptimizerStore((s) => s.simulatingIndex)
  const selectedPlanId = useOptimizerStore((s) => s.selectedPlanId)
  const selectPlan = useOptimizerStore((s) => s.selectPlan)
  const executePlan = useOptimizerStore((s) => s.executePlan)

  const visible =
    (phase === 'simulating' || phase === 'deciding' || phase === 'review') && plans.length > 0
  if (!visible) return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[150px] z-20 flex flex-col items-center gap-2 px-3">
      <div className="pointer-events-auto flex max-w-full items-stretch gap-2 overflow-x-auto scroll-thin pb-1">
        {plans.map((p, i) => (
          <div key={p.id} className="animate-riseIn" style={{ animationDelay: `${i * 70}ms` }}>
            <PlanCard
              plan={p}
              recommended={phase === 'review' && decision?.recommended?.id === p.id}
              testing={simulatingIndex === i}
              selected={selectedPlanId === p.id}
              onSelect={() => selectPlan(p.id)}
              onExecute={() => executePlan(p.id)}
            />
          </div>
        ))}
      </div>
      {phase === 'review' && decision?.recommended && (
        <div className="pointer-events-auto max-w-[720px] animate-riseIn rounded-lg border border-cyan-300/25 bg-[#050b16]/90 px-3 py-2 text-center backdrop-blur-xl">
          <p className="text-[11.5px] leading-relaxed text-slate-300">
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300/80">
              Why
            </span>{' '}
            {decision.why}
          </p>
        </div>
      )}
    </div>
  )
}
