/**
 * Deterministic procedural generator for the miniature city.
 * Same seed -> same city, so scenarios are reproducible.
 */
import type { CityConfig } from '../simulation/config'
import type {
  Building,
  BuildingType,
  City,
  DistrictId,
  Intersection,
  RoadSegment,
} from '../simulation/types'

/* ------------------------------------------------------------------ */
/* deterministic RNG                                                   */
/* ------------------------------------------------------------------ */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ */

type BlockZone =
  | 'downtown'
  | 'residential'
  | 'park'
  | 'school'
  | 'hospital'
  | 'transit'
  | 'industrial'
  | 'vacant'

interface Block {
  ix: number
  iz: number
  x: number
  z: number
  size: number
  district: DistrictId
  ring: number
  zone: BlockZone
}

function districtFor(x: number, z: number, bounds: number): DistrictId {
  const cx = x / bounds
  const cz = z / bounds
  if (Math.max(Math.abs(cx), Math.abs(cz)) < 0.32) return 'central'
  if (Math.abs(cx) > Math.abs(cz)) return cx > 0 ? 'east' : 'west'
  return cz < 0 ? 'north' : 'south'
}

const DISTRICT_PREFIX: Record<DistrictId, string> = {
  central: 'Core',
  north: 'North',
  east: 'Ridge',
  south: 'Gate',
  west: 'Harbour',
}

