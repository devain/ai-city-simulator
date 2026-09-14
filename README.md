# AI CITY SIMULATOR — a city you run with an AI, or against one

An interactive smart-city sandbox in the browser. A procedural 3D city, a transparent simulation
engine, and an AI that you can build alongside, ask for help, hand the whole city to — or **play
against**.

> **AI vs HUMAN — 10-year city challenge.** Same city seed, same $100M, same ten years, same
> seeded emergencies. You run one city, an autonomous AI runs the other, and at the end a
> transparent seven-component score says who built the better city. Nothing is rigged: the AI
> loses objectives it is badly suited to, and the winner is whatever the simulation produces.

**Three modes decide who is holding the controls:**

| | | |
| --- | --- | --- |
| **HUMAN** | You build. | The AI stays quiet unless you ask it something. |
| **AI ASSIST** | You build. | The AI watches every change, predicts what it will do, and recommends — but never builds without your approval. |
| **AUTONOMOUS** | The AI builds. | It analyses, prioritises, plans, simulates and constructs against your objective. You can pause it at any time. |

Underneath all three is the same thing: an AI that does not just *report* problems — it
**understands what you asked for, then analyzes → plans → simulates → decides → builds →
re-simulates → explains**.

Type *"I have $50M. Prepare the city for 5,000 new residents."* — or
*"Tôi có 50 triệu đô, chuẩn bị thành phố cho thêm 5.000 dân."* — and the AI parses the goal, the
budget and the constraints out of the sentence, diagnoses the binding constraint, generates
several costed plans, simulates each one for real, scores them against the brief, recommends one
— and then **autonomously executes it**: the camera flies to the site, a construction zone opens,
structures rise storey by storey, corridors and bus routes are laid, the simulation re-solves and
the heatmap drains. Then it shows you the before/after.

```
UNDERSTAND → ANALYZE → CONSTRAIN → PLAN → SIMULATE → DECIDE → EXECUTE → CONSTRUCT → RE-SIMULATE → EXPLAIN
```

It is not a chatbot with a city behind it. Every sentence resolves to a structured intent that
drives the *same* planner, the same simulation and the same construction system the buttons use —
and the AI reports only what actually happened.

> **Prototype simulation — illustrative estimates.**
> Every formula in `src/simulation/` is a transparent, hand-tuned demo coefficient. Nothing here
> is a calibrated prediction of any real city.

---

