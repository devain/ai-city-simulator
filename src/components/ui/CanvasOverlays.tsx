import { useCityStore, type HeatLayer } from '../../store/useCityStore'
import { BUILDING_LABELS, PRESSURE_COLORS, heatCss } from '../../lib/colors'
import { compact, full, money, signedPct } from '../../lib/format'
import { delta, DISTRICT_NAMES } from '../../simulation/citySimulation'
import type { MetricKey } from '../../simulation/types'

/** one world unit of building height reads as roughly one storey */
const STOREY_M = 3.6

const LAYERS: { id: HeatLayer; label: string }[] = [
  { id: 'none', label: 'Off' },
  { id: 'traffic', label: 'Traffic' },
  { id: 'electricity', label: 'Energy' },
  { id: 'water', label: 'Water' },
  { id: 'retail', label: 'Retail' },
  { id: 'education', label: 'Schools' },
  { id: 'parking', label: 'Parking' },
  { id: 'emissions', label: 'CO₂' },
]

export function HeatmapBar() {
  const heatLayer = useCityStore((s) => s.heatLayer)
  const setHeatLayer = useCityStore((s) => s.setHeatLayer)

  return (
    <div className="pointer-events-auto absolute left-3 top-3 z-20 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-1 rounded-xl border border-white/[0.08] bg-[#060c18]/75 p-1.5 backdrop-blur-xl">
      <span className="px-1.5 font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
        Heatmap
      </span>
      {LAYERS.map((l) => {
        const on = heatLayer === l.id
        return (
          <button
            key={l.id}
            onClick={() => setHeatLayer(l.id)}
            className={`rounded-lg px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] transition-all ${
              on
                ? 'bg-cyan-300/20 text-white shadow-glow ring-1 ring-cyan-300/50'
                : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
            }`}
          >
            {l.label}
          </button>
        )
      })}
      {heatLayer !== 'none' && (
        <div className="ml-1 flex items-center gap-1.5 border-l border-white/10 pl-2">
          <span className="font-mono text-[8.5px] text-slate-500">low</span>
          <div
            className="h-2 w-24 rounded-full"
            style={{
              background: `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1]
                .map((t) => heatCss(t))
                .join(',')})`,
            }}
          />
          <span className="font-mono text-[8.5px] text-slate-500">critical</span>
        </div>
      )}
    </div>
  )
}

