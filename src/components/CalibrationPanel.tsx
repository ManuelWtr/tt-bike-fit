import { useEffect, useState } from 'react'
import type { Calibration, UploadedImage } from '../types'
import { computeMmPerPx } from '../utils/export'

interface CalibrationPanelProps {
  image: UploadedImage
  onChange: (cal: Calibration | null) => void
}

/**
 * Optional pixel↔mm scaling. The user picks two existing landmarks (e.g.
 * pedal spindle + bottom bracket) and types in the real-world distance
 * between them (e.g. crank length 172.5 mm). Angles still work without
 * calibration — this just unlocks mm distance estimates in the CSV export.
 */
export function CalibrationPanel({ image, onChange }: CalibrationPanelProps) {
  const cal = image.calibration

  const [aId, setAId] = useState(cal?.pointAId ?? '')
  const [bId, setBId] = useState(cal?.pointBId ?? '')
  const [mm, setMm] = useState(cal ? String(cal.realLengthMm) : '172.5')

  // Keep local form state in sync when the underlying image changes.
  useEffect(() => {
    setAId(cal?.pointAId ?? '')
    setBId(cal?.pointBId ?? '')
    setMm(cal ? String(cal.realLengthMm) : '172.5')
  }, [image.id, cal?.pointAId, cal?.pointBId, cal?.realLengthMm])

  const valid =
    aId &&
    bId &&
    aId !== bId &&
    image.points.some((p) => p.id === aId) &&
    image.points.some((p) => p.id === bId) &&
    Number.isFinite(parseFloat(mm)) &&
    parseFloat(mm) > 0

  const mmPerPx = computeMmPerPx(image)

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Calibration (optional)</h2>
      </header>

      {image.points.length < 2 ? (
        <p className="muted">
          Place at least two points (via measurements) before calibrating.
        </p>
      ) : (
        <>
          <p className="muted">
            Pick two points with a known real-world distance (e.g. pedal
            spindle ↔ bottom bracket = crank length). Angles work without this.
          </p>
          <div className="form-row">
            <label>
              Point A
              <select
                value={aId}
                onChange={(e) => setAId(e.target.value)}
                className="select"
              >
                <option value="">—</option>
                {image.points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Point B
              <select
                value={bId}
                onChange={(e) => setBId(e.target.value)}
                className="select"
              >
                <option value="">—</option>
                {image.points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="form-stack">
            Real distance (mm)
            <input
              type="number"
              min="0"
              step="0.1"
              value={mm}
              onChange={(e) => setMm(e.target.value)}
              className="text-input"
            />
          </label>

          {mmPerPx != null && (
            <div className="kv">
              <span>Scale</span>
              <span>{mmPerPx.toFixed(4)} mm/px</span>
            </div>
          )}

          <div className="button-row">
            <button
              type="button"
              className="btn"
              disabled={!valid}
              onClick={() => {
                if (!valid) return
                onChange({
                  pointAId: aId,
                  pointBId: bId,
                  realLengthMm: parseFloat(mm),
                })
              }}
            >
              {cal ? 'Update calibration' : 'Set calibration'}
            </button>
            {cal && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onChange(null)}
              >
                Remove
              </button>
            )}
          </div>
        </>
      )}
    </section>
  )
}
