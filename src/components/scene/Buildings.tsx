import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useCityStore, type HeatLayer } from '../../store/useCityStore'
import { useSandboxStore } from '../../store/useSandboxStore'
import { useOptimizerStore } from '../../store/useOptimizerStore'
import { BUILDING_COLORS, heatColor } from '../../lib/colors'
import { makeWindowTexture } from './groundTexture'
import { daylight, clock } from '../../lib/clock'
import { execClock, newBuildFactor } from '../../execution/executionClock'
import { buildStage, jobProgress } from '../../execution/buildingStages'
import type { Building, BuildingType, DistrictId } from '../../simulation/types'
import { useCityView } from './CityViewContext'

/** How strongly each building type participates in a given heatmap layer. */
const LAYER_WEIGHT: Record<Exclude<HeatLayer, 'none'>, Partial<Record<BuildingType, number>>> = {
  traffic: { residential_tower: 1, house: 0.7, office: 1.1, shop: 1.15, hospital: 0.95, school: 0.8, transit_hub: 1.1, industrial: 0.9, parking: 1, park: 0.2 },
  electricity: { office: 1.25, industrial: 1.3, hospital: 1.2, residential_tower: 0.95, shop: 1.05, house: 0.55, school: 0.7, transit_hub: 0.8, parking: 0.35, park: 0.1 },
  water: { residential_tower: 1.15, house: 0.9, hospital: 1.25, industrial: 1.2, school: 0.85, office: 0.6, shop: 0.6, transit_hub: 0.5, parking: 0.2, park: 1.05 },
  retail: { shop: 1.3, residential_tower: 1, transit_hub: 1.1, office: 0.85, house: 0.7, school: 0.3, hospital: 0.4, parking: 0.5, industrial: 0.25, park: 0.2 },
  education: { school: 1.35, residential_tower: 1.05, house: 0.95, park: 0.35, shop: 0.2, office: 0.2, hospital: 0.3, parking: 0.15, transit_hub: 0.3, industrial: 0.1 },
  parking: { parking: 1.35, residential_tower: 1.1, shop: 1.2, office: 1.05, hospital: 1, house: 0.6, school: 0.5, transit_hub: 0.8, industrial: 0.6, park: 0.1 },
  emissions: { industrial: 1.4, office: 1.1, residential_tower: 0.95, hospital: 1.05, shop: 0.85, house: 0.6, school: 0.5, transit_hub: 0.6, parking: 0.7, park: 0 },
}

const HEAT_LAYERS = [
  'traffic',
  'electricity',
  'water',
  'retail',
  'education',
  'parking',
  'emissions',
] as const
type HeatKey = (typeof HEAT_LAYERS)[number]

const dummy = new THREE.Object3D()
const col = new THREE.Color()
const baseCol = new THREE.Color()
const CONCRETE = new THREE.Color('#55606f')
const NEW_TINT = new THREE.Color('#4de3ff')
const HOT_GLOW = new THREE.Color('#5ef0ff')

