import { useChallengeStore } from '../../store/useChallengeStore'
import {
  BUDGET_OPTIONS,
  LENGTH_OPTIONS,
  NAMED_SEEDS,
  OBJECTIVE_LIST,
  POPULATION_OPTIONS,
  type ChallengeObjectiveId,
} from '../../challenge/ChallengeConfig'
import { PERSONALITY_LIST } from '../../ai/AIPersonality'
import { money } from '../../lib/format'

const ACCENT: Record<string, string> = {
  sky: 'border-sky-300/60 bg-sky-300/12 text-sky-50 shadow-glow',
  amber: 'border-amber-300/60 bg-amber-300/12 text-amber-50 shadow-glow',
  emerald: 'border-emerald-300/60 bg-emerald-400/12 text-emerald-50 shadow-glow',
  cyan: 'border-cyan-300/60 bg-cyan-300/12 text-cyan-50 shadow-glow',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-mono text-[8.5px] uppercase tracking-[0.22em] text-cyan-300/70">
        {label}
      </div>
      {children}
    </div>
  )
}

function Pills<T extends string | number>({
  options,
  value,
  onChange,
  render,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
  render: (v: T) => string
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={String(o)}
          onClick={() => onChange(o)}
          className={`rounded-lg border px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] transition-all active:scale-[0.98] ${
            o === value
              ? 'border-cyan-300/60 bg-cyan-300/15 text-white shadow-glow'
              : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-cyan-300/35 hover:text-slate-100'
          }`}
        >
          {render(o)}
        </button>
      ))}
    </div>
  )
}

/**
 * The terms of the match, set before a single building is placed.
 *
 * Everything here is handed to both sides unchanged — which is the point, and
 * why the screen says so.
 */
export function ChallengeSetup() {
  const setup = useChallengeStore((s) => s.setup)
  const update = useChallengeStore((s) => s.updateSetup)
  const start = useChallengeStore((s) => s.start)
  const close = useChallengeStore((s) => s.close)
  const runTournament = useChallengeStore((s) => s.runTournament)

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center overflow-y-auto bg-[#03060d]/96 backdrop-blur-2xl scroll-thin">
      <div className="w-[min(880px,calc(100%-32px))] animate-riseIn py-8">
        {/* ---- title ---- */}
        <div className="mb-6 text-center">
          <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-cyan-300/60">
            City Challenge
          </div>
          <h1 className="mt-2 font-mono text-[42px] font-bold leading-none tracking-[0.14em] text-white text-glow sm:text-[56px]">
            AI <span className="text-slate-600">vs</span> HUMAN
          </h1>
          <p className="mt-3 font-mono text-[12px] tracking-[0.2em] text-slate-400">
            Same city. Same resources. {setup.years} years.
          </p>
        </div>

        <div className="glass-strong p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="City seed">
              <div className="grid grid-cols-2 gap-1">
                {NAMED_SEEDS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => update({ seed: s.seed, seedLabel: s.label })}
                    title={s.blurb}
                    className={`rounded-lg border px-2.5 py-2 text-left transition-all ${
                      setup.seed === s.seed
                        ? 'border-cyan-300/60 bg-cyan-300/12 shadow-glow'
                        : 'border-white/10 bg-white/[0.03] hover:border-cyan-300/35'
                    }`}
                  >
                    <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-slate-100">
                      {s.label}
                    </div>
                    <div className="mt-0.5 truncate text-[9.5px] text-slate-500">{s.blurb}</div>
                  </button>
                ))}
              </div>
              <button
                onClick={() =>
                  update({ seed: Math.floor(Math.random() * 1_000_000), seedLabel: 'Random' })
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 transition-colors hover:border-cyan-300/35 hover:text-cyan-100"
              >
                ⟳ Random seed {setup.seedLabel === 'Random' && `· ${setup.seed}`}
              </button>
            </Field>

            <div className="space-y-4">
              <Field label="Starting budget">
                <Pills
                  options={BUDGET_OPTIONS}
                  value={setup.budget}
                  onChange={(v) => update({ budget: v })}
                  render={(v) => money(v)}
                />
              </Field>
              <Field label="Starting population">
                <Pills
                  options={POPULATION_OPTIONS}
                  value={setup.population}
                  onChange={(v) => update({ population: v })}
                  render={(v) => v.toLocaleString('en-US')}
                />
              </Field>
              <Field label="Challenge length">
                <Pills
                  options={LENGTH_OPTIONS}
                  value={setup.years}
                  onChange={(v) => update({ years: v })}
                  render={(v) => `${v} years`}
                />
              </Field>
            </div>
          </div>

          <div className="my-5 hairline" />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Objective — this sets how both cities are scored">
              <div className="space-y-1">
                {OBJECTIVE_LIST.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => update({ objective: o.id as ChallengeObjectiveId })}
                    className={`flex w-full items-baseline justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition-all ${
                      setup.objective === o.id
                        ? 'border-cyan-300/60 bg-cyan-300/12 shadow-glow'
                        : 'border-white/10 bg-white/[0.03] hover:border-cyan-300/35'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[11px] uppercase tracking-[0.1em] text-slate-100">
                        {o.label}
                      </span>
                      <span className="mt-0.5 block truncate text-[9.5px] text-slate-500">
                        {o.blurb}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="AI personality — your opponent">
              <div className="space-y-1">
                {PERSONALITY_LIST.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => update({ personality: p.id })}
                    className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all ${
                      setup.personality === p.id
                        ? ACCENT[p.accent]
                        : 'border-white/10 bg-white/[0.03] hover:border-white/25'
                    }`}
                  >
                    <span className="mt-[1px] w-4 shrink-0 text-center font-mono text-[13px]">
                      {p.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[11px] uppercase tracking-[0.1em]">
                        {p.label}
                      </span>
                      <span className="mt-0.5 block text-[9.5px] leading-snug text-slate-400">
                        {p.blurb}
                      </span>
                      <span className="mt-1 block text-[9px] italic leading-snug text-slate-500">
                        {p.style}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <p className="mt-4 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[10.5px] leading-relaxed text-slate-400">
            Both cities are generated from the same seed and begin from the{' '}
            <span className="text-slate-200">identical snapshot</span> — same buildings, same roads,
            same population, same money. Emergencies are drawn from the same seeded timeline, so
            neither side ever gets a roll the other did not.
          </p>

          {/* ---- actions ---- */}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => start(false)}
              className="relative flex-1 overflow-hidden rounded-xl border border-cyan-300/60 bg-gradient-to-b from-cyan-400/30 to-cyan-500/10 px-5 py-3.5 font-mono text-[13px] font-bold uppercase tracking-[0.22em] text-cyan-50 shadow-glow transition-all hover:from-cyan-300/45 active:scale-[0.99]"
            >
              Start challenge
              <span className="pointer-events-none absolute inset-0 -translate-x-full animate-sweep bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            </button>
            <button
              onClick={() => start(true)}
              className="rounded-xl border border-fuchsia-300/45 bg-fuchsia-400/12 px-4 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fuchsia-100 transition-all hover:bg-fuchsia-400/22 active:scale-[0.99]"
              title="No human player — watch the AI run the city for the whole challenge"
            >
              Watch AI only
            </button>
            <button
              onClick={runTournament}
              className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3.5 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-300 transition-all hover:border-cyan-300/40 hover:text-cyan-100"
              title="Run all four personalities on this city and rank them"
            >
              AI tournament
            </button>
            <button
              onClick={close}
              className="rounded-xl border border-white/10 px-4 py-3.5 font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500 transition-colors hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
