/**
 * The bilingual keyword tables the local parser matches against.
 *
 * Everything is written de-accented and lower-case; `deaccent()` normalises the
 * input first, so "giao thông" and "giao thong" both hit the same rule. Keeping
 * the vocabulary in one file makes it obvious what the parser can and cannot
 * understand — and easy to extend.
 */
import type { InfraKind } from '../../city/infrastructure'
import type { DistrictId, MetricKey } from '../../simulation/types'
import type { IntentKind, QuestionKind } from './types'

export interface LexEntry<T> {
  id: T
  /** matched against the de-accented request */
  patterns: RegExp
  weight: number
}

/* ------------------------------------------------------------------ */
/* intents                                                             */
/* ------------------------------------------------------------------ */

export const INTENT_LEX: LexEntry<IntentKind>[] = [
  {
    id: 'population_growth',
    weight: 1,
    patterns:
      /\b(residents?|people|population|inhabitants?|housing|homes?|dwellings?|grow|growth|absorb|dan|dan cu|nguoi|dan so|nha o|tang dan|dong dan|qua dong)\b/,
  },
  {
    id: 'traffic_reduction',
    weight: 1,
    patterns:
      /\b(traffic|congestion|congested|gridlock|jam|jams|commute|corridor|corridors|road network|giao thong|un tac|ket xe|tac duong|ach tac)\b/,
  },
  {
    id: 'co2_reduction',
    weight: 1,
    patterns:
      /\b(co2|carbon|emissions?|climate|greenhouse|decarbon\w*|pollution|khi thai|o nhiem|phat thai|moi truong)\b/,
  },
  {
    id: 'quality_of_life',
    weight: 1,
    patterns:
      /\b(livable|liveable|livability|quality of life|wellbeing|nicer|better place|green space|dang song|chat luong song|song tot|xanh)\b/,
  },
  {
    id: 'economic_growth',
    weight: 1,
    patterns:
      /\b(economy|economic|jobs?|business|businesses|retail|commercial|gdp|investment|prosperity|kinh te|viec lam|thuong mai|doanh nghiep)\b/,
  },
  {
    id: 'cost_optimization',
    weight: 1,
    patterns: /\b(cheap|cheapest|cost|costs|affordable|savings?|spend less|tiet kiem|re nhat|chi phi thap)\b/,
  },
  {
    id: 'education',
    weight: 1,
    patterns: /\b(schools?|students?|education|classrooms?|teachers?|truong hoc|hoc sinh|giao duc|truong)\b/,
  },
  {
    id: 'parking',
    weight: 1,
    patterns: /\b(parking|garages?|bai do xe|cho do xe|do xe)\b/,
  },
  {
    id: 'energy',
    weight: 1,
    patterns: /\b(energy|power|electricity|grid|blackout|dien|nang luong|luoi dien)\b/,
  },
  {
    id: 'water',
    weight: 1,
    patterns: /\b(water|sewage|wastewater|treatment|nuoc|cap nuoc|thoat nuoc)\b/,
  },
  {
    id: 'balanced_optimization',
    weight: 0.6,
    patterns:
      /\b(balance|balanced|overall|everything|whole city|optimi[sz]e|improve|better|fix the city|xu ly|toi uu|cai thien|tot hon|giup toi|tong the)\b/,
  },
]

/* ------------------------------------------------------------------ */
/* explicit build requests                                             */
/* ------------------------------------------------------------------ */

export const BUILD_LEX: LexEntry<InfraKind>[] = [
  { id: 'school', weight: 1, patterns: /\b(schools?|truong hoc|truong)\b/ },
  { id: 'hospital', weight: 1, patterns: /\b(hospitals?|clinic|benh vien|tram y te)\b/ },
  { id: 'transit_hub', weight: 1, patterns: /\b(transit hubs?|interchange|metro station|bus station|ben xe|nha ga|tram trung chuyen|giao thong cong cong)\b/ },
  { id: 'residential_tower', weight: 1, patterns: /\b(residential towers?|apartment|apartments|housing block|chung cu|toa nha o|nha o)\b/ },
  { id: 'parking_garage', weight: 1, patterns: /\b(parking (garage|structure|lot)s?|car park|bai do xe|nha xe)\b/ },
  { id: 'park', weight: 1, patterns: /\b(parks?|green space|playground|cong vien|khong gian xanh)\b/ },
  { id: 'shopping_district', weight: 1, patterns: /\b(shopping (centre|center|district|mall)s?|mall|retail centre|trung tam thuong mai|sieu thi)\b/ },
  { id: 'office', weight: 1, patterns: /\b(office (building|tower)s?|offices|van phong|toa van phong)\b/ },
  { id: 'solar_farm', weight: 1, patterns: /\b(solar (farm|panels?|plant)s?|dien mat troi|nang luong mat troi)\b/ },
  { id: 'power_plant', weight: 1, patterns: /\b(power (plant|station)s?|nha may dien)\b/ },
  { id: 'water_facility', weight: 1, patterns: /\b(water (facility|plant|treatment)s?|nha may nuoc|xu ly nuoc)\b/ },
  { id: 'bus_route', weight: 1, patterns: /\b(bus routes?|brt|bus lanes?|tuyen buyt|xe buyt)\b/ },
  { id: 'road_widening', weight: 1, patterns: /\b(widen|widening|more lanes|road expansion|expand (?:the )?roads?|roads?|mo rong duong|lam duong|duong xa)\b/ },
  { id: 'highway_link', weight: 1, patterns: /\b(highways?|expressway|flyover|overpass|duong cao toc|cau vuot)\b/ },
]

