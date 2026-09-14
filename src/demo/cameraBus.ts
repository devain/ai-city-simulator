/**
 * THE CAMERA BUS.
 *
 * A camera move is a message on a channel. There is one channel per canvas
 * ('live', 'human', 'ai'), so a demo can direct the two match cities
 * independently and neither fights the other.
 *
 * Deliberately *not* a zustand store: shots are read every frame by the
 * controller inside the canvas, and a store would re-render the whole
 * dashboard 60 times a second. Same reasoning as `lib/clock.ts` and
 * `execution/executionClock.ts` — a mutable module object read in `useFrame`.
 */

export type CameraChannel = 'live' | 'human' | 'ai'

export type Easing = 'inOutCubic' | 'outQuint' | 'inOutSine' | 'linear'

export interface Shot {
  /** look-at point */
  x: number
  z: number
  y?: number
  /** distance from the target */
  distance: number
  /** polar angle from vertical: 0.35 = almost overhead, 1.3 = low and dramatic */
  polar: number
  /** absolute heading; omitted keeps the current one so moves stay continuous */
  azimuth?: number
  /** radians/second of drift after arriving */
  orbit?: number
  /** travel time, ms */
  travel: number
  /** field of view to ease toward — a subtle dolly-zoom when paired with distance */
  fov?: number
  /** 0..1 handheld wobble, for a moment of emphasis. Use sparingly. */
  shake?: number
  ease?: Easing
}

interface Channel {
  shot: Shot | null
  /** bumped on every send, so the controller can detect a new shot */
  token: number
  /** set while a demo owns the camera — suppresses the user-interrupt handler */
  locked: boolean
}

const channels: Record<CameraChannel, Channel> = {
  live: { shot: null, token: 0, locked: false },
  human: { shot: null, token: 0, locked: false },
  ai: { shot: null, token: 0, locked: false },
}

export function sendShot(channel: CameraChannel, shot: Shot) {
  const c = channels[channel]
  c.shot = shot
  c.token += 1
}

export function readChannel(channel: CameraChannel): Channel {
  return channels[channel]
}

/** While locked, a stray pointer move will not yank the camera off its mark. */
export function lockChannel(channel: CameraChannel, locked: boolean) {
  channels[channel].locked = locked
}

export function lockAll(locked: boolean) {
  for (const k of Object.keys(channels) as CameraChannel[]) channels[k].locked = locked
}

export function resetChannels() {
  for (const k of Object.keys(channels) as CameraChannel[]) {
    channels[k] = { shot: null, token: 0, locked: false }
  }
}

/* ------------------------------------------------------------------ */
/* the shot library                                                    */
/* ------------------------------------------------------------------ */

/**
 * Named shots, so a timeline reads like a shot list rather than a pile of
 * spherical coordinates. Every one of these is a *move*, never a cut — the
 * controller interpolates in spherical space, so the camera arcs around the
 * city instead of sliding through it.
 */
export const shots = {
  /** high and wide, drifting slowly — the opening frame */
  establishing: (channel: CameraChannel, travel = 5200): void =>
    sendShot(channel, {
      x: 0,
      z: 0,
      distance: 330,
      polar: 0.52,
      travel,
      orbit: 0.035,
      fov: 32,
      ease: 'inOutSine',
    }),

  /** the whole city, comfortably framed */
  overview: (channel: CameraChannel, travel = 2600): void =>
    sendShot(channel, { x: 0, z: 0, distance: 215, polar: 0.74, travel, fov: 36 }),

  /** travel to a point and hold a natural viewing angle */
  flyTo: (channel: CameraChannel, x: number, z: number, distance = 110, travel = 2200): void =>
    sendShot(channel, { x, z, distance, polar: 0.92, travel, fov: 36 }),

  /** get in close on one structure */
  focusOnObject: (
    channel: CameraChannel,
    x: number,
    z: number,
    distance = 58,
    travel = 1800,
  ): void => sendShot(channel, { x, z, distance, polar: 1.1, travel, fov: 40 }),

  /**
   * The construction hero shot: arrive high over the site, descend, and keep
   * rotating slowly around it while the structure goes up.
   */
  followConstruction: (channel: CameraChannel, x: number, z: number, travel = 2600): void =>
    sendShot(channel, {
      x,
      z,
      distance: 62,
      polar: 1.06,
      travel,
      orbit: 0.19,
      fov: 42,
      ease: 'outQuint',
    }),

  /** a slow lateral drift across the skyline */
  panAcrossCity: (channel: CameraChannel, travel = 9000): void =>
    sendShot(channel, {
      x: 0,
      z: 0,
      distance: 190,
      polar: 0.82,
      travel,
      orbit: 0.055,
      fov: 34,
      ease: 'linear',
    }),

  /** low, close, and slowly circling — for a reveal */
  heroShot: (channel: CameraChannel, travel = 3400): void =>
    sendShot(channel, {
      x: 0,
      z: 0,
      distance: 128,
      polar: 1.2,
      travel,
      orbit: 0.1,
      fov: 44,
      ease: 'outQuint',
    }),

  /** identical framing on both sides, so the comparison is honest */
  splitComparison: (travel = 2800): void => {
    const frame: Omit<Shot, 'travel'> = {
      x: 0,
      z: 0,
      distance: 235,
      polar: 0.7,
      azimuth: Math.PI * 0.25,
      fov: 35,
    }
    sendShot('human', { ...frame, travel })
    sendShot('ai', { ...frame, travel })
  },

  /** pull all the way back for the final card */
  pullBack: (channel: CameraChannel, travel = 4200): void =>
    sendShot(channel, {
      x: 0,
      z: 0,
      distance: 300,
      polar: 0.6,
      travel,
      orbit: 0.028,
      fov: 33,
      ease: 'inOutSine',
    }),

  /** a brief, restrained jolt — used once, when a crisis lands */
  emphasise: (channel: CameraChannel, x: number, z: number): void =>
    sendShot(channel, {
      x,
      z,
      distance: 150,
      polar: 0.88,
      travel: 1400,
      shake: 0.35,
      fov: 38,
      ease: 'outQuint',
    }),
}
