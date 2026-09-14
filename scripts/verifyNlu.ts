import { DEFAULT_CONFIG } from '../src/simulation/config'
import { generateCity } from '../src/city/generateCity'
import { runSimulation } from '../src/simulation/citySimulation'
import { planner } from '../src/ai/CityAIPlanner'
import { cityAI } from '../src/ai/nlu/LocalCityAIProvider'
import { describeIntent, routeIntent } from '../src/ai/intentRouter'
import { emptyConversation } from '../src/ai/nlu/types'
import type { CityAIContext } from '../src/ai/CityAIProvider'

const cfg = DEFAULT_CONFIG
const city = generateCity(cfg)
const current = runSimulation(city, cfg)
const diagnosis = planner.diagnose({ city, config: cfg, current })

const ctx: CityAIContext = {
  city,
  config: cfg,
  current,
  baseline: current,
  diagnosis,
  budget: 50_000_000,
  spent: 0,
  conversation: emptyConversation(),
}

const CASES = [
  'I have $50M. Prepare the city for 5,000 new residents.',
  'I need to support 5,000 additional residents.',
  'Fix downtown traffic under $20M.',
  'Traffic is terrible downtown. Fix it.',
  'Build a school near the residential district.',
  'Build a hospital near downtown.',
  'Reduce CO2 without hurting the economy.',
  'Make this city more livable.',
  'Increase population capacity but keep traffic below 50%.',
  'Add 10,000 residents, reduce traffic and keep the budget under $80M.',
  'I want 5k more residents.',
  'I need 20 thousand additional residents.',
  'Make the city better.',
  'I want 100,000 new residents with $1M.',
  'Build another school.',
  'How is the city doing?',
  'What is the biggest problem?',
  'How many people can the city support?',
  'What did you build?',
  'How much budget is left?',
  // Vietnamese
  'Tôi có 50 triệu đô, chuẩn bị thành phố cho thêm 5.000 dân.',
  'Giảm ùn tắc giao thông.',
  'Xây thêm trường học.',
  'Thành phố đang quá đông, xử lý giúp tôi.',
  'Giảm khí thải nhưng đừng làm kinh tế giảm.',
  'Thêm 20.000 dân.',
]

async function main() {
  console.log('=== INTENT PARSING ===\n')
  for (const raw of CASES) {
    const intent = await cityAI.understandRequest(raw, ctx)
    const action = routeIntent(intent, ctx)
    const bits: string[] = [intent.kind]
    if (intent.targetPopulationIncrease) bits.push(`pop=${intent.targetPopulationIncrease}`)
    if (intent.budget) bits.push(`$${(intent.budget / 1e6).toFixed(0)}M`)
    if (intent.buildKind) bits.push(`build=${intent.buildKind}×${intent.buildCount}`)
    if (intent.location.kind !== 'auto') bits.push(`loc=${intent.location.label}`)
    for (const c of intent.constraints) bits.push(`${c.metric} ${c.op}${c.value ? ' ' + c.value : ''}`)
    if (intent.question) bits.push(`Q=${intent.question}`)
    bits.push(`lang=${intent.language}`)
    bits.push(`conf=${(intent.parseConfidence * 100).toFixed(0)}%`)

    console.log(`"${raw}"`)
    console.log(`   → ${bits.join(' | ')}`)
    console.log(`   → action=${action.type}${
      action.type === 'build'
        ? ` ${action.kind} @ ${action.location.label} (${action.location.reason})`
        : action.type === 'optimize'
          ? ` ${action.objectiveId} · ${action.hardConstraints.length} constraints`
          : action.type === 'answer'
            ? ` ${action.question}`
            : ''
    }`)
    if (action.type === 'answer') console.log(`   → "${action.text.slice(0, 130)}"`)
    console.log(`   → understood as: ${describeIntent(intent)}`)
    console.log()
  }

  /* ---- follow-up context ---- */
  console.log('\n=== FOLLOW-UPS ===\n')
  const first = await cityAI.understandRequest('Add 5,000 residents.', ctx)
  const conv = { ...emptyConversation(), currentIntent: first, currentConstraints: first.constraints }
  const ctx2: CityAIContext = { ...ctx, conversation: conv }

  for (const raw of [
    'Too expensive. Keep it under $30M.',
    'What if we build roads instead?',
    'Also keep traffic below 60%.',
  ]) {
    const intent = await cityAI.understandRequest(raw, ctx2)
    console.log(`"${raw}"`)
    console.log(
      `   → kind=${intent.kind} followUp=${intent.isFollowUp} pop=${intent.targetPopulationIncrease ?? '-'} budget=${
        intent.budget ? '$' + (intent.budget / 1e6).toFixed(0) + 'M' : '-'
      } prefer=${intent.preferKinds.join(',') || '-'} constraints=${intent.constraints
        .map((c) => c.metric + ' ' + c.op + (c.value ?? ''))
        .join(', ') || '-'}`,
    )
    console.log()
  }

  /* ---- Phase 5: control commands never build ---- */
  console.log('\n=== CONTROL COMMANDS (PHASE 5) ===\n')
  for (const raw of [
    'Take control.',
    'Assist me.',
    "I'll do it myself.",
    'Pause.',
    'Resume.',
    'Stop.',
    'What should I build?',
    "What's wrong?",
    'Ban dieu khien di.',
    'Tam dung.',
  ]) {
    const intent = await cityAI.understandRequest(raw, ctx)
    const action = routeIntent(intent, ctx)
    const builds = action.type === 'build' || action.type === 'optimize'
    console.log(
      `"${raw}"\n   → kind=${intent.kind}${intent.control ? ' · ' + intent.control : ''}${
        intent.question ? ' · ' + intent.question : ''
      } · action=${action.type} · triggers construction: ${builds ? 'YES — BUG' : 'no'}`,
    )
    if (action.type === 'control' || action.type === 'answer') {
      console.log(`   → "${action.text.slice(0, 120)}"`)
    }
    console.log()
  }
}

main()