## 1. How to run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # typecheck + production bundle into dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit
npm run verify          # run the simulation engine headlessly and print the model outputs
npm run verify:planner  # run the AI planner headlessly: parse → diagnose → plan → decide → report
npm run verify:nlu      # run the natural-language layer headlessly: 50+ EN/VI requests → intent → action
npm run verify:sandbox  # run the sandbox headlessly: finance, health, demand, and the agent over 10 simulated years
npm run verify:challenge # run whole 10-year matches headlessly: fairness, determinism, four personalities
```

No backend, no API keys, no external assets. Everything runs locally in the browser.

### The demo (~85 seconds)

Click **DEMO** in the top right (or press `D`).

The demo does exactly one thing itself: it **types a sentence into the command bar**. Everything
after that — objective, budget, target, plans, construction — is derived by the AI from that
sentence. Nothing is pre-set for it. It deliberately starts on the *wrong* settings (Balanced
objective, $25M) so you can watch the request move them.

| Time | What happens |
| --- | --- |
| 0–5s | City overview · `Balanced · $25.0M · Standing by` |
| 5–9s | `POPULATION GROWTH DETECTED` |
| 9–14s | Camera moves toward the districts under pressure |
| 14–19s | `JUST TELL THE CITY WHAT YOU WANT` — *"I have $50M. Prepare the city for 5,000 new residents."* is typed into the command bar, character by character |
| 19–24s | `UNDERSTANDING THE REQUEST` → `POPULATION GROWTH · +5,000 · $50M`. The objective flips to **Population**, the budget to **$50M**, and the command center fills in what it read at 92% confidence |
| 24–31s | `GENERATING CITY PLANS` — four plans costed and simulated for real |
| 31–35s | `PLAN B SELECTED` |
| 35–60s | Autonomous construction — camera follows each of the 8 steps |
| 60–64s | Re-simulation and the hero result |
| 64–71s | Heatmap transition proves the change on the city itself |
| 72–84s | Full before/after |

### Driving it yourself

1. Type a request into the command bar at the bottom of the 3D view (press `/` to focus it) and
   hit **ASK CITY AI** — in English or Vietnamese. The **Try** chips are live examples; the
   **Suggested next** chips in the command center follow on from what just happened.
2. Pick an **objective** (Balanced · Population · Traffic · Cost · Quality · CO₂ · Economy) and a
   **budget** ($10M / $25M / $50M / $100M / custom).
3. Watch the plans get simulated, then **Execute** the recommendation or **Build this** on any
   other card. The AI takes over from there — **Pause**, **Skip** (fast-forwards rather than
   teleporting, so the city never lands half-built), **Replay optimization** and **Undo build** are
   in the command center throughout.
4. **AUTO** hands the whole thing to the AI: it picks the objective from the city's own worst
   problem and executes the winning plan without asking.
5. **Scenario challenges** on the left load a stressed city and a brief (Population Boom, Downtown
   Congestion, School Crisis, Energy Crisis, Climate Challenge…).

**Keyboard:** `C` open the AI-vs-Human challenge · `O` optimize · `T` start/stop the calendar ·
`H` city history · `Space` run scenario simulation · `D` demo · `/` focus the command bar ·
`Esc` cancel placing, demolishing or a dialog.

Any pointer or wheel input on the canvas immediately takes the camera back from the AI.

---

## 2. Project structure

```
src/
├── simulation/                 # the engine — pure functions, no React, no DOM
│   ├── config.ts               # every model constant, documented in one place
│   ├── types.ts                # City / Building / Road / Metric / SimulationResult
│   ├── pressure.ts             # utilisation → LOW | MODERATE | HIGH | CRITICAL
│   ├── populationModel.ts      # building inventory + population from dwelling capacity
│   ├── trafficModel.ts         # peak-hour assignment, BPR speed curve, per-segment V/C
│   ├── energyModel.ts          # electricity demand and peak MW
│   ├── waterModel.ts           # potable demand, leakage, wastewater
│   ├── retailModel.ts          # retail floor-space demand vs supply
│   ├── educationModel.ts       # students vs school seats
│   ├── parkingModel.ts         # parking demand vs supply
│   ├── transitModel.ts         # ridership vs peak-hour places
│   ├── emissionsModel.ts       # CO₂ from transport, grid, heating, industry, water
│   ├── costModel.ts            # annual municipal operating cost
│   ├── economyModel.ts         # GVA, employment rate, economic activity index
│   ├── livabilityModel.ts      # quality-of-life basket
│   ├── citySimulation.ts       # ← the engine boundary: runSimulation(city, config)
│   └── scenarios.ts            # the 8 scenario presets
├── ai/                         # ── the AI city planner ──
│   ├── nlu/                    # ── natural-language understanding (Phase 4) ──
│   │   ├── types.ts            # IntentKind / MetricConstraint / CityIntent / AIAction / AITurn
│   │   ├── numbers.ts          # "5k" "20 thousand" "$50M" "5.000" → numbers, EN + VI
│   │   ├── lexicon.ts          # the bilingual intent / infrastructure / location tables
│   │   ├── constraints.ts      # "under $20M" "keep CO2 below 50%" "don't hurt the economy"
│   │   ├── locations.ts        # named districts + auto-siting by unmet demand, with a reason
│   │   └── LocalCityAIProvider.ts # the deterministic provider — no keys, no network
│   ├── CityAIProvider.ts       # ← the understanding boundary + LLM-ready seam
│   ├── ChallengeAgent.ts       # ← the opponent: foresight, memory and fallibility
│   ├── AIPersonality.ts        # Conservative · Growth · Sustainable · Balanced
│   ├── AIMemory.ts             # judges its own builds by what happened next
│   ├── AutonomousCityAgent.ts  # ← analyze → prioritise → plan → simulate → score → execute
│   ├── CityPriorities.ts       # every city problem, ranked 0-100 on urgency
│   ├── CityAdvisor.ts          # AI ASSIST's voice: what is wrong, and the simulated fix
│   ├── predictImpact.ts        # what happens if you build this — by actually simulating it
│   ├── intentRouter.ts         # CityIntent → AIAction (optimize | build | answer | clarify | control)
│   ├── constraintCheck.ts      # hard constraints evaluated against *simulated* outcomes
│   ├── planValidation.ts       # a malformed plan can never reach the city state
│   ├── types.ts                # CityObjective / CityConstraint / CityPlan / CityPlanStep …
│   ├── ObjectiveParser.ts      # plain English → objective + budget + population target
│   ├── PlanGenerator.ts        # blueprints, headroom search, budget-aware greedy fitting
│   ├── PlanScorer.ts           # weighted 0-100 scoring + confidence
│   ├── OptimizationEngine.ts   # diagnose → plan → decide → report (pure)
│   ├── CityAIPlanner.ts        # ← the planner boundary + LLM-ready seam
│   ├── challenges.ts           # the 8 scenario challenges
│   └── cityAnalyst.ts          # Phase 1 analyst: analyse() + ask()
├── challenge/                  # ── the Phase 6 AI-vs-Human match ──
│   ├── CityRuntime.ts          # a city that can be advanced headlessly and deterministically
│   ├── ChallengeRunner.ts      # ← the match: two cities, one clock, one event timeline
│   ├── ChallengeConfig.ts      # seeds, budgets, populations, lengths, objectives
│   ├── ScoreEngine.ts          # the seven-component city score, weighted by objective
│   ├── ComparisonEngine.ts     # why a side won, from its own measured history
│   ├── scaleCity.ts            # a well-formed city at 10k, 20k or 50k residents
│   └── challengeDemo.ts        # the ~90-second AI-vs-Human demo
├── sandbox/                    # ── the Phase 5 city sandbox ──
│   ├── modes.ts                # HUMAN / AI ASSIST / AUTONOMOUS — who may build
│   ├── catalogue.ts            # the 10-category build catalogue, 20 structures + 4 linear
│   ├── finance.ts              # asset opex + six revenue lines → the city's books
│   ├── health.ts               # the 0-100 City Health score and its nine components
│   ├── demand.ts               # residential / commercial / industrial / education / … bars
│   ├── population.ts           # occupancy responds to jobs, schools, traffic, quality of life
│   ├── events.ts               # seeded emergencies — energy, water, recession, school crisis
│   ├── siting.ts               # where a building goes, and the reason attached to it
│   ├── sandboxPlan.ts          # a catalogue pick → a real, executable CityPlan
│   ├── history.ts              # the city's own record, by simulated year and month
│   └── persistence.ts          # three localStorage city slots — no backend
├── city/
│   ├── generateCity.ts         # seeded procedural city (blocks, zoning, roads, buildings)
│   ├── placement.ts            # building templates + slot allocation for the build tool
│   └── infrastructure.ts       # infra catalogue, costs, CityDelta + applyDelta
├── execution/                  # ── autonomous construction ──
│   ├── executionClock.ts       # the pausable construction clock (outside React)
│   ├── types.ts                # ConstructionStep / CameraShot / ExecutionQueue
│   ├── buildQueue.ts           # plan → ordered, camera-directed build sequence
│   └── buildingStages.ts       # foundation → floors → windows → details
├── store/
│   ├── useCityStore.ts         # Zustand: city state, run animation, events, chat
│   ├── useOptimizerStore.ts    # the optimizer's control plane + execution director
│   ├── useSandboxStore.ts      # Phase 5: modes, treasury, the calendar, build/demolish, history
│   ├── useChallengeStore.ts    # Phase 6: the match clock and the bridge to the live city
│   └── demo.ts                 # the ~85-second presentation — types a sentence, then watches
├── components/
│   ├── scene/
│   │   ├── CityCanvas.tsx      # Canvas, camera, orbit rig, bloom/vignette
│   │   ├── SkyCycle.tsx        # day/night lighting, sun arc, fog, moon
│   │   ├── Ground.tsx          # ground texture + congestion ribbons + click-to-build
│   │   ├── groundTexture.ts    # the whole street grid painted into one canvas texture
│   │   ├── Buildings.tsx       # instanced buildings, heatmaps, hover/select, growth-in
│   │   ├── Traffic.tsx         # instanced cars, buses, pedestrians, headlights
│   │   ├── Props.tsx           # instanced trees, street lights, signal heads
│   │   ├── Infrastructure.tsx  # expressways, piers, BRT routes, widened corridors, blueprints
│   │   ├── ConstructionSites.tsx # perimeter, holo-grid, progress ring, beams, sparks, readout
│   │   ├── Landmarks.tsx       # school roof/canopy/playground, transit platform/canopy/pylon
│   │   ├── DistrictHighlight.tsx # the survey marker over the site the AI chose, before it builds
│   │   ├── PlacementGhost.tsx  # the translucent building that follows the cursor
│   │   ├── CityViewContext.tsx # which city a scene draws — the seam that makes split-screen work
│   │   └── CameraDirector.tsx  # the cinematic camera: flyTo / focusOn / orbitAround / overview
│   └── ui/
│       ├── TopBar.tsx          # live readouts + DEMO
│       ├── LeftPanel.tsx       # scenarios, challenges, simulation control, build tool
│       ├── RightPanel.tsx      # optimizer panel + Phase 1 analyst, metrics, chat
│       ├── BottomPanel.tsx     # time-series, delta bars, pressure radar, event log
│       ├── ChallengeSetup.tsx  # the match terms — seed, budget, population, objective, opponent
│       ├── SplitCityView.tsx   # both cities rendered at once, stats coloured against each other
│       ├── ChallengeHud.tsx    # the match clock, the live score, PLAY / PAUSE / 1× 5× 20× / SKIP
│       ├── ChallengePanels.tsx # leaderboard, AI activity log, decision moments
│       ├── ChallengeResults.tsx # winner reveal, why it won, charts, the full comparison
│       ├── ChallengeTournament.tsx # all four personalities on the same city
│       ├── SandboxBar.tsx      # mode selector · who is in control · calendar · budget · health
│       ├── BuildToolbar.tsx    # the ten build categories, and DEMOLISH
│       ├── BuildPreview.tsx    # the predicted-impact card shown while you place
│       ├── CityVitals.tsx      # demand bars, population dynamics, the books, health breakdown
│       ├── AIAdvisorPanel.tsx  # AI ASSIST: status, top issue, recommendation with a button
│       ├── AIControlPanel.tsx  # AUTONOMOUS: current action, objective, money rules, control log
│       ├── CityHistoryPanel.tsx # the timeline of everything the city has been through
│       ├── CitySlots.tsx       # save / load / new / reset, and the Human-vs-AI challenge
│       ├── DemolishDialog.tsx  # cost and simulated impact before anything is removed
│       ├── AICommandBar.tsx    # ASK CITY AI, live examples, objective, budget, AUTO
│       ├── AIConversation.tsx  # "I understand…", the transcript, suggested next commands
│       ├── OptimizationPanel.tsx # status pipeline, bottlenecks, plans, why, AI event log
│       ├── PlanCards.tsx       # the interactive plan cards
│       ├── OptimizationReport.tsx # before/after modal + live build overlay
│       ├── ExecutionPanel.tsx  # the live build queue + pause / skip / replay / undo
│       ├── CinematicOverlay.tsx # letterbox, phase banners, step readout
│       ├── HeroResult.tsx      # the final reveal with counting numbers
│       ├── AnimatedNumber.tsx  # counts to a value instead of swapping it
│       ├── ChallengePanel.tsx  # scenario challenges
│       ├── CanvasOverlays.tsx  # heatmap bar, inspector, compare wipe, demo captions
│       └── MetricTile.tsx      # animated metric tile
└── lib/                        # clock, colours, number formatting, grid agents
```

### The two boundaries

**Simulation.** The UI only ever calls `runSimulation(city, config)`. Replacing the deterministic
models with calibrated models, a WASM micro-simulation or a remote ML service means re-implementing
that one function — nothing else in the app touches an individual model.

**Planning.** Everything the optimizer UI knows comes through `planner` in `CityAIPlanner.ts`:

```ts
export interface CityAIPlanner {
  parse(raw, fallback): ParsedRequest          // plain English → CityObjective + CityConstraint
  diagnose(input): CityDiagnosis               // bottlenecks + headroom + binding constraint
  plan(input, diagnosis): PlannerRun           // candidate CityPlans, scored, with a Decision
  autoObjective(diagnosis): CityObjective      // AUTO mode's own read of the city
}