export function Buildings() {
  const view = useCityView()
  const { city, current, heatLayer } = view
  const districts = useCityStore((s) => s.current.districts)
  const compareMode = useCityStore((s) => s.compareMode)
  const compareSplit = useCityStore((s) => s.compareSplit)
  const setHovered = useCityStore((s) => s.setHovered)
  const setSelected = useCityStore((s) => s.setSelected)
  const demolishMode = useSandboxStore((s) => s.demolishMode)
  const pickDemolish = useSandboxStore((s) => s.pickDemolish)
  const placementTool = useCityStore((s) => s.placementTool)
  const constructions = useOptimizerStore((s) => s.constructions)

  const buildings = city.buildings
  const count = buildings.length

  const bodyRef = useRef<THREE.InstancedMesh>(null)
  const glowRef = useRef<THREE.InstancedMesh>(null)
  const crownRef = useRef<THREE.InstancedMesh>(null)
  const growth = useRef(new Map<string, number>())

  /*
   * An InstancedMesh caches its bounding sphere the first time anything needs
   * it — which happens during preload, before useFrame has written a single
   * matrix. Left alone that sphere stays a unit blob at the origin and every
   * raycast (hover, click, build placement) misses.
   */
  const needsBounds = useRef(true)
  const colourPass = useRef(true)

  const windowTex = useMemo(() => makeWindowTexture(), [])
  const crowns = useMemo(() => buildings.filter((b) => b.h > 15), [buildings])
  const districtMap = useMemo(() => new Map(districts.map((d) => [d.id, d])), [districts])

  /*
   * Heat values are eased rather than swapped, so when the AI finishes a plan
   * the heatmap visibly drains from red to green instead of snapping.
   */
  const animHeat = useRef(new Map<DistrictId, Record<HeatKey, number>>())

  useEffect(() => {
    needsBounds.current = true
    colourPass.current = true
  }, [buildings])

  useEffect(() => {
    colourPass.current = true
  }, [heatLayer])

  const heatOf = (b: Building, layer: HeatLayer) => {
    if (layer === 'none') return 0
    const eased = animHeat.current.get(b.district)
    const base = eased
      ? eased[layer as HeatKey]
      : ((districtMap.get(b.district)?.[layer] as number) ?? 0)
    const w = LAYER_WEIGHT[layer][b.type] ?? 0.6
    return Math.max(0, Math.min(1, base * w))
  }

  useFrame((_, dt) => {
    const body = bodyRef.current
    const glow = glowRef.current
    const crown = crownRef.current
    if (!body || !glow) return

    const map = growth.current
    const night = 1 - daylight(clock.hour)
    const dusk = Math.max(0, (night - 0.34) / 0.66)
    const elapsed = execClock.elapsed
    const running = execClock.running
    // just-built structures are picked out, then settle into the skyline
    const fresh = newBuildFactor()

    /* ---- ease the heat values toward the live simulation ---- */
    let heatAnimating = false
    for (const d of districts) {
      let cur = animHeat.current.get(d.id)
      if (!cur) {
        cur = {} as Record<HeatKey, number>
        for (const k of HEAT_LAYERS) cur[k] = d[k] as number
        animHeat.current.set(d.id, cur)
      }
      for (const k of HEAT_LAYERS) {
        const target = d[k] as number
        const diff = target - cur[k]
        if (Math.abs(diff) > 0.0015) {
          cur[k] += diff * Math.min(1, dt * 1.5)
          heatAnimating = true
        } else cur[k] = target
      }
    }

    let dirty = false
    let building = 0

    for (let i = 0; i < buildings.length; i++) {
      const b = buildings[i]
      const t = running ? jobProgress(constructions[b.id], elapsed) : null

      let g: number
      let windows = 1
      let fx = 0

      if (t !== null && t < 1.02) {
        // the AI is building this one — it rises on the plan's schedule
        const stage = buildStage(t, b.h)
        g = stage.height
        windows = stage.windows
        fx = stage.fx
        map.set(b.id, g)
        dirty = true
        if (stage.phase !== 'pending') building++
      } else {
        const target = b.isNew && compareMode ? compareSplit : 1
        let cur = map.get(b.id)
        if (cur === undefined) {
          cur = b.isNew && t !== null ? 0 : 1
          map.set(b.id, cur)
          dirty = true
        }
        if (Math.abs(cur - target) > 0.002) {
          cur += (target - cur) * Math.min(1, dt * 4.2)
          map.set(b.id, cur)
          dirty = true
        }
        g = cur
      }

      const sy = Math.max(0.0015, b.h * g)
      dummy.position.set(b.x, sy / 2, b.z)
      dummy.scale.set(b.w, sy, b.d)
      dummy.rotation.set(0, b.rotation, 0)
      dummy.updateMatrix()
      body.setMatrixAt(i, dummy.matrix)

      // glow shell: night light, heatmap intensity, or construction energy
      const heat = heatOf(b, heatLayer)
      const glowScale =
        fx > 0
          ? 0.1 + fx * 0.5 + windows * 0.35
          : heatLayer === 'none'
            ? (b.isNew ? 0.05 + fresh * 0.18 : 0.045) * Math.max(dusk, b.isNew ? fresh * 0.7 : 0)
            : 0.06 + heat * 0.5
      dummy.scale.set(b.w + glowScale * 3.2, sy + glowScale * 2.2, b.d + glowScale * 3.2)
      dummy.updateMatrix()
      glow.setMatrixAt(i, dummy.matrix)
    }
    body.instanceMatrix.needsUpdate = true
    glow.instanceMatrix.needsUpdate = true

    if (dirty || needsBounds.current) {
      body.computeBoundingSphere()
      needsBounds.current = false
    }

    /* ---- colours: only recomputed while something is actually moving ---- */
    if (colourPass.current || heatAnimating || building > 0) {
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i]
        const heat = heatOf(b, heatLayer)
        baseCol.set(BUILDING_COLORS[b.type])

        if (heatLayer === 'none') {
          col.copy(baseCol)
          if (b.isNew) col.lerp(NEW_TINT, 0.1 + fresh * 0.26)
        } else {
          heatColor(heat, col)
          col.lerp(baseCol, 0.28)
        }

        const t = running ? jobProgress(constructions[b.id], elapsed) : null
        if (t !== null && t < 1.02) {
          const stage = buildStage(t, b.h)
          // bare structure first, finished facade second, lights last
          col.lerp(CONCRETE, 1 - stage.finish)
          if (stage.windows > 0) col.lerp(NEW_TINT, stage.windows * 0.22)
          body.setColorAt(i, col)
          glow.setColorAt(i, HOT_GLOW)
          continue
        }

        body.setColorAt(i, col)
        glow.setColorAt(
          i,
          heatLayer === 'none' ? baseCol.set(b.isNew ? '#5ef0ff' : '#ffb46a') : heatColor(heat, col),
        )
      }
      if (body.instanceColor) body.instanceColor.needsUpdate = true
      if (glow.instanceColor) glow.instanceColor.needsUpdate = true
      colourPass.current = false
    }

    if (crown) {
      for (let i = 0; i < crowns.length; i++) {
        const b = crowns[i]
        const g = map.get(b.id) ?? 1
        const top = b.h * g
        dummy.position.set(b.x, top + 0.85, b.z)
        // the crown is a finishing detail — it only appears once the frame is up
        dummy.scale.set(b.w * 0.3, g > 0.985 ? 1.7 : 0.0001, b.d * 0.3)
        dummy.rotation.set(0, b.rotation, 0)
        dummy.updateMatrix()
        crown.setMatrixAt(i, dummy.matrix)
      }
      crown.instanceMatrix.needsUpdate = true
    }

    /*
     * Window light and the additive glow shell stay completely off until dusk —
     * in daylight they would wash the whole city warm.
     */
    const mat = body.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = dusk * dusk * 2.3
    const gmat = glow.material as THREE.MeshBasicMaterial
    gmat.opacity = Math.max(
      building > 0 ? 0.34 : 0,
      heatLayer === 'none' ? dusk * 0.34 : 0.3,
    )
  })

  return (
    <group>
      <instancedMesh
        key={`body-${count}`}
        ref={bodyRef}
        args={[undefined as never, undefined as never, Math.max(1, count)]}
        frustumCulled={false}
        castShadow
        receiveShadow
        onPointerMove={(e) => {
          e.stopPropagation()
          if (!view.interactive) return
          const b = buildings[e.instanceId ?? -1]
          if (b) setHovered(b.id)
        }}
        onPointerOut={() => setHovered(null)}
        onClick={(e) => {
          e.stopPropagation()
          if (placementTool) return
          const b = buildings[e.instanceId ?? -1]
          if (!b || !view.interactive) return
          if (demolishMode) pickDemolish(b.id)
          else setSelected(b.id)
        }}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          roughness={0.62}
          metalness={0.25}
          emissive={'#ffb46a'}
          emissiveMap={windowTex}
          emissiveIntensity={0}
          toneMapped
        />
      </instancedMesh>

      <instancedMesh
        key={`glow-${count}`}
        ref={glowRef}
        args={[undefined as never, undefined as never, Math.max(1, count)]}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>

      <instancedMesh
        key={`crown-${crowns.length}`}
        ref={crownRef}
        args={[undefined as never, undefined as never, Math.max(1, crowns.length)]}
        frustumCulled={false}
        raycast={() => null}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#0a1018"
          roughness={0.35}
          metalness={0.7}
          emissive="#38f0ff"
          emissiveIntensity={0.07}
        />
      </instancedMesh>

      <Highlights />
    </group>
  )
}

