import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { clock, daylight } from '../../lib/clock'

const DAY_SKY = new THREE.Color('#0d1b33')
const NIGHT_SKY = new THREE.Color('#03050d')
const DAY_FOG = new THREE.Color('#0f2140')
const NIGHT_FOG = new THREE.Color('#04060f')
const SUN_DAY = new THREE.Color('#fff4dd')
const SUN_DUSK = new THREE.Color('#ff9d5c')
const AMB_DAY = new THREE.Color('#9dc4ff')
const AMB_NIGHT = new THREE.Color('#2a4a8a')

const tmp = new THREE.Color()

export function SkyCycle() {
  const sun = useRef<THREE.DirectionalLight>(null)
  const amb = useRef<THREE.AmbientLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const moon = useRef<THREE.Mesh>(null)
  const { scene } = useThree()

  useFrame((_, dt) => {
    if (!clock.paused) clock.hour = (clock.hour + dt * clock.speed) % 24
    const d = daylight(clock.hour)
    const dusk = Math.max(0, 1 - Math.abs(d - 0.32) * 3.4) // warm band near sunrise/sunset

    // sun travels an arc keyed to the hour
    const a = ((clock.hour - 6) / 24) * Math.PI * 2
    const r = 170
    if (sun.current) {
      sun.current.position.set(Math.cos(a) * r, Math.max(8, Math.sin(a) * r * 0.85), 62)
      sun.current.intensity = 0.2 + d * 2.35
      sun.current.color.copy(SUN_DAY).lerp(SUN_DUSK, dusk * 0.8)
    }
    if (amb.current) {
      amb.current.intensity = 0.3 + d * 0.5
      amb.current.color.copy(AMB_NIGHT).lerp(AMB_DAY, d)
    }
    if (hemi.current) {
      hemi.current.intensity = 0.2 + d * 0.62
    }

    tmp.copy(NIGHT_SKY).lerp(DAY_SKY, d)
    scene.background = tmp.clone()
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(NIGHT_FOG).lerp(DAY_FOG, d)
      scene.fog.near = 150
      scene.fog.far = 520 - d * 60
    }

    if (moon.current) {
      const m = moon.current.material as THREE.MeshBasicMaterial
      m.opacity = Math.max(0, 1 - d * 2.2) * 0.85
      moon.current.position.set(Math.cos(a + Math.PI) * r, Math.max(10, Math.sin(a + Math.PI) * r * 0.7), -40)
    }
  })

  return (
    <group>
      <ambientLight ref={amb} intensity={0.4} />
      <hemisphereLight ref={hemi} args={['#8fc4ff', '#0a1424', 0.4]} />
      <directionalLight
        ref={sun}
        castShadow
        intensity={1.6}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={140}
        shadow-camera-bottom={-140}
        shadow-camera-near={1}
        shadow-camera-far={520}
        shadow-bias={-0.0008}
      />
      {/* cool fill from the opposite side keeps the night silhouettes readable */}
      <directionalLight position={[-120, 70, -110]} intensity={0.45} color="#5eb3ff" />
      <mesh ref={moon} raycast={() => null}>
        <sphereGeometry args={[7, 18, 18]} />
        <meshBasicMaterial color="#dbeafe" transparent opacity={0.8} toneMapped={false} />
      </mesh>
    </group>
  )
}
