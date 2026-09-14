import { useEffect, useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useCityStore } from '../../store/useCityStore'
import { clock, formatClock } from '../../lib/clock'
import { delta } from '../../simulation/citySimulation'
import { heatCss } from '../../lib/colors'
import { signedPct } from '../../lib/format'
import type { MetricKey } from '../../simulation/types'

/** diurnal shape applied to the daily totals so the live chart breathes */
function diurnal(hour: number, kind: 'traffic' | 'electricity' | 'water' | 'emissions') {
  const peak = (h: number, c: number, w: number) => Math.exp(-((h - c) ** 2) / (2 * w * w))
  switch (kind) {
    case 'traffic':
      return 0.34 + 0.95 * peak(hour, 8.2, 1.5) + 1.0 * peak(hour, 17.8, 1.9)
    case 'electricity':
      return 0.62 + 0.35 * peak(hour, 11, 3) + 0.7 * peak(hour, 19.5, 2.4)
    case 'water':
      return 0.45 + 0.7 * peak(hour, 7.4, 1.6) + 0.55 * peak(hour, 20, 2.2)
    default:
      return 0.55 + 0.5 * peak(hour, 9, 3) + 0.45 * peak(hour, 18.5, 2.6)
  }
}

function useHistoryTicker() {
  const pushHistory = useCityStore((s) => s.pushHistory)
  useEffect(() => {
    const id = setInterval(() => {
      const s = useCityStore.getState()
      const p = s.runProgress
      const v = (k: MetricKey) =>
        s.previous.metrics[k].value + (s.current.metrics[k].value - s.previous.metrics[k].value) * p
      const h = clock.hour
      // indexed to the baseline city (= 100) so three different units share one axis
      const idx = (k: MetricKey, kind: Parameters<typeof diurnal>[1]) =>
        (v(k) / Math.max(1, s.baseline.metrics[k].value)) * diurnal(h, kind) * 100
      pushHistory({
        t: h,
        traffic: idx('traffic', 'traffic'),
        electricity: idx('electricity', 'electricity'),
        water: idx('water', 'water'),
        emissions: idx('emissions', 'emissions'),
      })
    }, 700)
    return () => clearInterval(id)
  }, [pushHistory])
}

const SHORT_LABEL: Partial<Record<MetricKey, string>> = {
  traffic: 'Traffic',
  electricity: 'Power',
  water: 'Water',
  retail: 'Retail',
  education: 'School',
  parking: 'Parking',
  emissions: 'CO₂',
  cost: 'Cost',
}

const CHART_KEYS: MetricKey[] = [
  'traffic',
  'electricity',
  'water',
  'retail',
  'education',
  'parking',
  'emissions',
  'cost',
]

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass flex min-w-0 flex-col p-2.5">
      <header className="mb-1 flex items-center justify-between gap-2">
        <h3 className="panel-title">
          <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
          {title}
        </h3>
        {right}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