export function DemoCaption() {
  const caption = useCityStore((s) => s.demoCaption)
  const step = useCityStore((s) => s.demoStep)
  if (!caption) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[30%] z-30 flex -translate-y-1/2 flex-col items-center gap-3">
      <div
        key={caption}
        className="animate-riseIn rounded-2xl border border-cyan-300/25 bg-[#040810]/70 px-7 py-4 backdrop-blur-md"
        style={{ boxShadow: '0 0 60px -18px rgba(56,240,255,0.65)' }}
      >
        <p className="text-center font-mono text-[15px] font-bold tracking-[0.28em] text-white text-glow sm:text-[19px]">
          {caption}
        </p>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className={`h-[3px] w-5 rounded-full transition-all duration-500 ${
              i <= step ? 'bg-cyan-300 shadow-glow' : 'bg-white/15'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

export function BuildingInspector() {
  const selectedId = useCityStore((s) => s.selectedBuilding)
  const city = useCityStore((s) => s.city)
  const districts = useCityStore((s) => s.current.districts)
  const heatLayer = useCityStore((s) => s.heatLayer)
  const setSelected = useCityStore((s) => s.setSelected)

  const b = city.buildings.find((x) => x.id === selectedId)
  if (!b) return null
  const d = districts.find((x) => x.id === b.district)

  const rows: [string, string][] = [
    ['District', DISTRICT_NAMES[b.district]],
    ...(b.capacity > 0 ? ([['Dwelling capacity', `${full(b.capacity)} residents`]] as [string, string][]) : []),
    ...(b.jobs > 0 ? ([['Jobs', full(b.jobs)]] as [string, string][]) : []),
    ...(b.retailSqm > 0 ? ([['Retail floor area', `${full(b.retailSqm)} m²`]] as [string, string][]) : []),
    ...(b.studentCapacity > 0 ? ([['Student seats', full(b.studentCapacity)]] as [string, string][]) : []),
    ...(b.beds > 0 ? ([['Hospital beds', full(b.beds)]] as [string, string][]) : []),
    ...(b.parkingSpaces > 0 ? ([['Parking spaces', full(b.parkingSpaces)]] as [string, string][]) : []),
    ...(b.greenHa > 0 ? ([['Green space', `${b.greenHa.toFixed(1)} ha`]] as [string, string][]) : []),
    ['Height', `${Math.round(b.h * STOREY_M)} m · ${Math.max(1, Math.round(b.h))} floors`],
  ]

  const pressures: [string, number][] = d
    ? [
        ['Traffic', d.traffic],
        ['Energy', d.electricity],
        ['Water', d.water],
        ['Schools', d.education],
        ['Parking', d.parking],
      ]
    : []

  return (
    <div className="pointer-events-auto absolute bottom-[150px] left-3 z-20 w-[272px] animate-riseIn rounded-xl border border-cyan-300/20 bg-[#060c18]/88 p-3 backdrop-blur-xl shadow-glass">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-cyan-300/70">
            {BUILDING_LABELS[b.type]}
            {b.isNew && <span className="ml-1.5 text-emerald-300">· new</span>}
          </p>
          <h3 className="mt-0.5 truncate text-[13px] font-semibold text-white">{b.label}</h3>
        </div>
        <button
          className="shrink-0 rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 hover:text-white"
          onClick={() => setSelected(null)}
        >
          ✕
        </button>
      </div>

      <div className="hairline my-2" />

      <dl className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2 font-mono text-[10px]">
            <dt className="truncate text-slate-500">{k}</dt>
            <dd className="tabular-nums text-slate-200">{v}</dd>
          </div>
        ))}
      </dl>

      {pressures.length > 0 && (
        <>
          <div className="hairline my-2" />
          <p className="mb-1.5 font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
            District pressure
          </p>
          <div className="space-y-1">
            {pressures.map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-12 font-mono text-[9px] text-slate-500">{k}</span>
                <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, v * 100)}%`,
                      background: heatCss(v),
                      boxShadow: `0 0 8px ${heatCss(v)}`,
                    }}
                  />
                </div>
                <span className="w-7 text-right font-mono text-[9px] tabular-nums text-slate-500">
                  {(v * 100).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {heatLayer !== 'none' && (
        <p className="mt-2 font-mono text-[8.5px] text-slate-600">
          Showing {heatLayer} heat layer — intensity is district pressure weighted by building type.
        </p>
      )}
    </div>
  )
}

const COMPARE_KEYS: MetricKey[] = [
  'population',
  'traffic',
  'electricity',
  'water',
  'retail',
  'education',
  'parking',
  'emissions',
  'cost',
]

