/**
 * CONTROL COMMANDS — the sentences that change who is driving.
 *
 * These are deliberately the highest-priority match in the parser: "stop"
 * must never be read as an optimisation brief, and "take control" must never
 * build something. They are checked before anything else and, like every other
 * intent, they are bilingual.
 */
import type { ControlKind, Language } from './types'
import { deaccent } from './numbers'

interface ControlPattern {
  control: ControlKind
  /** matched against the de-accented, lower-cased request */
  re: RegExp
  /** what the AI says back — it never claims more than it did */
  reply: Record<Language, string>
  summary: string
}

/**
 * Ordered: the first match wins, so the more specific phrasings come first.
 * "take over" means the *operator* takes over, "take control" means the AI
 * does — an easy thing to get backwards, so both are spelled out.
 */
const PATTERNS: ControlPattern[] = [
  {
    control: 'pause',
    re: /\b(pause|hold on|hold it|wait|stop|freeze|halt|tam dung|dung lai|dung)\b/,
    reply: {
      en: 'Paused. Anything already on site will finish, and I will make no new decisions until you resume.',
      vi: 'Đã tạm dừng. Công trình đang thi công sẽ hoàn tất, tôi sẽ không ra quyết định mới cho đến khi bạn tiếp tục.',
    },
    summary: 'Pause the AI',
  },
  {
    control: 'resume',
    re: /\b(resume|continue|carry on|keep going|go on|tiep tuc|chay tiep)\b/,
    reply: {
      en: 'Resuming from the city as it stands now.',
      vi: 'Tiếp tục từ trạng thái hiện tại của thành phố.',
    },
    summary: 'Resume the AI',
  },
  {
    control: 'human',
    re: /\b(i'?ll do it myself|i will do it myself|let me do it|my turn|i'?ll take over|i will take over|take over|hand (it )?back|give me control|manual mode|human mode|de toi lam|toi tu lam|tra quyen)\b/,
    reply: {
      en: 'Understood — you have the city. I will stay out of the way until you ask.',
      vi: 'Đã hiểu — thành phố là của bạn. Tôi sẽ không can thiệp cho đến khi bạn yêu cầu.',
    },
    summary: 'Hand control to the operator',
  },
  {
    control: 'take_control',
    re: /\b(take (full )?control|take over the city|you (run|drive|manage) (it|the city)|run the city|autonomous mode|full control|ban dieu khien|tu dong hoan toan)\b/,
    reply: {
      en: 'Understood. Taking control — I will analyse the city, choose a priority and start building against your objective.',
      vi: 'Đã hiểu. Tôi tiếp quản — tôi sẽ phân tích thành phố, chọn ưu tiên và bắt đầu xây dựng theo mục tiêu của bạn.',
    },
    summary: 'Take control of the city',
  },
  {
    control: 'assist',
    re: /\b(assist me|help me build|advise me|advisor mode|assist mode|watch (over )?(me|the city)|keep an eye|ho tro toi|tu van)\b/,
    reply: {
      en: 'Advising from here. You keep the controls — I will watch every change, predict what it does and recommend, but I will not build without your approval.',
      vi: 'Tôi sẽ tư vấn. Bạn vẫn điều khiển — tôi theo dõi mọi thay đổi và đề xuất, nhưng sẽ không xây nếu bạn chưa đồng ý.',
    },
    summary: 'Advise, do not build',
  },
]

/** The control command in this request, if there is one. */
export function detectControl(raw: string): { control: ControlKind; reply: string; summary: string } | null {
  const text = deaccent(raw).toLowerCase().trim()
  if (!text) return null
  const language: Language = /[À-ỹ]/.test(raw) ? 'vi' : 'en'

  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      return { control: p.control, reply: p.reply[language], summary: p.summary }
    }
  }
  return null
}

/** What each control command does, for the transcript. */
export const CONTROL_SUMMARY: Record<ControlKind, string> = {
  take_control: 'Switch to autonomous — the AI runs the city',
  assist: 'Switch to AI assist — the AI advises, you build',
  human: 'Switch to human — you have the city',
  pause: 'Pause the AI',
  resume: 'Resume the AI',
}
