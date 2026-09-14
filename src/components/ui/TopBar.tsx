import { useCityStore } from '../../store/useCityStore'
import { formatClock, useClockHour } from '../../lib/clock'
import { compact, full, signedPct } from '../../lib/format'
import { delta } from '../../simulation/citySimulation'
import { PRESSURE_TEXT } from '../../lib/colors'
import { SCENARIO_BY_ID } from '../../simulation/scenarios'
import { startDemo as startPhase2Demo, stopDemo as stopPhase2Demo } from '../../store/demo'

function Readout({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col leading-none">
      <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <span className={`mt-1 font-mono text-[13px] font-semibold tabular-nums ${tone ?? 'text-slate-100'}`}>
        {value}
      </span>
    </div>
  )
}

export function TopBar({
  onTogglePanel,
}: {
  onTogglePanel: (side: 'left' | 'right') => void
}) {
  const current = useCityStore((s) => s.current)
  const baseline = useCityStore((s) => s.baseline)
  const p = useCityStore((s) => s.runProgress)
  const previous = useCityStore((s) => s.previous)
  const isRunning = useCityStore((s) => s.isRunning)
  const demoActive = useCityStore((s) => s.demoActive)
  const startDemo = startPhase2Demo
  const stopDemo = stopPhase2Demo
  const scenario = useCityStore((s) => s.scenario)
  const hour = useClockHour()

  const pop = previous.population + (current.population - previous.population) * p
  const popDelta = delta(pop, baseline.population)
  const infra = current.metrics.infrastructure

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#060a14]/85 px-3 backdrop-blur-xl">
      <div className="flex items-center gap-2.5">
        <div className="relative grid h-8 w-8 place-items-center rounded-lg border border-cyan-300/40 bg-cyan-300/10">
          <div className="h-3 w-3 rounded-[3px] border border-cyan-200 shadow-glow" />
          <div className="absolute inset-0 animate-pulseGlow rounded-lg shadow-glow" />
        </div>
        <div className="leading-none">
          <h1 className="font-mono text-[13px] font-bold tracking-[0.22em] text-white text-glow">
            AI CITY SIMULATOR
          </h1>
          <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.2em] text-cyan-300/60">
            Smart-city command center
          </p>
        </div>
      </div>

      <div className="mx-1 hidden h-8 w-px bg-white/10 lg:block" />

      <div className="hidden min-w-0 flex-1 items-center gap-5 overflow-x-auto scroll-thin lg:flex">
        <Readout label="Population" value={full(pop)} tone="text-cyan-200" />
        <Readout
          label="Δ vs baseline"
          value={Math.abs(popDelta) < 0.05 ? '—' : signedPct(popDelta)}
          tone={popDelta > 0 ? 'text-amber-300' : 'text-slate-300'}
        />
        <Readout label="Peak veh/h" value={compact(current.metrics.traffic.value)} />
        <Readout label="Grid MW" value={current.raw.peakDemandMw.toFixed(1)} />
        <Readout
          label="Infra pressure"
          value={`${infra.value.toFixed(0)}`}
          tone={PRESSURE_TEXT[infra.pressure]}
        />
        <Readout label="City time" value={formatClock(hour)} tone="text-slate-300" />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="hidden rounded-full border border-amber-300/25 bg-amber-300/[0.07] px-2.5 py-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-amber-200/90 xl:inline">
          Prototype simulation — illustrative estimates
        </span>

        <span
          className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] sm:inline-flex ${
            isRunning
              ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100'
              : 'border-white/10 bg-white/[0.03] text-slate-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'animate-pulseGlow bg-cyan-300' : 'bg-emerald-400'}`}
          />
          {SCENARIO_BY_ID[scenario].short}
        </span>

        <button
          onClick={() => (demoActive ? stopDemo() : startDemo())}
          className={`relative overflow-hidden rounded-lg border px-3.5 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-all ${
            demoActive
              ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
              : 'border-cyan-300/50 bg-gradient-to-b from-cyan-400/25 to-cyan-500/10 text-cyan-50 shadow-glow hover:from-cyan-300/35'
          }`}
        >
          {demoActive ? 'Stop' : 'Demo'}
          {!demoActive && (
            <span className="pointer-events-none absolute inset-0 -translate-x-full animate-sweep bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          )}
        </button>

        <button className="btn !px-2 !py-1.5 lg:hidden" onClick={() => onTogglePanel('left')}>
          Controls
        </button>
        <button className="btn !px-2 !py-1.5 lg:hidden" onClick={() => onTogglePanel('right')}>
          Analyst
        </button>
      </div>
    </header>
  )
}
