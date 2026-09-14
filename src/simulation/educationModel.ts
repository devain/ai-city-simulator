import type { CityConfig } from './config'
import type { CityInventory } from './populationModel'

export interface EducationResult {
  children: number
  students: number
  seats: number
  utilisation: number
  seatsShort: number
  seatsShortAtTarget: number
  classroomsShort: number
  schoolsNeeded: number
  formula: string
}

/**
 * schoolDemand = population x childrenRate x enrollmentRate
 * capacity     = SUM(school seats)
 */
export function runEducationModel(
  population: number,
  config: CityConfig,
  inv: CityInventory,
): EducationResult {
  const children = population * config.childrenRate
  const students = children * config.schoolEnrollmentRate
  const seats = inv.schoolSeats || inv.schools * config.schoolCapacity
  const seatsShort = Math.max(0, students - seats)
  // seats required to bring utilisation back under the planning target
  const seatsShortAtTarget = Math.max(0, students / config.schoolTargetUtilisation - seats)

  return {
    children,
    students,
    seats,
    utilisation: students / Math.max(1, seats),
    seatsShort,
    seatsShortAtTarget,
    classroomsShort: Math.ceil(seatsShortAtTarget / config.classSize),
    schoolsNeeded: Math.ceil(seatsShortAtTarget / config.schoolCapacity),
    formula: 'students = pop x childrenRate x enrollmentRate; capacity = school seats',
  }
}
