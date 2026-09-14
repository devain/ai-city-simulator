import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCityStore } from '../../store/useCityStore'
import { useSandboxStore } from '../../store/useSandboxStore'
import { makeGroundTexture } from './groundTexture'
import { heatColor } from '../../lib/colors'
import { nearestSlot } from '../../city/placement'
import { TEMPLATES } from '../../city/placement'
import { useCityView } from './CityViewContext'

const dummy = new THREE.Object3D()
const col = new THREE.Color()

export function Ground() {
  const view = useCityView()
  const { city, baseCity, config, current, heatLayer } = view
  const placementTool = useCityStore((s) => s.placementTool)
  const placeAt = useCityStore((s) => s.placeAt)
  const setSelected = useCityStore((s) => s.setSelected)
  // Phase 5 places through the sandbox so the build is costed and simulated
  const sandboxItem = useSandboxStore((s) => s.activeItemId)
  const moveGhost = useSandboxStore((s) => s.moveGhost)

  const tex = useMemo(() => makeGroundTexture(baseCity, config), [baseCity, config])
  useEffect(() => () => tex.dispose(), [tex])

  const extent = (city.bounds + config.blockPitch) * 2
  const ghostRef = useRef<THREE.Mesh>(null)

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onPointerMove={(e) => {
          if (!view.interactive) return
          if (sandboxItem) {
            moveGhost(e.point.x, e.point.z)
            return
          }
          if (!placementTool || !ghostRef.current) return
          const slot = nearestSlot(city, e.point.x, e.point.z)
          if (!slot) return
          const t = TEMPLATES[placementTool]
          ghostRef.current.position.set(slot.x, t.h / 2, slot.z)
          ghostRef.current.scale.set(t.w, t.h, t.d)
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (!view.interactive) return
          if (sandboxItem) moveGhost(e.point.x, e.point.z)
          else if (placementTool) placeAt(e.point.x, e.point.z)
          else setSelected(null)
        }}
      >
        <planeGeometry args={[extent, extent]} />
        <meshStandardMaterial map={tex} roughness={0.95} metalness={0.05} />
      </mesh>

      {/* outer apron so the city never appears to float */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} raycast={() => null}>
        <planeGeometry args={[extent * 4, extent * 4]} />
        <meshStandardMaterial color="#050810" roughness={1} />
      </mesh>

      <RoadHeat />

      {placementTool && (
        <mesh ref={ghostRef} raycast={() => null} position={[0, 5, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#5ef0ff" transparent opacity={0.34} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

/** Congestion ribbons drawn over the street grid for the traffic heat layer. */
function RoadHeat() {
  const { city, config, current, heatLayer } = useCityView()
  const roads = current.roads
  const ref = useRef<THREE.InstancedMesh>(null)

  const active = heatLayer === 'traffic'

  const eased = useRef<number[]>([])

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    city.roads.forEach((r, i) => {
      const len = r.axis === 'x' ? Math.abs(r.x2 - r.x1) : Math.abs(r.z2 - r.z1)
      const w = config.roadWidth * (r.arterial ? 0.92 : 0.72)
      dummy.position.set((r.x1 + r.x2) / 2, 0.12, (r.z1 + r.z2) / 2)
      dummy.rotation.set(-Math.PI / 2, 0, r.axis === 'x' ? 0 : Math.PI / 2)
      dummy.scale.set(len * 0.98, w, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [city, config])

  useFrame((state, dt) => {
    const mesh = ref.current
    if (!mesh) return
    const m = mesh.material as THREE.MeshBasicMaterial
    const target = active ? 0.62 + Math.sin(state.clock.elapsedTime * 2) * 0.07 : 0
    m.opacity += (target - m.opacity) * 0.12
    mesh.visible = m.opacity > 0.01

    /*
     * Congestion drains rather than snapping — when the AI finishes a corridor
     * you watch the red bleed out of it.
     */
    const byId = new Map(roads.map((r) => [r.id, r]))
    let animating = false
    city.roads.forEach((r, i) => {
      const load = Math.min(1, (byId.get(r.id)?.volumeCapacityRatio ?? 0) / 1.15)
      const cur = eased.current[i] ?? load
      const diff = load - cur
      const next = Math.abs(diff) > 0.002 ? cur + diff * Math.min(1, dt * 1.5) : load
      if (next !== cur) animating = true
      eased.current[i] = next
    })
    if (animating || eased.current.length !== city.roads.length) {
      city.roads.forEach((_, i) => mesh.setColorAt(i, heatColor(eased.current[i] ?? 0, col)))
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh
      key={`roadheat-${city.roads.length}`}
      ref={ref}
      args={[undefined as never, undefined as never, Math.max(1, city.roads.length)]}
      raycast={() => null}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  )
}
