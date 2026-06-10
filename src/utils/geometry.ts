// ---------- Geometry utilities ----------
//
// All angle math lives here so it stays trivially testable and reusable.
// Inputs and outputs are plain numbers — no React, no DOM.
//
// Coordinate convention: x to the right, y DOWNWARDS (matches SVG / image
// coordinates). Angles in degrees, in [0, 180] for vertex angles.

export interface Vec2 {
  x: number
  y: number
}

const EPS = 1e-9

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/**
 * Angle at vertex B given three points A-B-C. Returns degrees in [0, 180].
 * Returns NaN if either arm has zero length.
 */
export function angleAtVertex(a: Vec2, b: Vec2, c: Vec2): number {
  const ba = { x: a.x - b.x, y: a.y - b.y }
  const bc = { x: c.x - b.x, y: c.y - b.y }
  const magBA = Math.hypot(ba.x, ba.y)
  const magBC = Math.hypot(bc.x, bc.y)
  if (magBA < EPS || magBC < EPS) return NaN
  const dot = ba.x * bc.x + ba.y * bc.y
  const cos = clamp(dot / (magBA * magBC), -1, 1)
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * Acute angle between the line A->B and the horizontal axis.
 * Returns degrees in [0, 90]. NaN if A and B coincide.
 *
 * Used for torso angle: "how flat is the torso?" — 0° = perfectly horizontal,
 * 90° = perfectly vertical, regardless of which way the rider is facing.
 */
export function angleToHorizontal(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return NaN
  return (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI
}

/**
 * SVG path `d` for an arc drawn at `vertex`, sweeping from the direction of
 * `a` to the direction of `c`. The arc takes the short way around (always the
 * inner angle, matching what `angleAtVertex` measures).
 */
export function arcPath(
  vertex: Vec2,
  a: Vec2,
  c: Vec2,
  radius: number,
): string {
  const angA = Math.atan2(a.y - vertex.y, a.x - vertex.x)
  const angC = Math.atan2(c.y - vertex.y, c.x - vertex.x)

  // Pick the shortest angular delta from angA to angC.
  let delta = angC - angA
  while (delta > Math.PI) delta -= 2 * Math.PI
  while (delta < -Math.PI) delta += 2 * Math.PI

  const startX = vertex.x + radius * Math.cos(angA)
  const startY = vertex.y + radius * Math.sin(angA)
  const endX = vertex.x + radius * Math.cos(angC)
  const endY = vertex.y + radius * Math.sin(angC)

  // largeArc=0 because |delta| <= 180°. sweep direction depends on sign of delta.
  const sweep = delta > 0 ? 1 : 0
  return `M ${startX} ${startY} A ${radius} ${radius} 0 0 ${sweep} ${endX} ${endY}`
}

/**
 * Midpoint between two points, useful for label placement.
 */
export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/**
 * Bisector direction (unit vector) at vertex B between BA and BC.
 * Used to push the angle label outward along the bisector so it doesn't
 * sit on top of the lines.
 */
export function bisectorUnit(a: Vec2, b: Vec2, c: Vec2): Vec2 {
  const ba = unit({ x: a.x - b.x, y: a.y - b.y })
  const bc = unit({ x: c.x - b.x, y: c.y - b.y })
  const sum = { x: ba.x + bc.x, y: ba.y + bc.y }
  const mag = Math.hypot(sum.x, sum.y)
  if (mag < EPS) {
    // BA and BC are exactly opposite — fall back to perpendicular of BA.
    return { x: -ba.y, y: ba.x }
  }
  return { x: sum.x / mag, y: sum.y / mag }
}

function unit(v: Vec2): Vec2 {
  const m = Math.hypot(v.x, v.y)
  if (m < EPS) return { x: 0, y: 0 }
  return { x: v.x / m, y: v.y / m }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * Format an angle (degrees) for display. NaN renders as "—".
 */
export function formatAngle(deg: number | null | undefined): string {
  if (deg == null || !Number.isFinite(deg)) return '—'
  return `${deg.toFixed(1)}°`
}
