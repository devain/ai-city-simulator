/**
 * LocalCityAIProvider — the deterministic MVP understanding layer.
 *
 * No API key, no network, no NLP dependency: a lexicon, a number parser and a
 * set of rules. It is reproducible, fast enough to run on every keystroke, and
 * — crucially — it produces exactly the `CityIntent` a hosted model would, so
 * the rest of the application never learns which one is in use.
 */
import type { InfraKind } from '../../city/infrastructure'
import type { CityAIContext, CityAIProvider } from '../CityAIProvider'
import {
  BUILD_LEX,
  BUILD_VERB,
  CHEAPER_CUE,
  FOLLOWUP_CUE,
  INTENT_LEX,
  QUESTION_CUE,
  QUESTION_LEX,
} from './lexicon'
import { extractConstraints } from './constraints'
import { detectControl } from './control'
import { AUTO_LOCATION, extractLocation } from './locations'
import { deaccent, detectLanguage, extractBudget, extractPeople } from './numbers'
import type { CityIntent, IntentKind, QuestionKind } from './types'

/** intents that answer "what is the objective", ranked when several match */
function scoreIntents(text: string): { id: IntentKind; weight: number }[] {
  const hits: { id: IntentKind; weight: number }[] = []
  for (const entry of INTENT_LEX) {
    if (entry.patterns.test(text)) hits.push({ id: entry.id, weight: entry.weight })
  }
  return hits.sort((a, b) => b.weight - a.weight)
}

function detectBuildKind(text: string): InfraKind | null {
  for (const entry of BUILD_LEX) {
    if (entry.patterns.test(text)) return entry.id
  }
  return null
}

function detectQuestion(text: string): QuestionKind | null {
  for (const entry of QUESTION_LEX) {
    if (entry.patterns.test(text)) return entry.id
  }
  return null
}

/** "build another school" / "one more school" / "2 schools" */
function detectBuildCount(text: string): number {
  const m = text.match(/\b(\d{1,2})\s+(more\s+)?(schools?|hospitals?|parks?|towers?|garages?|routes?|hubs?)/)
  if (m) return Math.max(1, Math.min(6, Number(m[1])))
  if (/\b(another|one more|a second|them mot|them 1)\b/.test(text)) return 1
  return 1
}

export class LocalCityAIProvider implements CityAIProvider {
  readonly id = 'local-deterministic-v1'
  readonly label = 'Local (deterministic)'

