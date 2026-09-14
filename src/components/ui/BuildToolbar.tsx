import { useState } from 'react'
import { useSandboxStore } from '../../store/useSandboxStore'
import {
  CATEGORY_ICON,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  isLinear,
  itemsIn,
  type CatalogueCategory,
} from '../../sandbox/catalogue'
import { money } from '../../lib/format'

/**
 * The free-build catalogue: ten categories, one open at a time so the panel
 * never becomes a wall. Anything the treasury cannot cover is still shown —
 * greyed, with the shortfall — because knowing what you cannot afford yet is
 * part of planning.
 */
export function BuildToolbar() {
  const [open, setOpen] = useState<CatalogueCategory | null>('residential')
  const activeItemId = useSandboxStore((s) => s.activeItemId)
  const selectItem = useSandboxStore((s) => s.selectItem)
  const treasury = useSandboxStore((s) => s.treasury)
  const demolishMode = useSandboxStore((s) => s.demolishMode)
  const setDemolishMode = useSandboxStore((s) => s.setDemolishMode)
  const demand = useSandboxStore((s) => s.demand)

  const demandFor = (key: string) => demand.find((d) => d.key === key)?.value ?? 0

  return (
    <section className="glass p-3">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="panel-title">
          <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
          Build
        </h2>
        <button
          onClick={() => setDemolishMode(!demolishMode)}
          className={`rounded-md border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] transition-all ${
            demolishMode
              ? 'border-rose-400/60 bg-rose-500/15 text-rose-200 shadow-glow'
              : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-rose-400/40 hover:text-rose-200'
          }`}
        >
          ✕ Demolish
        </button>
      </header>

      {demolishMode && (
        <p className="mb-2 rounded-lg border border-rose-400/25 bg-rose-500/[0.07] px-2.5 py-2 text-[10.5px] leading-snug text-rose-100/90">
          Click any building in the city to demolish it. You will see the cost and the impact before
          anything happens.
        </p>
      )}

      <div className="space-y-1">
        {CATEGORY_ORDER.map((cat) => {
          const items = itemsIn(cat)
          if (items.length === 0) return null
          const isOpen = open === cat
          const pressure = demandFor(
            cat === 'parks' ? 'residential' : cat === 'roads' ? 'transport' : cat,
          )

          return (
            <div key={cat}>
              <button
                onClick={() => setOpen(isOpen ? null : cat)}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-[7px] text-left transition-all ${
                  isOpen
                    ? 'border-cyan-300/35 bg-cyan-300/[0.07]'
                    : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15'
                }`}
              >
                <span className="w-4 shrink-0 text-center font-mono text-[11px] text-cyan-300/80">
                  {CATEGORY_ICON[cat]}
                </span>
                <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-200">
                  {CATEGORY_LABEL[cat]}
                </span>
                {pressure > 0.8 && (
                  <span
                    className={`rounded-full px-1.5 py-[1px] font-mono text-[8px] uppercase tracking-[0.1em] ${
                      pressure > 1 ? 'bg-rose-400/20 text-rose-200' : 'bg-amber-300/20 text-amber-200'
                    }`}
                    title={`${CATEGORY_LABEL[cat]} demand is ${Math.round(pressure * 100)}%`}
                  >
                    {pressure > 1 ? 'needed' : 'wanted'}
                  </span>
                )}
                <span className="font-mono text-[9px] text-slate-600">{isOpen ? '−' : '+'}</span>
              </button>

              {isOpen && (
                <div className="mt-1 space-y-1 pl-1">
                  {items.map((item) => {
                    const on = activeItemId === item.id
                    const afford = item.capex <= treasury
                    return (
                      <button
                        key={item.id}
                        onClick={() => selectItem(on ? null : item.id)}
                        className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-all active:scale-[0.99] ${
                          on
                            ? 'border-cyan-300/60 bg-cyan-300/[0.12] shadow-glow'
                            : afford
                              ? 'border-white/[0.07] bg-white/[0.02] hover:border-cyan-300/35 hover:bg-cyan-300/[0.05]'
                              : 'border-white/[0.05] bg-white/[0.01] opacity-55 hover:opacity-80'
                        }`}
                      >
                        <span className="mt-[1px] w-4 shrink-0 text-center font-mono text-[12px] text-cyan-200/90">
                          {item.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[11.5px] font-medium text-slate-100">
                              {item.name}
                            </span>
                            <span
                              className={`shrink-0 font-mono text-[10px] tabular-nums ${
                                afford ? 'text-emerald-200' : 'text-rose-300/80'
                              }`}
                            >
                              {money(item.capex)}
                            </span>
                          </span>
                          <span className="mt-[2px] block truncate text-[9.5px] leading-snug text-slate-500">
                            {item.blurb}
                          </span>
                          <span className="mt-[2px] block font-mono text-[8.5px] text-slate-600">
                            {item.opex > 0
                              ? `${money(item.opex)}/yr upkeep`
                              : 'no ongoing upkeep'}
                            {isLinear(item) && ' · placed on the network'}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