/** verbs that mean "construct this thing", as opposed to "improve this system" */
export const BUILD_VERB =
  /\b(build|construct|add|place|put|erect|install|create|xay|xay dung|them|lap dat|dung|tao)\b/

/* ------------------------------------------------------------------ */
/* locations                                                           */
/* ------------------------------------------------------------------ */

export const LOCATION_LEX: { id: DistrictId; label: string; patterns: RegExp }[] = [
  { id: 'central', label: 'Downtown', patterns: /\b(downtown|city cent(re|er)|central|core|cbd|trung tam|noi thanh)\b/ },
  { id: 'north', label: 'North Quarter', patterns: /\b(north|northern|(?:phia|huong|khu) bac)\b/ },
  { id: 'south', label: 'South Gate', patterns: /\b(south|southern|(?:phia|huong|khu) nam)\b/ },
  { id: 'east', label: 'East Ridge', patterns: /\b(east|eastern|(?:phia|huong|khu) dong)\b/ },
  { id: 'west', label: 'West Harbour', patterns: /\b(west|western|(?:phia|huong|khu) tay)\b/ },
]

/** zone words that describe a kind of area rather than a compass direction */
export const ZONE_LEX: { zone: 'residential' | 'commercial' | 'industrial'; patterns: RegExp }[] = [
  { zone: 'residential', patterns: /\b(residential (district|area|zone|neighbou?rhood)|housing (area|district)|khu dan cu|khu o)\b/ },
  { zone: 'commercial', patterns: /\b(commercial (district|area|zone)|business district|khu thuong mai)\b/ },
  { zone: 'industrial', patterns: /\b(industrial (district|area|zone)|khu cong nghiep)\b/ },
]

/* ------------------------------------------------------------------ */
/* constraints                                                         */
/* ------------------------------------------------------------------ */

/** metric words, for constraint phrases like "keep traffic below 50%" */
export const METRIC_LEX: { id: MetricKey; patterns: RegExp }[] = [
  { id: 'traffic', patterns: /\b(traffic|congestion|giao thong|un tac)\b/ },
  { id: 'economy', patterns: /\b(economy|economic|business|jobs?|kinh te)\b/ },
  { id: 'emissions', patterns: /\b(co2|carbon|emissions?|khi thai)\b/ },
  { id: 'education', patterns: /\b(schools?|education|truong hoc|giao duc)\b/ },
  { id: 'parking', patterns: /\b(parking|do xe)\b/ },
  { id: 'electricity', patterns: /\b(energy|power|electricity|dien)\b/ },
  { id: 'water', patterns: /\b(water|nuoc)\b/ },
  { id: 'livability', patterns: /\b(quality of life|livability|chat luong song)\b/ },
  { id: 'cost', patterns: /\b(cost|opex|operating cost|chi phi)\b/ },
]

/* ------------------------------------------------------------------ */
/* questions                                                           */
/* ------------------------------------------------------------------ */

export const QUESTION_LEX: LexEntry<QuestionKind>[] = [
  { id: 'what_to_build', weight: 1.2, patterns: /\b(what should (i|we) (build|do)|what (would )?you recommend|give me (your )?(a )?recommendation|what next|where should (i|we) (build|start)|nen xay gi|goi y|khuyen nghi)\b/ },
  { id: 'what_built', weight: 1, patterns: /\b(what (did|have) you (build|built|done)|what was built|da xay gi|xay nhung gi)\b/ },
  { id: 'budget_left', weight: 1, patterns: /\b(how much (budget|money)|budget (left|remaining)|remaining budget|con bao nhieu tien|ngan sach con)\b/ },
  { id: 'capacity', weight: 1, patterns: /\b(how many (people|residents) can|population capacity|how much can the city (support|hold)|suc chua|chua duoc bao nhieu)\b/ },
  { id: 'biggest_problem', weight: 1, patterns: /\b(biggest (problem|issue|bottleneck)|what.{0,12}wrong|main problem|worst|van de lon nhat|te nhat)\b/ },
  { id: 'why_plan', weight: 1, patterns: /\b(why (did you|you) (choose|pick|select)|why (this|that) plan|tai sao (chon|lai chon))\b/ },
  { id: 'city_status', weight: 1, patterns: /\b(how is the city|city status|how are we doing|status report|overview|tinh hinh|thanh pho the nao)\b/ },
  { id: 'metric_detail', weight: 0.7, patterns: /\b(why is|how high is|what is the|how bad is|bao nhieu|the nao)\b/ },
]

/** a leading question word makes "what should I build" a question, not an order */
export const QUESTION_CUE =
  /^\s*(what|why|how|which|when|where|is|are|do|does|can|could|should|tai sao|the nao|bao nhieu|co bao nhieu|lam sao)\b|\?\s*$/i

/* ------------------------------------------------------------------ */
/* follow-ups                                                          */
/* ------------------------------------------------------------------ */

/** phrases that only make sense against a previous request */
export const FOLLOWUP_CUE =
  /\b(too expensive|cheaper|instead|rather|what if|make it|keep it|lower|reduce that|same but|now |also |and also|dat qua|thay vi|re hon|van vay|thay vao do)\b/

export const CHEAPER_CUE = /\b(too expensive|cheaper|less money|lower budget|dat qua|re hon|giam chi phi)\b/
