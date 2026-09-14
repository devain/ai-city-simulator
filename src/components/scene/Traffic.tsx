import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCityStore } from '../../store/useCityStore'
import { mulberry32 } from '../../city/generateCity'
import { agentTransform, makeAgents, stepAgent, type GridAgent } from '../../lib/agents'
import { CAR_COLORS } from '../../lib/colors'
import { clock, daylight } from '../../lib/clock'
import { useCityView } from './CityViewContext'

const MAX_CARS = 260
const MAX_PEDS = 190
const dummy = new THREE.Object3D()
const col = new THREE.Color()

export function Traffic() {
  const { city, current, baseline, heatLayer } = useCityView()
  const congestion = useCityStore((s) => s.current.raw.congestionIndex)
  const peakTrips = useCityStore((s) => s.current.raw.peakVehicleTrips)
  const basePeak = useCityStore((s) => s.baseline.raw.peakVehicleTrips)
  const population = useCityStore((s) => s.current.population)
  const basePopulation = useCityStore((s) => s.baseline.population)
  const transitRiders = useCityStore((s) => s.current.raw.transitRidership)
  const baseRiders = useCityStore((s) => s.baseline.raw.transitRidership)

  const carsRef = useRef<THREE.InstancedMesh>(null)
  const lightsRef = useRef<THREE.InstancedMesh>(null)
  const busRef = useRef<THREE.InstancedMesh>(null)
  const pedRef = useRef<THREE.InstancedMesh>(null)

  const rnd = useMemo(() => mulberry32(90210), [])
  const gp = city.gridPositions
  const bounds = city.bounds

  const cars = useMemo<GridAgent[]>(
    () => makeAgents(MAX_CARS, gp, { rnd, speed: [7, 12], lane: 2.1 }),
    [gp, rnd],
  )
  const buses = useMemo<GridAgent[]>(
    () => makeAgents(14, gp, { rnd, speed: [5, 6.6], lane: 4.6, lines: [1, 3, 5] }),
    [gp, rnd],
  )
  const peds = useMemo<GridAgent[]>(
    () => makeAgents(MAX_PEDS, gp, { rnd, speed: [1.1, 2.1], lane: 6.4 }),
    [gp, rnd],
  )

  useEffect(() => {
    const mesh = carsRef.current
    if (!mesh) return
    const r = mulberry32(4242)
    for (let i = 0; i < MAX_CARS; i++) {
      mesh.setColorAt(i, col.set(CAR_COLORS[Math.floor(r() * CAR_COLORS.length)]))
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])

  /*
   * When the AI opens a bus rapid transit corridor, buses actually move onto
   * it: each new route gets a pinned pair running end to end.
   */
  const busRoutes = city.busRoutes ?? []
  useEffect(() => {
    if (busRoutes.length === 0) return
    const span = gp[gp.length - 1] - gp[0]
    let idx = 0
    for (const route of busRoutes) {
      const first = city.roads.find((r) => r.id === route.roadIds[0])
      if (!first) continue
      for (let k = 0; k < 2 && idx < buses.length; k++, idx++) {
        const a = buses[idx]
        a.axis = first.axis === 'x' ? 0 : 1
        a.fixed = first.axis === 'x' ? first.z1 : first.x1
        a.pos = gp[0] + ((k + 0.5) / 2) * span
        a.dir = k % 2 === 0 ? 1 : -1
        a.locked = true
      }
    }
  }, [busRoutes, city.roads, buses, gp])

  const activeBuses = Math.min(
    buses.length,
    Math.round(8 + busRoutes.length * 2 + (transitRiders / Math.max(1, baseRiders) - 1) * 6),
  )

  const activeCars = Math.round(
    Math.min(MAX_CARS, 92 * (peakTrips / Math.max(1, basePeak)) * (1 + congestion * 0.35)),
  )
  const activePeds = Math.round(Math.min(MAX_PEDS, 96 * (population / Math.max(1, basePopulation))))

  useFrame((_, rawDt) => {
    const dt = Math.min(0.05, rawDt)
    const night = 1 - daylight(clock.hour)
    // congested networks move slower — the visual and the model agree
    const flow = 0.35 + 0.65 / (1 + Math.pow(Math.max(0, congestion), 3))
    const dayFactor = 0.45 + 0.55 * daylight(clock.hour)

    const carsMesh = carsRef.current
    const lights = lightsRef.current
    if (carsMesh && lights) {
      for (let i = 0; i < MAX_CARS; i++) {
        const a = cars[i]
        if (i >= activeCars) {
          dummy.position.set(0, -50, 0)
          dummy.scale.setScalar(0.0001)
          dummy.rotation.set(0, 0, 0)
          dummy.updateMatrix()
          carsMesh.setMatrixAt(i, dummy.matrix)
          lights.setMatrixAt(i, dummy.matrix)
          continue
        }
        a.speed = (7 + (a.variant % 60) / 12) * flow
        stepAgent(a, dt, gp, bounds, 0.22, rnd)
        const t = agentTransform(a)
        dummy.position.set(t.x, 0.62, t.z)
        dummy.rotation.set(0, t.rotY, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        carsMesh.setMatrixAt(i, dummy.matrix)

        dummy.position.set(t.x + Math.cos(t.rotY) * 1.25, 0.55, t.z - Math.sin(t.rotY) * 1.25)
        dummy.scale.setScalar(0.55 + night * 0.9)
        dummy.updateMatrix()
        lights.setMatrixAt(i, dummy.matrix)
      }
      carsMesh.instanceMatrix.needsUpdate = true
      lights.instanceMatrix.needsUpdate = true
      ;(lights.material as THREE.MeshBasicMaterial).opacity = 0.18 + night * 0.7
      ;(carsMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.05 + night * 0.45
    }

    const busMesh = busRef.current
    if (busMesh) {
      for (let i = 0; i < buses.length; i++) {
        const a = buses[i]
        if (i >= activeBuses) {
          dummy.position.set(0, -50, 0)
          dummy.scale.setScalar(0.0001)
          dummy.updateMatrix()
          busMesh.setMatrixAt(i, dummy.matrix)
          continue
        }
        // buses on a dedicated corridor are not stuck in the general traffic
        a.speed = (5 + (a.variant % 30) / 20) * (a.locked ? Math.max(0.8, flow) : flow)
        stepAgent(a, dt, gp, bounds, 0.12, rnd)
        const t = agentTransform(a)
        dummy.position.set(t.x, 1.05, t.z)
        dummy.rotation.set(0, t.rotY, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        busMesh.setMatrixAt(i, dummy.matrix)
      }
      busMesh.instanceMatrix.needsUpdate = true
      ;(busMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + night * 0.9
    }

    const pedMesh = pedRef.current
    if (pedMesh) {
      const walkers = Math.round(activePeds * dayFactor)
      for (let i = 0; i < MAX_PEDS; i++) {
        const a = peds[i]
        if (i >= walkers) {
          dummy.position.set(0, -50, 0)
          dummy.scale.setScalar(0.0001)
          dummy.updateMatrix()
          pedMesh.setMatrixAt(i, dummy.matrix)
          continue
        }
        stepAgent(a, dt, gp, bounds, 0.3, rnd)
        const t = agentTransform(a)
        const bob = Math.sin(performance.now() * 0.006 + a.variant) * 0.07
        dummy.position.set(t.x, 0.85 + bob, t.z)
        dummy.rotation.set(0, t.rotY, 0)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        pedMesh.setMatrixAt(i, dummy.matrix)
      }
      pedMesh.instanceMatrix.needsUpdate = true
    }
  })

  const dim = heatLayer !== 'none'

  return (
    <group>
      <instancedMesh
        ref={carsRef}
        args={[undefined as never, undefined as never, MAX_CARS]}
        raycast={() => null}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[2.4, 0.85, 1.15]} />
        <meshStandardMaterial
          roughness={0.35}
          metalness={0.5}
          emissive="#7fe9ff"
          emissiveIntensity={0.2}
          transparent
          opacity={dim ? 0.55 : 1}
        />
      </instancedMesh>

      <instancedMesh
        ref={lightsRef}
        args={[undefined as never, undefined as never, MAX_CARS]}
        raycast={() => null}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.42, 6, 6]} />
        <meshBasicMaterial
          color="#fff3d0"
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={busRef}
        args={[undefined as never, undefined as never, 14]}
        raycast={() => null}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[5.4, 1.9, 1.7]} />
        <meshStandardMaterial
          color="#2dd4bf"
          roughness={0.4}
          metalness={0.35}
          emissive="#14b8a6"
          emissiveIntensity={0.4}
          transparent
          opacity={dim ? 0.6 : 1}
        />
      </instancedMesh>

      <instancedMesh
        ref={pedRef}
        args={[undefined as never, undefined as never, MAX_PEDS]}
        raycast={() => null}
        frustumCulled={false}
      >
        <capsuleGeometry args={[0.3, 0.7, 3, 6]} />
        <meshStandardMaterial
          color="#cfe6ff"
          roughness={0.8}
          emissive="#6ee7ff"
          emissiveIntensity={0.25}
          transparent
          opacity={dim ? 0.4 : 0.92}
        />
      </instancedMesh>
    </group>
  )
}
