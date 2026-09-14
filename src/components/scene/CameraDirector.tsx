import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useOptimizerStore } from '../../store/useOptimizerStore'

/**
 * The cinematic camera director.
 *
 * Camera moves are expressed as *shots* — a look-at point plus a spherical
 * offset (distance, polar, azimuth) — and interpolated in spherical space, so
 * the camera arcs around the city instead of sliding through it. Everything
 * eases in and out, and an optional `orbit` keeps the camera drifting around
 * the subject after it arrives.
 *
 * Reusable moves (see `useCamera`): flyTo · focusOn · orbitAround · zoomTo ·
 * returnToOverview.
 *
 * The user always wins: any pointer or wheel input on the canvas cancels the
 * current move and hands control straight back to OrbitControls.
 */

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/** shortest signed angular distance, so the camera never spins the long way */
function shortestAngle(from: number, to: number) {
  let d = (to - from) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

interface Controls {
  target: THREE.Vector3
  update: () => void
  enabled: boolean
}

export function CameraDirector() {
  const command = useOptimizerStore((s) => s.cameraCommand)
  const { camera, controls } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera
    controls: Controls | null
  }

  const anim = useRef<{
    start: number
    duration: number
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
    fromDist: number
    toDist: number
    fromPolar: number
    toPolar: number
    fromAz: number
    azDelta: number
    orbit: number
    done: boolean
  } | null>(null)
  const interrupted = useRef(false)

  // any manual interaction cancels the AI's camera move
  useEffect(() => {
    const stop = () => {
      interrupted.current = true
      anim.current = null
    }
    const el = document.querySelector('canvas')
    el?.addEventListener('pointerdown', stop)
    el?.addEventListener('wheel', stop, { passive: true })
    return () => {
      el?.removeEventListener('pointerdown', stop)
      el?.removeEventListener('wheel', stop)
    }
  }, [])

  useEffect(() => {
    if (!command || !controls) return
    interrupted.current = false

    const toTarget = new THREE.Vector3(command.x, command.y ?? 4, command.z)
    const offset = camera.position.clone().sub(controls.target)
    const spherical = new THREE.Spherical().setFromVector3(offset)

    anim.current = {
      start: performance.now(),
      duration: Math.max(200, command.travel),
      fromTarget: controls.target.clone(),
      toTarget,
      fromDist: spherical.radius,
      toDist: command.distance,
      fromPolar: spherical.phi,
      toPolar: command.polar,
      fromAz: spherical.theta,
      azDelta:
        command.azimuth != null
          ? shortestAngle(spherical.theta, command.azimuth)
          : // no heading given: swing a little so the move reads as a camera move
            (command.orbit ? 0.55 : 0.22) * (command.distance < spherical.radius ? 1 : -1),
      orbit: command.orbit ?? 0,
      done: false,
    }
  }, [command, camera, controls])

  useFrame((_, dt) => {
    const a = anim.current
    if (!a || !controls || interrupted.current) return

    const t = Math.min(1, (performance.now() - a.start) / a.duration)
    const e = easeInOutCubic(t)

    const target = new THREE.Vector3().lerpVectors(a.fromTarget, a.toTarget, e)
    const radius = a.fromDist + (a.toDist - a.fromDist) * e
    const phi = a.fromPolar + (a.toPolar - a.fromPolar) * e

    // once the move lands, keep drifting if the shot asked for an orbit
    if (t >= 1 && a.orbit) a.fromAz += a.orbit * dt
    const theta = a.fromAz + a.azDelta * e

    const offset = new THREE.Vector3().setFromSpherical(
      new THREE.Spherical(radius, Math.max(0.12, Math.min(1.45, phi)), theta),
    )

    camera.position.copy(target).add(offset)
    controls.target.copy(target)
    controls.update()

    if (t >= 1 && !a.orbit) anim.current = null
  })

  return null
}

/* ------------------------------------------------------------------ */
/* reusable camera moves, usable from anywhere in the app              */
/* ------------------------------------------------------------------ */

const run = (shot: Parameters<ReturnType<typeof useOptimizerStore.getState>['runCamera']>[0]) =>
  useOptimizerStore.getState().runCamera(shot)

export const cameraMoves = {
  /** travel to a point, keeping a natural viewing angle */
  flyTo: (x: number, z: number, distance = 110, travel = 1600) =>
    run({ x, z, distance, polar: 0.9, travel }),

  /** get in close on something specific */
  focusOn: (x: number, z: number, distance = 56, travel = 1300) =>
    run({ x, z, distance, polar: 1.12, travel }),

  /** arrive, then keep circling the subject */
  orbitAround: (x: number, z: number, distance = 72, speed = 0.16, travel = 1500) =>
    run({ x, z, distance, polar: 1.02, travel, orbit: speed }),

  /** change distance without moving the look-at point */
  zoomTo: (x: number, z: number, distance: number, travel = 900) =>
    run({ x, z, distance, polar: 0.95, travel }),

  /** back out to the whole city */
  returnToOverview: (travel = 2200) =>
    run({ x: 0, z: 0, distance: 215, polar: 0.74, travel }),
}
