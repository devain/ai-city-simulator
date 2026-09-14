import { useState } from 'react'
import { useSandboxStore } from '../../store/useSandboxStore'
import { HISTORY_ICON, HISTORY_TONE, MONTH_NAMES } from '../../sandbox/history'
import { money } from '../../lib/format'

/**
 * The city's own record, newest last — what was built, what was torn down,
 * what happened to it, and the headline numbers at each moment. This is the
 * same list the AI reads when it says "traffic rose after the shopping
 * district was built", so everything in it really happened.
 */
export function CityHistoryPanel({ onClose }: { onClose: () => void }) {
  const history = useSandboxStore((s) => s.history)
  const [majorOnly, setMajorOnly] = useState(false)

  const shown = majorOnly ? history.filter((h) => h.major) : history
  const byYear = new Map<number, typeof history>()
  for (const h of shown) {
    const list = byYear.get(h.year) ?? []
    list.push(h)
    byYear.set(h.year, list)
  }

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-black/55 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[78%] w-[min(620px,calc(100%-32px))] animate-riseIn flex-col rounded-xl border border-cyan-300/25 bg-[#050b16]/97 shadow-glass"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70">
              City history
            </div>
            <h3 className="mt-0.5 text-[16px] font-semibold uppercase tracking-wide text-white">
              {history.length} recorded event{history.length === 1 ? '' : 's'}
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMajorOnly((v) => !v)}
              className={`chip transition-colors ${majorOnly ? '!border-cyan-300/45 !text-cyan-200' : 'hover:!text-cyan-200'}`}
            >
              {majorOnly ? 'milestones' : 'everything'}
            </button>
            <button onClick={onClose} className="btn !px-2.5 !py-1.5 !text-[10px]">
              Close
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-4 py-3">
          {shown.length === 0 && (
            <p className="text-[11px] text-slate-500">Nothing recorded yet.</p>
          )}
          {[...byYear.entries()].map(([year, entries]) => (
            <div key={year} className="mb-3 last:mb-0">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">
                  Year {year}
                </span>
                <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/25 to-transparent" />
              </div>
              <div className="space-y-1">
                {entries.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
                  >
                    <span
                      className={`mt-[1px] w-4 shrink-0 text-center font-mono text-[11px] ${HISTORY_TONE[h.kind]}`}
                    >
                      {HISTORY_ICON[h.kind]}
                    </span>
                    <span className="w-9 shrink-0 pt-[1px] font-mono text-[9px] uppercase tracking-[0.1em] text-slate-600">
                      {MONTH_NAMES[h.month - 1]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11.5px] font-medium leading-snug text-slate-100">
                        {h.title}
                      </span>
                      <span className="mt-[2px] block text-[10px] leading-snug text-slate-500">
                        {h.detail}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-right leading-none sm:block">
                      <span className="block font-mono text-[9.5px] tabular-nums text-cyan-200/80">
                        {h.snapshot.population.toLocaleString('en-US')}
                      </span>
                      <span className="mt-[3px] block font-mono text-[9px] tabular-nums text-slate-600">
                        health {h.snapshot.health} · {money(h.snapshot.treasury)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
