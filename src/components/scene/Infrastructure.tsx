import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCityStore } from '../../store/useCityStore'
import { useOptimizerStore } from '../../store/useOptimizerStore'
import { clock, daylight } from '../../lib/clock'
import { execClock } from '../../execution/executionClock'
import type { RoadSegment } from '../../simulation/types'
import { useCityView } from './CityViewContext'

const dummy = new THREE.Object3D()
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
const MAX_BLUEPRINT = 96

/**
 * Everything the AI builds that is not a building: elevated expressways with
 * their piers, bus rapid transit routes, and a glow on widened corridors.
 * All instanced — three extra draw calls regardless of how much gets built.
 */
export function Infrastructure() {
  const { city, config } = useCityView()
  const constructions = useOptimizerStore((s) => s.constructions)

  const elevated = useMemo(() => city.roads.filter((r) => r.elevated), [city.roads])
  const widened = useMemo(() => city.roads.filter((r) => r.upgraded), [city.roads])
  const routes = useMemo(() => {
    const byId = new Map(city.roads.map((r) => [r.id, r]))
    return (city.busRoutes ?? []).map((route) => ({
      route,
      segments: route.roadIds.map((id) => byId.get(id)).filter((r): r is RoadSegment => !!r),
    }))
  }, [city])

  const deckRef = useRef<THREE.InstancedMesh>(null)
  const pierRef = useRef<THREE.InstancedMesh>(null)
  const brtRef = useRef<THREE.InstancedMesh>(null)
  const widenRef = useRef<THREE.InstancedMesh>(null)

  const PIERS_PER_SPAN = 3
  const DECK_Y = 7.4
  const blueprintRef = useRef<THREE.InstancedMesh>(null)

  /**
   * Roads are laid rather than switched on:
   *   blueprint line → surface expands from the centre → markings and lights.
   * `raw` is the un-eased timeline so the blueprint phase can be read off it.
   */
  const stageOf = (id: string) => {
    const job = constructions[id]
    if (!job || !execClock.running) return { raw: 1, surface: 1, blueprint: 0 }
    const raw = (execClock.elapsed - job.start) / job.duration
    if (raw <= 0) return { raw: 0, surface: 0, blueprint: raw > -0.4 ? 1 : 0 }
    if (raw >= 1) return { raw: 1, surface: 1, blueprint: 0 }
    const BP = 0.26
    if (raw < BP) return { raw, surface: 0, blueprint: 1 }
    const p = (raw - BP) / (1 - BP)
    return { raw, surface: easeOutCubic(p), blueprint: Math.max(0, 1 - p * 2.4) }
  }
  const progressOf = (id: string) => stageOf(id).surface

  useFrame((state) => {
    const night = 1 - daylight(clock.hour)
    const t = state.clock.elapsedTime
    let blueprintIndex = 0
    const bp = blueprintRef.current

    /* ---- elevated expressway decks + piers ---- */
    const deck = deckRef.current
    const pier = pierRef.current
    if (deck && pier) {
      elevated.forEach((r, i) => {
        const st = stageOf(r.id)
        const p = st.surface
        if (bp && st.blueprint > 0.01 && blueprintIndex < MAX_BLUEPRINT) {
          const full = r.axis === 'x' ? Math.abs(r.x2 - r.x1) : Math.abs(r.z2 - r.z1)
          dummy.position.set((r.x1 + r.x2) / 2, DECK_Y, (r.z1 + r.z2) / 2)
          dummy.rotation.set(0, r.axis === 'x' ? 0 : Math.PI / 2, 0)
          dummy.scale.set(full, 0.9, config.roadWidth * 0.84)
          dummy.updateMatrix()
          bp.setMatrixAt(blueprintIndex++, dummy.matrix)
        }
        const len = (r.axis === 'x' ? Math.abs(r.x2 - r.x1) : Math.abs(r.z2 - r.z1)) * p
        const w = config.roadWidth * 0.82
        const cx = (r.x1 + r.x2) / 2
        const cz = (r.z1 + r.z2) / 2
        // the deck extrudes out from the span centre as it is built
        dummy.position.set(cx, DECK_Y, cz)
        dummy.rotation.set(0, r.axis === 'x' ? 0 : Math.PI / 2, 0)
        dummy.scale.set(Math.max(0.01, len), 0.8, w)
        dummy.updateMatrix()
        deck.setMatrixAt(i, dummy.matrix)

        for (let k = 0; k < PIERS_PER_SPAN; k++) {
          const f = (k + 0.5) / PIERS_PER_SPAN
          const px = r.x1 + (r.x2 - r.x1) * f
          const pz = r.z1 + (r.z2 - r.z1) * f
          const show = p > f * 0.9 ? 1 : 0
          dummy.position.set(px, (DECK_Y / 2) * show, pz)
          dummy.rotation.set(0, 0, 0)
          dummy.scale.set(1, Math.max(0.01, DECK_Y * show), 1)
          dummy.updateMatrix()
          pier.setMatrixAt(i * PIERS_PER_SPAN + k, dummy.matrix)
        }
      })
      deck.instanceMatrix.needsUpdate = true
      pier.instanceMatrix.needsUpdate = true
      deck.count = elevated.length
      pier.count = elevated.length * PIERS_PER_SPAN
      ;(deck.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.06 + night * 0.2
    }

    /* ---- bus rapid transit ---- */
    const brt = brtRef.current
    if (brt) {
      let n = 0
      for (const { route, segments } of routes) {
        const st = stageOf(route.id)
        const p = st.surface
        if (bp && st.blueprint > 0.01) {
          // the whole corridor is surveyed before any of it is laid
          for (const r of segments) {
            if (blueprintIndex >= MAX_BLUEPRINT) break
            const len = r.axis === 'x' ? Math.abs(r.x2 - r.x1) : Math.abs(r.z2 - r.z1)
            dummy.position.set((r.x1 + r.x2) / 2, 0.5, (r.z1 + r.z2) / 2)
            dummy.rotation.set(0, r.axis === 'x' ? 0 : Math.PI / 2, 0)
            dummy.scale.set(len, 0.5, 2.4)
            dummy.updateMatrix()
            bp.setMatrixAt(blueprintIndex++, dummy.matrix)
          }
        }
        const shown = Math.ceil(segments.length * p)
        segments.forEach((r, i) => {
          if (i >= shown) return
          const len = r.axis === 'x' ? Math.abs(r.x2 - r.x1) : Math.abs(r.z2 - r.z1)
          dummy.position.set((r.x1 + r.x2) / 2, 0.34, (r.z1 + r.z2) / 2)
          dummy.rotation.set(-Math.PI / 2, 0, r.axis === 'x' ? 0 : Math.PI / 2)
          dummy.scale.set(len * 0.96, 2.1, 1)
          dummy.updateMatrix()
          brt.setMatrixAt(n++, dummy.matrix)
        })
      }
      brt.count = n
      brt.instanceMatrix.needsUpdate = true
      const m = brt.material as THREE.MeshBasicMaterial
      m.opacity = 0.26 + Math.sin(t * 2.2) * 0.1
    }

    /* ---- widened corridors ---- */
    const wide = widenRef.current
    if (wide) {
      widened.forEach((r, i) => {
        const st = stageOf(r.id)
        const p = st.surface
        if (bp && st.blueprint > 0.01 && blueprintIndex < MAX_BLUEPRINT) {
          const full = r.axis === 'x' ? Math.abs(r.x2 - r.x1) : Math.abs(r.z2 - r.z1)
          dummy.position.set((r.x1 + r.x2) / 2, 0.45, (r.z1 + r.z2) / 2)
          dummy.rotation.set(0, r.axis === 'x' ? 0 : Math.PI / 2, 0)
          dummy.scale.set(full, 0.5, config.roadWidth * 1.1)
          dummy.updateMatrix()
          bp.setMatrixAt(blueprintIndex++, dummy.matrix)
        }
        const len = (r.axis === 'x' ? Math.abs(r.x2 - r.x1) : Math.abs(r.z2 - r.z1)) * p
        dummy.position.set((r.x1 + r.x2) / 2, 0.2, (r.z1 + r.z2) / 2)
        dummy.rotation.set(-Math.PI / 2, 0, r.axis === 'x' ? 0 : Math.PI / 2)
        dummy.scale.set(Math.max(0.01, len * 0.98), config.roadWidth * 1.12, 1)
        dummy.updateMatrix()
        wide.setMatrixAt(i, dummy.matrix)
      })
      wide.count = widened.length
      wide.instanceMatrix.needsUpdate = true
      ;(wide.material as THREE.MeshBasicMaterial).opacity = 0.09 + Math.sin(t * 1.6) * 0.035
    }

    /* ---- survey blueprints ---- */
    if (bp) {
      for (let k = blueprintIndex; k < MAX_BLUEPRINT; k++) {
        dummy.position.set(0, -90, 0)
        dummy.scale.setScalar(0.0001)
        dummy.updateMatrix()
        bp.setMatrixAt(k, dummy.matrix)
      }
      bp.instanceMatrix.needsUpdate = true
      bp.visible = blueprintIndex > 0
      ;(bp.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 7) * 0.16
    }
  })

  return (
    <group>
      <instancedMesh
        key={`deck-${elevated.length}`}
        ref={deckRef}
        args={[undefined as never, undefined as never, Math.max(1, elevated.length)]}
        raycast={() => null}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#141d2c"
          roughness={0.55}
          metalness={0.45}
          emissive="#38f0ff"
          emissiveIntensity={0.08}
        />
      </instancedMesh>

      <instancedMesh
        key={`pier-${elevated.length}`}
        ref={pierRef}
        args={[undefined as never, undefined as never, Math.max(1, elevated.length * 3)]}
        raycast={() => null}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.62, 0.78, 1, 6]} />
        <meshStandardMaterial color="#141d2e" roughness={0.8} metalness={0.2} />
      </instancedMesh>

      <instancedMesh
        key={`brt-${routes.length}`}
        ref={brtRef}
        args={[undefined as never, undefined as never, 256]}
        raycast={() => null}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#2dd4bf"
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        ref={blueprintRef}
        args={[undefined as never, undefined as never, MAX_BLUEPRINT]}
        raycast={() => null}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color="#5ef0ff"
          wireframe
          transparent
          opacity={0.35}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        key={`widen-${widened.length}`}
        ref={widenRef}
        args={[undefined as never, undefined as never, Math.max(1, widened.length)]}
        raycast={() => null}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  )
}