/** hover outline + selection beam, kept out of the instanced meshes */
function Highlights() {
  const { city } = useCityView()
  const hovered = useCityStore((s) => s.hoveredBuilding)
  const selected = useCityStore((s) => s.selectedBuilding)
  const hoverRef = useRef<THREE.Mesh>(null)
  const selRef = useRef<THREE.Group>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  const find = (id: string | null) => (id ? city.buildings.find((b) => b.id === id) : undefined)
  const hb = find(hovered)
  const sb = find(selected)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (hoverRef.current && hb) {
      hoverRef.current.position.set(hb.x, hb.h / 2, hb.z)
      hoverRef.current.scale.set(hb.w + 0.7, hb.h + 0.7, hb.d + 0.7)
    }
    if (selRef.current && sb) {
      selRef.current.position.set(sb.x, 0, sb.z)
      const beam = selRef.current.children[0] as THREE.Mesh
      beam.position.y = sb.h / 2 + 9
      beam.scale.set(1, sb.h + 18, 1)
      const m = beam.material as THREE.MeshBasicMaterial
      m.opacity = 0.12 + Math.sin(t * 3) * 0.05
    }
    if (ringRef.current && sb) {
      const s = 1 + Math.sin(t * 2.4) * 0.06
      ringRef.current.scale.set(s, s, 1)
    }
  })

  return (
    <group>
      {hb && (
        <mesh ref={hoverRef} raycast={() => null}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color="#8ef6ff"
            wireframe
            transparent
            opacity={0.5}
            toneMapped={false}
          />
        </mesh>
      )}
      {sb && (
        <group ref={selRef}>
          <mesh raycast={() => null}>
            <cylinderGeometry args={[Math.max(sb.w, sb.d) * 0.62, Math.max(sb.w, sb.d) * 0.62, 1, 20, 1, true]} />
            <meshBasicMaterial
              color="#38f0ff"
              transparent
              opacity={0.14}
              side={THREE.DoubleSide}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.22, 0]} raycast={() => null}>
            <ringGeometry args={[Math.max(sb.w, sb.d) * 0.72, Math.max(sb.w, sb.d) * 0.86, 48]} />
            <meshBasicMaterial color="#38f0ff" transparent opacity={0.75} toneMapped={false} />
          </mesh>
        </group>
      )}
    </group>
  )
}
