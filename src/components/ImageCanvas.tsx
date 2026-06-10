import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { LandmarkPoint, Measurement, UploadedImage } from '../types'
import {
  angleAtVertex,
  angleToHorizontal,
  arcPath,
  bisectorUnit,
  formatAngle,
} from '../utils/geometry'

// ---------- Canvas ----------
//
// SVG-based viewer with viewBox-driven zoom/pan, draggable point markers,
// and live-recomputed angle overlays. All point coordinates round-trip
// through normalized (0..1) space so they survive image switches & resizes.

export interface WizardState {
  // Color used for the in-progress overlay so it matches the future measurement.
  color: string
  // What labels we've collected so far (for showing "Click hip", "Click knee"…)
  placedLabels: string[]
  /** Label of the next landmark to place, or null if done. */
  nextLabel: string | null
  /** Click positions already collected, in normalized (0..1) coords. */
  placedCoords: { x: number; y: number }[]
}

export interface CanvasViewControls {
  zoomIn: () => void
  zoomOut: () => void
  resetView: () => void
}

interface ImageCanvasProps {
  image: UploadedImage
  /** When set, the canvas is in wizard mode: clicks place points. */
  wizard: WizardState | null
  onWizardClick: (normX: number, normY: number) => void
  onPointMove: (pointId: string, normX: number, normY: number) => void
  onPointRemove: (pointId: string) => void
  selectedMeasurementId: string | null
  onSelectMeasurement: (measurementId: string | null) => void
  /**
   * Imperative handle for the parent toolbar buttons. Wired up via a ref
   * callback because the parent needs to drive zoom/reset.
   */
  controlsRef?: (controls: CanvasViewControls) => void
}

const ZOOM_STEP = 1.25
const MIN_ZOOM = 0.1
const MAX_ZOOM = 50
const POINT_HIT_RADIUS_PX = 12
const POINT_VISUAL_RADIUS_PX = 7
const CLICK_DRAG_THRESHOLD_PX = 4

