import { useSandboxStore } from '../../store/useSandboxStore'
import { useCityStore } from '../../store/useCityStore'
import { MODES, MODE_ORDER } from '../../sandbox/modes'
import { formatTick } from '../../sandbox/history'
import { money } from '../../lib/format'
import { useChallengeStore } from '../../store/useChallengeStore'
import { DemoModeButton } from './DemoStage'

const HEALTH_TONE: Record<string, string> = {
  EXCELLENT: 'text-emerald-300',
  HEALTHY: 'text-cyan-200',
  WARNING: 'text-amber-300',
  CRITICAL: 'text-rose-300',
}

const ACCENT: Record<string, { on: string; dot: string }> = {
  sky: { on: 'border-sky-300/60 bg-sky-300/15 text-sky-50 shadow-glow', dot: 'bg-sky-300' },
  cyan: { on: 'border-cyan-300/60 bg-cyan-300/15 text-cyan-50 shadow-glow', dot: 'bg-cyan-300' },
  fuchsia: {
    on: 'border-fuchsia-300/60 bg-fuchsia-400/15 text-fuchsia-50 shadow-glow',
    dot: 'bg-fuchsia-300',
  },
}

/**
 * The strip that answers "who is in control?" at a glance — plus the money,
 * the calendar and the one number that summarises the whole city.
 *
 * This sits directly under the title bar because in Phase 5 it is the most
 * important thing on screen: everything else changes meaning depending on
 * which of the three modes is lit.
 */
