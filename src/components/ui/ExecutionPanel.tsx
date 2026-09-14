import { useOptimizerStore } from '../../store/useOptimizerStore'
import { INFRA } from '../../city/infrastructure'
import type { ConstructionStep } from '../../execution/types'

const STATUS_DOT: Record<ConstructionStep['status'], string> = {
  COMPLETE: '●',
  BUILDING: '◐',
  QUEUED: '○',
}

const STATUS_CLASS: Record<ConstructionStep['status'], string> = {
  COMPLETE: 'text-emerald-300',
  BUILDING: 'text-cyan-200',
  QUEUED: 'text-slate-600',
}

/**
 * The AI command center during execution: what has been done, what is being
 * built right now and how far along it is, and what is still queued — plus the
 * controls to pause, fast-forward or run the whole thing again.
 */
export function ExecutionPanel() {
  const phase = useOptimizerStore((s) => s.phase)
  const steps = useOptimizerStore((s) => s.steps)
  const activeIndex = useOptimizerStore((s) => s.activeStepIndex)
  const stepProgress = useOptimizerStore((s) => s.stepProgress)
  const buildProgress = useOptimizerStore((s) => s.buildProgress)
  const paused = useOptimizerStore((s) => s.paused)
  const skipping = useOptimizerStore((s) => s.skipping)
  const queue = useOptimizerStore((s) => s.queue)
  const pause = useOptimizerStore((s) => s.pauseExecution)
  const resume = useOptimizerStore((s) => s.resumeExecution)
  const skip = useOptimizerStore((s) => s.skipExecution)
  const replay = useOptimizerStore((s) => s.replayOptimization)
  const restore = useOptimizerStore((s) => s.restoreSnapshot)
  const snapshot = useOptimizerStore((s) => s.snapshot)

  const executing = phase === 'building'
  const finished = phase === 'complete'
  if (!executing && !finished) return null
  if (steps.length === 0) return null

  const active = steps[activeIndex]

  return (
    <div className="mt-2.5 rounded-lg border border-fuchsia-300/25 bg-fuchsia-400/[0.06] p-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-fuchsia-200/90">
          {executing ? `Executing Plan ${queue?.planCode ?? ''}` : `Plan ${queue?.planCode ?? ''} executed`}
        </span>
        <span className="font-mono text-[9px] tabular-nums text-slate-400">
          {Math.round(buildProgress * 100)}%
        </span>
      </div>

      {/* overall progress */}
      <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-300 transition-[width] duration-150"
          style={{ width: `${buildProgress * 100}%` }}
        />
      </div>

      {/* the queue */}
      <ol className="mt-2 max-h-[186px] space-y-[3px] overflow-y-auto scroll-thin pr-1">
        {steps.map((s, i) => {
          const isActive = i === activeIndex && executing
          return (
            <li key={s.id}>
              <div
                className={`flex items-center gap-2 rounded-md px-1.5 py-[3px] ${
                  isActive ? 'bg-cyan-300/10' : ''
                }`}
              >
                <span className={`font-mono text-[10px] ${STATUS_CLASS[s.status]}`}>
                  {STATUS_DOT[s.status]}
                </span>
                <span className="font-mono text-[8.5px] tabular-nums text-slate-600">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate font-mono text-[9.5px] tracking-[0.04em] ${
                    s.status === 'QUEUED' ? 'text-slate-500' : 'text-slate-200'
                  }`}
                >
                  {s.label}
                </span>
                {s.kind && (
                  <span className="shrink-0 font-mono text-[9px] text-slate-600">
                    {INFRA[s.kind].icon}
                  </span>
                )}
              </div>
              {isActive && (
                <div className="ml-[26px] mr-1 mt-[3px] h-[2px] overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-cyan-300 shadow-glow"
                    style={{ width: `${stepProgress * 100}%` }}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {/* what the AI is doing right now */}
      {executing && active && (
        <div className="mt-2 rounded-md border border-white/10 bg-black/25 px-2 py-1.5">
          <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-slate-500">
            Current action
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-200">
            {paused ? 'Paused — awaiting operator' : active.detail}
          </p>
        </div>
      )}

      {/* controls */}
      <div className="mt-2 flex gap-1.5">
        {executing && (
          <>
            <button
              className={`btn flex-1 !py-1.5 !text-[10px] ${paused ? 'btn-active' : ''}`}
              onClick={() => (paused ? resume() : pause())}
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button
              className="btn flex-1 !py-1.5 !text-[10px]"
              onClick={skip}
              disabled={skipping}
            >
              {skipping ? 'Skipping…' : 'Skip'}
            </button>
          </>
        )}
        {finished && snapshot && (
          <>
            <button className="btn flex-1 !py-1.5 !text-[10px]" onClick={replay}>
              Replay optimization
            </button>
            <button className="btn flex-1 !py-1.5 !text-[10px]" onClick={restore}>
              Undo build
            </button>
          </>
        )}
      </div>
    </div>
  )
}
