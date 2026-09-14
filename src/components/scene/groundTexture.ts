import * as THREE from 'three'
import type { City } from '../../simulation/types'
import type { CityConfig } from '../../simulation/config'

/**
 * The whole street layout is painted once into a canvas texture instead of
 * being built from thousands of meshes — asphalt, kerbs, lane markings,
 * crosswalks and block plots all cost a single draw call.
 */
export function makeGroundTexture(city: City, config: CityConfig, size = 2048): THREE.CanvasTexture {
  const pad = config.blockPitch
  const extent = city.bounds + pad // world half-size covered by the texture
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!

  const S = size / (extent * 2) // px per world unit
  const X = (x: number) => (x + extent) * S
  const Z = (z: number) => (z + extent) * S

  // ground
  g.fillStyle = '#070a12'
  g.fillRect(0, 0, size, size)

  // subtle radial lift towards the centre so the city reads as the focal point
  const grad = g.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.62)
  grad.addColorStop(0, 'rgba(30,52,78,0.55)')
  grad.addColorStop(0.6, 'rgba(14,24,40,0.32)')
  grad.addColorStop(1, 'rgba(4,7,15,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)

  // block plots
  const gp = city.gridPositions
  const inner = config.blockPitch - config.roadWidth
  for (let i = 0; i < gp.length - 1; i++) {
    for (let j = 0; j < gp.length - 1; j++) {
      const cx = (gp[i] + gp[i + 1]) / 2
      const cz = (gp[j] + gp[j + 1]) / 2
      g.fillStyle = 'rgba(22,32,48,0.85)'
      g.fillRect(X(cx - inner / 2), Z(cz - inner / 2), inner * S, inner * S)
      g.strokeStyle = 'rgba(90,160,200,0.10)'
      g.lineWidth = Math.max(1, 0.25 * S)
      g.strokeRect(X(cx - inner / 2), Z(cz - inner / 2), inner * S, inner * S)
    }
  }

  // roads
  for (const r of city.roads) {
    const w = (r.arterial ? config.roadWidth : config.roadWidth * 0.78) * S
    g.strokeStyle = '#11151d'
    g.lineWidth = w
    g.lineCap = 'butt'
    g.beginPath()
    g.moveTo(X(r.x1), Z(r.z1))
    g.lineTo(X(r.x2), Z(r.z2))
    g.stroke()

    // kerb glow
    g.strokeStyle = 'rgba(120,200,255,0.09)'
    g.lineWidth = Math.max(1, 0.22 * S)
    const off = w / 2
    const dx = r.axis === 'x' ? 0 : off
    const dz = r.axis === 'x' ? off : 0
    for (const s of [-1, 1]) {
      g.beginPath()
      g.moveTo(X(r.x1) + dx * s, Z(r.z1) + dz * s)
      g.lineTo(X(r.x2) + dx * s, Z(r.z2) + dz * s)
      g.stroke()
    }

    // centre line
    g.strokeStyle = r.arterial ? 'rgba(250,220,140,0.42)' : 'rgba(210,230,255,0.20)'
    g.lineWidth = Math.max(1, 0.16 * S)
    g.setLineDash([1.6 * S, 1.9 * S])
    g.beginPath()
    g.moveTo(X(r.x1), Z(r.z1))
    g.lineTo(X(r.x2), Z(r.z2))
    g.stroke()
    g.setLineDash([])
  }

  // intersections + crosswalks
  for (const it of city.intersections) {
    const half = (config.roadWidth / 2) * S
    g.fillStyle = '#151a23'
    g.fillRect(X(it.x) - half, Z(it.z) - half, half * 2, half * 2)
    if (it.signalised) {
      g.strokeStyle = 'rgba(226,244,255,0.30)'
      g.lineWidth = Math.max(1, 0.2 * S)
      for (let k = -3; k <= 3; k++) {
        const o = k * 0.9 * S
        g.beginPath()
        g.moveTo(X(it.x) + o, Z(it.z) - half - 1.5 * S)
        g.lineTo(X(it.x) + o, Z(it.z) - half - 0.2 * S)
        g.moveTo(X(it.x) + o, Z(it.z) + half + 0.2 * S)
        g.lineTo(X(it.x) + o, Z(it.z) + half + 1.5 * S)
        g.moveTo(X(it.x) - half - 1.5 * S, Z(it.z) + o)
        g.lineTo(X(it.x) - half - 0.2 * S, Z(it.z) + o)
        g.moveTo(X(it.x) + half + 0.2 * S, Z(it.z) + o)
        g.lineTo(X(it.x) + half + 1.5 * S, Z(it.z) + o)
        g.stroke()
      }
    }
  }

  const tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 8
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** Tiny tiling window texture used as the emissive map on every building. */
export function makeWindowTexture(): THREE.CanvasTexture {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, s, s)

  const cols = 6
  const rows = 8
  const cw = s / cols
  const rh = s / rows
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const on = ((x * 7 + y * 13 + ((x * y) % 5)) % 10) > 3
      if (!on) continue
      const a = 0.45 + ((x * 3 + y * 5) % 7) / 12
      g.fillStyle = `rgba(255,${200 + ((x + y) % 3) * 18},${150 + ((x * y) % 4) * 22},${a})`
      g.fillRect(x * cw + cw * 0.22, y * rh + rh * 0.22, cw * 0.56, rh * 0.42)
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 3)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
