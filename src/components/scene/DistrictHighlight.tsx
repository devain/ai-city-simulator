import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useOptimizerStore } from '../../store/useOptimizerStore'

/**
 * When the AI chooses where to build, it says so on the map before anything
 * happens — a pulsing survey marker over the district it picked, with the
 * reason attached. Disappears as soon as construction starts.
 */
export function DistrictHighlight() {
  const focus = useOptimizerStore((s) => s.focusDistrict)
  const phase = useOptimizerStore((s) => s.phase)
  const group = useRef<THREE.Group>(null)

  const visible = !!focus && (phase === 'review' || phase === 'deciding')

  useFrame((state) => {
    const g = group.current
    if (!g) return
    g.visible = visible
    if (!focus || !visible) return

    const t = state.clock.elapsedTime
    g.position.set(focus.x, 0, focus.z)

    const ring = g.children[0] as THREE.Mesh
    const pulse = (t * 0.45) % 1
    ring.scale.setScalar(14 + pulse * 16)
    ;(ring.material as THREE.MeshBasicMaterial).opacity = (1 - pulse) * 0.7

    const inner = g.children[1] as THREE.Mesh
    inner.rotation.z = -t * 0.5
    ;(inner.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 3) * 0.18

    const beam = g.children[2] as THREE.Mesh
    ;(beam.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(t * 2.2) * 0.05
  })

  return (
    <group ref={group} visible={false}>
      {/* expanding survey pulse */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]} raycast={() => null}>
        <ringGeometry args={[0.92, 1, 64]} />
        <meshBasicMaterial
          color="#5ef0ff"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* fixed target reticle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.34, 0]} raycast={() => null}>
        <ringGeometry args={[11, 12.4, 6]} />
        <meshBasicMaterial
          color="#a6ffea"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* column of light */}
      <mesh position={[0, 22, 0]} raycast={() => null}>
        <cylinderGeometry args={[9, 9, 44, 24, 1, true]} />
        <meshBasicMaterial
          color="#38f0ff"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {focus && visible && (
        <Html position={[0, 30, 0]} center distanceFactor={110} style={{ pointerEvents: 'none' }}>
          <div className="min-w-[150px] select-none rounded-md border border-cyan-300/40 bg-[#040a14]/90 px-2.5 py-1.5 text-center font-mono backdrop-blur-sm">
            <div className="text-[7px] uppercase tracking-[0.22em] text-cyan-300/80">
              AI selected site
            </div>
            <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              {focus.label}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}