export function generateCity(config: CityConfig): City {
  const rnd = mulberry32(config.seed)
  const G = config.gridLines
  const pitch = config.blockPitch
  const bounds = ((G - 1) * pitch) / 2
  const gridPositions = Array.from({ length: G }, (_, i) => -bounds + i * pitch)
  const innerSize = pitch - config.roadWidth

  /* ---------------- blocks ---------------- */
  const blocks: Block[] = []
  for (let iz = 0; iz < G - 1; iz++) {
    for (let ix = 0; ix < G - 1; ix++) {
      const x = (gridPositions[ix] + gridPositions[ix + 1]) / 2
      const z = (gridPositions[iz] + gridPositions[iz + 1]) / 2
      const district = districtFor(x, z, bounds)
      const ring = Math.max(Math.abs(x), Math.abs(z)) / bounds
      blocks.push({ ix, iz, x, z, size: innerSize, district, ring, zone: 'residential' })
    }
  }

  // central blocks become downtown
  for (const b of blocks) if (b.district === 'central') b.zone = 'downtown'

  const outer = blocks
    .filter((b) => b.zone === 'residential')
    .sort((a, b) => b.ring - a.ring || a.ix - b.ix || a.iz - b.iz)

  const take = (n: number, pick: (b: Block) => number) =>
    outer
      .filter((b) => b.zone === 'residential')
      .sort((a, b) => pick(b) - pick(a))
      .slice(0, n)

  // industrial corner (far north-west), parks spread out, schools near residents
  take(config.industrialBuildings > 0 ? 1 : 0, (b) => -b.x - b.z * 1.4).forEach(
    (b) => (b.zone = 'industrial'),
  )
  take(config.parks, (b) => b.ring * 2 + rnd()).forEach((b) => (b.zone = 'park'))
  take(config.schools, (b) => 1.4 - Math.abs(b.ring - 0.55) + rnd() * 0.6).forEach(
    (b) => (b.zone = 'school'),
  )
  take(config.hospitals, (b) => 1.2 - Math.abs(b.ring - 0.5) + rnd() * 0.4).forEach(
    (b) => (b.zone = 'hospital'),
  )
  take(config.transitHubs, (b) => 1 - Math.abs(b.ring - 0.5) + (b.x > 0 ? 0.4 : 0)).forEach(
    (b) => (b.zone = 'transit'),
  )
  take(2, (b) => (b.district === 'east' ? 1 : 0) + rnd() * 0.5).forEach((b) => (b.zone = 'vacant'))

  /* ---------------- roads ---------------- */
  const roads: RoadSegment[] = []
  const arterialLine = (i: number) => i === 1 || i === 3 || i === 5
  const mPerKm = config.metresPerUnit / 1000

  for (let line = 0; line < G; line++) {
    for (let seg = 0; seg < G - 1; seg++) {
      const a = gridPositions[seg]
      const b = gridPositions[seg + 1]
      const cross = gridPositions[line]
      const arterial = arterialLine(line)
      const lanes = arterial ? 4 : 2

      // horizontal road (runs along X at z = cross)
      {
        const mx = (a + b) / 2
        const district = districtFor(mx, cross, bounds)
        roads.push({
          id: `rx-${line}-${seg}`,
          axis: 'x',
          x1: a,
          z1: cross,
          x2: b,
          z2: cross,
          lanes,
          arterial,
          district,
          loadWeight: loadWeight(mx, cross, bounds, arterial),
          lengthKm: Math.abs(b - a) * mPerKm,
          name: `${DISTRICT_PREFIX[district]} ${arterial ? 'Arterial' : 'Street'} ${line + 1}-${seg + 1}`,
        })
      }
      // vertical road (runs along Z at x = cross)
      {
        const mz = (a + b) / 2
        const district = districtFor(cross, mz, bounds)
        roads.push({
          id: `rz-${line}-${seg}`,
          axis: 'z',
          x1: cross,
          z1: a,
          x2: cross,
          z2: b,
          lanes,
          arterial,
          district,
          loadWeight: loadWeight(cross, mz, bounds, arterial),
          lengthKm: Math.abs(b - a) * mPerKm,
          name: `${DISTRICT_PREFIX[district]} ${arterial ? 'Avenue' : 'Lane'} ${line + 1}-${seg + 1}`,
        })
      }
    }
  }

  const intersections: Intersection[] = []
  for (let i = 0; i < G; i++) {
    for (let j = 0; j < G; j++) {
      const x = gridPositions[i]
      const z = gridPositions[j]
      intersections.push({
        id: `ix-${i}-${j}`,
        x,
        z,
        signalised: arterialLine(i) || arterialLine(j),
        district: districtFor(x, z, bounds),
      })
    }
  }

  /* ---------------- buildings ---------------- */
  const buildings: Building[] = []
  const freeSlots: City['freeSlots'] = []
  let counter = 0
  const id = (p: string) => `${p}-${(counter++).toString(36)}`

  const slotPositions = (b: Block) => {
    const o = b.size / 4
    return [
      { x: b.x - o, z: b.z - o },
      { x: b.x + o, z: b.z - o },
      { x: b.x - o, z: b.z + o },
      { x: b.x + o, z: b.z + o },
    ]
  }

  const base = (type: BuildingType, x: number, z: number, district: DistrictId): Building => ({
    id: id(type),
    type,
    x,
    z,
    w: 8,
    d: 8,
    h: 6,
    rotation: 0,
    district,
    capacity: 0,
    jobs: 0,
    retailSqm: 0,
    parkingSpaces: 0,
    studentCapacity: 0,
    beds: 0,
    greenHa: 0,
    variant: Math.floor(rnd() * 1000),
    label: '',
  })

  let residentialMade = 0
  let commercialMade = 0
  let parkingMade = 0
  let industrialMade = 0

  for (const block of blocks) {
    const slots = slotPositions(block)

    if (block.zone === 'park') {
      const b = base('park', block.x, block.z, block.district)
      b.w = block.size
      b.d = block.size
      b.h = 0.6
      const areaHa = ((block.size * config.metresPerUnit) ** 2) / 10_000
      b.greenHa = areaHa
      b.label = `${DISTRICT_PREFIX[block.district]} Park`
      buildings.push(b)
      continue
    }

    if (block.zone === 'school') {
      const b = base('school', block.x, block.z, block.district)
      b.w = block.size * 0.72
      b.d = block.size * 0.5
      b.h = 5.5
      b.studentCapacity = config.schoolCapacity
      b.jobs = 55
      b.parkingSpaces = 60
      b.greenHa = ((block.size * config.metresPerUnit) ** 2) / 10_000 * 0.3
      b.label = `${DISTRICT_PREFIX[block.district]} School`
      buildings.push(b)
      continue
    }

    if (block.zone === 'hospital') {
      const b = base('hospital', block.x, block.z, block.district)
      b.w = block.size * 0.66
      b.d = block.size * 0.58
      b.h = 13
      b.beds = 220
      b.jobs = 620
      b.parkingSpaces = 220
      b.label = `${DISTRICT_PREFIX[block.district]} Hospital`
      buildings.push(b)
      continue
    }

    if (block.zone === 'transit') {
      const b = base('transit_hub', block.x, block.z, block.district)
      b.w = block.size * 0.8
      b.d = block.size * 0.46
      b.h = 7
      b.jobs = 140
      b.parkingSpaces = 180
      b.retailSqm = 1800
      b.label = `${DISTRICT_PREFIX[block.district]} Transit Hub`
      buildings.push(b)
      continue
    }

    if (block.zone === 'industrial') {
      for (let i = 0; i < 4; i++) {
        const s = slots[i]
        const b = base('industrial', s.x, s.z, block.district)
        b.w = 8.4
        b.d = 8.4
        b.h = 4.5 + rnd() * 3
        b.jobs = 210
        b.parkingSpaces = 90
        b.label = `Industrial Unit ${i + 1}`
        buildings.push(b)
        industrialMade++
      }
      continue
    }

    if (block.zone === 'vacant') {
      for (const s of slots) freeSlots.push({ x: s.x, z: s.z, district: block.district })
      continue
    }

    if (block.zone === 'downtown') {
      for (const s of slots) {
        if (commercialMade < config.commercialBuildings) {
          const shop = rnd() < 0.35
          const b = base(shop ? 'shop' : 'office', s.x, s.z, block.district)
          b.w = 8.2
          b.d = 8.2
          b.h = shop ? 6 + rnd() * 3 : 16 + rnd() * 20
          b.jobs = shop ? 120 : 820
          b.retailSqm = shop ? 5200 : 900
          b.parkingSpaces = shop ? 160 : 240
          b.label = shop ? `Core Retail ${commercialMade + 1}` : `Core Tower ${commercialMade + 1}`
          buildings.push(b)
          commercialMade++
        } else {
          freeSlots.push({ x: s.x, z: s.z, district: block.district })
        }
      }
      continue
    }

    /* residential block */
    const perBlock = block.ring > 0.7 ? 4 : 3
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      if (i < perBlock && residentialMade < config.residentialBuildings) {
        const suburban = block.ring > 0.7
        const b = base(suburban ? 'house' : 'residential_tower', s.x, s.z, block.district)
        b.w = suburban ? 7.2 : 8
        b.d = suburban ? 7.2 : 8
        b.h = suburban ? 3.2 + rnd() * 1.8 : 11 + rnd() * 16
        b.capacity = suburban ? 90 + rnd() * 60 : 190 + rnd() * 190
        b.parkingSpaces = suburban ? 26 : 54
        b.retailSqm = suburban ? 0 : rnd() < 0.4 ? 900 : 0
        b.jobs = suburban ? 0 : 28
        b.label = suburban
          ? `${DISTRICT_PREFIX[block.district]} Houses ${residentialMade + 1}`
          : `${DISTRICT_PREFIX[block.district]} Tower ${residentialMade + 1}`
        buildings.push(b)
        residentialMade++
      } else if (parkingMade < config.parkingGarages && i === 3 && rnd() < 0.5) {
        const b = base('parking', s.x, s.z, block.district)
        b.w = 8
        b.d = 8
        b.h = 5
        b.parkingSpaces = 935
        b.label = `${DISTRICT_PREFIX[block.district]} Parking ${parkingMade + 1}`
        buildings.push(b)
        parkingMade++
      } else {
        freeSlots.push({ x: s.x, z: s.z, district: block.district })
      }
    }
  }

  // guarantee the configured number of parking garages
  while (parkingMade < config.parkingGarages && freeSlots.length > 0) {
    const s = freeSlots.shift()!
    const b = base('parking', s.x, s.z, s.district)
    b.w = 8
    b.d = 8
    b.h = 5
    b.parkingSpaces = 935
    b.label = `${DISTRICT_PREFIX[s.district]} Parking ${parkingMade + 1}`
    buildings.push(b)
    parkingMade++
  }

  /* ---------------- normalise to the configured targets ---------------- */
  normalise(buildings, 'capacity', config.residentialCapacity)
  normalise(buildings, 'jobs', config.jobs)
  normalise(buildings, 'retailSqm', config.retailFloorAreaSqm)
  normalise(buildings, 'parkingSpaces', config.attachedParkingSpaces)

  for (const b of buildings) {
    if (b.capacity) b.capacity = Math.round(b.capacity)
    if (b.jobs) b.jobs = Math.round(b.jobs)
    if (b.retailSqm) b.retailSqm = Math.round(b.retailSqm)
    if (b.parkingSpaces) b.parkingSpaces = Math.round(b.parkingSpaces)
  }

  /* growth lands in the east first — that keeps the demo narrative honest */
  const order: Record<DistrictId, number> = { east: 0, south: 1, north: 2, west: 3, central: 4 }
  freeSlots.sort((a, b) => order[a.district] - order[b.district])

  // overflow ring, so large scenarios always have somewhere to build
  const ringR = bounds + pitch * 0.75
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const x = Math.cos(a) * ringR
    const z = Math.sin(a) * ringR
    freeSlots.push({ x, z, district: districtFor(x, z, bounds) })
  }

  return { buildings, roads, busRoutes: [], intersections, bounds, gridPositions, freeSlots }
}

function loadWeight(x: number, z: number, bounds: number, arterial: boolean): number {
  const centrality = 1 - Math.min(1, Math.hypot(x, z) / (bounds * 1.35))
  const eastBias = x > 0 ? 0.22 * (x / bounds) : 0
  return 0.55 + centrality * 1.1 + (arterial ? 0.85 : 0) + eastBias
}

function normalise(
  buildings: Building[],
  key: 'capacity' | 'jobs' | 'retailSqm' | 'parkingSpaces',
  target: number,
) {
  const total = buildings.reduce((s, b) => s + b[key], 0)
  if (total <= 0) return
  const k = target / total
  for (const b of buildings) b[key] = b[key] * k
}