export const planner: CityAIPlanner = deterministicPlanner
// later: createClaudePlanner({ apiKey, model: 'claude-opus-5' })
```

`describeCityForModel()` already emits exactly the structured payload a hosted model would be
prompted with (objective, weights, constraint, diagnosis, every metric, inventory), so swapping in
an LLM is a single-file change. **No component imports a model or a blueprint directly.**

**Understanding.** Phase 4 adds a third boundary. Everything the UI knows about what you *meant*
comes through `cityAI` in `nlu/LocalCityAIProvider.ts`:

```ts
export interface CityAIProvider {
  id: string
  understandRequest(input: string, context: CityAIContext): Promise<CityIntent>
}

export const cityAI: CityAIProvider = localCityAI   // deterministic, offline
// later: createClaudeCityAI({ apiKey, model: 'claude-opus-5' })
```

`understandRequest` is already `async` and already receives `describeContextForModel(context)` —
the districts, the live metrics, what has been built this session, the previous turn — so a hosted
model drops in behind the same call. **The store never parses a string itself.**

---

## 3. Phase 6 — AI vs Human

Press **`C`**, or the **AI vs HUMAN** button in the status strip.

### The premise

> Same city. Same resources. Ten years.

Both sides start from *the same `CitySnapshot` object* — not a copy, not a re-roll. Snapshots are
immutable and every change returns a new one, so there is no mechanism by which one city could
diverge from the other before either side acts. Emergencies are drawn from `eventDueAt(seed, tick)`,
which is a pure function of the seed and the month, so neither side ever gets a roll the other
did not.

`npm run verify:challenge` prints the fingerprints and asserts they match:

```
human  158|180|0|104|20001|12017|0.740573|0.754803|…|100000000.00|57
ai     158|180|0|104|20001|12017|0.740573|0.754803|…|100000000.00|57
identical: YES · same object: YES (structurally shared)
```

### Split screen, one scene

Until Phase 6 every scene component read the city store directly. They now read it from
`CityViewContext`, whose default provider *is* the live store — so the single-city view is
unchanged and the split view is the same components under a different provider. No scene code is
duplicated, the instanced pipeline and lighting are identical, and the AI's city is marked
`interactive: false` so it cannot be edited by hand.

Double-click either city to enlarge it. Every stat is coloured against the other side, so the
comparison reads without a separate table.

### The opponent

The challenge agent extends the Phase 5 loop with the three things a *competitor* needs:

| | |
| --- | --- |
| **Foresight** | It projects each system forward from the city's own recent history and acts on where things are heading. This is what lets it build transit *before* congestion. A match log line reads: *"Housing is at 79/100 and rising — projected 88/100 within 5 months → building residential tower."* |
| **Memory** | Nine months after each build it judges the result and shifts its preferences. From a real run: *"Residential tower added 7 points of congestion under the current road capacity"* → `residential_tower −42%`, `apartment −50%`. |
| **Fallibility** | It has no oracle. The projection is a straight-line extrapolation and is often wrong, and a Growth personality will build itself into an 88% traffic crisis before noticing. |

Every decision names the measured reading that caused it, and every option it weighed was
*actually simulated* — the decision-moment panel shows the real score deltas it measured:

```
ENVIRONMENT — CRITICAL DECISION            Year 1
Environment at 100/100 — 9,396 kg CO₂ per resident/yr
  A  Solar farm    $14.0M   score +1.50  health +1   ← chosen
  B  Transit hub   $12.5M   score +1.30  health +1
  C  Large park     $2.4M   score −0.10  health −1
