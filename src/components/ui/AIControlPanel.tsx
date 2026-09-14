import { useSandboxStore, spendableBy } from '../../store/useSandboxStore'
import { AGENT_OBJECTIVES, type AgentObjectiveId } from '../../ai/AutonomousCityAgent'
import { LEVEL_TONE } from '../../ai/CityPriorities'
import { formatTick } from '../../sandbox/history'
import { money } from '../../lib/format'

const LOG_TONE: Record<string, { dot: string; text: string }> = {
  analyze: { dot: 'bg-sky-300', text: 'text-sky-200/90' },
  decide: { dot: 'bg-cyan-300', text: 'text-cyan-100' },
  build: { dot: 'bg-emerald-400', text: 'text-emerald-200/90' },
  observe: { dot: 'bg-slate-500', text: 'text-slate-400' },
  warn: { dot: 'bg-amber-300', text: 'text-amber-200/90' },
  mode: { dot: 'bg-fuchsia-300', text: 'text-fuchsia-200/90' },
}

const OBJECTIVE_LIST: AgentObjectiveId[] = ['grow', 'economy', 'traffic', 'quality', 'green', 'balanced']

/**
 * AUTONOMOUS mode's cockpit: what the AI is doing, why, what it may spend, and
 * a pause button that always works. The log underneath is a record of real
 * decisions — every line was produced by an actual call to the agent.
 */
export function AIControlPanel() {
  const mode = useSandboxStore((s) => s.mode)
  const paused = useSandboxStore((s) => s.agentPaused)
  const status = useSandboxStore((s) => s.agentStatus)
  const objective = useSandboxStore((s) => s.agentObjective)
  const setObjective = useSandboxStore((s) => s.setAgentObjective)
  const pause = useSandboxStore((s) => s.pauseAgent)
  const resume = useSandboxStore((s) => s.resumeAgent)
  const log = useSandboxStore((s) => s.aiLog)
  const decision = useSandboxStore((s) => s.lastDecision)
  const treasury = useSandboxStore((s) => s.treasury)
  const reserve = useSandboxStore((s) => s.reserve)
  const priorities = useSandboxStore((s) => s.priorities)
  const setMode = useSandboxStore((s) => s.setMode)

  if (mode !== 'autonomous') return null

  const spendable = spendableBy(treasury, reserve)

  return (
    <section className="glass border-fuchsia-300/20 p-3">
      <header className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="panel-title !text-fuchsia-300/80">
          <span className="inline-block h-1 w-1 rounded-full bg-fuchsia-300 shadow-glow" />
          AI in control
        </h2>
        <span
          className={`chip ${
            paused ? '!border-amber-300/40 !text-amber-200' : '!border-fuchsia-300/40 !text-fuchsia-200'
          }`}
        >
          {paused ? 'paused' : 'operating'}
        </span>
      </header>

      {/* ---- what it is doing right now ---- */}
      <div className="rounded-lg border border-fuchsia-300/25 bg-fuchsia-400/[0.06] p-2.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              paused ? 'bg-amber-300' : 'animate-pulseGlow bg-fuchsia-300'
            }`}
          />
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-fuchsia-300/70">
            Current action
          </span>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-snug text-slate-100">{status}</p>
        {decision?.priority && (
          <p className="mt-1.5 border-l border-fuchsia-300/25 pl-2 text-[10px] leading-relaxed text-slate-400">
            <span className={LEVEL_TONE[decision.priority.level]}>
              {decision.priority.label} {decision.priority.urgency}/100
            </span>{' '}
            — {decision.priority.reading}
            {decision.siting && (
              <>
                <br />
                Site: {decision.siting}
              </>
            )}
          </p>
        )}
      </div>

      {/* ---- objective ---- */}
      <div className="mt-2.5">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
          Objective
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {OBJECTIVE_LIST.map((id) => (
            <button
              key={id}
              onClick={() => setObjective(id)}
              title={AGENT_OBJECTIVES[id].phrase}
              className={`rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] transition-all ${
                objective === id
                  ? 'bg-fuchsia-400/20 text-white ring-1 ring-fuchsia-300/50'
                  : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
              }`}
            >
              {AGENT_OBJECTIVES[id].label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
          “{AGENT_OBJECTIVES[objective].phrase}”
        </p>
      </div>

      {/* ---- money rules ---- */}
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        <Cell label="Treasury" value={money(treasury)} tone="text-emerald-200" />
        <Cell label="Reserve" value={money(reserve)} tone="text-amber-200" />
        <Cell label="May spend" value={money(spendable)} tone="text-cyan-200" />
      </div>

      {/* ---- controls ---- */}
      <div className="mt-2.5 flex gap-1.5">
        <button
          onClick={paused ? resume : pause}
          className={`flex-1 rounded-lg border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition-all active:scale-[0.98] ${
            paused
              ? 'border-emerald-300/55 bg-emerald-400/15 text-emerald-100 shadow-glow hover:bg-emerald-400/25'
              : 'border-amber-300/50 bg-amber-300/12 text-amber-100 hover:bg-amber-300/20'
          }`}
        >
          {paused ? '▶ Resume AI' : '❚❚ Pause AI'}
        </button>
        <button
          onClick={() => setMode('human')}
          className="rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-300 transition-colors hover:border-sky-300/40 hover:text-sky-100"
        >
          Take over
        </button>
      </div>

      {/* ---- what it is watching ---- */}
      <div className="mt-2.5 flex flex-wrap gap-1">
        {priorities.slice(0, 4).map((p) => (
          <span
            key={p.key}
            title={p.reading}
            className={`rounded-full border border-white/10 bg-white/[0.03] px-2 py-[2px] font-mono text-[8.5px] uppercase tracking-[0.1em] ${LEVEL_TONE[p.level]}`}
          >
            {p.label} {p.urgency}
          </span>
        ))}
      </div>

      {/* ---- the control log ---- */}
      <div className="mt-2.5">
        <span className="font-mono text-[8.5px] uppercase tracking-[0.2em] text-slate-500">
          AI control log
        </span>
        <div className="mt-1.5 max-h-[192px] space-y-[5px] overflow-y-auto scroll-thin pr-1">
          {log.length === 0 && (
            <p className="text-[10px] leading-relaxed text-slate-600">
              No decisions yet — the first one lands within a few seconds.
            </p>
          )}
          {log.map((l) => {
            const tone = LOG_TONE[l.kind] ?? LOG_TONE.observe
            return (
              <div key={l.id} className="flex gap-2">
                <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-white/25">
                  <span className={`block h-1 w-1 rounded-full ${tone.dot}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`text-[10.5px] leading-snug ${tone.text}`}>{l.text}</span>
                  <span className="ml-1.5 font-mono text-[8.5px] text-slate-600">
                    {formatTick(l.tick)}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Cell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-md border border-white/[0.07] bg-white/[0.02] px-2 py-1.5 leading-none">
      <div className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-slate-600">{label}</div>
      <div className={`mt-[4px] font-mono text-[11px] font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  )
}
