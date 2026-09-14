import { useEffect, useState } from 'react'
import { CityCanvas } from './components/scene/CityCanvas'
import { TopBar } from './components/ui/TopBar'
import { LeftPanel } from './components/ui/LeftPanel'
import { RightPanel } from './components/ui/RightPanel'
import { BottomPanel } from './components/ui/BottomPanel'
import {
  BuildingInspector,
  CompareOverlay,
  DemoCaption,
  HeatmapBar,
  ViewHud,
} from './components/ui/CanvasOverlays'
import { AICommandBar } from './components/ui/AICommandBar'
import { PlanCards } from './components/ui/PlanCards'
import { OptimizationReport } from './components/ui/OptimizationReport'
import { CinematicOverlay } from './components/ui/CinematicOverlay'
import { HeroResult } from './components/ui/HeroResult'
import { useCityStore } from './store/useCityStore'
import { useOptimizerStore } from './store/useOptimizerStore'
import { useSandboxStore } from './store/useSandboxStore'
import { SandboxBar } from './components/ui/SandboxBar'
import { BuildPreview } from './components/ui/BuildPreview'
import { DemolishDialog } from './components/ui/DemolishDialog'
import { CityHistoryPanel } from './components/ui/CityHistoryPanel'
import { useChallengeStore } from './store/useChallengeStore'
import { ChallengeSetup } from './components/ui/ChallengeSetup'
import { SplitCityView } from './components/ui/SplitCityView'
import { ChallengeHud } from './components/ui/ChallengeHud'
import { DecisionMoment } from './components/ui/ChallengePanels'
import { ChallengeResults } from './components/ui/ChallengeResults'
import { ChallengeTournament } from './components/ui/ChallengeTournament'
import { ChallengeDemoOverlay } from './components/ui/ChallengeDemoOverlay'
import { startDemo as startPhase2Demo, stopDemo as stopPhase2Demo } from './store/demo'

export default function App() {
  const [panel, setPanel] = useState<'left' | 'right' | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const cancelBuild = useSandboxStore((s) => s.cancelBuild)
  const cancelDemolish = useSandboxStore((s) => s.cancelDemolish)
  const setDemolishMode = useSandboxStore((s) => s.setDemolishMode)
  const toggleClock = useSandboxStore((s) => s.toggleClock)
  const challengePhase = useChallengeStore((s) => s.phase)
  const openChallenge = useChallengeStore((s) => s.open)
  // a live match replaces the single-city view with the split one
  const inMatch =
    challengePhase === 'running' ||
    challengePhase === 'paused' ||
    challengePhase === 'decision' ||
    challengePhase === 'finished'
  const setPlacementTool = useCityStore((s) => s.setPlacementTool)
  const runScenario = useCityStore((s) => s.runScenario)
  const optimize = useOptimizerStore((s) => s.optimize)
  const closeReport = useOptimizerStore((s) => s.closeReport)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT'
      if (e.key === 'Escape') {
        setPlacementTool(null)
        setPanel(null)
        closeReport()
        stopPhase2Demo()
        // Phase 5: escape also backs out of placing and demolishing
        cancelBuild()
        cancelDemolish()
        setDemolishMode(false)
        setShowHistory(false)
      }
      if (typing) return
      if (e.key === ' ') {
        e.preventDefault()
        runScenario()
      }
      if (e.key.toLowerCase() === 'd') startPhase2Demo()
      if (e.key.toLowerCase() === 'o') optimize()
      if (e.key.toLowerCase() === 't') toggleClock()
      if (e.key.toLowerCase() === 'h') setShowHistory((v) => !v)
      if (e.key.toLowerCase() === 'c') openChallenge()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setPlacementTool, runScenario, optimize, closeReport, cancelBuild, cancelDemolish, setDemolishMode, toggleClock, openChallenge])

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-ink-900 bg-techgrid">
      <TopBar onTogglePanel={(s) => setPanel((p) => (p === s ? null : s))} />
      <SandboxBar onShowHistory={() => setShowHistory(true)} />

      {inMatch && <ChallengeHud />}

      <div className="relative flex min-h-0 flex-1">
        {/* LEFT — city + simulation controls */}
        <aside className="hidden w-[276px] shrink-0 border-r border-white/[0.06] lg:block xl:w-[300px]">
          <LeftPanel />
        </aside>

        {/* CENTER — 3D city + charts */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            {inMatch ? <SplitCityView /> : <CityCanvas />}
            {!inMatch && (
              <>
                <HeatmapBar />
                <BuildingInspector />
                <ViewHud />
                <PlanCards />
                <DemoCaption />
                <CompareOverlay />
                <CinematicOverlay />
                <HeroResult />
                <OptimizationReport />
              </>
            )}
            <AICommandBar />
            <BuildPreview />
            <DemolishDialog />
            <DecisionMoment />
            <ChallengeResults />
            {showHistory && <CityHistoryPanel onClose={() => setShowHistory(false)} />}
            <div className="pointer-events-none absolute inset-0 scan" />
          </div>
          <div className="h-[188px] shrink-0 md:h-[200px] xl:h-[212px]">
            <BottomPanel />
          </div>
        </main>

        {/* RIGHT — AI analysis + metrics */}
        <aside className="hidden w-[320px] shrink-0 border-l border-white/[0.06] lg:block xl:w-[352px]">
          <RightPanel />
        </aside>

        {challengePhase === 'setup' && <ChallengeSetup />}
        <ChallengeTournament />
        <ChallengeDemoOverlay />

        {/* mobile / tablet drawers */}
        {panel && (
          <div
            className="absolute inset-0 z-40 bg-black/55 backdrop-blur-sm lg:hidden"
            onClick={() => setPanel(null)}
          >
            <div
              className="absolute inset-y-0 w-[86%] max-w-[340px] animate-riseIn border-white/10 bg-[#050912]/97"
              style={panel === 'left' ? { left: 0, borderRightWidth: 1 } : { right: 0, borderLeftWidth: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              {panel === 'left' ? <LeftPanel /> : <RightPanel />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
