import type { MeasurementPreset } from '../types'
import { PRESETS } from '../constants/presets'

export interface WizardSession {
  preset: MeasurementPreset
  placedCoords: { x: number; y: number }[]
}

interface MeasurementWizardProps {
  /** Active wizard session, or null if no measurement is being added. */
  session: WizardSession | null
  /** True if there is an active image so wizard can be started. */
  hasActiveImage: boolean
  onStart: (preset: MeasurementPreset) => void
  onUndo: () => void
  onCancel: () => void
}

export function MeasurementWizard({
  session,
  hasActiveImage,
  onStart,
  onUndo,
  onCancel,
}: MeasurementWizardProps) {
  if (session) {
    const { preset, placedCoords } = session
    const nextIdx = placedCoords.length
    const nextSlot = preset.landmarks[nextIdx] ?? null

    return (
      <section className="panel panel--accent">
        <header className="panel__header">
          <h2>Adding: {preset.name}</h2>
        </header>
        <p className="muted">{preset.description}</p>

        <ol className="step-list">
          {preset.landmarks.map((slot, i) => {
            const state =
              i < nextIdx ? 'done' : i === nextIdx ? 'current' : 'pending'
            return (
              <li key={i} className={`step-list__item is-${state}`}>
                <span className="step-list__dot">
                  {state === 'done' ? '✓' : i + 1}
                </span>
                <div className="step-list__body">
                  <div className="step-list__label">{slot.label}</div>
                  {state === 'current' && (
                    <div className="step-list__hint">{slot.instruction}</div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>

        {nextSlot && (
          <div className="banner">
            Click on the image to place <strong>{nextSlot.label}</strong>.
          </div>
        )}

        <div className="button-row">
          <button
            type="button"
            className="btn"
            onClick={onUndo}
            disabled={placedCoords.length === 0}
          >
            Undo last
          </button>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Add measurement</h2>
      </header>
      {!hasActiveImage && (
        <p className="muted">Select an image to add measurements.</p>
      )}
      <ul className="preset-list">
        {PRESETS.map((preset) => (
          <li key={preset.id}>
            <button
              type="button"
              className="preset-button"
              onClick={() => onStart(preset)}
              disabled={!hasActiveImage}
            >
              <span
                className="preset-button__swatch"
                style={{ background: preset.color }}
                aria-hidden
              />
              <span className="preset-button__body">
                <span className="preset-button__name">{preset.name}</span>
                <span className="preset-button__desc">{preset.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
