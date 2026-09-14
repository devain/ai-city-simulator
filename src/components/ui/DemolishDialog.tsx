import { useSandboxStore } from '../../store/useSandboxStore'
import { districtLabel } from '../../sandbox/siting'
import { money } from '../../lib/format'

/**
 * Nothing is removed from the city without the player seeing what it will
 * cost and what it will break. Both figures come from a real simulation of
 * the city without that building.
 */
export function DemolishDialog() {
  const target = useSandboxStore((s) => s.demolishTarget)
  const confirm = useSandboxStore((s) => s.confirmDemolish)
  const cancel = useSandboxStore((s) => s.cancelDemolish)
  const treasury = useSandboxStore((s) => s.treasury)

  if (!target) return null
  const { building, refund, opexSaved, impact } = target
  const affordable = refund <= treasury
  const name = building.label.replace(/^New /, '').split(' · ')[0]

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/55 backdrop-blur-sm"
      onClick={cancel}
    >
      <div
        className="w-[min(360px,calc(100%-32px))] animate-riseIn rounded-xl border border-rose-400/35 bg-[#0a0710]/97 p-4 shadow-glass"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-rose-300/70">
          Confirm demolition
        </div>
        <h3 className="mt-1 text-[17px] font-semibold uppercase tracking-wide text-white">
          Demolish {name}?
        </h3>
        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
          {districtLabel(building.district)}
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 leading-none">
            <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-500">Cost</div>
            <div
              className={`mt-1.5 font-mono text-[15px] font-bold tabular-nums ${
                affordable ? 'text-rose-200' : 'text-rose-400'
              }`}
            >
              {money(refund)}
            </div>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 leading-none">
            <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-500">
              Upkeep saved
            </div>
            <div className="mt-1.5 font-mono text-[15px] font-bold tabular-nums text-emerald-300">
              {opexSaved > 0 ? `${money(opexSaved)}` : '—'}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
            Simulated impact
          </div>
          <div className="mt-1.5 space-y-[3px]">
            {impact.length === 0 && (
              <p className="text-[11px] text-slate-500">No measurable effect on city systems.</p>
            )}
            {impact.map((line) => (
              <p key={line} className="font-mono text-[10.5px] leading-snug text-amber-200/90">
                {line}
              </p>
            ))}
          </div>
        </div>

        {!affordable && (
          <p className="mt-2.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-2 font-mono text-[10px] leading-snug text-rose-200">
            Insufficient funds — clearing this site costs {money(refund)} and the treasury holds{' '}
            {money(treasury)}.
          </p>
        )}

        <div className="mt-3.5 flex gap-2">
          <button
            onClick={confirm}
            disabled={!affordable}
            className="flex-1 rounded-lg border border-rose-400/60 bg-rose-500/20 px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-rose-100 transition-all hover:bg-rose-500/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Demolish
          </button>
          <button
            onClick={cancel}
            className="rounded-lg border border-white/12 bg-white/[0.03] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-300 transition-colors hover:text-white"
          >
            Keep it
          </button>
        </div>
      </div>
    </div>
  )
}
