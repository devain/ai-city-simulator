import * as THREE from 'three'
import type { BuildingType, PressureLevel } from '../simulation/types'

export const BUILDING_COLORS: Record<BuildingType, string> = {
  residential_tower: '#46618a',
  house: '#54607a',
  office: '#2c4368',
  shop: '#59477d',
  school: '#2f6a5b',
  hospital: '#6d4356',
  park: '#1d4526',
  parking: '#3a4454',
  transit_hub: '#2a5c7c',
  industrial: '#4a4655',
  power_plant: '#5a4a3a',
  solar_farm: '#1f3d63',
  water_facility: '#245a66',
}

export const BUILDING_LABELS: Record<BuildingType, string> = {
  residential_tower: 'Residential tower',
  house: 'Low-rise housing',
  office: 'Office tower',
  shop: 'Retail',
  school: 'School',
  hospital: 'Hospital',
  park: 'Park',
  parking: 'Parking structure',
  transit_hub: 'Transit hub',
  industrial: 'Industrial',
  power_plant: 'Power plant',
  solar_farm: 'Solar farm',
  water_facility: 'Water treatment',
}

export const PRESSURE_COLORS: Record<PressureLevel, string> = {
  LOW: '#34d399',
  MODERATE: '#38bdf8',
  HIGH: '#fbbf24',
  CRITICAL: '#fb5e6d',
}

export const PRESSURE_TEXT: Record<PressureLevel, string> = {
  LOW: 'text-emerald-300',
  MODERATE: 'text-sky-300',
  HIGH: 'text-amber-300',
  CRITICAL: 'text-rose-400',
}

/** cool -> hot ramp used by every heatmap layer */
const RAMP = ['#0ea5e9', '#22d3ee', '#4ade80', '#facc15', '#fb923c', '#f43f5e'].map(
  (c) => new THREE.Color(c),
)

const tmp = new THREE.Color()

export function heatColor(t: number, target = new THREE.Color()): THREE.Color {
  const x = Math.max(0, Math.min(0.9999, t)) * (RAMP.length - 1)
  const i = Math.floor(x)
  target.copy(RAMP[i]).lerp(RAMP[i + 1] ?? RAMP[i], x - i)
  return target
}

export function heatCss(t: number) {
  return '#' + heatColor(t, tmp).getHexString()
}

export const CAR_COLORS = [
  '#dbe7ff',
  '#93c5fd',
  '#f8fafc',
  '#fca5a5',
  '#fcd34d',
  '#a5b4fc',
  '#5eead4',
  '#cbd5e1',
]