```

### Four personalities that genuinely differ

They share one algorithm. What changes is what they *value*: which problems they weight, how much
money they refuse to commit, how loaded a system must be before they act, and how much short-term
pain they will accept. From one tournament on the same city:

| | Score | Population | Traffic | CO₂/head | Cash left | Builds |
| --- | --- | --- | --- | --- | --- | --- |
| 🥇 **Balanced** | 63.4 | 26,746 | 79% | 6.5t | $5.1M | 77 |
| 🥈 **Sustainable** | 62.6 | 23,313 | **67%** | **5.7t** | $8.2M | 69 |
| 🥉 **Conservative** | 62.0 | 23,006 | 66% | 5.8t | **$11.8M** | 58 |
| **Growth** | 55.8 | **30,377** | **88%** | 7.0t | $0.9M | 83 |

Growth houses the most people and pays for it in congestion and an empty treasury. Sustainable
runs the cleanest, quietest city. Conservative ends with the money. **And the ranking changes with
the objective** — under *Economic growth*, Growth wins:

```
Balanced            Sustainable 62.6 · Conservative 62.0 · Balanced 63.4 · Growth 55.8
Economic growth     Growth 59.1 · Conservative 56.4 · Balanced 55.8 · Sustainable 55.7
Sustainable city    Sustainable 69.4 · Balanced 62.2 · Growth 54.5 · Conservative 51.2
Traffic reduction   Sustainable 63.6 · Balanced 62.1 · Conservative 52.3 · Growth 51.4
```

### The score

One number from seven components, each 0-100, weighted by the match objective:

```
score = population×0.15 + economy×0.20 + traffic×0.15 + education×0.10
      + environment×0.15 + quality×0.15 + financial×0.10          (Balanced)
```

Components are measured **relative to the starting city**, because the question is who improved
*this* city most — not who is closest to an arbitrary ideal. The weights are re-normalised per
objective, so scores stay comparable across match types.

### Playing your side

Everything from Phases 1-5 works inside a match. The build toolbar, the predicted-impact preview,
demolition, the natural-language command bar and the AI advisor all operate on your match city —
so a build lands in the city the score actually reads. Put a school down and the treasury moves
$100.9M → $93.1M, your score moves 60.2 → 60.8, and the activity log records *"You built school"*.

Set the mode to **AI ASSIST** and you get an advisor helping you against the opponent.

### The end of it

At year 10 the match stops and shows the winner, then *why*, generated from the two histories:

> **AI WINS** — Human 55.4, Balanced AI 63.4, by 8.0
>
> "The AI won on environment and population, which together account for most of the 8.0-point
> margin over your city. It acted on 16 problems before they became critical."

…followed by the decisive components with their point swings, the top three decisions that
produced them, both cities' ten years plotted on the same charts (score, population, traffic,
budget, CO₂, quality of life, city health), and a twelve-row final comparison.

Then **Replay** (same seed, same events), **vs Conservative / Growth / Sustainable** (same city,
different opponent), or a fresh setup.

### Other ways in

- **Watch AI only** — no human side; the AI runs the city for the whole challenge.
- **AI tournament** — all four personalities on the same city, ranked.
- **Start demo** — a complete ten-year match in about 90 seconds, with the human side played by a
  handful of reasonable-but-reactive moves. The AI's moves are not scripted and the winner is not
  fixed.

---

## 4. Phase 5 — the human + AI sandbox

### Who is in control, always on screen

The strip under the title bar is the most important thing in Phase 5, because every other panel
changes meaning depending on which mode is lit:

```
[ ⌘ HUMAN ] [ ◈ AI ASSIST ] [ ⬢ AUTONOMOUS ]   CONTROL: You   AI: Advisor
▶ Year 4 · Jul   1× 2× 5×   BUDGET $73.4M   NET +$2.8M   CITY HEALTH  HEALTHY 78
```

Switching is instant and never resets the city. The AI picks up from whatever state it finds:

```
HUMAN → AI ASSIST     "Advising from here. You keep the controls."
AI ASSIST → AUTONOMOUS "Understood. Taking control — I will analyse the city, choose a
                        priority and start building against your objective."
AUTONOMOUS → HUMAN     "Understood — you have the city."
```

**Only AUTONOMOUS lets the AI build unprompted.** That rule is enforced in one place
(`MODES[mode].aiMayBuild`) and is never bent.

### The city is a place now, not a demonstration

| | |
| --- | --- |
| **Free build** | Ten categories, 20 structures and 4 kinds of linear infrastructure — small house through residential tower, shop through shopping centre, clinic and hospital, school and university, bus interchange and transit hub, solar farm and power plant, small and large parks, corridor widening, expressways, smart junctions, BRT. |
| **Demolish** | Click any building. You see the clearance cost and the *simulated* consequence before you confirm. |
| **Budget** | A persistent $100M treasury. Construction is refused outright when the money is not there, with the shortfall stated. |
| **Operating cost** | Every structure is a permanent claim on the budget — a school is $0.5M/yr for ever, a hospital $1.2M/yr, a transit hub $1.0M/yr. |
| **Revenue** | Council tax, business rates, retail, transit fares, utility charges and parking — all scaled off the live simulation, so growing the city grows the income. |
| **The calendar** | One tick is one simulated month. Population, demand, revenue, congestion and emissions all move with it. |
| **Emergencies** | Seeded and deterministic: energy shortage, water shortage, recession, economic boom, school crisis, traffic surge, fuel spike. Same seed, same weather — so a Human-vs-AI run is a fair test. |
| **City health** | One 0-100 score over nine weighted systems, with the weakest always named. |
| **History** | Every build, demolition, emergency and milestone, stamped with the simulated date. |
| **Save / load** | Three city slots in `localStorage`. No backend. |

### Population is an argument, not a constant

The engine derives population from `residentialCapacity × occupancyRate`. Phase 5 stops treating
occupancy as fixed and lets the city argue for it. Six factors — jobs, schools, healthcare,
traffic, quality of life, utilities — set an equilibrium occupancy, and the city drifts toward it
about 22% of the way per simulated year.

That is the loop the sandbox needed: **build towers and the population climbs, but keep building
them without the schools, roads and jobs to match and occupancy stalls or reverses.**

### The interaction the whole phase is built around

Pick anything from the catalogue and the preview card is not an estimate table. The candidate is
placed on a copy of the city, **the entire simulation is re-run**, and the two results are
differenced. Every number on the card is the number the city will read a second later:

```
PLACING  ▤ School
SITE     South Gate          COST $7.8M      UPKEEP $500,000/yr
PREDICTED                                            health +1
  Parking          −0.6%      School pressure  −16.7%
  Grid load        +1.8%      Water load        +0.6%
  CO₂              +0.7%      Jobs               +55
  Net income  −$418,817/yr
