/**
 * Tiny grid-following agent used for both vehicles and pedestrians.
 * Everything is plain numbers so thousands of agents can be advanced in a
 * single loop and written straight into an InstancedMesh.
 */
export interface GridAgent {
  /** 0 = travelling along X, 1 = travelling along Z */
  axis: 0 | 1
  /** the grid line the agent is on (world coordinate of the other axis) */
  fixed: number
  /** position along the travel axis */
  pos: number
  dir: 1 | -1
  speed: number
  lane: number
  variant: number
  /** pinned to a scheduled route — never turns off it */
  locked?: boolean
}

export function makeAgents(
  n: number,
  gridPositions: number[],
  opts: {
    rnd: () => number
    speed: [number, number]
    lane: number
    /** restrict to these grid-line indices (e.g. arterials only) */
    lines?: number[]
  },
): GridAgent[] {
  const lines = opts.lines ?? gridPositions.map((_, i) => i)
  const out: GridAgent[] = []
  const span = gridPositions[gridPositions.length - 1] - gridPositions[0]
  for (let i = 0; i < n; i++) {
    const li = lines[Math.floor(opts.rnd() * lines.length)]
    out.push({
      axis: opts.rnd() < 0.5 ? 0 : 1,
      fixed: gridPositions[li],
      pos: gridPositions[0] + opts.rnd() * span,
      dir: opts.rnd() < 0.5 ? 1 : -1,
      speed: opts.speed[0] + opts.rnd() * (opts.speed[1] - opts.speed[0]),
      lane: opts.lane,
      variant: Math.floor(opts.rnd() * 1000),
    })
  }
  return out
}

export function stepAgent(
  a: GridAgent,
  dt: number,
  gridPositions: number[],
  bounds: number,
  turnProb: number,
  rnd: () => number,
) {
  const delta = a.dir * a.speed * dt
  const next = a.pos + delta

  if (turnProb > 0 && !a.locked) {
    for (let i = 0; i < gridPositions.length; i++) {
      const v = gridPositions[i]
      const crossed = a.dir > 0 ? a.pos < v && next >= v : a.pos > v && next <= v
      if (!crossed) continue
      if (rnd() < turnProb) {
        const nextAxis: 0 | 1 = a.axis === 0 ? 1 : 0
        const newFixed = v
        const newPos = a.fixed
        a.axis = nextAxis
        a.fixed = newFixed
        a.pos = newPos
        a.dir = rnd() < 0.5 ? 1 : -1
        return
      }
      break
    }
  }

  const edge = bounds + 3
  if (next > edge) a.pos = -edge
  else if (next < -edge) a.pos = edge
  else a.pos = next
}

/** world position + heading for an agent */
export function agentTransform(a: GridAgent) {
  if (a.axis === 0) {
    return {
      x: a.pos,
      z: a.fixed + a.dir * a.lane,
      rotY: a.dir > 0 ? 0 : Math.PI,
    }
  }
  return {
    x: a.fixed - a.dir * a.lane,
    z: a.pos,
    rotY: a.dir > 0 ? -Math.PI / 2 : Math.PI / 2,
  }
}