export function BottomPanel() {
  useHistoryTicker()
  const history = useCityStore((s) => s.history)
  const current = useCityStore((s) => s.current)
  const baseline = useCityStore((s) => s.baseline)

  const deltaData = useMemo(
    () =>
      CHART_KEYS.map((k) => ({
        name: SHORT_LABEL[k],
        key: k,
        change: delta(current.metrics[k].value, baseline.metrics[k].value),
      })),
    [current, baseline],
  )

  const radarData = useMemo(
    () =>
      CHART_KEYS.map((k) => ({
        subject: SHORT_LABEL[k] ?? k,
        baseline: Math.min(140, baseline.metrics[k].utilisation * 100),
        scenario: Math.min(140, current.metrics[k].utilisation * 100),
      })),
    [current, baseline],
  )

  return (
    <div className="grid h-full auto-cols-[minmax(258px,1fr)] grid-flow-col gap-2.5 overflow-x-auto scroll-thin p-2.5 pt-0 xl:auto-cols-auto xl:grid-flow-row xl:grid-cols-[1.35fr_1fr_0.85fr_0.9fr] xl:overflow-x-visible">
      <Card
        title="Live system load"
        right={<span className="chip tabular-nums">baseline = 100</span>}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 4, right: 6, left: -22, bottom: 0 }}>
            <defs>
              {[
                ['gTraffic', '#38bdf8'],
                ['gEnergy', '#facc15'],
                ['gWater', '#22d3ee'],
              ].map(([id, c]) => (
                <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity={0.55} />
                  <stop offset="100%" stopColor={c} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={(v) => formatClock(v)}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[0, 'auto']}
              tickFormatter={(v) => `${Math.round(v)}`}
            />
            <ReferenceLine y={100} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
            <Tooltip
              labelFormatter={(v) => formatClock(Number(v))}
              formatter={(v: number, n: string) => [`${v.toFixed(0)} index`, n]}
            />
            <Area
              type="monotone"
              dataKey="traffic"
              name="Traffic"
              stroke="#38bdf8"
              strokeWidth={1.6}
              fill="url(#gTraffic)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="electricity"
              name="Electricity"
              stroke="#facc15"
              strokeWidth={1.6}
              fill="url(#gEnergy)"
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="water"
              name="Water"
              stroke="#22d3ee"
              strokeWidth={1.6}
              fill="url(#gWater)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Change vs baseline" right={<span className="chip">% delta</span>}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={deltaData} margin={{ top: 6, right: 6, left: -26, bottom: 14 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              interval={0}
              angle={-38}
              textAnchor="end"
              height={26}
              tick={{ fontSize: 8.5, fill: 'rgba(203,232,255,0.45)' }}
            />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${v}%`} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.18)" />
            <Tooltip formatter={(v: number) => signedPct(v)} />
            <Bar dataKey="change" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {deltaData.map((d) => (
                <Cell
                  key={d.key}
                  fill={d.change >= 0 ? heatCss(Math.min(0.95, 0.35 + d.change / 60)) : '#34d399'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Pressure profile" right={<span className="chip">% of capacity</span>}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} outerRadius="76%">
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8.5, fill: 'rgba(203,232,255,0.45)' }} />
            <Radar
              name="Baseline"
              dataKey="baseline"
              stroke="#64748b"
              fill="#64748b"
              fillOpacity={0.16}
              isAnimationActive={false}
            />
            <Radar
              name="Scenario"
              dataKey="scenario"
              stroke="#38f0ff"
              fill="#38f0ff"
              fillOpacity={0.26}
              isAnimationActive={false}
            />
            <Tooltip formatter={(v: number) => `${v.toFixed(0)}%`} />
          </RadarChart>
        </ResponsiveContainer>
      </Card>

      <EventLog />
    </div>
  )
}

const KIND_COLOR: Record<string, string> = {
  info: '#60a5fa',
  ok: '#34d399',
  warn: '#fbbf24',
  alert: '#fb5e6d',
  ai: '#c084fc',
}

export function EventLog() {
  const events = useCityStore((s) => s.events)
  return (
    <Card
      title="Event log"
      right={
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulseGlow rounded-full bg-emerald-400" />
          <span className="chip">live</span>
        </span>
      }
    >
      <div className="h-full overflow-y-auto scroll-thin pr-1">
        <ul className="space-y-[3px]">
          {events.map((e) => (
            <li key={e.id} className="flex animate-riseIn items-start gap-2">
              <span className="shrink-0 font-mono text-[9px] tabular-nums text-slate-600">
                {e.time}
              </span>
              <span
                className="mt-[5px] h-1 w-1 shrink-0 rounded-full"
                style={{ background: KIND_COLOR[e.kind], boxShadow: `0 0 8px ${KIND_COLOR[e.kind]}` }}
              />
              <span className="min-w-0 font-mono text-[9.5px] leading-snug text-slate-400">
                {e.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