AI · Modest, safe improvement. +480 student seats.
```

When a placement would push something to its ceiling, the card says so before you commit —
*"This pushes parking to 96% — pair it with a transit connection."*

### AI ASSIST: it watches, predicts, recommends — and never builds

The advisor ranks every city problem 0-100 on urgency, works out the remedy, **simulates that
remedy**, and only then speaks. It refuses to recommend anything that would leave the city worse
off; if nothing affordable improves things, it says that instead of inventing a suggestion.

```
⚠ EDUCATION UNDER PRESSURE
  84% of school seats taken
  Build a school in East Ridge.
  Cost $7.8M · Upkeep $500,000/yr
  Expected  education 84% → 63%          City health  +3
  [ BUILD RECOMMENDATION ]  [ NOT NOW ]
```

### AUTONOMOUS: a decision function, not a script

`decide()` is called once per simulated month. It looks at the city *as it stands*, and returns
either one action or a stated reason for doing nothing:

```
ANALYZE → PRIORITIZE → PLAN → SIMULATE → SCORE → EXECUTE → OBSERVE → REPEAT
```

Because it re-reads the live city every time, it adapts with no script anywhere. From an actual
ten-year run (`npm run verify:sandbox`):

```
Y1M2   BUILD    Shopping centre    $5.4M   Finances 72/100 → health +1
Y4M4   ⚠ EVENT  Water shortage (20 months)
Y4M4   BUILD    Water facility    $16.0M   Water 100/100 → health +3
Y6M10  ⚠ EVENT  Energy shortage (24 months)
Y6M10  BUILD    Solar farm        $14.0M   Energy 100/100 → health +5
Y6M11  BUILD    Solar farm        $14.0M   Energy  57/100 → health +4
Y7M8   BUILD    Transit hub       $12.5M   Traffic  50/100 → health +2
```

The water facility was not planned. The shortage arrived, water jumped to the top of the ranking,
and the next call to `decide()` simply saw a different city.

**Three rules it never breaks.** Every action names the ranked problem that caused it. It never
commits money it does not have and never touches the $5M emergency reserve. It simulates before
it builds and abandons anything that would lower city health below the objective's floor — the
gate that stops a growth objective from bulldozing the city with housing it cannot service.

It also declines to act: in that ten-year run it **held 103 of 120 months** rather than build for
the sake of building, and finished with the city solvent (−$0.8M/yr → +$21.9k/yr), healthier
(63 → 70) and larger (10,000 → 11,880 residents).

### Talk to it

The Phase 4 command bar is unchanged, and gains the commands that change who is driving. Control
commands are matched *before* anything else, so "stop" can never be read as a building brief:

| Say | It does |
| --- | --- |
| `Take control.` · `Bạn điều khiển đi.` | switches to AUTONOMOUS and starts working |
| `Assist me.` | switches to AI ASSIST |
| `I'll do it myself.` | switches to HUMAN |
| `Pause.` · `Stop.` · `Tạm dừng.` | stops the AI making decisions; work on site still finishes |
| `Resume.` | carries on from the current city |
| `What's wrong?` | the ranked problem list, from live state |
| `What should I build?` | the advisor's recommendation, with its simulated outcome |
| `Build a school.` · `Fix downtown traffic under $20M.` | Phase 4, exactly as before |

### Human vs AI

Same starting city, same $100M, same ten years, same seeded emergencies. Run one side, then the
other, and the results sit side by side — city health, population, traffic, treasury, CO₂ per head
and economy, with the winner of each row highlighted.

### One construction system, not two

A player placing a school and the agent placing a school produce the same thing: a one-step
`CityPlan` that goes through `validatePlan → executePlan`, the same path the AI has used since
Phase 2. Both get the site survey, the staged build, the camera work and the re-simulation, and
**neither can corrupt city state** — there is no second code path that quietly mutates the city.

Human builds run quiet; the agent's larger work is cinematic, so the camera only moves for things
worth looking at.

---

## 5. Phase 4 — natural-language autonomy

### The sentence is the interface

```
you → "Build a school near the residential district."
         │
         ▼  LocalCityAIProvider.understandRequest()
      CityIntent { kind: 'build_specific', buildKind: 'school', count: 1,
                   location: { kind: 'descriptor', label: 'residential district' },
                   constraints: [], language: 'en', parseConfidence: 0.92 }
         │
         ▼  intentRouter.routeIntent()
      AIAction  { type: 'build', kind: 'school', count: 1,
                  location: { district: 'south_gate', reason: 'best match for the
                              residential district', x, z } }
         │
         ▼  useOptimizerStore.dispatchAction()
      buildSpecificPlan() → validatePlan() → scorePlan() → executePlan()
         │
         ▼  Phase 3 construction, unchanged
      camera flies, site opens, the school rises, the simulation re-solves
```

A direct build order and a generated optimisation plan travel the **same** simulate → validate →
score → construct path. There is no second code path that quietly mutates the city.

### What it understands

| | |
| --- | --- |
| **Intents** | population growth · traffic reduction · cost optimisation · quality of life · CO₂ reduction · economic growth · education · energy · water · parking · balanced optimisation · build-specific · question |
| **Numbers** | `5,000` · `5k` · `20 thousand` · `$50M` · `$20 million` · `20m` · and the Vietnamese `5.000` / `50 triệu` / `2 tỷ` |
| **Money vs people** | decided by the surrounding words, not the magnitude — `$20M` is a budget, `20 thousand residents` is a target |
| **Locations** | `downtown` · `north` · `the residential district` · `East Ridge` · `khu dân cư` · `phía đông` — or nothing, and the AI picks by unmet demand |
| **Constraints** | `under $20M` · `keep CO2 below 50%` · `don't reduce economic activity` · `at least 80% transit coverage` |
| **Vietnamese** | `dân` `người` `triệu` `tỷ` `giao thông` `ùn tắc` `trường học` `bệnh viện` `đỗ xe` `khí thải` `kinh tế` — diacritics optional |
| **Follow-ups** | *"Too expensive. Keep it under $30M."* keeps the previous target and re-plans · *"What if we build roads instead?"* keeps the goal and pivots the solution family |
| **Questions** | *"How is the city doing?"* · *"What did you build?"* · *"How much budget is left?"* · *"Why that plan?"* — answered from live state, **never** triggering construction |

`npm run verify:nlu` runs the whole table headlessly and prints intent, constraints and the routed
action for every phrase.

### Constraints are enforced, not asserted

`extractConstraints()` produces `MetricConstraint[]`, which travels into `CityConstraint.metrics`.
Every candidate plan is **simulated**, and `evaluateConstraints(after, before, constraints)` reads
the metric off the *simulated* result. A plan that breaks the brief has its score multiplied by
`0.3`, carries its violations in `plan.violations`, and `decide()` only recommends it when nothing
compliant exists — saying so.

So *"Reduce CO2 without hurting the economy"* cannot be answered with a plan that quietly costs
economic activity. It is checked against the number, not against the intention.

### Impossible briefs get a straight answer

