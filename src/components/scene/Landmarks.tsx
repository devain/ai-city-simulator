import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCityStore } from '../../store/useCityStore'
import { useOptimizerStore } from '../../store/useOptimizerStore'
import { execClock } from '../../execution/executionClock'
import { buildStage, jobProgress } from '../../execution/buildingStages'
import { clock, daylight } from '../../lib/clock'
import type { Building } from '../../simulation/types'
import { useCityView } from './CityViewContext'

/**
 * Makes the civic buildings actually readable as what they are.
 *
 * Schools get a pitched roof, an entrance canopy, a playground and a sign;
 * transit hubs get a platform, a canopy on pillars and a lit pylon. Everything
 * is instanced per part, so the whole set costs six draw calls no matter how
 * many the AI builds — and each detail only appears at the right point in the
 * construction sequence (roof when the frame tops out, sign and lights last).
 */
const dummy = new THREE.Object3D()

interface Detail {
  b: Building
  /** 0..1 how complete the structure is */
  done: number
  /** 0..1 detail-stage reveal */
  detail: number
}

export function Landmarks() {
  const { city } = useCityView()
  const constructions = useOptimizerStore((s) => s.constructions)

  const schools = useMemo(() => city.buildings.filter((b) => b.type === 'school'), [city])
  const hubs = useMemo(() => city.buildings.filter((b) => b.type === 'transit_hub'), [city])

  const roofRef = useRef<THREE.InstancedMesh>(null)
  const canopyRef = useRef<THREE.InstancedMesh>(null)
  const playRef = useRef<THREE.InstancedMesh>(null)
  const signRef = useRef<THREE.InstancedMesh>(null)
  const platformRef = useRef<THREE.InstancedMesh>(null)
  const shelterRef = useRef<THREE.InstancedMesh>(null)
  const pylonRef = useRef<THREE.InstancedMesh>(null)

  const stateOf = (b: Building): Detail => {
    if (!execClock.running) return { b, done: 1, detail: 1 }
    const t = jobProgress(constructions[b.id], execClock.elapsed)
    if (t === null) return { b, done: 1, detail: 1 }
    if (t >= 1) return { b, done: 1, detail: 1 }
    const stage = buildStage(Math.max(0, t), b.h)
    return {
      b,
      done: stage.height,
      // details arrive once the frame is up: roof, then canopy, then signage
      detail: Math.max(0, Math.min(1, (stage.t - 0.72) / 0.24)),
    }
  }

  useFrame(() => {
    const night = 1 - daylight(clock.hour)

    /* ---------------- schools ---------------- */
    const roof = roofRef.current
    const canopy = canopyRef.current
    const play = playRef.current
    const sign = signRef.current

    if (roof && canopy && play && sign) {
      schools.forEach((b, i) => {
        const st = stateOf(b)
        const topped = st.done > 0.985 ? 1 : 0
        const top = b.h * st.done

        // pitched roof — a 4-sided pyramid sitting on the frame
        dummy.position.set(b.x, top + (topped ? 1.05 : 0), b.z)
        dummy.rotation.set(0, Math.PI / 4, 0)
        dummy.scale.set(
          topped ? b.w * 0.78 : 0.0001,
          topped ? 2.1 * st.detail : 0.0001,
          topped ? b.d * 0.78 : 0.0001,
        )
        dummy.updateMatrix()
        roof.setMatrixAt(i, dummy.matrix)

        // entrance canopy on the long side
        const cw = Math.min(4.6, b.w * 0.42)
        dummy.position.set(b.x, 1.5, b.z + b.d / 2 + 0.9)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(cw * st.detail, 0.34, 1.9 * st.detail)
        dummy.updateMatrix()
        canopy.setMatrixAt(i, dummy.matrix)

        // playground pad alongside
        dummy.position.set(b.x - b.w / 2 - 3.1, 0.14, b.z)
        dummy.rotation.set(-Math.PI / 2, 0, 0)
        dummy.scale.set(5 * st.detail, Math.min(b.d, 8) * st.detail, 1)
        dummy.updateMatrix()
        play.setMatrixAt(i, dummy.matrix)

        // sign pylon by the entrance
        dummy.position.set(b.x + b.w / 2 - 1.2, 2.2 * st.detail, b.z + b.d / 2 + 1.6)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(0.36, 4.4 * st.detail, 1.5 * st.detail)
        dummy.updateMatrix()
        sign.setMatrixAt(i, dummy.matrix)
      })
      roof.count = schools.length
      canopy.count = schools.length
      play.count = schools.length
      sign.count = schools.length
      roof.instanceMatrix.needsUpdate = true
      canopy.instanceMatrix.needsUpdate = true
      play.instanceMatrix.needsUpdate = true
      sign.instanceMatrix.needsUpdate = true
      ;(sign.material as THREE.MeshBasicMaterial).opacity = 0.55 + night * 0.4
    }

    /* ---------------- transit hubs ---------------- */
    const platform = platformRef.current
    const shelter = shelterRef.current
    const pylon = pylonRef.current

    if (platform && shelter && pylon) {
      hubs.forEach((b, i) => {
        const st = stateOf(b)
        const topped = st.done > 0.985 ? 1 : 0

        // boarding platform running along the front
        dummy.position.set(b.x, 0.34, b.z + b.d / 2 + 2.6)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(b.w * 1.1 * Math.min(1, st.done * 1.6), 0.68, 4.4)
        dummy.updateMatrix()
        platform.setMatrixAt(i, dummy.matrix)

        // canopy roof over the platform, once the frame is up
        dummy.position.set(b.x, topped ? 4.6 : 0, b.z + b.d / 2 + 2.6)
        dummy.scale.set(
          topped ? b.w * 1.16 * st.detail : 0.0001,
          topped ? 0.42 : 0.0001,
          topped ? 5.2 * st.detail : 0.0001,
        )
        dummy.updateMatrix()
        shelter.setMatrixAt(i, dummy.matrix)

        // lit pylon with the interchange mark
        dummy.position.set(b.x - b.w / 2 - 1.6, 4.2 * st.detail, b.z + b.d / 2 + 2.2)
        dummy.scale.set(0.5, 8.4 * st.detail, 0.5)
        dummy.updateMatrix()
        pylon.setMatrixAt(i, dummy.matrix)
      })
      platform.count = hubs.length
      shelter.count = hubs.length
      pylon.count = hubs.length
      platform.instanceMatrix.needsUpdate = true
      shelter.instanceMatrix.needsUpdate = true
      pylon.instanceMatrix.needsUpdate = true
      ;(pylon.material as THREE.MeshBasicMaterial).opacity = 0.6 + night * 0.35
    }
  })

  return (
    <group>
      {/* --- school --- */}
      <instancedMesh
        key={`roof-${schools.length}`}
        ref={roofRef}
        args={[undefined as never, undefined as never, Math.max(1, schools.length)]}
        raycast={() => null}
        frustumCulled={false}
        castShadow
      >
        <coneGeometry args={[0.72, 1, 4]} />
        <meshStandardMaterial color="#7a3f42" roughness={0.85} />
      </instancedMesh>

      <instancedMesh
        key={`canopy-${schools.length}`}
        ref={canopyRef}
        args={[undefined as never, undefined as never, Math.max(1, schools.length)]}
        raycast={() => null}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#d7e3f0" roughness={0.7} />
      </instancedMesh>

      <instancedMesh
        key={`play-${schools.length}`}
        ref={playRef}
        args={[undefined as never, undefined as never, Math.max(1, schools.length)]}
        raycast={() => null}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial color="#2f6a4a" roughness={0.95} />
      </instancedMesh>

      <instancedMesh
        key={`sign-${schools.length}`}
        ref={signRef}
        args={[undefined as never, undefined as never, Math.max(1, schools.length)]}
        raycast={() => null}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#7ef0b0" transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>

      {/* --- transit hub --- */}
      <instancedMesh
        key={`platform-${hubs.length}`}
        ref={platformRef}
        args={[undefined as never, undefined as never, Math.max(1, hubs.length)]}
        raycast={() => null}
        frustumCulled={false}
        receiveShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </instancedMesh>

      <instancedMesh
        key={`shelter-${hubs.length}`}
        ref={shelterRef}
        args={[undefined as never, undefined as never, Math.max(1, hubs.length)]}
        raycast={() => null}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#1d3a4a"
          roughness={0.5}
          metalness={0.5}
          emissive="#22d3ee"
          emissiveIntensity={0.18}
        />
      </instancedMesh>

      <instancedMesh
        key={`pylon-${hubs.length}`}
        ref={pylonRef}
        args={[undefined as never, undefined as never, Math.max(1, hubs.length)]}
        raycast={() => null}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#2dd4bf" transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