export function SandboxBar({ onShowHistory }: { onShowHistory: () => void }) {
  const mode = useSandboxStore((s) => s.mode)
  const setMode = useSandboxStore((s) => s.setMode)
  const treasury = useSandboxStore((s) => s.treasury)
  const finance = useSandboxStore((s) => s.finance)
  const health = useSandboxStore((s) => s.health)
  const tick = useSandboxStore((s) => s.tick)
  const clockRunning = useSandboxStore((s) => s.clockRunning)
  const toggleClock = useSandboxStore((s) => s.toggleClock)
  const msPerTick = useSandboxStore((s) => s.msPerTick)
  const setSpeed = useSandboxStore((s) => s.setSpeed)
  const events = useSandboxStore((s) => s.activeEvents)
  const agentPaused = useSandboxStore((s) => s.agentPaused)
  const openChallenge = useChallengeStore((s) => s.open)
  const population = useCityStore((s) => s.current.population)

  const spec = MODES[mode]
  const accent = ACCENT[spec.accent]

  return (
    <div className="relative z-30 flex h-[46px] shrink-0 items-center gap-3 overflow-x-auto border-b border-white/[0.07] bg-[#070c17]/85 px-3 backdrop-blur-xl scroll-thin">
      {/* ---- mode selector ---- */}
      <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
        {MODE_ORDER.map((m) => {
          const ms = MODES[m]
          const on = m === mode
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              title={ms.blurb}
              className={`rounded-lg border px-3 py-[7px] font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition-all active:scale-[0.98] ${
                on
                  ? ACCENT[ms.accent].on
                  : 'border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
              }`}
            >
              <span className="mr-1.5">{ms.icon}</span>
              {ms.label}
            </button>
          )
        })}
      </div>

      {/* ---- who is in control ---- */}
      <div className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accent.dot} animate-pulseGlow`} />
        <div className="leading-none">
          <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">Control</div>
          <div className="mt-[3px] font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white">
            {spec.control}
          </div>
        </div>
        <div className="ml-1 hidden leading-none sm:block">
          <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">AI</div>
          <div
            className={`mt-[3px] font-mono text-[10px] uppercase tracking-[0.12em] ${
              mode === 'autonomous' && agentPaused ? 'text-amber-300' : 'text-slate-300'
            }`}
          >
            {mode === 'autonomous' && agentPaused ? 'Paused' : spec.aiRole}
          </div>
        </div>
      </div>

      {/* ---- the calendar ---- */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={toggleClock}
          title={clockRunning ? 'Pause the simulated calendar' : 'Let time run'}
          className={`grid h-8 w-8 place-items-center rounded-lg border font-mono text-[11px] transition-all active:scale-95 ${
            clockRunning
              ? 'border-emerald-300/50 bg-emerald-300/12 text-emerald-200'
              : 'border-white/12 bg-white/[0.04] text-slate-300 hover:border-cyan-300/40'
          }`}
        >
          {clockRunning ? '❚❚' : '▶'}
        </button>
        <div className="leading-none">
          <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">Date</div>
          <div className="mt-[3px] font-mono text-[11px] font-semibold tabular-nums text-slate-100">
            {formatTick(tick)}
          </div>
        </div>
        <div className="hidden items-center gap-[3px] md:flex">
          {[
            { ms: 2400, label: '1×' },
            { ms: 1100, label: '2×' },
            { ms: 450, label: '5×' },
          ].map((s) => (
            <button
              key={s.ms}
              onClick={() => setSpeed(s.ms)}
              className={`rounded px-1.5 py-1 font-mono text-[9px] tabular-nums transition-colors ${
                msPerTick === s.ms
                  ? 'bg-cyan-300/20 text-white ring-1 ring-cyan-300/40'
                  : 'text-slate-500 hover:text-slate-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-7 w-px shrink-0 bg-white/10" />

      {/* ---- the books ---- */}
      <div className="shrink-0 leading-none">
        <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">Budget</div>
        <div className="mt-[3px] font-mono text-[14px] font-bold tabular-nums text-emerald-200 text-glow">
          {money(treasury)}
        </div>
      </div>
      <div className="hidden shrink-0 leading-none sm:block">
        <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">Net / yr</div>
        <div
          className={`mt-[3px] font-mono text-[12px] font-semibold tabular-nums ${
            finance.netIncome >= 0 ? 'text-emerald-300' : 'text-rose-300'
          }`}
        >
          {finance.netIncome >= 0 ? '+' : '−'}
          {money(Math.abs(finance.netIncome))}
        </div>
      </div>
      <div className="hidden shrink-0 leading-none lg:block">
        <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">Residents</div>
        <div className="mt-[3px] font-mono text-[12px] font-semibold tabular-nums text-cyan-200">
          {Math.round(population).toLocaleString('en-US')}
        </div>
      </div>

      {/* ---- the one number ---- */}
      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        {events.length > 0 && (
          <div className="hidden items-center gap-1.5 rounded-lg border border-amber-300/35 bg-amber-300/[0.08] px-2.5 py-1.5 md:flex">
            <span className="animate-pulseGlow font-mono text-[11px] text-amber-300">
              {events[0].spec.icon}
            </span>
            <div className="leading-none">
              <div className="font-mono text-[8px] uppercase tracking-[0.18em] text-amber-300/70">
                Active event
              </div>
              <div className="mt-[3px] font-mono text-[10px] font-semibold text-amber-100">
                {events[0].spec.name}
                {events.length > 1 && ` +${events.length - 1}`}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onShowHistory}
          className="btn !px-2.5 !py-1.5 !text-[10px]"
          title="City history"
        >
          History
        </button>

        <DemoModeButton compact />

        <button
          onClick={openChallenge}
          className="relative overflow-hidden rounded-lg border border-fuchsia-300/50 bg-gradient-to-b from-fuchsia-400/25 to-fuchsia-500/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-fuchsia-50 shadow-glow transition-all hover:from-fuchsia-300/40 active:scale-[0.98]"
          title="Same city, same money, ten years — you against an autonomous AI"
        >
          AI vs Human
          <span className="pointer-events-none absolute inset-0 -translate-x-full animate-sweep bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </button>

        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
          <div className="leading-none">
            <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">
              City health
            </div>
            <div
              className={`mt-[3px] font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${HEALTH_TONE[health.status]}`}
            >
              {health.status}
            </div>
          </div>
          <div
            className={`font-mono text-[22px] font-bold tabular-nums leading-none ${HEALTH_TONE[health.status]} text-glow`}
          >
            {health.score}
          </div>
        </div>
      </div>
    </div>
  )
}