*"I want 100,000 new residents with $1M."*

> **Constraint conflict detected** — +100,000 residents is beyond what this city can absorb —
> measured headroom is 2,850, limited by parking. Best achievable now: about 2,850 additional
> residents before parking fails. Raise the budget or lower the target and ask again.

The headroom figure is the binary-searched `headroom()` result, not a guess, and nothing is built.

### The AI never claims work it did not do

The transcript status is the truth:

| status | means |
| --- | --- |
| `understood` | the sentence was parsed |
| `planning` | plans generated · *"Recommending Transit + School Package — awaiting your go-ahead"* |
| `building` | construction is actually running |
| `complete` | the structure exists in city state and the simulation has re-solved |
| `answered` | a question — the city was not touched |
| `rejected` | no valid plan, with the reason |

*"Construction planned"* and *"School complete"* are different sentences and are never
interchanged. `"What did you build?"` reads the recorded completions only — it listed
`School — South Gate (08:53:27)` and `School — East Ridge (08:55:19)` after two builds, and nothing
after a request that was only planned.

### City-state memory

`AIConversationState` keeps the last intent, the live constraints and every completed structure
with its district. So *"Build another school"* scores districts by unmet education demand and
applies a `-0.55` penalty to any district that just received the same kind of building — the second
school goes to **East Ridge**, not back to South Gate, and the panel says why.

### Nothing malformed reaches the city

`validatePlan(plan, city, constraint)` runs before every execution and checks structure, unknown
infrastructure kinds, an empty delta, plot collisions (`slotKey`), missing road/intersection ids,
the budget, and the brief. A failing plan is rejected in the transcript with the reason; the city
state is never touched.

### Planning confidence

A single number, assembled from deterministic factors — how much of the sentence matched the
lexicon, whether a budget and a target were found, whether the location was explicit, whether the
constraints are satisfiable. `92%` for a fully specified request, `66%` for *"Make the city
better"*, `58%` for a bare follow-up. No chain-of-thought is shown, only the decision factors.

### The four demo requests

| Say | It does |
| --- | --- |
| `I have $50M. Prepare the city for 5,000 new residents.` | population growth · +5,000 · $50M → 4 costed plans, recommends Transit + School Package at $35.5M / 80 pts |
| `Fix downtown traffic under $20M.` | traffic · Downtown · budget cap → every candidate priced ≤ $20M |
| `Build a school near the residential district.` | sites it in South Gate, flies there, builds it, re-simulates |
| `Tôi có 50 triệu đô, chuẩn bị thành phố cho thêm 5.000 dân.` | identical plan to the English request, labelled `Tiếng Việt` |

### Acceptance run

All eight acceptance tests pass in the browser with **zero console errors**:

| # | Request | Result |
| --- | --- | --- |
| 1 | `I have $50M. Prepare the city for 5,000 new residents.` | `population growth · +5,000 · $50M` · 4 plans · Plan B $35.5M / 80 |
| 2 | `Fix downtown traffic under $20M.` | `traffic reduction · $20M · Downtown` · plans $19.6M / $15.2M / $14.0M / $16.8M |
| 3 | `Build a school near the residential district.` | sited **South Gate**, built, schools 5 → 6 |
| 4 | `Reduce CO2 without hurting the economy.` | `co2 reduction · economy must not fall` · Utility Reinforcement |
| 5 | `Tôi có 50 triệu đô, chuẩn bị thành phố cho thêm 5.000 dân.` | `population growth · +5,000 · $50M · Tiếng Việt` |
| 6 | `Make the city better.` | `balanced optimization` · 66% confidence · plans anyway |
| 7 | `Build another school.` | sited **East Ridge** — a *different* district — schools 6 → 7 |
| 8 | `How is the city doing?` | answered from live state · **no construction** |

Plus: *"I want 100,000 new residents with $1M."* → constraint conflict + best achievable ·
*"Too expensive. Keep it under $30M."* → re-planned, every option ≤ $30M ·
*"What if we build roads instead?"* → pivots to Road & Corridor Expansion.

---

## 6. Phase 3 — autonomous construction

### One clock, not a pile of flags

Execution is a single pausable clock (`execution/executionClock.ts`) plus an ordered queue. Every
construction window in the 3D scene is expressed in *execution-elapsed milliseconds*, never in
wall-clock time — which is exactly what makes **Pause**, **Skip** and **Replay** work without a web
of cancelled timers, and what keeps the buildings, camera, blueprints and progress rings in lockstep.

The state machine is `idle → analyzing → planning → simulating → deciding → review → building →
complete`, with the step queue carrying its own `QUEUED | BUILDING | COMPLETE` status per item.

### A logical build order

`execution/buildQueue.ts` turns the approved plan into a directed sequence — the interchange before
the corridors that feed it, the school before the route that serves it, the network connected last:

```
01 ANALYZING CONSTRUCTION SITE     05 CONSTRUCTING PARKING GARAGE
02 ALLOCATING RESOURCES            06 CONNECTING BUS RAPID TRANSIT ROUTE
03 CONSTRUCTING TRANSIT HUB        07 RUNNING NEW CITY SIMULATION
04 CONSTRUCTING SCHOOL             08 OPTIMIZATION COMPLETE
```

Each step carries its own camera shot, so the direction comes from the plan rather than a hard-coded
storyboard: whatever the AI decides to build is what the camera goes to look at.

### Buildings are constructed, not spawned

`execution/buildingStages.ts` drives every structure through readable phases:

| Phase | What you see |
| --- | --- |
| `foundation` | a slab and a lit pit; nothing has risen yet |
| `rising` | the frame stacks **storey by storey** (height is quantised to floors, so it steps rather than stretching) |
| `finishing` | topped out — bare concrete becomes the finished facade and the windows come on |
| `done` | scaffolding, beams and sparks fade; it is just part of the city |

The construction zone around it has a rotating perimeter, a holographic floor grid, a progress arc
that is a real arc of the work done, corner beams that climb with the frame, a scan plane sweeping
the top, rising sparks and a `CONSTRUCTION SITE / TRANSIT HUB / 42%` readout.

Roads get their own sequence: **survey blueprint → surface expands from the centre → markings and
lights**. Bus routes survey the whole corridor first, then light up segment by segment.

### The cinematic camera

`CameraDirector.tsx` interpolates in **spherical space** — target, distance, polar and azimuth — so
the camera arcs around the city instead of sliding through it, with ease-in-out on every move and an
optional orbit once it arrives. Reusable moves: `flyTo` · `focusOn` · `orbitAround` · `zoomTo` ·
`returnToOverview`. Any pointer or wheel input cancels the move instantly and hands control back to
OrbitControls.

### The city visibly reacts

- **Heatmaps drain rather than snap** — district heat and per-segment congestion are eased toward the
  new simulation over ~2s, so you watch red bleed out of the corridors the AI just fixed.
