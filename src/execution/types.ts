import type { InfraKind } from '../city/infrastructure'

export type StepStatus = 'QUEUED' | 'BUILDING' | 'COMPLETE'

export type StepType =
  | 'site_analysis'
  | 'resource_allocation'
  | 'structure'
  | 'road'
  | 'route'
  | 'simulate'
  | 'complete'

/** Where the camera should be while a step runs. */
export interface CameraShot {
  /** world point the camera looks at */
  x: number
  z: number
  y?: number
  /** distance from the target */
  distance: number
  /** polar angle from vertical: 0.6 = high overview, 1.2 = low and dramatic */
  polar: number
  /** absolute azimuth; omitted keeps the current heading so moves feel continuous */
  azimuth?: number
  /** keep rotating around the target after arriving */
  orbit?: number
  /** travel time in ms */
  travel: number
}

export interface ConstructionStep {
  id: string
  index: number
  type: StepType
  kind?: InfraKind
  /** the headline the command center shows, e.g. "CONSTRUCTING TRANSIT HUB" */
  label: string
  detail: string
  /** ids of the city objects this step brings online */
  targetIds: string[]
  position: { x: number; z: number } | null
  /** ms, in execution time */
  startAt: number
  duration: number
  status: StepStatus
  progress: number
  camera: CameraShot | null
}

export interface ExecutionQueue {
  planId: string
  planCode: string
  planName: string
  steps: ConstructionStep[]
  totalMs: number
  /** execution-time windows for every object the plan creates */
  constructions: Record<string, { start: number; duration: number }>
  /** the most important new structure — the hero shot orbits this */
  hero: { x: number; z: number } | null
}