  async understandRequest(input: string, context: CityAIContext): Promise<CityIntent> {
    const raw = input.trim()
    const language = detectLanguage(raw)

    /* ---------- control comes first: "stop" is never a building brief ---------- */
    const control = detectControl(raw)
    if (control) {
      return {
        kind: 'control',
        raw,
        language,
        secondary: [],
        location: AUTO_LOCATION,
        constraints: [],
        control: control.control,
        isFollowUp: false,
        preferKinds: [],
        parseConfidence: 0.96,
        matched: [control.summary.toLowerCase()],
      }
    }
    const text = deaccent(raw).toLowerCase()
    const matched: string[] = []

    const prev = context.conversation.currentIntent
    const isFollowUp = FOLLOWUP_CUE.test(text) && !!prev

    /* ---------- numbers ---------- */
    const budget = extractBudget(raw, language) ?? undefined
    const people = extractPeople(raw, language) ?? undefined
    if (budget) matched.push(`budget $${(budget / 1e6).toFixed(0)}M`)
    if (people) matched.push(`${people.toLocaleString('en-US')} residents`)

    /* ---------- constraints ---------- */
    const constraints = extractConstraints(raw)
    for (const c of constraints) matched.push(c.source)

    /* ---------- location ---------- */
    const location = extractLocation(raw)
    if (location.kind !== 'auto') matched.push(location.label)

    /* ---------- questions come first: never build on a question ---------- */
    const questionKind = detectQuestion(text)
    const looksLikeQuestion = QUESTION_CUE.test(raw) || raw.trim().endsWith('?')
    const orders = BUILD_VERB.test(text) || /\b(fix|reduce|increase|prepare|optimi[sz]e|make)\b/.test(text)

    if (questionKind && (looksLikeQuestion || !orders)) {
      return {
        kind: 'question',
        raw,
        language,
        secondary: [],
        location: AUTO_LOCATION,
        constraints: [],
        question: questionKind,
        isFollowUp: false,
        preferKinds: [],
        parseConfidence: 0.9,
        matched: [questionKind.replace(/_/g, ' ')],
      }
    }

    /* ---------- an explicit "build X" order ---------- */
    const buildKind = detectBuildKind(text)
    const wantsBuild = !!buildKind && BUILD_VERB.test(text)

    // "build roads instead" after a transit recommendation is a preference,
    // not a standalone build order
    const preferKinds: InfraKind[] = []
    if (isFollowUp && buildKind && /\b(instead|rather|what if|thay vi|thay vao do)\b/.test(text)) {
      preferKinds.push(buildKind)
    }

    if (wantsBuild && preferKinds.length === 0) {
      matched.unshift(`build ${buildKind}`)
      return {
        kind: 'build_specific',
        raw,
        language,
        secondary: [],
        buildKind: buildKind ?? undefined,
        buildCount: detectBuildCount(text),
        budget,
        location,
        constraints,
        isFollowUp,
        preferKinds: [],
        parseConfidence: 0.92,
        matched,
      }
    }

    /* ---------- objective-style request ---------- */
    const hits = scoreIntents(text)
    let kind: IntentKind = hits[0]?.id ?? 'unknown'
    const secondary = hits.slice(1).map((h) => h.id)

    // a headcount always means population growth, whatever else was said
    if (people) {
      if (kind !== 'population_growth') secondary.unshift(kind)
      kind = 'population_growth'
    }

    // a pure follow-up ("too expensive, keep it under $30M") inherits the goal
    let inherited = false
    if (isFollowUp && prev && (kind === 'unknown' || kind === 'balanced_optimization') && !people) {
      kind = prev.kind === 'question' ? 'balanced_optimization' : prev.kind
      inherited = true
      matched.unshift('continues previous request')
    }

    // "make the city better" with nothing else → balance the whole city
    if (kind === 'unknown') {
      kind = 'balanced_optimization'
      matched.push('no explicit objective — balancing the city')
    }

    if (hits[0]) matched.push(hits[0].id.replace(/_/g, ' '))

    /* ---------- confidence from how much we actually pinned down ---------- */
    let confidence = 0.42
    if (hits.length > 0) confidence += 0.24
    if (people) confidence += 0.16
    if (budget) confidence += 0.1
    if (constraints.length > 0) confidence += 0.08
    if (location.kind !== 'auto') confidence += 0.04
    if (inherited) confidence += 0.06
    if (kind === 'balanced_optimization' && hits.length === 0) confidence = Math.min(confidence, 0.55)

    return {
      kind,
      raw,
      language,
      secondary: [...new Set(secondary)].filter((s) => s !== kind),
      targetPopulationIncrease: people ?? (inherited ? prev?.targetPopulationIncrease : undefined),
      budget: budget ?? (CHEAPER_CUE.test(text) && prev?.budget ? Math.round(prev.budget * 0.6) : undefined),
      location,
      constraints:
        isFollowUp && prev ? dedupeConstraints([...prev.constraints, ...constraints]) : constraints,
      isFollowUp,
      preferKinds,
      parseConfidence: Math.max(0.3, Math.min(0.97, confidence)),
      matched: [...new Set(matched)],
    }
  }
}

function dedupeConstraints<T extends { metric: string; op: string }>(list: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  // later entries win, so a new constraint overrides the inherited one
  for (const c of [...list].reverse()) {
    const key = `${c.metric}:${c.op}`
    if (seen.has(key)) continue
    seen.add(key)
    out.unshift(c)
  }
  return out
}

export const localCityAI = new LocalCityAIProvider()

/**
 * The provider the app uses. Swap this line to go live:
 *
 *   export const cityAI: CityAIProvider = new ClaudeCityAIProvider({ ... })
 */
export const cityAI: CityAIProvider = localCityAI
