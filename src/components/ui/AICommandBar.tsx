import { useEffect, useRef, useState } from 'react'
import { useOptimizerStore } from '../../store/useOptimizerStore'
import { OBJECTIVE_LIST } from '../../ai/ObjectiveParser'
import { money } from '../../lib/format'
import type { ObjectiveId } from '../../ai/types'

const BUDGETS = [10, 25, 50, 100].map((m) => m * 1_000_000)

/**
 * The natural-language command bar.
 *
 * This is the front door of the whole product: the user talks to the city here.
 * While the AI is working it turns into a live status strip rather than an
 * input, so it never invites a second request mid-construction.
 */
export function AICommandBar() {
  const objective = useOptimizerStore((s) => s.objective)
  const setObjective = useOptimizerStore((s) => s.setObjective)
  const budget = useOptimizerStore((s) => s.budget)
  const setBudget = useOptimizerStore((s) => s.setBudget)
  const spent = useOptimizerStore((s) => s.spent)
  const ask = useOptimizerStore((s) => s.ask)
  const autoOptimize = useOptimizerStore((s) => s.autoOptimize)
  const phase = useOptimizerStore((s) => s.phase)
  const statusLine = useOptimizerStore((s) => s.statusLine)
  const thinking = useOptimizerStore((s) => s.thinking)
  const suggestions = useOptimizerStore((s) => s.suggestions)
  const buildProgress = useOptimizerStore((s) => s.buildProgress)
  const understanding = useOptimizerStore((s) => s.understanding)
  const typedText = useOptimizerStore((s) => s.typedText)

  const [text, setText] = useState('')
  const [customBudget, setCustomBudget] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const executing = phase === 'building' || phase === 'resimulating'
  const busy = thinking || (phase !== 'idle' && phase !== 'complete' && phase !== 'review')
  // the demo types into the bar; while it does, the field is a read-only mirror
  const narrated = typedText !== null
  const shown = typedText ?? text

  // '/' focuses the command bar, like any decent console
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = () => {
    const q = text.trim()
    if (!q || busy) return
    setText('')
    void ask(q)
  }

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-20 rounded-xl border border-cyan-300/20 bg-[#050b16]/90 p-2.5 shadow-glass backdrop-blur-2xl">
      {/* ---- row 1: the request ---- */}
      {executing ? (
        <div className="flex items-center gap-3 px-1 py-[5px]">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-fuchsia-300/50 bg-fuchsia-400/15 font-mono text-[11px] text-fuchsia-200">
            AI
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-mono text-[12px] font-bold uppercase tracking-[0.18em] text-fuchsia-100">
                AI is executing…
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400">
                {statusLine} · {Math.round(buildProgress * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300 transition-[width] duration-150"
                style={{ width: `${buildProgress * 100}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <span className="hidden items-center gap-2 pl-1 sm:flex">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-300/40 bg-cyan-300/10 font-mono text-[11px] text-cyan-200">
              AI
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/70">
              City AI
            </span>
          </span>

          <input
            ref={inputRef}
            type="text"
            name="city-ai-command"
            autoComplete="off"
            value={shown}
            onChange={(e) => setText(e.target.value)}
            readOnly={narrated}
            disabled={busy && !narrated}
            placeholder="Tell the AI what you want to achieve…"
            className={`min-w-[180px] flex-1 rounded-lg border bg-white/[0.04] px-3 py-2.5 text-[12.5px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-300/50 disabled:opacity-50 ${
              narrated ? 'border-cyan-300/60 shadow-glow' : 'border-white/10'
            }`}
          />

          <button
            type="submit"
            disabled={busy}
            className="relative overflow-hidden rounded-lg border border-cyan-300/60 bg-gradient-to-b from-cyan-400/30 to-cyan-500/10 px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-50 shadow-glow transition-all hover:from-cyan-300/45 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {thinking ? 'Understanding…' : busy ? statusLine + '…' : 'Ask city AI'}
            {!busy && (
              <span className="pointer-events-none absolute inset-0 -translate-x-full animate-sweep bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            )}
          </button>

          <button
            type="button"
            onClick={() => autoOptimize()}
            disabled={busy}
            className="rounded-lg border border-fuchsia-300/40 bg-fuchsia-400/10 px-3 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-100 transition-all hover:bg-fuchsia-400/20 active:scale-[0.98] disabled:opacity-40"
            title="Let the AI pick the objective and execute the best plan on its own"
          >
            Auto
          </button>
        </form>
      )}

      {/* ---- row 2: what you could say ---- */}
      {!executing && (
        <div className="mt-2 flex items-center gap-2">
          <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
            Try
          </span>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto scroll-thin pb-[2px]">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setText(s)
                  inputRef.current?.focus()
                }}
                className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-[3px] text-[10px] text-slate-400 transition-colors hover:border-cyan-300/40 hover:text-cyan-100"
              >
                {s}
              </button>
            ))}
          </div>
          {understanding && (
            <span
              className="hidden shrink-0 rounded-full border border-cyan-300/25 bg-cyan-300/[0.07] px-2 py-[3px] font-mono text-[9px] text-cyan-200/90 xl:inline"
              title="How the AI read your last request"
            >
              read: {understanding.kind.replace(/_/g, ' ')} · {(understanding.parseConfidence * 100).toFixed(0)}%
            </span>
          )}
        </div>
      )}

      {/* ---- row 3: objective + budget ---- */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
          Objective
        </span>
        <div className="flex flex-wrap gap-1">
          {OBJECTIVE_LIST.map((o) => {
            const on = o.id === objective.id
            return (
              <button
                key={o.id}
                onClick={() => setObjective(o.id as ObjectiveId)}
                title={o.description}
                className={`rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-all ${
                  on
                    ? 'bg-cyan-300/20 text-white ring-1 ring-cyan-300/50'
                    : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                }`}
              >
                {o.icon} {o.short}
              </button>
            )
          })}
        </div>

        <span className="ml-auto font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
          Budget
        </span>
        <div className="flex items-center gap-1">
          {BUDGETS.map((b) => (
            <button
              key={b}
              onClick={() => {
                setCustomBudget(false)
                setBudget(b)
              }}
              className={`rounded-md px-2 py-1 font-mono text-[9px] tracking-[0.08em] transition-all ${
                !customBudget && budget === b
                  ? 'bg-emerald-300/20 text-white ring-1 ring-emerald-300/50'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
              }`}
            >
              ${b / 1_000_000}M
            </button>
          ))}
          <button
            onClick={() => setCustomBudget((v) => !v)}
            className={`rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] transition-all ${
              customBudget
                ? 'bg-emerald-300/20 text-white ring-1 ring-emerald-300/50'
                : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
            }`}
          >
            Custom
          </button>
          {customBudget && (
            <input
              type="number"
              min={1}
              max={500}
              value={Math.round(budget / 1_000_000)}
              onChange={(e) => setBudget(Math.max(0, Number(e.target.value) * 1_000_000))}
              className="w-16 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-1 text-right font-mono text-[10px] text-slate-100 outline-none focus:border-emerald-300/50"
            />
          )}
        </div>

        <div className="flex items-baseline gap-1.5 border-l border-white/10 pl-3">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-slate-500">
            Available
          </span>
          <span className="font-mono text-[13px] font-semibold tabular-nums text-emerald-200 text-glow">
            {money(budget)}
          </span>
          {spent > 0 && (
            <span className="font-mono text-[9px] tabular-nums text-slate-500">
              · {money(spent)} committed
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
