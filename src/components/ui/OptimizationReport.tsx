import { useOptimizerStore } from '../../store/useOptimizerStore'
import { money } from '../../lib/format'
import { INFRA } from '../../city/infrastructure'
import { AnimatedNumber } from './AnimatedNumber'
import type { ComparisonRow } from '../../ai/types'

function fmtNumber(row: ComparisonRow, v: number) {
  if (row.key === 'population') return Math.round(v).toLocaleString('en-US')
  if (row.key === 'livability') return v.toFixed(0)
  if (row.key === 'economy') return money(v)
  return `${v.toFixed(0)}%`
}

function fmtValue(row: ComparisonRow, which: 'before' | 'after') {
  return fmtNumber(row, which === 'before' ? row.beforePct : row.afterPct)
}

function Delta({ row }: { row: ComparisonRow }) {
  const improved = row.lowerIsBetter ? row.changePct < -0.05 : row.changePct > 0.05
  const worsened = row.lowerIsBetter ? row.changePct > 0.05 : row.changePct < -0.05
  const flat = !improved && !worsened
  const arrow = row.changePct > 0.05 ? '↑' : row.changePct < -0.05 ? '↓' : '–'
  const colour = flat ? 'text-slate-500' : improved ? 'text-emerald-300' : 'text-rose-300'
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold tabular-nums ${colour}`}>
      <span className="text-[12px]">{arrow}</span>
      {flat ? (
        '—'
      ) : (
        <AnimatedNumber
          value={row.changePct}
          duration={1300}
          format={(n) => `${n > 0 ? '+' : ''}${n.toFixed(0)}%`}
        />
      )}
    </span>
  )
}

export function OptimizationReport() {
  const open = useOptimizerStore((s) => s.reportOpen)
  const report = useOptimizerStore((s) => s.report)
  const close = useOptimizerStore((s) => s.closeReport)
  const plans = useOptimizerStore((s) => s.plans)
  const focusCity = useOptimizerStore((s) => s.focusCity)

  if (!open || !report) return null
  const plan = plans.find((p) => p.id === report.planId)

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#02040a]/70 backdrop-blur-[3px]"
        onClick={close}
      />
      <div className="relative z-10 max-h-full w-full max-w-[680px] animate-riseIn overflow-y-auto scroll-thin rounded-2xl border border-cyan-300/25 bg-[#050b16]/95 p-4 shadow-glass backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-cyan-300/80">
              Optimization complete
            </div>
            <h3 className="mt-1 text-[17px] font-bold text-white text-glow">{report.planName}</h3>
            <p className="mt-0.5 font-mono text-[10px] text-slate-500">
              {plan?.steps.map((s) => `${s.count}× ${INFRA[s.kind].name}`).join(' · ')}
            </p>
          </div>
          <button className="btn !px-2 !py-1" onClick={close}>
            Close
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {report.headline.map((h) => (
            <span
              key={h}
              className="rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-cyan-100"
            >
              {h}
            </span>
          ))}
          <span className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-emerald-200">
            {money(report.spend)} committed
          </span>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 gap-y-0">
          <div className="col-span-4 grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-b border-white/10 pb-1.5 font-mono text-[8.5px] uppercase tracking-[0.18em] text-slate-500">
            <span>Metric</span>
            <span className="w-[72px] text-right">Before</span>
            <span className="w-[72px] text-right">After</span>
            <span className="w-[64px] text-right">Change</span>
          </div>

          {report.rows.map((row, i) => {
            const improved = row.lowerIsBetter ? row.changePct < -0.05 : row.changePct > 0.05
            return (
              <div
                key={row.key + row.label}
                className="col-span-4 grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 border-b border-white/[0.05] py-1.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-[11.5px] text-slate-200">{row.label}</div>
                  <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(100, Math.max(2, row.key === 'population' || row.key === 'economy' ? 60 : row.afterPct))}%`,
                        background: improved ? '#34d399' : row.changePct === 0 ? '#64748b' : '#fb7185',
                        boxShadow: `0 0 8px ${improved ? '#34d39988' : '#fb718588'}`,
                      }}
                    />
                  </div>
                </div>
                <span className="w-[72px] text-right font-mono text-[11.5px] tabular-nums text-slate-500">
                  {fmtValue(row, 'before')}
                </span>
                <AnimatedNumber
                  className="w-[72px] text-right font-mono text-[11.5px] font-semibold tabular-nums text-white"
                  value={row.afterPct}
                  duration={1300}
                  delay={i * 90}
                  format={(n) => fmtNumber(row, n)}
                />
                <span className="w-[64px] text-right">
                  <Delta row={row} />
                </span>
              </div>
            )
          })}
        </div>

        <p className="mt-3 font-mono text-[9px] leading-relaxed text-slate-600">
          Population capacity is the number of extra residents the city can absorb before a modelled
          system passes 100% of capacity. Pressure rows are shown as % of capacity used.
          Prototype simulation — illustrative estimates.
        </p>

        <div className="mt-3 flex gap-2">
          <button
            className="btn flex-1"
            onClick={() => {
              focusCity()
              close()
            }}
          >
            Back to city overview
          </button>
        </div>
      </div>
    </div>
  )
}
