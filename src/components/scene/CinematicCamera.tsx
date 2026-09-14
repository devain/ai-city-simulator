import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { readChannel, type CameraChannel, type Easing, type Shot } from '../../demo/cameraBus'

/**
 * The cinematic camera controller, one per canvas.
 *
 * Generalised from the Phase 3 director so the split-screen match canvases can
 * each be directed independently. Moves are interpolated in *spherical* space
 * — look-at point, distance, polar, azimuth — so the camera arcs around the
 * city rather than sliding through it, and it never teleports.
 *
 * The user always wins: any pointer or wheel input cancels the move and hands
 * control back to OrbitControls, unless the channel is locked by a demo that
 * owns the frame.
 */

const EASING: Record<Easing, (t: number) => number> = {
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  linear: (t) => t,
}

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

interface Anim {
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
  fromFov: number
  toFov: number
  orbit: number
  shake: number
  ease: (t: number) => number
}

export function CinematicCamera({ channel }: { channel: CameraChannel }) {
  const { camera, controls, gl } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera
    controls: Controls | null
    gl: THREE.WebGLRenderer
  }

  const anim = useRef<Anim | null>(null)
  const lastToken = useRef(0)
  const interrupted = useRef(false)
  const drift = useRef(0)

  // manual interaction cancels the move — but not while a demo owns the shot
  useEffect(() => {
    const stop = () => {
      if (readChannel(channel).locked) return
      interrupted.current = true
      anim.current = null
    }
    const el = gl.domElement
    el.addEventListener('pointerdown', stop)
    el.addEventListener('wheel', stop, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', stop)
      el.removeEventListener('wheel', stop)
    }
  }, [gl, channel])

  useFrame((_, dt) => {
    const ch = readChannel(channel)

    /* ---- a new shot has been sent ---- */
    if (ch.token !== lastToken.current && ch.shot && controls) {
      lastToken.current = ch.token
      interrupted.current = false
      drift.current = 0
      anim.current = begin(ch.shot, camera, controls)
    }

    const a = anim.current
    if (!a || !controls || interrupted.current) return

    const raw = Math.min(1, (performance.now() - a.start) / a.duration)
    const e = a.ease(raw)

    const target = new THREE.Vector3().lerpVectors(a.fromTarget, a.toTarget, e)
    const radius = a.fromDist + (a.toDist - a.fromDist) * e
    const phi = a.fromPolar + (a.toPolar - a.fromPolar) * e

    // the orbit keeps going after arrival, so a held shot still breathes
    if (a.orbit) drift.current += a.orbit * dt * (raw >= 1 ? 1 : e)
    const theta = a.fromAz + a.azDelta * e + drift.current

    const offset = new THREE.Vector3().setFromSpherical(
      new THREE.Spherical(radius, Math.max(0.12, Math.min(1.45, phi)), theta),
    )

    camera.position.copy(target).add(offset)

    /*
     * Shake decays over the first third of the move and is scaled by distance,
     * so it reads as a handheld reaction rather than an earthquake. One short
     * burst, never a sustained rumble.
     */
    if (a.shake > 0 && raw < 0.34) {
      const decay = 1 - raw / 0.34
      const amp = a.shake * decay * radius * 0.008
      const t = performance.now() * 0.021
      camera.position.x += Math.sin(t * 1.7) * amp
      camera.position.y += Math.sin(t * 2.3 + 1.1) * amp * 0.6
      camera.position.z += Math.cos(t * 1.9 + 0.4) * amp
    }

    if (a.toFov !== a.fromFov) {
      camera.fov = a.fromFov + (a.toFov - a.fromFov) * e
      camera.updateProjectionMatrix()
    }

    controls.target.copy(target)
    controls.update()

    // a shot with no orbit is finished once it lands; an orbiting one is held
    if (raw >= 1 && !a.orbit) anim.current = null
  })

  return null
}

function begin(shot: Shot, camera: THREE.PerspectiveCamera, controls: Controls): Anim {
  const toTarget = new THREE.Vector3(shot.x, shot.y ?? 4, shot.z)
  const offset = camera.position.clone().sub(controls.target)
  const spherical = new THREE.Spherical().setFromVector3(offset)

  return {
    start: performance.now(),
    duration: Math.max(200, shot.travel),
    fromTarget: controls.target.clone(),
    toTarget,
    fromDist: spherical.radius,
    toDist: shot.distance,
    fromPolar: spherical.phi,
    toPolar: shot.polar,
    fromAz: spherical.theta,
    azDelta:
      shot.azimuth != null
        ? shortestAngle(spherical.theta, shot.azimuth)
        : // no heading given: swing a little so the move reads as a camera move
          (shot.orbit ? 0.5 : 0.2) * (shot.distance < spherical.radius ? 1 : -1),
    fromFov: camera.fov,
    toFov: shot.fov ?? camera.fov,
    orbit: shot.orbit ?? 0,
    shake: shot.shake ?? 0,
    ease: EASING[shot.ease ?? 'inOutCubic'],
  }
}
