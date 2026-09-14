import { useState } from 'react'
import { useSandboxStore } from '../../store/useSandboxStore'
import { HEADLINE_DEMAND } from '../../sandbox/demand'
import { money } from '../../lib/format'

function Bar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1.25, value))
  const tone =
    v > 1 ? 'bg-rose-400' : v > 0.85 ? 'bg-amber-300' : v > 0.6 ? 'bg-cyan-300' : 'bg-emerald-400'
  return (
    <div className="h-[5px] w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div
        className={`h-full rounded-full ${tone} transition-[width] duration-500`}
        style={{ width: `${Math.min(100, (v / 1.25) * 100)}%` }}
      />
    </div>
  )
}

/**
 * What the city is asking for, and whether it can pay for it.
 *
 * The demand bars are the player's shopping list; the books underneath are the
 * reason they cannot buy everything on it.
 */
export function CityVitals() {
  const demand = useSandboxStore((s) => s.demand)
  const finance = useSandboxStore((s) => s.finance)
  const health = useSandboxStore((s) => s.health)
  const pressure = useSandboxStore((s) => s.pressure)
  const [showAll, setShowAll] = useState(false)
  const [showBooks, setShowBooks] = useState(false)

  const shown = showAll ? demand : demand.filter((d) => HEADLINE_DEMAND.includes(d.key))

  return (
    <section className="glass p-3">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="panel-title">
          <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
          City demand
        </h2>
        <button className="chip hover:!text-cyan-200" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'headline' : 'all'}
        </button>
      </header>

      <div className="space-y-2">
        {shown.map((d) => (
          <div key={d.key} title={d.detail}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-slate-400">
                {d.label}
              </span>
              <span
                className={`font-mono text-[10px] tabular-nums ${
                  d.value > 1 ? 'text-rose-300' : d.value > 0.85 ? 'text-amber-200' : 'text-slate-300'
                }`}
              >
                {Math.round(d.value * 100)}%
              </span>
            </div>
            <div className="mt-1">
              <Bar value={d.value} />
            </div>
          </div>
        ))}
      </div>

      {/* ---- population dynamics ---- */}
      <div className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
            Population growth
          </span>
          <span
            className={`font-mono text-[11px] font-semibold tabular-nums ${
              pressure.annualGrowth >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {pressure.annualGrowth >= 0 ? '+' : ''}
            {(pressure.annualGrowth * 100).toFixed(2)}% / yr
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-3 gap-x-2 gap-y-1">
          {pressure.factors.map((f) => (
            <div key={f.key} title={f.detail} className="leading-none">
              <div className="truncate font-mono text-[8px] uppercase tracking-[0.12em] text-slate-600">
                {f.label}
              </div>
              <div
                className={`mt-[3px] font-mono text-[9.5px] ${
                  f.rating === 'High'
                    ? 'text-emerald-300'
                    : f.rating === 'Low'
                      ? 'text-rose-300'
                      : 'text-slate-300'
                }`}
              >
                {f.rating}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[9.5px] leading-snug text-slate-500">
          Held back most by{' '}
          <span className="text-slate-300">{pressure.limiting.label.toLowerCase()}</span> ·{' '}
          {pressure.limiting.detail}
        </p>
      </div>

      {/* ---- the books ---- */}
      <button
        onClick={() => setShowBooks((v) => !v)}
        className="mt-2.5 flex w-full items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-left transition-colors hover:border-white/15"
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
          Annual budget
        </span>
        <span className="flex items-baseline gap-2">
          <span
            className={`font-mono text-[11.5px] font-semibold tabular-nums ${
              finance.netIncome >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {finance.netIncome >= 0 ? '+' : '−'}
            {money(Math.abs(finance.netIncome))}
          </span>
          <span className="font-mono text-[9px] text-slate-600">{showBooks ? '−' : '+'}</span>
        </span>
      </button>

      {showBooks && (
        <div className="mt-1.5 space-y-2 rounded-lg border border-white/[0.07] bg-black/20 p-2.5">
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-emerald-300/70">
                Revenue
              </span>
              <span className="font-mono text-[10px] tabular-nums text-emerald-200">
                {money(finance.annualRevenue)}
              </span>
            </div>
            {finance.revenue.map((l) => (
              <div key={l.label} className="flex items-baseline justify-between gap-2" title={l.detail}>
                <span className="truncate text-[10px] text-slate-400">{l.label}</span>
                <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-slate-300">
                  {money(l.amount)}
                </span>
              </div>
            ))}
          </div>
          <div className="hairline" />
          <div>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-rose-300/70">
                Operating cost
              </span>
              <span className="font-mono text-[10px] tabular-nums text-rose-200">
                {money(finance.annualOperatingCost)}
              </span>
            </div>
            {finance.costs.map((l) => (
              <div key={l.label} className="flex items-baseline justify-between gap-2" title={l.detail}>
                <span className="truncate text-[10px] text-slate-400">{l.label}</span>
                <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-slate-300">
                  {money(l.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- health breakdown ---- */}
      <div className="mt-2.5 grid grid-cols-3 gap-1">
        {health.components.map((c) => (
          <div
            key={c.key}
            title={`${c.label}: ${c.detail}`}
            className="rounded-md border border-white/[0.06] bg-white/[0.02] px-1.5 py-1 leading-none"
          >
            <div className="truncate font-mono text-[7.5px] uppercase tracking-[0.1em] text-slate-600">
              {c.label}
            </div>
            <div
              className={`mt-[3px] font-mono text-[11px] font-semibold tabular-nums ${
                c.score >= 70
                  ? 'text-emerald-300'
                  : c.score >= 50
                    ? 'text-amber-300'
                    : 'text-rose-300'
              }`}
            >
              {c.score}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