- **Buses use the new routes** — each BRT corridor gets a pinned pair of vehicles running end to end,
  and they are not slowed by general traffic.
- **New structures are highlighted briefly**, then settle into the skyline.
- **Schools and transit hubs are recognisable** — a pitched roof, entrance canopy, playground and
  sign; a platform, canopy and lit pylon. Details only appear at the right construction phase.

### Nothing is faked

If the AI builds a school, the school is in `city.buildings` and the education model counts its
seats. If it lays a bus route, it is in `city.busRoutes`, the transit model counts its vehicles and
buses drive it. The before/after numbers come from re-running `runSimulation` on the changed city —
which is why **Undo build** can restore the exact prior state, and **Replay** reproduces the same
result every time.

### Controls

| Control | Behaviour |
| --- | --- |
| **Pause / Resume** | freezes the construction clock — buildings, camera and progress all hold |
| **Skip** | fast-forwards the clock ×14; the sequence still completes properly |
| **Replay optimization** | restores the snapshot, then re-runs the same plan |
| **Undo build** | restores city, metrics, diagnosis, heatmap and budget to the pre-build state |

---

## 7. Phase 2 — the AI City Optimizer

### The pipeline

```
REQUEST → DIAGNOSE → GENERATE → SIMULATE EACH → SCORE → DECIDE → BUILD → RE-SIMULATE → EXPLAIN
```

Nothing in that chain is faked. Each candidate plan is materialised into a real `CityDelta`
(buildings, road widenings, new elevated links, bus routes), applied to a copy of the city, and run
through the *same* `runSimulation` the dashboard uses. The numbers on the plan cards are simulation
output, which is why they can be checked against the before/after report afterwards.

### Population capacity — a measured property, not a guess

`headroom(city, config)` binary-searches how many extra residents the city can absorb before
traffic, schools, parking, the grid or water passes 100% of capacity. A plan's **capacity gain** is
the change in that number. This is what lets the AI say something genuinely useful:

> *"Widening ten corridors cuts congestion 19% but buys zero population capacity — parking, not the
> road network, is the binding constraint."*

…which is exactly what the Road & Corridor Expansion plan reports.

### Objectives and scoring

Seven objectives (Balanced · Population Growth · Traffic · Cost · Quality of Life · CO₂ · Economy),
each a set of weights over ten scored dimensions:

```
score = Σ(dimensionScore × weight) / Σweight     then penalised for being over budget
                                                 or for missing the population target
```

The same four plans get scored very differently per objective — under *traffic* the AI picks the
transit package, under *CO₂* the clean-energy grid, under *economy* the office/retail expansion.

### Budget

The budget is real capital. Plans are trimmed unit-by-unit to fit it, options that still do not fit
are discarded with a note, and executing a plan spends from the pot. At $10M against a
+5,000-resident brief the AI reports **BUDGET CONSTRAINT DETECTED** and delivers the best
achievable package instead of pretending.

### Natural-language requests

`ObjectiveParser.ts` maps free text onto objective + budget + population target, including blended
intents ("reduce CO2 **without hurting** the economy" blends the CO₂ and economy weight sets):

| Request | Parsed as |
| --- | --- |
| "I need this city to support 5,000 additional residents." | Population · target +5,000 |
| "I have $50M. Prepare the city for 20,000 new residents." | Population · target +20,000 · budget $50M |
| "Reduce traffic around downtown." | Traffic, focus traffic |
| "Reduce CO2 without hurting the economy." | CO₂ blended with Economy |
| "Build a better school system." | Quality, focus education |

### Infrastructure the AI can build

Residential tower · Office · Shopping district · School · Hospital · Park · Parking garage ·
Transit hub · Power plant · Solar farm · Water facility · Corridor widening (+2 lanes) ·
Elevated expressway · Bridge · Smart intersection · Bus rapid transit route.

Each carries a capex and a construction time. Power plants and solar farms raise grid capacity
(solar also displaces grid carbon); water facilities raise treatment capacity; transit hubs and BRT
routes shift mode share out of cars, which in turn reduces parking demand.

### Visual construction

Plans are physically built on the map rather than appearing as text. Phase 3 replaced the original
single-stage growth with a full construction sequence — see **Phase 3** above.

### Two new models

`economyModel.ts` (GVA from jobs, retail and household spend; employment rate) and
`livabilityModel.ts` (a weighted basket of traffic comfort, school places, green space, amenities,
transit access, air quality and parking ease) join the metric set, so the AI can trade quality of
life and economic activity against cost.

### The acceptance run

Budget **$50M**, request *"I need this city to support 5,000 additional residents."*

```
DIAGNOSIS   WATCH · headroom 2,850 residents · binding constraint: parking
PLANS       A New Residential District  $46.8M  score 46  capacity +4,609  traffic  +9.3%
            B Transit + School Package  $35.5M  score 80  capacity +5,050  traffic  -8.2%
            C Utility Reinforcement     $46.0M  score 26  capacity   +200  traffic  +0.2%
            D Economic Expansion        $48.8M  score 38  capacity +2,750  traffic  +1.9%
DECISION    Plan B — confidence 97%
```

> "Plan B scored 80/100 under *population* because it delivers +5,050 of 5,000 residents and −16.7%
> school load for $35.5M. It beats Plan A (46/100) by 441 more residents of capacity."

After construction and re-simulation:

| Metric | Before | After | Δ |
| --- | ---: | ---: | ---: |
| Population capacity | 2,850 | 7,900 | **+177%** |
| Traffic | 72% | 66% | −8% |
| School capacity | 61% | 51% | **−17%** |
| Parking | 86% | 70% | **−18%** |
| Quality of life | 72 | 80 | **+12%** |
| Economic activity | $550.0M | $569.6M | +4% |
| Electricity | 75% | 78% | +3% |
| Committed | — | $35.5M | of $50M |

---

## 8. What Phase 1 already provided

**Simulation engine** — 10 independent models behind one boundary, all transparent formulas:

| System | Formula (abridged) |
| --- | --- |
| Population | `Σ(dwelling capacity) × occupancyRate` |
| Traffic | `pop × trips/person × carShare × peakFactor + job trips + through traffic`, BPR speed curve |
| Electricity | `pop × 8.6 kWh + jobs × 26 kWh + industry + institutions + municipal` |
| Water | `pop × 155 L + jobs + institutions + irrigation + industry + 18% losses` |
| Retail | `pop × 1.35 m² + jobs × 0.9 m² + catchment demand` |
| Education | `pop × childrenRate × enrollmentRate` vs `Σ school seats` |
| Parking | `vehicles × 0.95 + jobs × 0.28 + retail m²/100 × 2.6` vs supply |
| Transit | `pop × trips/person × transitModeShare` vs peak-hour places |
| CO₂ | `transport + grid + heating + industry + water − parks` |
| Cost | `energy + water + roads + transit + education + waste + services` |

