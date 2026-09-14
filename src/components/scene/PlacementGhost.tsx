import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useSandboxStore } from '../../store/useSandboxStore'
import { CATALOGUE_BY_ID } from '../../sandbox/catalogue'

/**
 * The translucent building that follows the cursor before you commit.
 *
 * Cyan means the plot is free and you can afford it; red means one of those is
 * not true. A footprint ring on the ground makes the parcel legible even when
 * the structure is tall.
 */
export function PlacementGhost() {
  const itemId = useSandboxStore((s) => s.activeItemId)
  const ghost = useSandboxStore((s) => s.ghost)
  const group = useRef<THREE.Group>(null)
  const box = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)

  const item = itemId ? CATALOGUE_BY_ID[itemId] : null
  const visible = !!item && !!ghost

  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.visible = visible
    if (!visible || !ghost || !item) return

    const t = state.clock.elapsedTime
    g.position.set(ghost.x, 0, ghost.z)

    const b = box.current
    if (b) {
      b.scale.set(item.template.w, item.template.h, item.template.d)
      b.position.y = item.template.h / 2
      const mat = b.material as THREE.MeshBasicMaterial
      mat.color.set(ghost.valid ? '#5ef0ff' : '#ff6b8a')
      mat.opacity = 0.2 + Math.sin(t * 3) * 0.05
    }

    const r = ring.current
    if (r) {
      const w = Math.max(item.template.w, item.template.d) * 0.78
      r.scale.setScalar(w)
      const mat = r.material as THREE.MeshBasicMaterial
      mat.color.set(ghost.valid ? '#a6ffea' : '#ff6b8a')
      mat.opacity = 0.5 + Math.sin(t * 4) * 0.18
    }
  })

  return (
    <group ref={group} visible={false}>
      <mesh ref={box} raycast={() => null}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color="#5ef0ff"
          transparent
          opacity={0.22}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* wire outline so the silhouette reads against bright ground */}
      <mesh
        raycast={() => null}
        scale={[
          (item?.template.w ?? 1) * 1.005,
          (item?.template.h ?? 1) * 1.005,
          (item?.template.d ?? 1) * 1.005,
        ]}
        position={[0, (item?.template.h ?? 1) / 2, 0]}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={ghost?.valid === false ? '#ff6b8a' : '#bffcff'}
          wireframe
          transparent
          opacity={0.45}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.26, 0]} raycast={() => null}>
        <ringGeometry args={[0.88, 1, 4]} />
        <meshBasicMaterial
          color="#a6ffea"
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}