export function ImageCanvas({
  image,
  wizard,
  onWizardClick,
  onPointMove,
  onPointRemove,
  selectedMeasurementId,
  onSelectMeasurement,
  controlsRef,
}: ImageCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // viewBox is in image-pixel coordinates.
  const [viewBox, setViewBox] = useState(() => ({
    x: 0,
    y: 0,
    w: image.width,
    h: image.height,
  }))

  // Reset view whenever the image changes.
  useLayoutEffect(() => {
    setViewBox({ x: 0, y: 0, w: image.width, h: image.height })
  }, [image.id, image.width, image.height])

  // Container size (used to derive image-px-per-screen-px). State, not a
  // ref, so the canvas re-renders with correct visual sizes after first
  // layout and on window resize.
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  // Pointer interaction state ------------------------------------------------
  const interaction = useRef<
    | { kind: 'idle' }
    | {
        kind: 'maybeClick'
        startClientX: number
        startClientY: number
        startViewBox: typeof viewBox
        pointerId: number
      }
    | {
        kind: 'panning'
        lastImgX: number
        lastImgY: number
        pointerId: number
      }
    | {
        kind: 'draggingPoint'
        pointId: string
        pointerId: number
      }
  >({ kind: 'idle' })

  // ---- helpers ----

  const screenToImage = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const svg = svgRef.current
      if (!svg) return null
      const ctm = svg.getScreenCTM()
      if (!ctm) return null
      const pt = svg.createSVGPoint()
      pt.x = clientX
      pt.y = clientY
      const local = pt.matrixTransform(ctm.inverse())
      return { x: local.x, y: local.y }
    },
    [],
  )

  // ---- imperative view controls exposed to parent ----

  const zoomBy = useCallback(
    (factor: number, anchorImgX?: number, anchorImgY?: number) => {
      setViewBox((vb) => {
        const newW = vb.w / factor
        const newH = vb.h / factor
        const minVbW = image.width / MAX_ZOOM
        const maxVbW = image.width / MIN_ZOOM
        if (newW < minVbW || newW > maxVbW) return vb
        const ax = anchorImgX ?? vb.x + vb.w / 2
        const ay = anchorImgY ?? vb.y + vb.h / 2
        return {
          x: ax - (ax - vb.x) / factor,
          y: ay - (ay - vb.y) / factor,
          w: newW,
          h: newH,
        }
      })
    },
    [image.width],
  )

  useEffect(() => {
    if (!controlsRef) return
    controlsRef({
      zoomIn: () => zoomBy(ZOOM_STEP),
      zoomOut: () => zoomBy(1 / ZOOM_STEP),
      resetView: () =>
        setViewBox({ x: 0, y: 0, w: image.width, h: image.height }),
    })
  }, [controlsRef, image.width, image.height, zoomBy])

  // ---- pointer handlers ----

  const onPointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // Right click: ignore (let context menu happen / do nothing).
      if (e.button !== 0) return
      const target = e.target as SVGElement
      const pointEl = target.closest('[data-point-id]')
      if (pointEl) {
        const pointId = pointEl.getAttribute('data-point-id')!
        ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
        interaction.current = {
          kind: 'draggingPoint',
          pointId,
          pointerId: e.pointerId,
        }
        return
      }
      // Otherwise: maybe a click (to place wizard point or deselect), maybe a pan.
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      interaction.current = {
        kind: 'maybeClick',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startViewBox: viewBox,
        pointerId: e.pointerId,
      }
    },
    [viewBox],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const st = interaction.current
      if (st.kind === 'idle') return

      if (st.kind === 'maybeClick') {
        const dx = e.clientX - st.startClientX
        const dy = e.clientY - st.startClientY
        if (Math.hypot(dx, dy) > CLICK_DRAG_THRESHOLD_PX) {
          // Promote to pan.
          const imgPt = screenToImage(e.clientX, e.clientY)
          if (imgPt) {
            interaction.current = {
              kind: 'panning',
              lastImgX: imgPt.x,
              lastImgY: imgPt.y,
              pointerId: st.pointerId,
            }
          }
        }
        return
      }

      if (st.kind === 'panning') {
        const imgPt = screenToImage(e.clientX, e.clientY)
        if (!imgPt) return
        const dx = imgPt.x - st.lastImgX
        const dy = imgPt.y - st.lastImgY
        setViewBox((vb) => ({
          x: vb.x - dx,
          y: vb.y - dy,
          w: vb.w,
          h: vb.h,
        }))
        // After updating viewBox, the same client position maps to a new image
        // point; recompute relative to the NEW viewBox so we don't drift.
        const after = screenToImage(e.clientX, e.clientY)
        if (after) {
          interaction.current = {
            ...st,
            lastImgX: after.x,
            lastImgY: after.y,
          }
        }
        return
      }

      if (st.kind === 'draggingPoint') {
        const imgPt = screenToImage(e.clientX, e.clientY)
        if (!imgPt) return
        onPointMove(
          st.pointId,
          imgPt.x / image.width,
          imgPt.y / image.height,
        )
      }
    },
    [image.width, image.height, onPointMove, screenToImage],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const st = interaction.current
      interaction.current = { kind: 'idle' }
      try {
        ;(e.currentTarget as Element).releasePointerCapture(e.pointerId)
      } catch {
        /* ignore — pointer may already be released */
      }
      if (st.kind === 'maybeClick') {
        // It was a click (no significant movement).
        const imgPt = screenToImage(e.clientX, e.clientY)
        if (!imgPt) return
        if (wizard && wizard.nextLabel) {
          const nx = imgPt.x / image.width
          const ny = imgPt.y / image.height
          if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
            onWizardClick(nx, ny)
          }
        } else {
          // Click on empty area — deselect.
          onSelectMeasurement(null)
        }
      }
    },
    [image.width, image.height, onSelectMeasurement, onWizardClick, screenToImage, wizard],
  )

  // ---- wheel zoom ----

  // We use a native (non-passive) wheel listener so we can preventDefault and
  // stop the page scrolling under the canvas. React's synthetic onWheel is
  // attached as passive in some browsers, so this is the safe approach.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const imgPt = screenToImage(e.clientX, e.clientY)
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      zoomBy(factor, imgPt?.x, imgPt?.y)
    }
    svg.addEventListener('wheel', handler, { passive: false })
    return () => svg.removeEventListener('wheel', handler)
  }, [screenToImage, zoomBy])

  // Observe container size so visual element sizes stay constant in screen
  // pixels regardless of zoom or window resize.
  useLayoutEffect(() => {
    const c = containerRef.current
    if (!c) return
    const measure = () => {
      const rect = c.getBoundingClientRect()
      setContainerSize((prev) =>
        Math.abs(prev.w - rect.width) > 0.5 || Math.abs(prev.h - rect.height) > 0.5
          ? { w: rect.width, h: rect.height }
          : prev,
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(c)
    return () => ro.disconnect()
  }, [])

  // ---- keyboard: Delete removes selected measurement's points if focused on canvas ----
  // (Per-point delete is exposed via right-click handler below + sidebar.)

  // ---- render ----

  // image-px-per-screen-px. preserveAspectRatio="meet" → use the max ratio.
  const pxToImg =
    containerSize.w > 0 && containerSize.h > 0
      ? Math.max(viewBox.w / containerSize.w, viewBox.h / containerSize.h)
      : 1

  const measurementsToRender = useMemo(
    () => image.measurements.map((m) => withResolvedPoints(m, image)),
    [image],
  )

  const cursorStyle = (() => {
    if (wizard?.nextLabel) return 'crosshair'
    if (interaction.current.kind === 'panning') return 'grabbing'
    return 'grab'
  })()

  return (
    <div ref={containerRef} className="canvas-host">
      <svg
        ref={svgRef}
        className="image-canvas"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ cursor: cursorStyle }}
      >
        <image
          href={image.dataUrl}
          x={0}
          y={0}
          width={image.width}
          height={image.height}
          preserveAspectRatio="none"
        />

        {/* Existing measurement overlays */}
        {measurementsToRender.map((m) => (
          <MeasurementOverlay
            key={m.id}
            data={m}
            selected={m.id === selectedMeasurementId}
            pxToImg={pxToImg}
            onSelect={() => onSelectMeasurement(m.id)}
          />
        ))}

        {/* All placed points (draggable) */}
        {image.points.map((p) => (
          <PointMarker
            key={p.id}
            point={p}
            imageWidth={image.width}
            imageHeight={image.height}
            pxToImg={pxToImg}
            onContextMenu={(e) => {
              e.preventDefault()
              onPointRemove(p.id)
            }}
          />
        ))}

        {/* In-progress wizard overlay: ghosts for already-placed points */}
        {wizard && wizard.placedCoords.length > 0 && (
          <g>
            {wizard.placedCoords.map((c, i) => (
              <g key={i}>
                <circle
                  cx={c.x * image.width}
                  cy={c.y * image.height}
                  r={POINT_VISUAL_RADIUS_PX * pxToImg}
                  fill={wizard.color}
                  fillOpacity={0.5}
                  stroke="white"
                  strokeWidth={2 * pxToImg}
                />
                {i > 0 && (
                  <line
                    x1={wizard.placedCoords[i - 1].x * image.width}
                    y1={wizard.placedCoords[i - 1].y * image.height}
                    x2={c.x * image.width}
                    y2={c.y * image.height}
                    stroke={wizard.color}
                    strokeWidth={2 * pxToImg}
                    strokeDasharray={`${6 * pxToImg} ${4 * pxToImg}`}
                  />
                )}
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}

// ---------- measurement overlay ----------

interface ResolvedMeasurement {
  id: string
  name: string
  kind: Measurement['kind']
  color: string
  /** Resolved point coordinates in image-pixel space. May be shorter than expected if a point is missing. */
  pts: { id: string; x: number; y: number; label: string }[]
}

function withResolvedPoints(
  m: Measurement,
  img: UploadedImage,
): ResolvedMeasurement {
  const pts = m.pointIds
    .map((pid) => img.points.find((p) => p.id === pid))
    .filter((p): p is LandmarkPoint => Boolean(p))
    .map((p) => ({
      id: p.id,
      x: p.x * img.width,
      y: p.y * img.height,
      label: p.label,
    }))
  return { id: m.id, name: m.name, kind: m.kind, color: m.color, pts }
}

interface MeasurementOverlayProps {
  data: ResolvedMeasurement
  selected: boolean
  pxToImg: number
  onSelect: () => void
}

function MeasurementOverlay({
  data,
  selected,
  pxToImg,
  onSelect,
}: MeasurementOverlayProps) {
  const { color, pts, kind, name } = data
  if (pts.length < 2) return null

  const strokeWidth = (selected ? 3 : 2) * pxToImg
  const labelFontPx = 16 * pxToImg
  const arcRadiusPx = 36 * pxToImg

  // Determine vertex + angle.
  let vertex = pts[0]
  let degrees = NaN
  let arc = ''
  // For angleToHorizontal we draw a virtual horizontal "ray" from vertex.
  let horizontalEnd: { x: number; y: number } | null = null

  if (kind === 'angle3point' && pts.length === 3) {
    vertex = pts[1]
    degrees = angleAtVertex(pts[0], pts[1], pts[2])
    if (Number.isFinite(degrees)) {
      arc = arcPath(pts[1], pts[0], pts[2], arcRadiusPx)
    }
  } else if (kind === 'angleToHorizontal' && pts.length === 2) {
    vertex = pts[0]
    degrees = angleToHorizontal(pts[0], pts[1])
    // Place the horizontal ray going in the same general x-direction as pts[1].
    const dir = pts[1].x >= pts[0].x ? 1 : -1
    const refLen = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1
    horizontalEnd = { x: vertex.x + dir * refLen, y: vertex.y }
    if (Number.isFinite(degrees)) {
      arc = arcPath(vertex, horizontalEnd, pts[1], arcRadiusPx)
    }
  }

  // Label position: push out along bisector (3-point) or perpendicular for 2-point.
  let labelPos = { x: vertex.x + 30 * pxToImg, y: vertex.y - 20 * pxToImg }
  if (kind === 'angle3point' && pts.length === 3) {
    const bis = bisectorUnit(pts[0], pts[1], pts[2])
    labelPos = {
      x: vertex.x + bis.x * (arcRadiusPx + 20 * pxToImg),
      y: vertex.y + bis.y * (arcRadiusPx + 20 * pxToImg),
    }
  } else if (horizontalEnd) {
    const bis = bisectorUnit(horizontalEnd, vertex, pts[1])
    labelPos = {
      x: vertex.x + bis.x * (arcRadiusPx + 20 * pxToImg),
      y: vertex.y + bis.y * (arcRadiusPx + 20 * pxToImg),
    }
  }

  const labelText = `${name}: ${formatAngle(degrees)}`

  return (
    <g
      onPointerDown={(e) => {
        // Don't pan if the user clicks on the polyline itself.
        e.stopPropagation()
        onSelect()
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* Polyline through the points */}
      <polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={selected ? 1 : 0.9}
      />

      {/* Horizontal reference for torso-type angle */}
      {horizontalEnd && (
        <line
          x1={vertex.x}
          y1={vertex.y}
          x2={horizontalEnd.x}
          y2={horizontalEnd.y}
          stroke={color}
          strokeWidth={strokeWidth * 0.7}
          strokeDasharray={`${8 * pxToImg} ${5 * pxToImg}`}
          opacity={0.8}
        />
      )}

      {/* Angle arc at vertex */}
      {arc && (
        <path
          d={arc}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={0.9}
        />
      )}

      {/* Angle label */}
      {Number.isFinite(degrees) && (
        <AngleLabel
          x={labelPos.x}
          y={labelPos.y}
          text={labelText}
          color={color}
          fontPx={labelFontPx}
        />
      )}
    </g>
  )
}

interface AngleLabelProps {
  x: number
  y: number
  text: string
  color: string
  fontPx: number
}

function AngleLabel({ x, y, text, color, fontPx }: AngleLabelProps) {
  // SVG <text> can't have a background — we draw a rect behind it sized
  // approximately to the text. Width estimate: 0.6 * fontPx per character.
  const charW = fontPx * 0.6
  const w = Math.max(text.length * charW, 30)
  const h = fontPx * 1.4
  const padX = fontPx * 0.4
  return (
    <g pointerEvents="none">
      <rect
        x={x - padX}
        y={y - h / 2}
        width={w + padX * 2}
        height={h}
        rx={fontPx * 0.3}
        fill="rgba(10, 14, 26, 0.85)"
      />
      <text
        x={x}
        y={y}
        fill={color}
        fontSize={fontPx}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontWeight={600}
        dominantBaseline="middle"
      >
        {text}
      </text>
    </g>
  )
}

// ---------- point marker ----------

interface PointMarkerProps {
  point: LandmarkPoint
  imageWidth: number
  imageHeight: number
  pxToImg: number
  onContextMenu: (e: React.MouseEvent) => void
}

function PointMarker({
  point,
  imageWidth,
  imageHeight,
  pxToImg,
  onContextMenu,
}: PointMarkerProps) {
  const cx = point.x * imageWidth
  const cy = point.y * imageHeight
  const r = POINT_VISUAL_RADIUS_PX * pxToImg
  const hitR = POINT_HIT_RADIUS_PX * pxToImg
  const labelFontPx = 12 * pxToImg

  return (
    <g data-point-id={point.id} onContextMenu={onContextMenu}>
      {/* Hit target (transparent, larger than the visible circle for easy grabbing) */}
      <circle
        cx={cx}
        cy={cy}
        r={hitR}
        fill="transparent"
        style={{ cursor: 'grab' }}
      />
      {/* Visible marker */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="#ffffff"
        stroke="#0a0e1a"
        strokeWidth={2 * pxToImg}
      />
      <circle cx={cx} cy={cy} r={r * 0.4} fill="#0a0e1a" />
      {/* Label slightly above-right */}
      <text
        x={cx + r + 4 * pxToImg}
        y={cy - r - 2 * pxToImg}
        fontSize={labelFontPx}
        fill="#f1f5f9"
        stroke="#0a0e1a"
        strokeWidth={3 * pxToImg}
        paintOrder="stroke"
        fontFamily="system-ui, -apple-system, sans-serif"
        pointerEvents="none"
      >
        {point.label}
      </text>
    </g>
  )
}
