import { useEffect, useState } from 'react'
import { useSandboxStore } from '../../store/useSandboxStore'
import { SLOT_IDS, SLOT_LABEL, storageAvailable, type SlotId } from '../../sandbox/persistence'
import { AGENT_OBJECTIVES, type AgentObjectiveId } from '../../ai/AutonomousCityAgent'
import { money } from '../../lib/format'

/**
 * Three city slots, a fresh city, a reset — and the Human-vs-AI run.
 *
 * Saves are local to the browser and hold the city, the treasury, the calendar
 * and the whole history. The simulation is never saved; it is re-derived on
 * load, so a restored city can never disagree with the engine.
 */
export function CitySlots() {
  const slots = useSandboxStore((s) => s.slots)
  const refreshSlots = useSandboxStore((s) => s.refreshSlots)
  const saveTo = useSandboxStore((s) => s.saveTo)
  const loadFrom = useSandboxStore((s) => s.loadFrom)
  const newCity = useSandboxStore((s) => s.newCity)
  const resetSandbox = useSandboxStore((s) => s.resetSandbox)
  const notice = useSandboxStore((s) => s.saveNotice)
  const challenge = useSandboxStore((s) => s.challenge)
  const startChallenge = useSandboxStore((s) => s.startChallenge)
  const clearChallenge = useSandboxStore((s) => s.clearChallenge)

  const [open, setOpen] = useState(false)
  const [objective, setObjective] = useState<AgentObjectiveId>('grow')
  const available = storageAvailable()

  useEffect(() => {
    if (open) refreshSlots()
  }, [open, refreshSlots])

  const human = challenge?.results.human
  const ai = challenge?.results.ai

  return (
    <section className="glass p-3">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="panel-title">
          <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
          City slots
        </h2>
        <button className="chip hover:!text-cyan-200" onClick={() => setOpen((v) => !v)}>
          {open ? 'hide' : 'show'}
        </button>
      </header>

      {notice && (
        <p className="mb-2 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-2.5 py-1.5 font-mono text-[9.5px] text-cyan-100">
          {notice}
        </p>
      )}

      {open && (
        <>
          {!available && (
            <p className="mb-2 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-2.5 py-2 text-[10px] leading-snug text-amber-100/90">
              Local storage is blocked in this browser, so saving is unavailable. Everything else
              works normally.
            </p>
          )}

          <div className="space-y-1.5">
            {SLOT_IDS.map((id: SlotId) => {
              const info = slots.find((s) => s.slot === id)
              const saved = info?.saved ?? null
              return (
                <div
                  key={id}
                  className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-200">
                      {SLOT_LABEL[id]}
                    </span>
                    <span className="font-mono text-[9px] text-slate-600">
                      {saved
                        ? `Year ${saved.summary.year} · ${saved.summary.population.toLocaleString('en-US')} · health ${saved.summary.health}`
                        : 'empty'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    <button
                      onClick={() => saveTo(id)}
                      disabled={!available}
                      className="flex-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-cyan-100 disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => loadFrom(id)}
                      disabled={!saved}
                      className="flex-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-300 transition-colors hover:border-emerald-300/40 hover:text-emerald-100 disabled:opacity-30"
                    >
                      Load
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-2 flex gap-1">
            <button onClick={newCity} className="btn flex-1 !py-1.5 !text-[10px]">
              New city
            </button>
            <button onClick={resetSandbox} className="btn flex-1 !py-1.5 !text-[10px]">
              Reset city
            </button>
          </div>

          {/* ---- human vs AI ---- */}
          <div className="mt-3 rounded-lg border border-fuchsia-300/25 bg-fuchsia-400/[0.05] p-2.5">
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-fuchsia-300/80">
              City challenge · human vs AI
            </div>
            <p className="mt-1 text-[10px] leading-snug text-slate-400">
              Same starting city, same $100M, ten simulated years. Run one side, then the other, and
              compare.
            </p>

            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value as AgentObjectiveId)}
              className="mt-2 w-full rounded-md border border-white/10 bg-[#0a1220] px-2 py-1.5 font-mono text-[10px] text-slate-200 outline-none focus:border-fuchsia-300/50"
            >
              {(Object.keys(AGENT_OBJECTIVES) as AgentObjectiveId[]).map((id) => (
                <option key={id} value={id}>
                  {AGENT_OBJECTIVES[id].phrase}
                </option>
              ))}
            </select>

            <div className="mt-1.5 flex gap-1">
              <button
                onClick={() => startChallenge('human', objective)}
                className="flex-1 rounded-md border border-sky-300/40 bg-sky-300/10 px-2 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-sky-100 transition-colors hover:bg-sky-300/20"
              >
                Run as human
              </button>
              <button
                onClick={() => startChallenge('ai', objective)}
                className="flex-1 rounded-md border border-fuchsia-300/45 bg-fuchsia-400/12 px-2 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-fuchsia-100 transition-colors hover:bg-fuchsia-400/22"
              >
                Run as AI
              </button>
            </div>

            {(human || ai) && (
              <div className="mt-2.5">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 gap-y-1">
                  <span />
                  <span className="text-right font-mono text-[8.5px] uppercase tracking-[0.12em] text-sky-300/80">
                    Human
                  </span>
                  <span className="text-right font-mono text-[8.5px] uppercase tracking-[0.12em] text-fuchsia-300/80">
                    AI
                  </span>
                  <CompareRow label="City health" a={human?.health} b={ai?.health} fmt={(v) => String(v)} best="high" />
                  <CompareRow
                    label="Population"
                    a={human?.population}
                    b={ai?.population}
                    fmt={(v) => v.toLocaleString('en-US')}
                    best="high"
                  />
                  <CompareRow
                    label="Traffic"
                    a={human?.traffic}
                    b={ai?.traffic}
                    fmt={(v) => `${Math.round(v * 100)}%`}
                    best="low"
                  />
                  <CompareRow label="Treasury" a={human?.treasury} b={ai?.treasury} fmt={money} best="high" />
                  <CompareRow
                    label="CO₂ / head"
                    a={human?.co2PerCapita}
                    b={ai?.co2PerCapita}
                    fmt={(v) => `${Math.round(v / 1000)}t`}
                    best="low"
                  />
                  <CompareRow label="Economy" a={human?.economy} b={ai?.economy} fmt={money} best="high" />
                </div>
                <button
                  onClick={clearChallenge}
                  className="mt-1.5 w-full rounded-md border border-white/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500 transition-colors hover:text-slate-200"
                >
                  Clear results
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function CompareRow({
  label,
  a,
  b,
  fmt,
  best,
}: {
  label: string
  a?: number
  b?: number
  fmt: (v: number) => string
  best: 'high' | 'low'
}) {
  const winner =
    a != null && b != null ? (best === 'high' ? (a > b ? 'a' : b > a ? 'b' : null) : a < b ? 'a' : b < a ? 'b' : null) : null
  return (
    <>
      <span className="truncate text-[10px] text-slate-400">{label}</span>
      <span
        className={`text-right font-mono text-[10px] tabular-nums ${
          winner === 'a' ? 'font-bold text-emerald-300' : 'text-slate-300'
        }`}
      >
        {a != null ? fmt(a) : '—'}
      </span>
      <span
        className={`text-right font-mono text-[10px] tabular-nums ${
          winner === 'b' ? 'font-bold text-emerald-300' : 'text-slate-300'
        }`}
      >
        {b != null ? fmt(b) : '—'}
      </span>
    </>
  )
}
