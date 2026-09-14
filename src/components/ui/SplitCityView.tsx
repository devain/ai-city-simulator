import { useState } from 'react'
import { MatchCanvas } from '../scene/CityCanvas'
import { useChallengeStore } from '../../store/useChallengeStore'
import { useCityStore } from '../../store/useCityStore'
import { useDemoStore } from '../../store/useDemoStore'
import { AI_PERSONALITIES } from '../../ai/AIPersonality'
import { money } from '../../lib/format'
import type { CitySnapshot } from '../../challenge/CityRuntime'
import type { CityScore } from '../../challenge/ScoreEngine'

const pct = (v: number) => `${Math.round(v * 100)}%`
const n = (v: number) => Math.round(v).toLocaleString('en-US')

function Stat({
  label,
  value,
  mine,
  theirs,
  lowerIsBetter,
}: {
  label: string
  value: string
  mine: number
  theirs: number
  lowerIsBetter?: boolean
}) {
  const winning = lowerIsBetter ? mine < theirs : mine > theirs
  const level = Math.abs(mine - theirs) < 1e-9 ? 'tie' : winning ? 'win' : 'lose'
  return (
    <div className="leading-none">
      <div className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-slate-600">{label}</div>
      <div
        className={`mt-[4px] font-mono text-[12px] font-semibold tabular-nums ${
          level === 'tie' ? 'text-slate-300' : level === 'win' ? 'text-emerald-300' : 'text-slate-400'
        }`}
      >
        {value}
        {level === 'win' && <span className="ml-1 text-[9px]">▲</span>}
      </div>
    </div>
  )
}

function SidePanel({
  title,
  subtitle,
  accent,
  snap,
  score,
  other,
  otherScore,
}: {
  title: string
  subtitle: string
  accent: string
  snap: CitySnapshot
  score: CityScore
  other: CitySnapshot
  otherScore: CityScore
}) {
  const r = snap.result
  const o = other.result
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-2.5">
      <div className="pointer-events-auto rounded-xl border border-white/10 bg-[#050b16]/92 p-2.5 shadow-glass backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="leading-none">
            <div className={`font-mono text-[11px] font-bold uppercase tracking-[0.2em] ${accent}`}>
              {title}
            </div>
            <div className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.16em] text-slate-500">
              {subtitle}
            </div>
          </div>
          <div className="text-right leading-none">
            <div className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-slate-600">
              City score
            </div>
            <div
              className={`mt-1 font-mono text-[26px] font-bold tabular-nums ${
                score.total >= otherScore.total ? 'text-emerald-300 text-glow' : 'text-slate-300'
              }`}
            >
              {score.total.toFixed(1)}
            </div>
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-4 gap-x-2 gap-y-2">
          <Stat label="Population" value={n(r.population)} mine={r.population} theirs={o.population} />
          <Stat label="Budget" value={money(snap.treasury)} mine={snap.treasury} theirs={other.treasury} />
          <Stat
            label="Traffic"
            value={pct(r.metrics.traffic.utilisation)}
            mine={r.metrics.traffic.utilisation}
            theirs={o.metrics.traffic.utilisation}
            lowerIsBetter
          />
          <Stat
            label="Economy"
            value={`$${(r.raw.grossValueAdded / 1e6).toFixed(0)}M`}
            mine={r.raw.grossValueAdded}
            theirs={o.raw.grossValueAdded}
          />
          <Stat
            label="CO₂ / head"
            value={`${(r.raw.co2PerCapitaKgYear / 1000).toFixed(1)}t`}
            mine={r.raw.co2PerCapitaKgYear}
            theirs={o.raw.co2PerCapitaKgYear}
            lowerIsBetter
          />
          <Stat
            label="Quality"
            value={String(Math.round(r.raw.livabilityIndex))}
            mine={r.raw.livabilityIndex}
            theirs={o.raw.livabilityIndex}
          />
          <Stat
            label="Health"
            value={String(snap.health.score)}
            mine={snap.health.score}
            theirs={other.health.score}
          />
          <Stat
            label="Net / yr"
            value={`${snap.finance.netIncome >= 0 ? '+' : '−'}${money(Math.abs(snap.finance.netIncome))}`}
            mine={snap.finance.netIncome}
            theirs={other.finance.netIncome}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * The two cities, side by side, rendered with the same scene components under
 * different city providers. Each stat is coloured against the other side, so
 * the comparison reads at a glance without a separate table.
 */
export function SplitCityView() {
  const match = useChallengeStore((s) => s.match)
  const autoRotate = useChallengeStore((s) => s.autoRotate)
  const heatLayer = useCityStore((s) => s.heatLayer)
  const [focus, setFocus] = useState<'both' | 'human' | 'ai'>('both')
  // in demo mode the cinematic camera owns framing, and the stat panels are
  // chrome the recording does not want
  const demoActive = useDemoStore((s) => s.active)
  const demoStage = useDemoStore((s) => s.stage)

  if (!match) return null
  const personality = AI_PERSONALITIES[match.setup.personality]

  const shared = {
    baseCity: match.baseline.city,
    baseline: match.baseline.result,
    heatLayer,
    constructions: {},
  }

  const humanWide = focus === 'human'
  const aiWide = focus === 'ai'
  // the stat cards are a distraction over a title card, but essential when the
  // demo is actually comparing the two cities
  const showPanels =
    !demoActive || ['SETUP', 'HUMAN_ACTION', 'CRISIS', 'FINAL_COMPARISON', 'SIMULATION_FAST_FORWARD'].includes(demoStage)

  return (
    <div className="absolute inset-0 flex">
      {/* ---- HUMAN ---- */}
      <div
        className={`relative min-w-0 border-r border-cyan-300/15 transition-[flex] duration-500 ${
          humanWide ? 'flex-[3]' : aiWide ? 'flex-[0.35]' : 'flex-1'
        }`}
        onDoubleClick={() => setFocus(focus === 'human' ? 'both' : 'human')}
      >
        <MatchCanvas
          view={{
            ...shared,
            side: 'human',
            city: match.human.city,
            config: match.human.config,
            current: match.human.result,
            interactive: true,
          }}
          autoRotate={false}
        />
        {showPanels && (
          <SidePanel
            title="Your city"
            subtitle={match.setup.watchOnly ? 'no player — untouched' : 'you have the controls'}
            accent="text-sky-200"
            snap={match.human}
            score={match.scores.human}
            other={match.ai}
            otherScore={match.scores.ai}
          />
        )}
      </div>

      {/* ---- AI ---- */}
      <div
        className={`relative min-w-0 transition-[flex] duration-500 ${
          aiWide ? 'flex-[3]' : humanWide ? 'flex-[0.35]' : 'flex-1'
        }`}
        onDoubleClick={() => setFocus(focus === 'ai' ? 'both' : 'ai')}
      >
        <MatchCanvas
          view={{
            ...shared,
            side: 'ai',
            city: match.ai.city,
            config: match.ai.config,
            current: match.ai.result,
            interactive: false,
          }}
          autoRotate={autoRotate && !demoActive}
        />
        {showPanels && (
          <SidePanel
            title={`${personality.label} AI`}
            subtitle={personality.style}
            accent="text-fuchsia-200"
            snap={match.ai}
            score={match.scores.ai}
            other={match.human}
            otherScore={match.scores.human}
          />
        )}
      </div>

      {!demoActive && (
        <p className="pointer-events-none absolute bottom-1 left-1/2 z-10 -translate-x-1/2 font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-600">
          double-click a city to enlarge it
        </p>
      )}
    </div>
  )
}
