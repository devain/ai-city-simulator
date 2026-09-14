import { useSandboxStore } from '../../store/useSandboxStore'
import { LEVEL_TONE } from '../../ai/CityPriorities'
import { MODES } from '../../sandbox/modes'
import { money } from '../../lib/format'

const SEVERITY: Record<string, { border: string; bg: string; text: string; icon: string }> = {
  INFO: { border: 'border-sky-300/30', bg: 'bg-sky-300/[0.06]', text: 'text-sky-200', icon: 'ℹ' },
  WARNING: {
    border: 'border-amber-300/35',
    bg: 'bg-amber-300/[0.07]',
    text: 'text-amber-200',
    icon: '⚠',
  },
  CRITICAL: {
    border: 'border-rose-400/40',
    bg: 'bg-rose-500/[0.09]',
    text: 'text-rose-200',
    icon: '⚠',
  },
}

/**
 * AI ASSIST's face: the city's status, the one thing most worth fixing, and a
 * recommendation with the simulated outcome attached — and a button that the
 * AI can never press itself.
 */
export function AIAdvisorPanel() {
  const mode = useSandboxStore((s) => s.mode)
  const advice = useSandboxStore((s) => s.advice)
  const priorities = useSandboxStore((s) => s.priorities)
  const health = useSandboxStore((s) => s.health)
  const accept = useSandboxStore((s) => s.acceptAdvice)
  const dismiss = useSandboxStore((s) => s.dismissAdvice)
  const treasury = useSandboxStore((s) => s.treasury)

  if (mode === 'autonomous') return null

  const top = priorities[0]
  const watching = priorities.filter((p) => p.level !== 'NORMAL').slice(0, 4)
  const quiet = !MODES[mode].aiMayAdvise

  return (
    <section className="glass p-3">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="panel-title">
          <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
          AI advisor
        </h2>
        <span
          className={`chip ${quiet ? '' : '!border-cyan-300/40 !text-cyan-200'}`}
          title={MODES[mode].blurb}
        >
          {quiet ? 'standing by' : 'watching'}
        </span>
      </header>

      {/* ---- the city, in three lines ---- */}
      <dl className="mb-2.5 space-y-1 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
        <Row label="City status" value={health.status} tone={statusTone(health.status)} />
        <Row label="Top issue" value={top ? `${top.label} · ${top.urgency}/100` : '—'} tone={top ? LEVEL_TONE[top.level] : undefined} />
        <Row
          label="Weakest system"
          value={`${health.weakest.label} · ${health.weakest.score}/100`}
        />
      </dl>

      {quiet ? (
        <p className="text-[10.5px] leading-relaxed text-slate-500">
          You have the city. The AI is not watching or recommending — switch to{' '}
          <span className="text-cyan-200">AI Assist</span> and it will monitor every change, predict
          what it will do and suggest what to build next.
        </p>
      ) : advice && !quiet ? (
        <AdviceCard advice={advice} treasury={treasury} onAccept={accept} onDismiss={dismiss} />
      ) : (
        <p className="rounded-lg border border-emerald-300/20 bg-emerald-400/[0.05] px-2.5 py-2 text-[10.5px] leading-relaxed text-emerald-100/80">
          Nothing needs attention. Every system has slack and the books balance — build what you like,
          and I will speak up when something changes.
        </p>
      )}

      {/* ---- the ranked list ---- */}
      {watching.length > 0 && (
        <div className="mt-2.5">
          <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
            Watching
          </span>
          <div className="mt-1.5 space-y-1">
            {watching.map((p) => (
              <div
                key={p.key}
                title={p.why}
                className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-[5px]"
              >
                <span className={`w-14 shrink-0 font-mono text-[8.5px] uppercase tracking-[0.1em] ${LEVEL_TONE[p.level]}`}>
                  {p.level}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10.5px] text-slate-200">{p.label}</span>
                <span className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-white/10">
                  <span
                    className={`block h-full rounded-full ${
                      p.level === 'CRITICAL'
                        ? 'bg-rose-400'
                        : p.level === 'WARNING'
                          ? 'bg-amber-300'
                          : 'bg-sky-300'
                    }`}
                    style={{ width: `${p.urgency}%` }}
                  />
                </span>
                <span className="w-6 shrink-0 text-right font-mono text-[9.5px] tabular-nums text-slate-400">
                  {p.urgency}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function AdviceCard({
  advice,
  treasury,
  onAccept,
  onDismiss,
}: {
  advice: NonNullable<ReturnType<typeof useSandboxStore.getState>['advice']>
  treasury: number
  onAccept: () => void
  onDismiss: () => void
}) {
  const s = SEVERITY[advice.severity] ?? SEVERITY.INFO
  return (
    <div className={`animate-riseIn rounded-lg border ${s.border} ${s.bg} p-2.5`}>
      <div className="flex items-center gap-1.5">
        <span className={`font-mono text-[11px] ${s.text}`}>{s.icon}</span>
        <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${s.text}`}>
          {advice.title}
        </span>
      </div>
      <p className="mt-1 font-mono text-[9.5px] text-slate-400">{advice.reading}</p>

      <p className="mt-2 text-[11.5px] leading-snug text-slate-100">{advice.recommendation}</p>

      <dl className="mt-2 space-y-[3px]">
        <Row label="Cost" value={money(advice.capex)} />
        {advice.opex > 0 && <Row label="Upkeep" value={`${money(advice.opex)}/yr`} />}
        {advice.outcome && <Row label="Expected" value={advice.outcome} tone="text-cyan-200" />}
        {advice.healthDelta != null && advice.healthDelta !== 0 && (
          <Row
            label="City health"
            value={`${advice.healthDelta > 0 ? '+' : ''}${advice.healthDelta}`}
            tone={advice.healthDelta > 0 ? 'text-emerald-300' : 'text-rose-300'}
          />
        )}
      </dl>

      {advice.unaffordable && (
        <p className="mt-2 rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 font-mono text-[9.5px] leading-snug text-rose-200">
          Insufficient funds — needs {money(advice.capex)}, you have {money(treasury)}
        </p>
      )}

      <div className="mt-2.5 flex gap-1.5">
        <button
          onClick={onAccept}
          disabled={advice.unaffordable || !advice.itemId}
          className="flex-1 rounded-lg border border-cyan-300/55 bg-gradient-to-b from-cyan-400/25 to-cyan-500/10 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-50 shadow-glow transition-all hover:from-cyan-300/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Build recommendation
        </button>
        <button
          onClick={onDismiss}
          className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400 transition-colors hover:text-slate-100"
        >
          Not now
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className={`truncate text-right text-[10.5px] ${tone ?? 'text-slate-200'}`}>{value}</dd>
    </div>
  )
}

const statusTone = (s: string) =>
  s === 'EXCELLENT'
    ? 'text-emerald-300'
    : s === 'HEALTHY'
      ? 'text-cyan-200'
      : s === 'WARNING'
        ? 'text-amber-300'
        : 'text-rose-300'
