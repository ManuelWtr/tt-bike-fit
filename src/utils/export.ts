import type { AppState, UploadedImage } from '../types'
import { angleAtVertex, angleToHorizontal, distance, formatAngle } from './geometry'

// ---------- Export helpers ----------
//
// JSON: full structured state (round-trippable; lets the user save & re-import).
// CSV:  flat summary table — one row per measurement across all images.
// PNG:  the current image with overlay baked in (rendered from canvas).

export function exportJson(state: AppState): string {
  return JSON.stringify(state, null, 2)
}

export function downloadFile(
  filename: string,
  content: string | Blob,
  mime = 'application/octet-stream',
): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoking so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * CSV summary: one row per measurement, with the image's name as context.
 *
 * Columns:
 *   image, measurement, kind, angle_deg, point_labels,
 *   calibration_mm_per_px, mm_estimate (if calibration set & 3-point)
 */
export function exportSummaryCsv(state: AppState): string {
  const header = [
    'image',
    'measurement',
    'kind',
    'angle_deg',
    'point_labels',
    'mm_per_px',
    'limb_length_mm_estimate',
  ]
  const rows: string[][] = [header]

  for (const img of state.images) {
    const mmPerPx = computeMmPerPx(img)
    for (const m of img.measurements) {
      const points = m.pointIds.map((pid) =>
        img.points.find((p) => p.id === pid),
      )
      if (points.some((p) => !p)) continue

      // Recompute on export so the CSV is always consistent with the points.
      let degrees = NaN
      if (m.kind === 'angle3point' && points.length === 3) {
        const [a, b, c] = points as NonNullable<(typeof points)[number]>[]
        degrees = angleAtVertex(
          toPx(a, img),
          toPx(b, img),
          toPx(c, img),
        )
      } else if (m.kind === 'angleToHorizontal' && points.length === 2) {
        const [a, b] = points as NonNullable<(typeof points)[number]>[]
        degrees = angleToHorizontal(toPx(a, img), toPx(b, img))
      }

      // For 3-point: estimate distance vertex->first point if calibration set.
      let mmEstimate = ''
      if (mmPerPx != null && m.kind === 'angle3point' && points.length === 3) {
        const [a, b] = points as NonNullable<(typeof points)[number]>[]
        const px = distance(toPx(a, img), toPx(b, img))
        mmEstimate = (px * mmPerPx).toFixed(1)
      }

      rows.push([
        img.name,
        m.name,
        m.kind,
        Number.isFinite(degrees) ? degrees.toFixed(1) : '',
        points
          .map((p) => p?.label ?? '?')
          .join(' → '),
        mmPerPx != null ? mmPerPx.toFixed(4) : '',
        mmEstimate,
      ])
    }
  }

  return rows.map(escapeCsvRow).join('\n')
}

function escapeCsvRow(row: string[]): string {
  return row
    .map((cell) => {
      if (/[",\n]/.test(cell)) {
        return `"${cell.replace(/"/g, '""')}"`
      }
      return cell
    })
    .join(',')
}

function toPx(
  p: { x: number; y: number },
  img: { width: number; height: number },
) {
  return { x: p.x * img.width, y: p.y * img.height }
}

/** Returns mm-per-pixel if calibration is fully resolvable, else null. */
export function computeMmPerPx(img: UploadedImage): number | null {
  const cal = img.calibration
  if (!cal) return null
  const a = img.points.find((p) => p.id === cal.pointAId)
  const b = img.points.find((p) => p.id === cal.pointBId)
  if (!a || !b) return null
  const px = distance(toPx(a, img), toPx(b, img))
  if (px < 1e-6) return null
  return cal.realLengthMm / px
}

/**
 * Render the active image with all overlays into a PNG. Reuses the same
 * geometry helpers as the on-screen SVG so the exported image matches what
 * the user sees.
 */
export async function exportAnnotatedPng(img: UploadedImage): Promise<Blob> {
  const imgEl = await loadImageElement(img.dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context for PNG export')

  ctx.drawImage(imgEl, 0, 0, img.width, img.height)

  // Scale visual elements with image size so they're readable.
  const baseSize = Math.min(img.width, img.height)
  const lineWidth = Math.max(2, baseSize * 0.004)
  const pointRadius = Math.max(4, baseSize * 0.007)
  const fontPx = Math.max(14, baseSize * 0.025)

  ctx.lineWidth = lineWidth
  ctx.font = `bold ${fontPx}px system-ui, -apple-system, sans-serif`
  ctx.textBaseline = 'middle'

  for (const m of img.measurements) {
    const points = m.pointIds
      .map((pid) => img.points.find((p) => p.id === pid))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => toPx(p, img))
    if (points.length < 2) continue

    ctx.strokeStyle = m.color
    ctx.fillStyle = m.color

    // Polyline through the points.
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
    ctx.stroke()

    // Reference horizontal line for torso angle.
    if (m.kind === 'angleToHorizontal' && points.length === 2) {
      const v = points[0]
      const length = Math.hypot(
        points[1].x - v.x,
        points[1].y - v.y,
      )
      ctx.save()
      ctx.setLineDash([lineWidth * 4, lineWidth * 3])
      ctx.beginPath()
      ctx.moveTo(v.x, v.y)
      ctx.lineTo(v.x + length, v.y)
      ctx.stroke()
      ctx.restore()
    }

    // Angle label, near the vertex.
    let degrees = NaN
    let vertex = points[0]
    if (m.kind === 'angle3point' && points.length === 3) {
      vertex = points[1]
      degrees = angleAtVertex(points[0], points[1], points[2])
    } else if (m.kind === 'angleToHorizontal' && points.length === 2) {
      degrees = angleToHorizontal(points[0], points[1])
    }

    if (Number.isFinite(degrees)) {
      const label = `${m.name}: ${formatAngle(degrees)}`
      const padding = fontPx * 0.5
      const textWidth = ctx.measureText(label).width
      const boxX = vertex.x + fontPx * 0.8
      const boxY = vertex.y - fontPx * 0.7
      const rectX = boxX - padding
      const rectY = boxY - fontPx / 2 - padding / 2
      const rectW = textWidth + padding * 2
      const rectH = fontPx + padding
      // White card with the measurement-colored border, like on the canvas.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
      ctx.fillRect(rectX, rectY, rectW, rectH)
      ctx.strokeStyle = m.color
      ctx.lineWidth = Math.max(1, lineWidth * 0.6)
      ctx.strokeRect(rectX, rectY, rectW, rectH)
      ctx.lineWidth = lineWidth
      ctx.fillStyle = m.color
      ctx.fillText(label, boxX, boxY)
    }

    // Markers for each point — dark ring + white core, matches on-screen.
    for (const p of points) {
      ctx.fillStyle = '#1f1d1a'
      ctx.beginPath()
      ctx.arc(p.x, p.y, pointRadius, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = Math.max(1, lineWidth * 0.5)
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(p.x, p.y, pointRadius * 0.42, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = lineWidth
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to encode PNG'))
    }, 'image/png')
  })
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image for export'))
    img.src = src
  })
}
