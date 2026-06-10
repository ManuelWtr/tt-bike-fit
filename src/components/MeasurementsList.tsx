import { useState } from 'react'
import type { UploadedImage } from '../types'
import {
  angleAtVertex,
  angleToHorizontal,
  formatAngle,
} from '../utils/geometry'

interface MeasurementsListProps {
  image: UploadedImage
  selectedMeasurementId: string | null
  onSelectMeasurement: (id: string | null) => void
  onRemoveMeasurement: (id: string) => void
  onRenameMeasurement: (id: string, name: string) => void
  onRemovePoint: (id: string) => void
}

/**
 * Lists all measurements on the active image with their live-computed angles
 * and the points that compose them.
 */
export function MeasurementsList({
  image,
  selectedMeasurementId,
  onSelectMeasurement,
  onRemoveMeasurement,
  onRenameMeasurement,
  onRemovePoint,
}: MeasurementsListProps) {
  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Measurements</h2>
        <span className="panel__count">{image.measurements.length}</span>
      </header>

      {image.measurements.length === 0 ? (
        <p className="muted">
          No measurements yet. Pick a preset above and click landmarks on the
          image to add one.
        </p>
      ) : (
        <ul className="measurements-list">
          {image.measurements.map((m) => (
            <MeasurementCard
              key={m.id}
              image={image}
              measurementId={m.id}
              selected={m.id === selectedMeasurementId}
              onSelect={() =>
                onSelectMeasurement(
                  m.id === selectedMeasurementId ? null : m.id,
                )
              }
              onRemove={() => onRemoveMeasurement(m.id)}
              onRename={(name) => onRenameMeasurement(m.id, name)}
              onRemovePoint={onRemovePoint}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface MeasurementCardProps {
  image: UploadedImage
  measurementId: string
  selected: boolean
  onSelect: () => void
  onRemove: () => void
  onRename: (name: string) => void
  onRemovePoint: (id: string) => void
}

function MeasurementCard({
  image,
  measurementId,
  selected,
  onSelect,
  onRemove,
  onRename,
  onRemovePoint,
}: MeasurementCardProps) {
  // NOTE: hooks must be declared before any early return so render order
  // stays stable. The MeasurementCard is keyed by `measurementId` in the
  // parent list, so in practice it unmounts when its measurement is deleted
  // — but we follow the Rules of Hooks anyway.
  const m = image.measurements.find((x) => x.id === measurementId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(m?.name ?? '')
  if (!m) return null

  const pts = m.pointIds
    .map((pid) => image.points.find((p) => p.id === pid))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({ ...p, px: p.x * image.width, py: p.y * image.height }))

  let degrees = NaN
  if (m.kind === 'angle3point' && pts.length === 3) {
    degrees = angleAtVertex(
      { x: pts[0].px, y: pts[0].py },
      { x: pts[1].px, y: pts[1].py },
      { x: pts[2].px, y: pts[2].py },
    )
  } else if (m.kind === 'angleToHorizontal' && pts.length === 2) {
    degrees = angleToHorizontal(
      { x: pts[0].px, y: pts[0].py },
      { x: pts[1].px, y: pts[1].py },
    )
  }

  const submitName = () => {
    const next = draft.trim()
    if (next && next !== m.name) onRename(next)
    setEditing(false)
  }

  return (
    <li
      className={
        'measurement-card ' + (selected ? 'is-selected' : '')
      }
      style={{ borderLeftColor: m.color }}
      onClick={onSelect}
    >
      <div className="measurement-card__head">
        <span
          className="measurement-card__swatch"
          style={{ background: m.color }}
          aria-hidden
        />
        {editing ? (
          <input
            className="text-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submitName}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitName()
              if (e.key === 'Escape') {
                setDraft(m.name)
                setEditing(false)
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="measurement-card__name"
            onClick={(e) => {
              e.stopPropagation()
              setEditing(true)
            }}
            title="Click to rename"
          >
            {m.name}
          </button>
        )}
        <strong className="measurement-card__angle">
          {formatAngle(degrees)}
        </strong>
        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={(e) => {
            e.stopPropagation()
            if (confirm(`Delete measurement "${m.name}"?`)) onRemove()
          }}
          aria-label="Delete measurement"
          title="Delete measurement"
        >
          ×
        </button>
      </div>
      <ul className="measurement-card__points">
        {pts.map((p) => (
          <li key={p.id}>
            <span className="measurement-card__point-label">{p.label}</span>
            <span className="measurement-card__point-coord">
              ({(p.x * 100).toFixed(1)}%, {(p.y * 100).toFixed(1)}%)
            </span>
            <button
              type="button"
              className="icon-button"
              onClick={(e) => {
                e.stopPropagation()
                if (
                  confirm(
                    `Delete point "${p.label}"? This will also delete the measurement.`,
                  )
                ) {
                  onRemovePoint(p.id)
                }
              }}
              aria-label="Delete point"
              title="Delete point (also deletes this measurement)"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </li>
  )
}
