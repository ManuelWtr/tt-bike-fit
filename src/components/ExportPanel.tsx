import { useState } from 'react'
import type { AppState, UploadedImage } from '../types'
import {
  downloadFile,
  exportAnnotatedPng,
  exportJson,
  exportSummaryCsv,
} from '../utils/export'

interface ExportPanelProps {
  state: AppState
  activeImage: UploadedImage | null
  onReset: () => void
}

/**
 * Exports:
 *   - JSON: full state (round-trippable; future "import" hook lives here).
 *   - CSV: flat summary table of every measurement across all images.
 *   - PNG: the current image with all overlays baked in.
 */
export function ExportPanel({ state, activeImage, onReset }: ExportPanelProps) {
  const [busy, setBusy] = useState<null | 'png'>(null)
  const [err, setErr] = useState<string | null>(null)

  const handlePng = async () => {
    if (!activeImage) return
    setBusy('png')
    setErr(null)
    try {
      const blob = await exportAnnotatedPng(activeImage)
      const safeName = activeImage.name.replace(/[^a-z0-9_-]+/gi, '_')
      downloadFile(`${safeName}-fit.png`, blob, 'image/png')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Export</h2>
      </header>

      <div className="button-row button-row--wrap">
        <button
          type="button"
          className="btn"
          disabled={state.images.length === 0}
          onClick={() => {
            downloadFile(
              'tt-bike-fit.json',
              exportJson(state),
              'application/json',
            )
          }}
        >
          JSON (all data)
        </button>
        <button
          type="button"
          className="btn"
          disabled={state.images.length === 0}
          onClick={() => {
            downloadFile(
              'tt-bike-fit.csv',
              exportSummaryCsv(state),
              'text/csv',
            )
          }}
        >
          CSV summary
        </button>
        <button
          type="button"
          className="btn"
          disabled={!activeImage || busy === 'png'}
          onClick={handlePng}
        >
          {busy === 'png' ? 'Rendering…' : 'PNG (this image)'}
        </button>
      </div>

      {err && <div className="error-banner">{err}</div>}

      <hr className="divider" />

      <button
        type="button"
        className="btn btn--danger"
        onClick={() => {
          if (
            confirm(
              'Delete ALL images and measurements? This cannot be undone.',
            )
          ) {
            onReset()
          }
        }}
      >
        Clear all data
      </button>
    </section>
  )
}
