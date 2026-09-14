import { useSandboxStore } from '../../store/useSandboxStore'
import { CATALOGUE_BY_ID, LINEAR_BY_ID, isLinear } from '../../sandbox/catalogue'
import { districtLabel } from '../../sandbox/siting'
import { money } from '../../lib/format'

/**
 * THE BUILD PREVIEW — the panel that makes the AI feel like it understands
 * the city rather than describing it.
 *
 * Every number here came from actually placing the candidate on a copy of the
 * city and re-running the whole simulation, so nothing on this card is an
 * estimate: it is what the city will read a moment after you press Build.
 */
export function BuildPreview() {
  const itemId = useSandboxStore((s) => s.activeItemId)
  const ghost = useSandboxStore((s) => s.ghost)
  const impact = useSandboxStore((s) => s.impact)
  const treasury = useSandboxStore((s) => s.treasury)
  const confirm = useSandboxStore((s) => s.confirmBuild)
  const cancel = useSandboxStore((s) => s.cancelBuild)
  const mode = useSandboxStore((s) => s.mode)

  if (!itemId) return null
  const item = CATALOGUE_BY_ID[itemId] ?? LINEAR_BY_ID[itemId]
  if (!item) return null

  const linear = isLinear(item)
  const canAfford = item.capex <= treasury
  const canPlace = linear ? true : !!ghost?.valid
  const blocked = !canAfford || (!linear && !ghost)

  return (
    <div className="pointer-events-auto absolute bottom-[150px] left-3 z-30 w-[272px] animate-riseIn rounded-xl border border-cyan-300/25 bg-[#050b16]/95 p-3 shadow-glass backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-cyan-300/70">
            {mode === 'human' ? 'Placing' : 'AI preview'}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="font-mono text-[13px] text-cyan-200">{item.icon}</span>
            <span className="truncate text-[13px] font-semibold text-white">{item.name}</span>
          </div>
        </div>
        <button
          onClick={cancel}
          className="shrink-0 rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[11px] leading-none text-slate-500 transition-colors hover:text-slate-100"
          title="Cancel (Esc)"
        >
          ✕
        </button>
      </div>

      {/* ---- where ---- */}
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">Site</span>
        <span className="truncate text-right text-[10.5px] text-slate-200">
          {linear
            ? 'the busiest corridor'
            : ghost
              ? districtLabel(ghost.district)
              : 'no free land'}
        </span>
      </div>

      {/* ---- money ---- */}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Cell label="Cost" value={money(item.capex)} tone={canAfford ? 'text-emerald-200' : 'text-rose-300'} />
        <Cell
          label="Upkeep"
          value={item.opex > 0 ? `${money(item.opex)}/yr` : 'none'}
          tone="text-slate-200"
        />
      </div>

      {/* ---- the simulated consequence ---- */}
      {impact && (
        <>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
              Predicted
            </span>
            <span
              className={`font-mono text-[9.5px] tabular-nums ${
                impact.healthDelta > 0
                  ? 'text-emerald-300'
                  : impact.healthDelta < 0
                    ? 'text-rose-300'
                    : 'text-slate-400'
              }`}
              title="Change in the 0-100 city health score"
            >
              health {impact.healthDelta >= 0 ? '+' : ''}
              {impact.healthDelta}
            </span>
          </div>

          <div className="mt-1.5 space-y-[3px]">
            {impact.lines.length === 0 && (
              <p className="text-[10px] text-slate-500">No measurable change to city systems.</p>
            )}
            {impact.lines.slice(0, 6).map((l) => {
              const good = l.higherIsBetter ? l.delta > 0 : l.delta < 0
              return (
                <div key={l.key} className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[10.5px] text-slate-400">{l.label}</span>
                  <span
                    className={`shrink-0 font-mono text-[10px] tabular-nums ${
                      good ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {l.display}
                  </span>
                </div>
              )
            })}
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10.5px] text-slate-400">Net income</span>
              <span
                className={`shrink-0 font-mono text-[10px] tabular-nums ${
                  impact.netIncomeDelta >= 0 ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {impact.netIncomeDelta >= 0 ? '+' : '−'}
                {money(Math.abs(impact.netIncomeDelta))}/yr
              </span>
            </div>
          </div>

          {/* ---- the AI's read ---- */}
          <p className="mt-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.05] px-2 py-1.5 text-[10.5px] leading-snug text-cyan-100/90">
            <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-cyan-300/70">
              AI ·{' '}
            </span>
            {impact.verdict}
          </p>
          {impact.caution && (
            <p className="mt-1.5 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-2 py-1.5 text-[10.5px] leading-snug text-amber-100/90">
              ⚠ {impact.caution}
            </p>
          )}
        </>
      )}

      {ghost?.problem && (
        <p className="mt-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 font-mono text-[9.5px] leading-snug text-rose-200">
          {ghost.problem}
        </p>
      )}

      <div className="mt-2.5 flex gap-1.5">
        <button
          onClick={confirm}
          disabled={blocked || !canPlace}
          className="flex-1 rounded-lg border border-cyan-300/60 bg-gradient-to-b from-cyan-400/30 to-cyan-500/10 px-3 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-50 shadow-glow transition-all hover:from-cyan-300/45 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Build · {money(item.capex)}
        </button>
        <button
          onClick={cancel}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 transition-colors hover:text-slate-100"
        >
          Cancel
        </button>
      </div>

      {!linear && (
        <p className="mt-1.5 text-center font-mono text-[8.5px] text-slate-600">
          click the city to move the site · esc to cancel
        </p>
      )}
    </div>
  )
}

function Cell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-1.5 leading-none">
      <div className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-slate-600">{label}</div>
      <div className={`mt-[4px] font-mono text-[11px] font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}
