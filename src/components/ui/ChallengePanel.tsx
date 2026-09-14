import { useOptimizerStore } from '../../store/useOptimizerStore'
import { CHALLENGES } from '../../ai/challenges'

export function ChallengePanel() {
  const active = useOptimizerStore((s) => s.activeChallenge)
  const runChallenge = useOptimizerStore((s) => s.runChallenge)
  const clearChallenge = useOptimizerStore((s) => s.clearChallenge)
  const phase = useOptimizerStore((s) => s.phase)
  const busy = phase !== 'idle' && phase !== 'complete' && phase !== 'review'

  const current = CHALLENGES.find((c) => c.id === active)

  return (
    <section className="glass p-3">
      <header className="mb-2.5 flex items-center justify-between">
        <h2 className="panel-title">
          <span className="inline-block h-1 w-1 rounded-full bg-cyan-300 shadow-glow" />
          Scenario challenges
        </h2>
        {active && (
          <button className="chip !text-cyan-200" onClick={clearChallenge}>
            clear
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-1.5">
        {CHALLENGES.map((c) => {
          const on = c.id === active
          return (
            <button
              key={c.id}
              disabled={busy}
              onClick={() => runChallenge(c.id)}
              className={`btn flex flex-col items-start gap-0.5 !px-2.5 !py-2 text-left disabled:opacity-40 ${
                on ? 'btn-active' : ''
              }`}
              style={on ? { borderColor: `${c.accent}88`, boxShadow: `0 0 18px -4px ${c.accent}` } : undefined}
              title={c.brief}
            >
              <span className="font-mono text-[9px] tracking-[0.14em]" style={{ color: c.accent }}>
                {c.icon} {c.subtitle}
              </span>
              <span className="text-[10px] leading-tight text-slate-300">{c.name}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-2 text-[10px] leading-snug text-slate-500">
        {current
          ? current.brief
          : 'Each scenario stresses the simulation for real, sets the AI a brief and a budget, then starts the optimizer.'}
      </p>
    </section>
  )
}
