import { useCityStore } from '../../store/useCityStore'
import { PRESSURE_COLORS, PRESSURE_TEXT } from '../../lib/colors'
import { compact, money, signedPct } from '../../lib/format'
import { delta } from '../../simulation/citySimulation'
import type { MetricKey } from '../../simulation/types'

/** Value animated from the pre-run figure to the post-run figure. */
export function useAnimatedMetric(key: MetricKey) {
  const prev = useCityStore((s) => s.previous.metrics[key])
  const cur = useCityStore((s) => s.current.metrics[key])
  const base = useCityStore((s) => s.baseline.metrics[key])
  const p = useCityStore((s) => s.runProgress)
  const value = prev.value + (cur.value - prev.value) * p
  const utilisation = prev.utilisation + (cur.utilisation - prev.utilisation) * p
  return { value, utilisation, metric: cur, baseline: base, changePct: delta(value, base.value) }
}

export function MetricTile({ metricKey, compactMode }: { metricKey: MetricKey; compactMode?: boolean }) {
  const { value, utilisation, metric, changePct } = useAnimatedMetric(metricKey)
  const pressure = metric.pressure
  const colour = PRESSURE_COLORS[pressure]
  const display = metricKey === 'cost' ? money(value) : compact(value)

  return (
    <div className="group relative overflow-hidden rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-cyan-300/25 hover:bg-white/[0.04]">
      <div
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${colour}, transparent)` }}
      />
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-400">
          {metric.label}
        </span>
        <span
          className={`font-mono text-[9px] font-semibold tabular-nums ${
            changePct > 0.05
              ? 'text-rose-300'
              : changePct < -0.05
                ? 'text-emerald-300'
                : 'text-slate-500'
          }`}
        >
          {Math.abs(changePct) < 0.05 ? '—' : signedPct(changePct)}
        </span>
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-mono text-[19px] font-semibold tabular-nums text-white text-glow">
          {display}
        </span>
        {!compactMode && (
          <span className="font-mono text-[9px] text-slate-500">{metric.unit}</span>
        )}
      </div>

      <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${Math.min(100, utilisation * 100)}%`,
            background: `linear-gradient(90deg, ${colour}55, ${colour})`,
            boxShadow: `0 0 10px ${colour}99`,
          }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <span className={`font-mono text-[9px] font-semibold tracking-[0.14em] ${PRESSURE_TEXT[pressure]}`}>
          {pressure}
        </span>
        <span className="font-mono text-[9px] tabular-nums text-slate-500">
          {(utilisation * 100).toFixed(0)}%
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-[#060c18]/96 px-3 py-2 text-[10px] leading-snug text-slate-300 opacity-0 backdrop-blur transition-opacity duration-200 group-hover:opacity-100">
          {metric.detail}
      </div>
    </div>
  )
}
