/**
 * Numeric extraction for city requests.
 *
 * Has to cope with all of these, in two languages:
 *
 *   5,000 · 5000 · 5k · 10k · 20 thousand · 5.000 (vi) · 20.000 (vi)
 *   $50M · 50 million · $20 million · 20m · 50 triệu đô · 1 tỷ · 30 triệu
 *
 * The hard part is not the arithmetic, it is deciding whether a number is
 * money or a headcount. That is done from the cues around it, not from its
 * magnitude — "$20M" and "20,000 residents" both start with 20.
 */
import type { Language } from './types'

export interface NumToken {
  value: number
  raw: string
  index: number
  /** the multiplier word that followed, if any */
  unit?: string
  isMoney: boolean
}

const MULTIPLIER: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  nghin: 1_000,
  ngan: 1_000,
  m: 1_000_000,
  mil: 1_000_000,
  million: 1_000_000,
  millions: 1_000_000,
  tr: 1_000_000,
  trieu: 1_000_000,
  b: 1_000_000_000,
  billion: 1_000_000_000,
  ty: 1_000_000_000,
  ti: 1_000_000_000,
}

/** strip Vietnamese diacritics so the lexicon can stay plain ASCII */
export function deaccent(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

const MONEY_WORDS = /\$|usd|dollar|dollars|do la|dola|do|budget|ngan sach|capital|spend|invest/i
const PEOPLE_WORDS = /resident|residents|people|person|inhabitant|inhabitants|population|dan|nguoi|dan cu/i

/**
 * Parse the digits of a number token, using the language to decide what a dot
 * means: in Vietnamese "5.000" is five thousand, in English it is five.
 */
function parseDigits(raw: string, language: Language): number {
  const cleaned = raw.replace(/\s/g, '')
  if (language === 'vi') {
    // vi: '.' groups thousands, ',' is the decimal mark
    if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/\./g, ''))
    return Number(cleaned.replace(/\./g, '').replace(',', '.'))
  }
  // en: ',' groups thousands, '.' is the decimal mark
  if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/,/g, ''))
  return Number(cleaned.replace(/,/g, ''))
}

const TOKEN_RE =
  /(\$\s*)?(\d[\d.,]*)\s*(k|m|b|tr|ty|ti|mil|thousand|million|millions|billion|trieu|nghin|ngan)?\b/gi

/** Pull every number out of the text, tagged as money or not. */
export function tokenizeNumbers(text: string, language: Language): NumToken[] {
  const flat = deaccent(text)
  const out: NumToken[] = []
  TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null

  while ((m = TOKEN_RE.exec(flat)) !== null) {
    const [full, dollar, digits, unitRaw] = m
    const base = parseDigits(digits, language)
    if (!Number.isFinite(base)) continue

    const unit = unitRaw ? unitRaw.toLowerCase() : undefined
    const mult = unit ? (MULTIPLIER[unit] ?? 1) : 1

    // look a little way either side for a currency or headcount cue
    const before = flat.slice(Math.max(0, m.index - 22), m.index)
    const after = flat.slice(m.index + full.length, m.index + full.length + 22)

    const moneyCue = !!dollar || MONEY_WORDS.test(after) || MONEY_WORDS.test(before)
    const peopleCue = PEOPLE_WORDS.test(after)

    // "50 trieu do" / "$50M" / "under 20m" are money; "5.000 dan" is not
    const isMoney = moneyCue && !peopleCue

    out.push({
      value: base * mult,
      raw: full.trim(),
      index: m.index,
      unit,
      isMoney,
    })
  }
  return out
}

/** Words-as-numbers, for "twenty thousand residents". */
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
  mot: 1, hai: 2, ba: 3, bon: 4, nam: 5, muoi: 10, hai_muoi: 20, tram: 100,
}

function wordNumber(text: string): number | null {
  const flat = deaccent(text).toLowerCase()
  const m = flat.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|hundred|mot|hai|ba|bon|nam|muoi|tram)\s+(thousand|million|nghin|ngan|trieu)\b/,
  )
  if (!m) return null
  const base = WORD_NUMBERS[m[1]] ?? 1
  const mult = MULTIPLIER[m[2]] ?? 1
  return base * mult
}

/** The money figure in the request, if there is one. */
export function extractBudget(text: string, language: Language): number | null {
  const tokens = tokenizeNumbers(text, language)
  const money = tokens.find((t) => t.isMoney)
  if (!money) return null

  let v = money.value
  // "$50" in a city-planning brief means $50M, never fifty dollars
  if (!money.unit && v > 0 && v < 1000) v *= 1_000_000
  return Math.round(v)
}

/** The headcount in the request, if there is one. */
export function extractPeople(text: string, language: Language): number | null {
  const flat = deaccent(text).toLowerCase()
  if (!PEOPLE_WORDS.test(flat)) {
    // still allow "prepare the city for 20,000" with no noun
    if (!/\b(for|support|absorb|handle|chuan bi|cho)\b/.test(flat)) return null
  }

  const tokens = tokenizeNumbers(text, language).filter((t) => {
    if (t.isMoney) return false
    // "keep traffic below 50%" is a limit, not fifty residents
    const next = flat.slice(t.index + t.raw.length, t.index + t.raw.length + 3)
    return !/^\s*%/.test(next)
  })
  if (tokens.length > 0) {
    // prefer a number that is actually next to a people word
    const nearPeople = tokens.find((t) => {
      const after = flat.slice(t.index, t.index + t.raw.length + 26)
      return PEOPLE_WORDS.test(after)
    })
    const chosen = nearPeople ?? tokens[0]
    const v = Math.round(chosen.value)
    if (v >= 50 && v <= 500_000) return v
  }

  const words = wordNumber(text)
  if (words && words >= 50 && words <= 500_000) return words
  return null
}

/** Rough language detection — diacritics first, then common words. */
export function detectLanguage(text: string): Language {
  if (/[àáảãạăâấầẩẫậêếềểễệôốồổỗộơớờởỡợưứừửữựđìíỉĩịùúủũụỳýỷỹỵ]/i.test(text)) return 'vi'
  const flat = deaccent(text).toLowerCase()
  if (/\b(toi|thanh pho|giup|xay|them|dan|giao thong|khi thai|hay|lam|cho)\b/.test(flat)) return 'vi'
  return 'en'
}
