import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useCityStore } from '../../store/useCityStore'
import { useOptimizerStore } from '../../store/useOptimizerStore'
import { execClock } from '../../execution/executionClock'
import { buildStage, jobProgress } from '../../execution/buildingStages'
import { BUILDING_LABELS } from '../../lib/colors'
import type { Building } from '../../simulation/types'
import { useCityView } from './CityViewContext'

/**
 * The construction zone around whatever the AI is building right now:
 * a glowing perimeter, a holographic ground grid, corner beams that climb with
 * the structure, a progress ring, rising sparks, and a readout.
 *
 * Only a handful are ever live at once, so these are plain meshes — the
 * particles are a single instanced mesh shared across every site.
 */
const MAX_SITES = 8
const PARTICLES_PER_SITE = 14
const MAX_PARTICLES = MAX_SITES * PARTICLES_PER_SITE

const dummy = new THREE.Object3D()

/** a faint holographic grid for the site floor */
function makeGridTexture() {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  g.clearRect(0, 0, s, s)
  g.strokeStyle = 'rgba(94,240,255,0.55)'
  g.lineWidth = 1
  for (let i = 0; i <= 8; i++) {
    const v = (i / 8) * s
    g.beginPath()
    g.moveTo(v, 0)
    g.lineTo(v, s)
    g.moveTo(0, v)
    g.lineTo(s, v)
    g.stroke()
  }
  g.strokeStyle = 'rgba(94,240,255,0.9)'
  g.lineWidth = 3
  g.strokeRect(1.5, 1.5, s - 3, s - 3)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

interface Site {
  b: Building
  job: { start: number; duration: number }
}

export function ConstructionSites() {
  const { city } = useCityView()
  const constructions = useOptimizerStore((s) => s.constructions)

  const gridTex = useMemo(() => makeGridTexture(), [])

  const sites = useMemo<Site[]>(() => {
    const byId = new Map(city.buildings.map((b) => [b.id, b]))
    const out: Site[] = []
    for (const [id, job] of Object.entries(constructions)) {
      const b = byId.get(id)
      if (b) out.push({ b, job })
    }
    return out.sort((a, b) => a.job.start - b.job.start).slice(0, MAX_SITES)
  }, [city, constructions])

  const group = useRef<THREE.Group>(null)
  const sparks = useRef<THREE.InstancedMesh>(null)
  const labels = useRef<(HTMLDivElement | null)[]>([])

  useFrame((state) => {
    const g = group.current
    if (!g) return
    const t = state.clock.elapsedTime
    const elapsed = execClock.elapsed
    const running = execClock.running
    let sparkIndex = 0

    g.children.forEach((child, i) => {
      const site = sites[i]
      if (!site || !running) {
        child.visible = false
        // the readout lives in the DOM, so it has to be dismissed explicitly
        const dead = labels.current[i]
        if (dead) dead.style.opacity = '0'
        return
      }
      const { b, job } = site
      const raw = jobProgress(job, elapsed) ?? -1
      // the site appears a beat before work starts and lingers briefly after
      const active = raw > -0.5 && raw < 1.15
      child.visible = active
      if (!active) {
        const dead = labels.current[i]
        if (dead) dead.style.opacity = '0'
        return
      }

      const stage = buildStage(Math.min(1, Math.max(0, raw)), b.h)
      const appear = Math.min(1, Math.max(0, (raw + 0.5) / 0.5))
      const fade = raw > 1 ? Math.max(0, 1 - (raw - 1) / 0.15) : 1
      const alpha = appear * fade
      const footprint = Math.max(b.w, b.d)

      child.position.set(b.x, 0, b.z)

      /* 0: glowing perimeter ring */
      const ring = child.children[0] as THREE.Mesh
      ring.scale.setScalar(footprint * (0.72 + appear * 0.1))
      ring.rotation.z = t * 0.45
      ;(ring.material as THREE.MeshBasicMaterial).opacity = alpha * (0.55 + Math.sin(t * 4) * 0.15)

      /* 1: holographic floor grid */
      const grid = child.children[1] as THREE.Mesh
      grid.scale.set(b.w * 1.5 * appear, b.d * 1.5 * appear, 1)
      ;(grid.material as THREE.MeshBasicMaterial).opacity = alpha * 0.45 * (1 - stage.t * 0.5)

      /* 2: progress ring — a real arc of the work done */
      const prog = child.children[2] as THREE.Mesh
      const geo = prog.geometry as THREE.RingGeometry
      const arc = Math.max(0.001, stage.t * Math.PI * 2)
      if (Math.abs((geo.parameters.thetaLength ?? 0) - arc) > 0.02) {
        prog.geometry.dispose()
        prog.geometry = new THREE.RingGeometry(
          footprint * 0.86,
          footprint * 0.96,
          40,
          1,
          Math.PI / 2,
          arc,
        )
      }
      ;(prog.material as THREE.MeshBasicMaterial).opacity = alpha * 0.9

      /* 3: foundation slab */
      const slab = child.children[3] as THREE.Mesh
      slab.position.y = 0.12
      slab.scale.set(b.w * 1.08, 0.24, b.d * 1.08)
      ;(slab.material as THREE.MeshStandardMaterial).opacity = alpha

      /* 4: corner beams that climb with the frame */
      const beams = child.children[4] as THREE.Group
      const beamH = Math.max(0.4, b.h * stage.height + 1.4)
      beams.children.forEach((beam, k) => {
        const sx = k === 0 || k === 3 ? -1 : 1
        const sz = k < 2 ? -1 : 1
        beam.position.set((sx * b.w) / 2, beamH / 2, (sz * b.d) / 2)
        beam.scale.set(1, beamH, 1)
        const m = (beam as THREE.Mesh).material as THREE.MeshBasicMaterial
        m.opacity = alpha * 0.75 * stage.fx
      })

      /* 5: scan plane sweeping the top of the structure */
      const scan = child.children[5] as THREE.Mesh
      scan.position.y = b.h * stage.height + 0.4
      scan.scale.set(b.w * 1.12, b.d * 1.12, 1)
      ;(scan.material as THREE.MeshBasicMaterial).opacity =
        stage.phase === 'rising' || stage.phase === 'foundation'
          ? alpha * (0.5 + Math.sin(t * 10) * 0.22)
          : 0

      /* label */
      const el = labels.current[i]
      if (el) {
        el.style.opacity = String(alpha)
        const pct = el.querySelector('[data-pct]') as HTMLElement | null
        if (pct) pct.textContent = `${Math.round(stage.t * 100)}%`
        const ph = el.querySelector('[data-phase]') as HTMLElement | null
        if (ph) ph.textContent = stage.phase.toUpperCase()
      }

      /* sparks rising out of the works */
      const sp = sparks.current
      if (sp && stage.fx > 0.05) {
        for (let k = 0; k < PARTICLES_PER_SITE && sparkIndex < MAX_PARTICLES; k++) {
          const seed = i * 31 + k * 7.3
          const life = ((t * 0.55 + seed * 0.137) % 1)
          const px = b.x + (Math.sin(seed * 2.1) * b.w) / 2.2
          const pz = b.z + (Math.cos(seed * 1.7) * b.d) / 2.2
          const py = 0.4 + life * (b.h * stage.height + 4)
          const scale = (1 - life) * 0.34 * stage.fx * alpha
          dummy.position.set(px, py, pz)
          dummy.scale.setScalar(Math.max(0.0001, scale))
          dummy.rotation.set(t * 2 + seed, t * 1.4, 0)
          dummy.updateMatrix()
          sp.setMatrixAt(sparkIndex++, dummy.matrix)
        }
      }
    })

    const sp = sparks.current
    if (sp) {
      for (let k = sparkIndex; k < MAX_PARTICLES; k++) {
        dummy.position.set(0, -80, 0)
        dummy.scale.setScalar(0.0001)
        dummy.updateMatrix()
        sp.setMatrixAt(k, dummy.matrix)
      }
      sp.instanceMatrix.needsUpdate = true
      sp.visible = sparkIndex > 0
    }
  })

  return (
    <group>
      <group ref={group}>
        {Array.from({ length: MAX_SITES }).map((_, i) => (
          <group key={i} visible={false}>
            {/* 0 perimeter */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]} raycast={() => null}>
              <ringGeometry args={[0.9, 1, 5]} />
              <meshBasicMaterial
                color="#5ef0ff"
                transparent
                opacity={0}
                side={THREE.DoubleSide}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>

            {/* 1 holographic grid */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.16, 0]} raycast={() => null}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                map={gridTex}
                transparent
                opacity={0}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>

            {/* 2 progress arc */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.34, 0]} raycast={() => null}>
              <ringGeometry args={[0.9, 1, 40, 1, Math.PI / 2, 0.001]} />
              <meshBasicMaterial
                color="#a6ffea"
                transparent
                opacity={0}
                side={THREE.DoubleSide}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>

            {/* 3 foundation slab */}
            <mesh raycast={() => null}>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#2a3444" roughness={0.95} transparent opacity={0} />
            </mesh>

            {/* 4 corner beams */}
            <group>
              {[0, 1, 2, 3].map((k) => (
                <mesh key={k} raycast={() => null}>
                  <boxGeometry args={[0.28, 1, 0.28]} />
                  <meshBasicMaterial
                    color="#ffd27a"
                    transparent
                    opacity={0}
                    depthWrite={false}
                    toneMapped={false}
                  />
                </mesh>
              ))}
            </group>

            {/* 5 scan plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial
                color="#8ef6ff"
                transparent
                opacity={0}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* readouts, kept in the DOM so the type stays crisp */}
      {sites.map((s, i) => (
        <Html
          key={s.b.id}
          position={[s.b.x, s.b.h + 6, s.b.z]}
          center
          distanceFactor={90}
          zIndexRange={[5, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div
            ref={(el) => {
              labels.current[i] = el
            }}
            style={{ opacity: 0 }}
            className="min-w-[132px] select-none rounded-md border border-cyan-300/40 bg-[#040a14]/85 px-2 py-1 text-center font-mono backdrop-blur-sm"
          >
            <div className="text-[7px] uppercase tracking-[0.2em] text-cyan-300/80">
              Construction site
            </div>
            <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              {BUILDING_LABELS[s.b.type]}
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span data-phase className="text-[7px] tracking-[0.14em] text-slate-400">
                PENDING
              </span>
              <span data-pct className="text-[13px] font-bold tabular-nums text-cyan-200">
                0%
              </span>
            </div>
          </div>
        </Html>
      ))}

      {/* shared spark pool */}
      <instancedMesh
        ref={sparks}
        args={[undefined as never, undefined as never, MAX_PARTICLES]}
        raycast={() => null}
        frustumCulled={false}
      >
        <tetrahedronGeometry args={[1, 0]} />
        <meshBasicMaterial
          color="#ffd9a0"
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  )
}