export function CompareOverlay() {
  const compareMode = useCityStore((s) => s.compareMode)
  const split = useCityStore((s) => s.compareSplit)
  const setSplit = useCityStore((s) => s.setCompareSplit)
  const toggle = useCityStore((s) => s.toggleCompare)
  const baseline = useCityStore((s) => s.baseline)
  const current = useCityStore((s) => s.current)

  if (!compareMode) return null

  return (
    <>
      {/* wipe indicator over the 3D view */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <div
          className="absolute inset-y-0 w-px bg-cyan-300/70"
          style={{ left: `${split * 100}%`, boxShadow: '0 0 24px rgba(56,240,255,0.8)' }}
        />
        <div
          className="absolute top-3 -translate-x-1/2 rounded-full border border-cyan-300/40 bg-[#040810]/80 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-100 backdrop-blur"
          style={{ left: `${split * 100}%` }}
        >
          {split < 0.5 ? 'current city' : 'simulated city'}
        </div>
      </div>

      <div className="pointer-events-auto absolute inset-x-3 bottom-[150px] z-30 animate-riseIn rounded-xl border border-white/10 bg-[#060c18]/90 p-3 backdrop-blur-2xl shadow-glass sm:inset-x-auto sm:right-3 sm:w-[520px]">
        <div className="flex items-center justify-between">
          <h3 className="panel-title">
            <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
            Before / after comparison
          </h3>
          <button className="btn !px-2 !py-1" onClick={() => toggle(false)}>
            Close
          </button>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
            Current
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={split}
            onChange={(e) => setSplit(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-300">
            Simulated
          </span>
        </div>
        <p className="mt-1 font-mono text-[8.5px] text-slate-600">
          Drag to morph the 3D city between the two states — new buildings grow in as you slide.
        </p>

        <div className="mt-2.5 max-h-[36vh] overflow-y-auto scroll-thin">
          <table className="w-full border-collapse">
            <thead>
              <tr className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-slate-500">
                <th className="pb-1 text-left font-normal">Metric</th>
                <th className="pb-1 text-right font-normal">Current</th>
                <th className="pb-1 text-right font-normal">Simulated</th>
                <th className="pb-1 text-right font-normal">Δ</th>
                <th className="pb-1 text-right font-normal">Pressure</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE_KEYS.map((k) => {
                const a = baseline.metrics[k]
                const b = current.metrics[k]
                const ch = delta(b.value, a.value)
                const fmt = (v: number) => (k === 'cost' ? money(v) : compact(v))
                return (
                  <tr key={k} className="border-t border-white/[0.05]">
                    <td className="py-1.5 text-[10.5px] text-slate-300">{a.label}</td>
                    <td className="py-1.5 text-right font-mono text-[10.5px] tabular-nums text-slate-500">
                      {fmt(a.value)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-[10.5px] font-semibold tabular-nums text-white">
                      {fmt(b.value)}
                    </td>
                    <td
                      className={`py-1.5 text-right font-mono text-[10.5px] tabular-nums ${
                        ch > 0.05 ? 'text-rose-300' : ch < -0.05 ? 'text-emerald-300' : 'text-slate-600'
                      }`}
                    >
                      {Math.abs(ch) < 0.05 ? '—' : signedPct(ch)}
                    </td>
                    <td className="py-1.5 text-right">
                      <span
                        className="rounded-full px-1.5 py-[2px] font-mono text-[8.5px] tracking-[0.1em]"
                        style={{
                          color: PRESSURE_COLORS[b.pressure],
                          background: `${PRESSURE_COLORS[b.pressure]}18`,
                        }}
                      >
                        {b.pressure}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export function ViewHud() {
  const placementTool = useCityStore((s) => s.placementTool)
  const hovered = useCityStore((s) => s.hoveredBuilding)
  const city = useCityStore((s) => s.city)
  const isRunning = useCityStore((s) => s.isRunning)
  const progress = useCityStore((s) => s.runProgress)
  const hb = hovered ? city.buildings.find((b) => b.id === hovered) : undefined

  return (
    <>
      {isRunning && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[2px] bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 shadow-glow transition-[width] duration-150"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      <div className="pointer-events-none absolute bottom-[150px] right-3 z-20 flex flex-col items-end gap-1.5">
        {hb && (
          <div className="rounded-lg border border-white/10 bg-[#060c18]/85 px-2.5 py-1.5 backdrop-blur">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-cyan-300/70">
              {BUILDING_LABELS[hb.type]}
            </p>
            <p className="text-[11px] text-slate-200">{hb.label}</p>
          </div>
        )}
        <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-slate-600">
          {placementTool
            ? 'click to place · esc to cancel'
            : 'drag to orbit · scroll to zoom · click a building to inspect'}
        </p>
      </div>
    </>
  )
}
