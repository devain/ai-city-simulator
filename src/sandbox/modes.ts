/**
 * THE THREE MODES — who is holding the controls.
 *
 * This is the single most important piece of state in Phase 5, so it lives on
 * its own and every panel reads it from here. The rule is simple and never
 * bent: only AUTONOMOUS lets the AI build without being asked.
 */
export type SandboxMode = 'human' | 'assist' | 'autonomous'

export interface ModeSpec {
  id: SandboxMode
  label: string
  icon: string
  /** who is in control, shown in the status strip */
  control: string
  /** what the AI is doing, shown under it */
  aiRole: string
  blurb: string
  /** true when the AI is allowed to place things unprompted */
  aiMayBuild: boolean
  /** true when the AI watches and warns without being asked */
  aiMayAdvise: boolean
  accent: string
}

export const MODES: Record<SandboxMode, ModeSpec> = {
  human: {
    id: 'human',
    label: 'Human',
    icon: '⌘',
    control: 'You',
    aiRole: 'Standing by',
    blurb: 'You build. The AI stays quiet unless you ask it something.',
    aiMayBuild: false,
    aiMayAdvise: false,
    accent: 'sky',
  },
  assist: {
    id: 'assist',
    label: 'AI Assist',
    icon: '◈',
    control: 'You',
    aiRole: 'Advisor',
    blurb:
      'You build. The AI watches every change, predicts what it will do and recommends — but never builds without your approval.',
    aiMayBuild: false,
    aiMayAdvise: true,
    accent: 'cyan',
  },
  autonomous: {
    id: 'autonomous',
    label: 'Autonomous',
    icon: '⬢',
    control: 'AI',
    aiRole: 'Operating the city',
    blurb: 'The AI runs the city against your objective. You can pause it at any time.',
    aiMayBuild: true,
    aiMayAdvise: true,
    accent: 'fuchsia',
  },
}

export const MODE_ORDER: SandboxMode[] = ['human', 'assist', 'autonomous']

/** What the event log says when control changes hands. */
export const MODE_TRANSITION: Record<SandboxMode, string> = {
  human: 'AI control paused — you have the city',
  assist: 'AI assistance enabled — advising, not building',
  autonomous: 'AI has taken control of the city',
}
