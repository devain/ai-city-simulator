import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCityStore } from '../../store/useCityStore'
import { mulberry32 } from '../../city/generateCity'
import { clock, daylight } from '../../lib/clock'
import { useCityView } from './CityViewContext'

const dummy = new THREE.Object3D()

/** Trees, street lighting and signal heads — all instanced, three draw calls. */
export function Props() {
  const { city, config } = useCityView()

  const { trees, lamps, signals } = useMemo(() => {
    const rnd = mulberry32(config.seed ^ 0x5f3a)
    const trees: { x: number; z: number; s: number }[] = []
    const lamps: { x: number; z: number }[] = []
    const signals: { x: number; z: number }[] = []

    for (const b of city.buildings) {
      if (b.type !== 'park') continue
      const half = b.w / 2 - 1.4
      for (let i = 0; i < 26; i++) {
        trees.push({
          x: b.x + (rnd() * 2 - 1) * half,
          z: b.z + (rnd() * 2 - 1) * half,
          s: 0.75 + rnd() * 0.8,
        })
      }
    }

    const edge = config.roadWidth / 2 + 1.1
    for (const r of city.roads) {
      const len = r.axis === 'x' ? Math.abs(r.x2 - r.x1) : Math.abs(r.z2 - r.z1)
      const steps = Math.max(2, Math.round(len / 9))
      for (let i = 1; i < steps; i++) {
        const t = i / steps
        const x = r.x1 + (r.x2 - r.x1) * t
        const z = r.z1 + (r.z2 - r.z1) * t
        const ox = r.axis === 'x' ? 0 : edge
        const oz = r.axis === 'x' ? edge : 0
        const side = i % 2 === 0 ? 1 : -1
        if (r.arterial) lamps.push({ x: x + ox * side, z: z + oz * side })
        else if (rnd() < 0.45)
          trees.push({ x: x + ox * side, z: z + oz * side, s: 0.6 + rnd() * 0.45 })
      }
    }

    for (const it of city.intersections) {
      if (!it.signalised) continue
      const o = config.roadWidth / 2 + 0.9
      signals.push({ x: it.x + o, z: it.z + o })
      signals.push({ x: it.x - o, z: it.z - o })
    }

    return { trees, lamps, signals }
  }, [city, config])

  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const leafRef = useRef<THREE.InstancedMesh>(null)
  const poleRef = useRef<THREE.InstancedMesh>(null)
  const bulbRef = useRef<THREE.InstancedMesh>(null)
  const sigRef = useRef<THREE.InstancedMesh>(null)

  // matrices are static: written once, and again whenever the city changes
  const written = useRef(false)
  useEffect(() => {
    written.current = false
  }, [trees, lamps, signals])
  useFrame((state) => {
    if (!written.current) {
      const trunk = trunkRef.current
      const leaf = leafRef.current
      const pole = poleRef.current
      const bulb = bulbRef.current
      const sig = sigRef.current
      if (trunk && leaf) {
        trees.forEach((t, i) => {
          dummy.position.set(t.x, 0.7 * t.s, t.z)
          dummy.scale.set(t.s, t.s, t.s)
          dummy.rotation.set(0, i * 0.7, 0)
          dummy.updateMatrix()
          trunk.setMatrixAt(i, dummy.matrix)
          dummy.position.set(t.x, 1.9 * t.s, t.z)
          dummy.updateMatrix()
          leaf.setMatrixAt(i, dummy.matrix)
        })
        trunk.instanceMatrix.needsUpdate = true
        leaf.instanceMatrix.needsUpdate = true
      }
      if (pole && bulb) {
        lamps.forEach((l, i) => {
          dummy.position.set(l.x, 2.1, l.z)
          dummy.scale.set(1, 1, 1)
          dummy.rotation.set(0, 0, 0)
          dummy.updateMatrix()
          pole.setMatrixAt(i, dummy.matrix)
          dummy.position.set(l.x, 4.3, l.z)
          dummy.updateMatrix()
          bulb.setMatrixAt(i, dummy.matrix)
        })
        pole.instanceMatrix.needsUpdate = true
        bulb.instanceMatrix.needsUpdate = true
      }
      if (sig) {
        signals.forEach((s, i) => {
          dummy.position.set(s.x, 2.4, s.z)
          dummy.scale.set(1, 1, 1)
          dummy.rotation.set(0, 0, 0)
          dummy.updateMatrix()
          sig.setMatrixAt(i, dummy.matrix)
        })
        sig.instanceMatrix.needsUpdate = true
      }
      written.current = true
    }

    const night = 1 - daylight(clock.hour)
    if (bulbRef.current) {
      const m = bulbRef.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.08 + night * 0.85
    }
    if (sigRef.current) {
      const m = sigRef.current.material as THREE.MeshBasicMaterial
      const phase = Math.floor(state.clock.elapsedTime / 4) % 2
      m.color.set(phase === 0 ? '#4ade80' : '#f87171')
      m.opacity = 0.55 + night * 0.4
    }
  })

  return (
    <group>
      <instancedMesh
        key={`trunk-${trees.length}`}
        ref={trunkRef}
        args={[undefined as never, undefined as never, Math.max(1, trees.length)]}
        raycast={() => null}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.16, 0.22, 1.4, 5]} />
        <meshStandardMaterial color="#3d3227" roughness={0.95} />
      </instancedMesh>

      <instancedMesh
        key={`leaf-${trees.length}`}
        ref={leafRef}
        args={[undefined as never, undefined as never, Math.max(1, trees.length)]}
        raycast={() => null}
        frustumCulled={false}
        castShadow
      >
        <icosahedronGeometry args={[1.25, 0]} />
        <meshStandardMaterial color="#1f6b45" roughness={0.85} flatShading />
      </instancedMesh>

      <instancedMesh
        key={`pole-${lamps.length}`}
        ref={poleRef}
        args={[undefined as never, undefined as never, Math.max(1, lamps.length)]}
        raycast={() => null}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.09, 0.12, 4.2, 5]} />
        <meshStandardMaterial color="#2a3442" roughness={0.5} metalness={0.6} />
      </instancedMesh>

      <instancedMesh
        key={`bulb-${lamps.length}`}
        ref={bulbRef}
        args={[undefined as never, undefined as never, Math.max(1, lamps.length)]}
        raycast={() => null}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.42, 8, 8]} />
        <meshBasicMaterial
          color="#ffe0a3"
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        key={`sig-${signals.length}`}
        ref={sigRef}
        args={[undefined as never, undefined as never, Math.max(1, signals.length)]}
        raycast={() => null}
        frustumCulled={false}
      >
        <boxGeometry args={[0.34, 0.9, 0.34]} />
        <meshBasicMaterial color="#4ade80" transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
