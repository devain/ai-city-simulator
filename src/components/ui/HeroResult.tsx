import { useOptimizerStore } from '../../store/useOptimizerStore'
import { AnimatedNumber } from './AnimatedNumber'
import { money } from '../../lib/format'
import type { ComparisonRow } from '../../ai/types'

/** the four headline outcomes, in the order they read best */
const HERO_KEYS = ['population', 'traffic', 'education', 'parking'] as const

const LABEL: Record<string, string> = {
  population: 'Population capacity',
  traffic: 'Traffic',
  education: 'School pressure',
  parking: 'Parking pressure',
  emissions: 'CO₂',
}

function HeroStat({ row, delay }: { row: ComparisonRow; delay: number }) {
  const improved = row.lowerIsBetter ? row.changePct < -0.05 : row.changePct > 0.05
  const flat = Math.abs(row.changePct) < 0.05
  const colour = flat ? 'text-slate-400' : improved ? 'text-emerald-300' : 'text-rose-300'
  const isCapacity = row.key === 'population'

  return (
    <div className="animate-riseIn text-center" style={{ animationDelay: `${delay}ms` }}>
      <div className={`font-mono text-[30px] font-bold leading-none tabular-nums ${colour} text-glow sm:text-[38px]`}>
        <AnimatedNumber
          value={row.changePct}
          duration={1500}
          delay={delay}
          format={(n) => `${n > 0 ? '+' : ''}${n.toFixed(0)}%`}
        />
      </div>
      <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-slate-400">
        {LABEL[row.key] ?? row.label}
      </div>
      <div className="mt-1 font-mono text-[10px] tabular-nums text-slate-500">
        <AnimatedNumber
          value={row.beforePct}
          duration={1500}
          delay={delay}
          format={(n) => (isCapacity ? Math.round(n).toLocaleString('en-US') : `${n.toFixed(0)}%`)}
        />
        {' → '}
        <span className="text-slate-200">
          <AnimatedNumber
            value={row.afterPct}
            duration={1500}
            delay={delay}
            format={(n) => (isCapacity ? Math.round(n).toLocaleString('en-US') : `${n.toFixed(0)}%`)}
          />
        </span>
      </div>
    </div>
  )
}

/**
 * The final beat: the camera has pulled back to the city, the heatmap has
 * settled, and the result lands. Numbers count up rather than appearing.
 */
export function HeroResult() {
  const open = useOptimizerStore((s) => s.heroOpen)
  const report = useOptimizerStore((s) => s.report)
  const close = useOptimizerStore((s) => s.closeHero)
  const queue = useOptimizerStore((s) => s.queue)
  const diagnosis = useOptimizerStore((s) => s.diagnosis)

  if (!open || !report) return null

  const rows = HERO_KEYS.map((k) => report.rows.find((r) => r.key === k)).filter(
    (r): r is ComparisonRow => !!r,
  )

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-b from-[#02040a]/60 via-[#02040a]/25 to-[#02040a]/80" />
      {/* a soft pool of darkness so the result reads over any part of the city */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 52% 46% at 50% 48%, rgba(2,5,12,0.92) 0%, rgba(2,5,12,0.72) 45%, rgba(2,5,12,0) 78%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[720px] animate-riseIn text-center">
        <div className="mx-auto mb-3 h-px w-40 bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />

        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-cyan-300/80">
          AI City Optimizer
        </p>
        <h2 className="mt-2 font-mono text-[24px] font-bold tracking-[0.16em] text-white text-glow sm:text-[32px]">
          OPTIMIZATION COMPLETE
        </h2>
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.24em] text-slate-300">
          Plan {queue?.planCode} executed · {queue?.planName}
        </p>

        <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
          {rows.map((r, i) => (
            <HeroStat key={r.key} row={r} delay={260 + i * 180} />
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 font-mono text-[10px] text-emerald-200">
            {money(report.spend)} committed
          </span>
          <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 font-mono text-[10px] text-cyan-100">
            City status: {diagnosis?.status === 'NOMINAL' ? 'OPTIMIZED' : (diagnosis?.status ?? 'UPDATED')}
          </span>
        </div>

        <button
          onClick={close}
          className="btn-primary mx-auto mt-7 block !px-6"
        >
          View before / after
        </button>

        <div className="mx-auto mt-4 h-px w-40 bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
      </div>
    </div>
  )
}
