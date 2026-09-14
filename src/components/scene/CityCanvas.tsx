import { Suspense, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars, Preload } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Ground } from './Ground'
import { Buildings } from './Buildings'
import { Traffic } from './Traffic'
import { Props } from './Props'
import { SkyCycle } from './SkyCycle'
import { Infrastructure } from './Infrastructure'
import { ConstructionSites } from './ConstructionSites'
import { DistrictHighlight } from './DistrictHighlight'
import { PlacementGhost } from './PlacementGhost'
import { LiveCityView, MatchCityView, type CityView } from './CityViewContext'
import { Landmarks } from './Landmarks'
import { CameraDirector } from './CameraDirector'
import { useCityStore } from '../../store/useCityStore'
import { useOptimizerStore } from '../../store/useOptimizerStore'
import { daylight, useClockHour } from '../../lib/clock'

function SimPulse() {
  const isRunning = useCityStore((s) => s.isRunning)
  const progress = useCityStore((s) => s.runProgress)
  const ref = useRef<THREE.Mesh>(null)

  useFrame(() => {
    const m = ref.current
    if (!m) return
    const show = isRunning ? 1 : 0
    const p = isRunning ? progress : 1
    const s = 8 + p * 190
    m.scale.set(s, s, 1)
    const mat = m.material as THREE.MeshBasicMaterial
    mat.opacity += ((show ? (1 - p) * 0.55 : 0) - mat.opacity) * 0.2
    m.visible = mat.opacity > 0.01
  })

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.4, 0]} raycast={() => null}>
      <ringGeometry args={[0.88, 1, 80]} />
      <meshBasicMaterial
        color="#5ef0ff"
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  )
}

function NightSky() {
  const hour = useClockHour(1500)
  if (daylight(hour) > 0.4) return null
  return <Stars radius={420} depth={80} count={2600} factor={5} saturation={0} fade speed={0.6} />
}

function Rig() {
  const cinematic = useCityStore((s) => s.cinematic)
  const aiDriving = useOptimizerStore((s) => s.cinematic)
  const controls = useRef<OrbitControlsImpl>(null)
  useFrame(() => {
    // the cinematic director owns the camera while the AI is executing
    if (controls.current) controls.current.autoRotate = cinematic && !aiDriving
  })
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      target={[0, 4, 0]}
      minDistance={38}
      maxDistance={340}
      maxPolarAngle={Math.PI * 0.46}
      autoRotateSpeed={0.5}
      enablePan
      panSpeed={0.6}
    />
  )
}

export function CityCanvas() {
  return (
    <Canvas
      shadows
      dpr={Math.min(1.75, typeof window !== 'undefined' ? window.devicePixelRatio : 1)}
      camera={{ position: [104, 86, 126], fov: 36, near: 1, far: 900 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ scene }) => {
        scene.fog = new THREE.Fog('#0a1628', 160, 480)
      }}
    >
      <Suspense fallback={null}>
        <LiveCityView>
        <SkyCycle />
        <NightSky />
        <Ground />
        <Buildings />
        <Infrastructure />
        <Landmarks />
        <ConstructionSites />
        <DistrictHighlight />
        <PlacementGhost />
        <Props />
        <Traffic />
        <SimPulse />
        <Rig />
        <CameraDirector />
        <EffectComposer enableNormalPass={false} multisampling={0}>
          <Bloom
            intensity={0.72}
            luminanceThreshold={0.42}
            luminanceSmoothing={0.25}
            mipmapBlur
            radius={0.72}
          />
          <Vignette eskil={false} offset={0.22} darkness={0.82} />
        </EffectComposer>
        <Preload all />
        </LiveCityView>
      </Suspense>
    </Canvas>
  )
}

/* ------------------------------------------------------------------ */
/* one side of a Human-vs-AI match                                     */
/* ------------------------------------------------------------------ */

/**
 * The same scene, pointed at a different city.
 *
 * Deliberately lighter than the main canvas: no post-processing, no
 * construction sites and a lower pixel ratio, because two of these render at
 * once and the split view is about reading the two cities against each other
 * rather than admiring either one. The city itself is still the hero — same
 * geometry, same lighting, same instanced pipeline.
 */
export function MatchCanvas({
  view,
  autoRotate = true,
}: {
  view: Omit<CityView, 'side'> & { side: 'human' | 'ai' }
  autoRotate?: boolean
}) {
  return (
    <Canvas
      dpr={Math.min(1.35, typeof window !== 'undefined' ? window.devicePixelRatio : 1)}
      camera={{ position: [118, 96, 138], fov: 38, near: 1, far: 900 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ scene }) => {
        scene.fog = new THREE.Fog('#0a1628', 180, 520)
      }}
    >
      <Suspense fallback={null}>
        <MatchCityView {...view}>
          <SkyCycle />
          <Ground />
          <Buildings />
          <Infrastructure />
          <Landmarks />
          <Props />
          <Traffic />
          <MatchRig autoRotate={autoRotate} />
          <Preload all />
        </MatchCityView>
      </Suspense>
    </Canvas>
  )
}

function MatchRig({ autoRotate }: { autoRotate: boolean }) {
  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      target={[0, 4, 0]}
      minDistance={60}
      maxDistance={360}
      maxPolarAngle={Math.PI * 0.46}
      autoRotate={autoRotate}
      autoRotateSpeed={0.28}
      enablePan={false}
    />
  )
}