Peak-hour traffic is assigned segment-by-segment, weighted by road class, centrality **and the
trip generation of the buildings around each segment** — so new development shows up on the streets
next to it, and the analyst can name the corridor that fails first.

**Baseline city** (all configurable in `config.ts` and via the left panel sliders):
10,000 residents · 4,000 vehicles · 6,000 jobs · 50 residential buildings · 10 commercial ·
5 schools · 2 hospitals · 5 parks · 4 parking structures · 4 industrial · 1 transit hub ·
84 road segments · 49 intersections on a 7×7 grid.

**3D city** — seeded procedural generation (same seed ⇒ same city): downtown core, residential
ring, low-rise outskirts, industrial corner, parks, vacant infill plots. Instanced rendering
throughout (buildings, cars, buses, pedestrians, trees, street lights, signals); the entire street
layout — asphalt, kerbs, lane markings, crosswalks, block plots — is painted once into a single
canvas texture. Day/night cycle with window lights that come on at dusk, headlights, orbit/zoom/pan,
hover highlight, click-to-inspect, bloom and vignette.

**Scenarios** — Current City, +1,000 / +5,000 / +10,000 Residents, New Shopping District,
New Residential Tower, New School, New Transit Hub. Running one animates the city (towers grow in),
eases every metric to its new value over ~2 s and narrates the event log as the models converge.

**AI City Analyst** — assessment, ranked problems, recommended interventions (each with a
one-click **APPLY** that actually builds it and re-runs the simulation), confidence score and
affected areas. The chat accepts free text and handles growth questions ("what happens if I add
3,000 residents?" runs a real hypothetical simulation), siting questions, corridor questions,
"what should I build next?", cost questions and per-system lookups.

**Heatmaps** — Traffic, Energy, Water, Retail, Schools, Parking, CO₂. Buildings take a colour from
their district's pressure weighted by building type; road segments get congestion ribbons keyed to
their own V/C ratio.

**Before/after mode** — a metric-by-metric table with deltas and pressure levels, plus a wipe
slider that morphs the 3D city between the two states (new buildings grow in as you drag).

**City building tool** — place a residential tower, school, hospital, shopping centre, parking
garage, park or transit hub; it snaps to the nearest free plot and the simulation recalculates
immediately.

**Event log, time-series charts** (live load indexed to baseline, change-vs-baseline bars,
pressure radar) and a scripted **30-second demo**.

### The headline scenario

`+5,000 Residents` → **RUN SIMULATION** produces, from the formulas above:

| | Current | Simulated | Δ |
| --- | ---: | ---: | ---: |
| Population | 10,000 | 15,004 | +50.0% |
| Traffic (peak veh/h) | 4,898 | 5,785 | **+18.1%** |
| Electricity | 398k kWh/day | 442k | **+10.9%** |
| Water | 7,477 m³/day | 8,414 | **+12.5%** |
| Retail demand | 28.2k m² | 35.0k | **+23.9%** |
| School capacity | 61% | 92% | **HIGH** |
| Parking | 86% | 110% | **CRITICAL** |
| CO₂ | 328k kg/day | 356k | **+8.7%** |

> "Adding 5,004 residents increases residential and retail demand significantly. Traffic rises
> +18.1%, electricity +10.9% and water +12.5%. The largest bottlenecks are parking, school capacity
> and the east ridge road network. East Ridge carries the highest combined pressure."

Recommendations: **1.** Add 1 school · **2.** Add 800 parking spaces · **3.** Increase public
transit capacity · **4.** Add a new road connection.

---

## 9. What should be built next

**Understanding**
- Swap `localCityAI` for an LLM-backed `CityAIProvider` at the existing seam. The lexicon handles
  the phrasings it was written for and degrades to `balanced_optimization` outside them; a model
  would generalise, and `describeContextForModel()` already emits the prompt payload.
- Keep the deterministic provider as the validator behind it: let the model propose a `CityIntent`,
  then run the same `validatePlan()` gate, so a hallucinated plan still cannot reach city state.
- Ask a clarifying question when two intents score within a hair of each other, instead of
  committing to the higher one at low confidence.
- Speech input, and a spoken read-back of the decision factors.

**Planner intelligence**
- Let the planner compose *combinations* across blueprints rather than scaling one at a time, and
  search the intervention space for the cheapest package that keeps every system under threshold.
- Multi-round planning: phase spending across years with a discount rate, and let the AI defer.
- Explain counterfactuals — "if you raise the budget to $70M, Plan A becomes viable and buys X".

**Model fidelity**
- Real shortest-path / user-equilibrium assignment over the road graph instead of weighted shares,
  and a 24-hour profile rather than a scaled daily total.
- Calibrate against open data (census, utility, traffic counts) and publish residuals, so the
  disclaimer can become a confidence interval.
- Induced demand: new road capacity should attract trips back over time, which would make the
  road-widening plan's story even sharper.
- Land-use feedback — new residents induce jobs and retail over several years.

**Product**
- Persist and share an optimisation run (URL-encoded or a small backend); diff two runs side by side.
- Import a real street network (OSM) and real parcels instead of the generated grid.
- Let the user hand-edit a plan before executing it (add/remove steps, see the score move live).
- Export a PDF briefing pack of the before/after for a council meeting.

**Construction & camera**
- Per-object construction geometry (cranes that travel, façade panels that clad floor by floor)
  rather than one staged box per structure.
- Let the user scrub the execution timeline, not just pause and skip.
- Camera collision, so a low hero shot can never clip through a tower.

**Engineering**
- Move `runSimulation` and the headroom search into a Web Worker — plan generation runs ~40
  simulations and currently blocks for ~200ms on the main thread.
- Code-split three.js and postprocessing (1.64 MB / 453 kB gzipped in one chunk today).
- Golden-file tests over `npm run verify`, `verify:planner`, `verify:nlu`, `verify:sandbox` and
  `verify:challenge`, so
  tuning a constant or a regex cannot silently change the headline demo, flip the AI's
  recommendation, break a phrasing that used to parse, or send the autonomous agent bankrupt.

**The challenge**
- Let the AI demolish and rezone, not only add — it currently plays with one hand.
- Multi-step plans: the agent commits to one building per month, so it cannot stage a programme.
- A real opponent model — the agent's foresight is a straight-line extrapolation, which is exactly
  the assumption a learned model would improve on. `ChallengeAgent` takes its whole world through
  one input object, so swapping it is a single-file change.
- Head-to-head replays of a specific year, and a shareable match URL.

**Sandbox**
- Let the player draw roads and zone districts, rather than placing structures on fixed plots.
- More than one thing under construction at a time, so a big programme does not serialise.
- A proper cash-flow projection — the agent currently checks solvency one build at a time and
  cannot see a cliff three moves ahead.
- Let the AI *demolish*: it can only add today, which is half a planner.
