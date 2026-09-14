import { useState } from 'react'
import { useCityStore } from '../../store/useCityStore'
import { SCENARIOS } from '../../simulation/scenarios'
import { PLACEABLE } from '../../city/placement'
import { clock, formatClock, setHour, useClockHour } from '../../lib/clock'
import { full } from '../../lib/format'
import { ChallengePanel } from './ChallengePanel'
import { BuildToolbar } from './BuildToolbar'
import { CityVitals } from './CityVitals'
import { CitySlots } from './CitySlots'
import type { CityConfig } from '../../simulation/config'

function Section({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="glass p-3">
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="panel-title">
          <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
          {title}
        </h2>
        {right}
      </header>
      {children}
    </section>
  )
}

export function LeftPanel() {
  const scenario = useCityStore((s) => s.scenario)
  const selectScenario = useCityStore((s) => s.selectScenario)
  const runScenario = useCityStore((s) => s.runScenario)
  const isRunning = useCityStore((s) => s.isRunning)
  const resetCity = useCityStore((s) => s.resetCity)
  const placementTool = useCityStore((s) => s.placementTool)
  const setPlacementTool = useCityStore((s) => s.setPlacementTool)
  const compareMode = useCityStore((s) => s.compareMode)
  const toggleCompare = useCityStore((s) => s.toggleCompare)
  const hasRun = useCityStore((s) => s.hasRun)
  const config = useCityStore((s) => s.config)
  const setConfigValue = useCityStore((s) => s.setConfigValue)
  const city = useCityStore((s) => s.city)
  const current = useCityStore((s) => s.current)

  const hour = useClockHour()
  const [speed, setSpeed] = useState(clock.speed)

  const active = SCENARIOS.find((s) => s.id === scenario)!

  return (
    <div className="flex h-full flex-col gap-2.5 overflow-y-auto scroll-thin p-2.5">
      {/* Phase 5 — the city is yours: build it, read it, save it */}
      <BuildToolbar />
      <CityVitals />
      <CitySlots />

      <Section title="Scenario presets">
        <div className="grid grid-cols-2 gap-1.5">
          {SCENARIOS.map((s) => {
            const on = s.id === scenario
            return (
              <button
                key={s.id}
                onClick={() => selectScenario(s.id)}
                className={`btn flex flex-col items-start gap-0.5 !px-2.5 !py-2 text-left ${on ? 'btn-active' : ''}`}
                style={on ? { borderColor: `${s.accent}88`, boxShadow: `0 0 18px -4px ${s.accent}` } : undefined}
              >
                <span className="font-mono text-[9px] tracking-[0.16em]" style={{ color: s.accent }}>
                  {s.icon} {s.short}
                </span>
                <span className="text-[10px] leading-tight text-slate-300">{s.name}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] leading-snug text-slate-500">{active.description}</p>
      </Section>

      <ChallengePanel />

      <Section title="Simulation control">
        <button className="btn-primary w-full" onClick={runScenario} disabled={isRunning}>
          {isRunning ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-200" />
              Running…
            </span>
          ) : (
            'Run simulation'
          )}
          {isRunning && (
            <span className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
              <span className="block h-full w-1/3 animate-sweep bg-cyan-200/80" />
            </span>
          )}
        </button>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button
            className={`btn ${compareMode ? 'btn-active' : ''}`}
            onClick={() => toggleCompare()}
            disabled={!hasRun && !compareMode}
          >
            Compare scenario
          </button>
          <button className="btn" onClick={resetCity}>
            Reset city
          </button>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>Time of day</span>
            <span className="tabular-nums text-cyan-200">{formatClock(hour)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={23.99}
            step={0.05}
            value={hour}
            onChange={(e) => setHour(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>Clock speed</span>
            <span className="tabular-nums text-cyan-200">{speed.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={0}
            max={4}
            step={0.05}
            value={speed}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              setSpeed(v)
              clock.speed = v
            }}
            className="w-full"
          />
        </div>
      </Section>

      <Section title="City building tool" right={
        placementTool ? (
          <button className="chip !text-cyan-200" onClick={() => setPlacementTool(null)}>
            cancel
          </button>
        ) : null
      }>
        <div className="grid grid-cols-2 gap-1.5">
          {PLACEABLE.map((t) => {
            const on = placementTool === t.type
            return (
              <button
                key={t.type}
                onClick={() => setPlacementTool(on ? null : (t.type as never))}
                className={`btn flex items-center gap-2 !px-2 !py-2 text-left ${on ? 'btn-active' : ''}`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-cyan-300/25 bg-cyan-300/10 font-mono text-[11px] text-cyan-200">
                  {t.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] leading-tight text-slate-200">{t.name}</span>
                  <span className="block font-mono text-[8.5px] leading-tight text-slate-500">
                    {t.blurb}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-[10px] leading-snug text-slate-500">
          {placementTool
            ? 'Click anywhere on the map — the building snaps to the nearest free plot and the simulation recalculates instantly.'
            : 'Pick a building type, then click the city to place it.'}
        </p>
      </Section>

      <Section title="City parameters">
        <div className="space-y-2.5">
          <Param
            label="Dwelling capacity"
            k="residentialCapacity"
            min={4000}
            max={26000}
            step={200}
            value={config.residentialCapacity}
            onChange={setConfigValue}
            fmt={full}
          />
          <Param
            label="Jobs"
            k="jobs"
            min={1000}
            max={16000}
            step={250}
            value={config.jobs}
            onChange={setConfigValue}
            fmt={full}
          />
          <Param
            label="Car ownership"
            k="carOwnershipRate"
            min={0.1}
            max={0.8}
            step={0.01}
            value={config.carOwnershipRate}
            onChange={setConfigValue}
            fmt={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <Param
            label="Trips per person / day"
            k="tripsPerPersonPerDay"
            min={1.5}
            max={5}
            step={0.05}
            value={config.tripsPerPersonPerDay}
            onChange={setConfigValue}
            fmt={(v) => v.toFixed(2)}
          />
          <Param
            label="Transit mode share"
            k="transitModeShare"
            min={0.05}
            max={0.6}
            step={0.01}
            value={config.transitModeShare}
            onChange={setConfigValue}
            fmt={(v) => `${(v * 100).toFixed(0)}%`}
          />
        </div>
      </Section>

      <Section title="City inventory">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[10px]">
          <Stat label="Residents" value={full(current.population)} />
          <Stat label="Vehicles" value={full(current.vehicles)} />
          <Stat label="Buildings" value={full(city.buildings.length)} />
          <Stat label="Jobs" value={full(current.jobs)} />
          <Stat label="Road segments" value={full(city.roads.length)} />
          <Stat label="Intersections" value={full(city.intersections.length)} />
          <Stat label="Schools" value={full(city.buildings.filter((b) => b.type === 'school').length)} />
          <Stat label="Hospitals" value={full(city.buildings.filter((b) => b.type === 'hospital').length)} />
        </dl>
      </Section>

      <p className="px-1 pb-1 text-[9px] leading-relaxed text-slate-600">
        Prototype simulation — illustrative estimates. Formulas are deterministic and transparent;
        they are not calibrated predictions of any real city.
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/[0.05] pb-1">
      <dt className="truncate text-slate-500">{label}</dt>
      <dd className="tabular-nums text-slate-200">{value}</dd>
    </div>
  )
}

function Param({
  label,
  k,
  min,
  max,
  step,
  value,
  onChange,
  fmt,
}: {
  label: string
  k: keyof CityConfig
  min: number
  max: number
  step: number
  value: number
  onChange: (k: keyof CityConfig, v: number) => void
  fmt: (v: number) => string
}) {
  const [local, setLocal] = useState(value)
  const shown = Math.abs(local - value) > 1e-9 ? local : value
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
        <span className="truncate">{label}</span>
        <span className="tabular-nums text-cyan-200">{fmt(shown)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(e) => setLocal(parseFloat(e.target.value))}
        onMouseUp={(e) => onChange(k, parseFloat((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onChange(k, parseFloat((e.target as HTMLInputElement).value))}
        className="w-full"
      />
    </div>
  )
}
