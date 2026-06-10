import { useCallback, useEffect, useMemo, useState } from 'react'
import { ImageCanvas } from './components/ImageCanvas'
import type { CanvasViewControls } from './components/ImageCanvas'
import { CanvasToolbar } from './components/CanvasToolbar'
import { ImageList } from './components/ImageList'
import { MeasurementWizard } from './components/MeasurementWizard'
import type { WizardSession } from './components/MeasurementWizard'
import { MeasurementsList } from './components/MeasurementsList'
import { CalibrationPanel } from './components/CalibrationPanel'
import { ExportPanel } from './components/ExportPanel'
import { ComparisonTable } from './components/ComparisonTable'
import { UploadZone } from './components/UploadZone'
import { useStore } from './hooks/useStore'
import type { MeasurementPreset } from './types'

export function App() {
  const store = useStore()
  const { activeImage, state } = store

  // -- wizard state lives at App level so both canvas + sidebar can see it --
  const [wizard, setWizard] = useState<WizardSession | null>(null)
  // -- canvas zoom controls handed up to the toolbar --
  const [canvasControls, setCanvasControls] =
    useState<CanvasViewControls | null>(null)
  const [selectedMeasurementId, setSelectedMeasurementId] = useState<
    string | null
  >(null)

  const startWizard = useCallback((preset: MeasurementPreset) => {
    setWizard({ preset, placedCoords: [] })
    setSelectedMeasurementId(null)
  }, [])

  const cancelWizard = useCallback(() => setWizard(null), [])

  const undoWizardClick = useCallback(() => {
    setWizard((w) => {
      if (!w) return null
      return { ...w, placedCoords: w.placedCoords.slice(0, -1) }
    })
  }, [])

  const onWizardClick = useCallback(
    (normX: number, normY: number) => {
      if (!wizard || !activeImage) return
      const next = {
        ...wizard,
        placedCoords: [...wizard.placedCoords, { x: normX, y: normY }],
      }
      if (next.placedCoords.length === next.preset.landmarks.length) {
        // All slots filled — create the measurement and exit wizard.
        const created = store.createMeasurementFromPreset(
          activeImage.id,
          next.preset,
          next.placedCoords,
        )
        if (created) setSelectedMeasurementId(created.id)
        setWizard(null)
      } else {
        setWizard(next)
      }
    },
    [activeImage, store, wizard],
  )

  // Cancel wizard automatically if user switches images mid-flow.
  const onSelectImage = useCallback(
    (id: string) => {
      setWizard(null)
      setSelectedMeasurementId(null)
      store.setActiveImage(id)
    },
    [store],
  )

  // Cancel any wizard / selection if the active image changes via ANY path
  // (manual switch, image deletion, fresh-load from storage). The user
  // typically wants to re-think placement for a new image.
  const activeImageId = activeImage?.id ?? null
  useEffect(() => {
    setWizard(null)
    setSelectedMeasurementId(null)
  }, [activeImageId])

  // Build the wizard descriptor the canvas needs.
  const canvasWizard = useMemo(() => {
    if (!wizard) return null
    const placed = wizard.placedCoords
    const nextSlot = wizard.preset.landmarks[placed.length] ?? null
    return {
      color: wizard.preset.color,
      placedLabels: placed.map((_, i) => wizard.preset.landmarks[i].label),
      nextLabel: nextSlot?.label ?? null,
      placedCoords: placed,
    }
  }, [wizard])

  const toolbarHint = wizard
    ? wizard.preset.landmarks[wizard.placedCoords.length]
      ? `Click to place: ${wizard.preset.landmarks[wizard.placedCoords.length].label}`
      : 'Finishing measurement…'
    : activeImage
      ? 'Drag points to refine · Right-click a point to delete · Wheel to zoom · Drag to pan'
      : null

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">TT Bike Fit</div>
        {store.storageWarning && (
          <button
            type="button"
            className="warning-pill"
            onClick={store.clearStorageWarning}
            title="Click to dismiss"
          >
            {store.storageWarning}
          </button>
        )}
      </header>

      <main className="app-main">
        <section className="app-canvas-area">
          {activeImage ? (
            <>
              <CanvasToolbar
                imageName={activeImage.name}
                controls={canvasControls}
                hint={toolbarHint}
              />
              <ImageCanvas
                key={activeImage.id}
                image={activeImage}
                wizard={canvasWizard}
                onWizardClick={onWizardClick}
                onPointMove={(pointId, x, y) =>
                  store.movePoint(activeImage.id, pointId, x, y)
                }
                onPointRemove={(pointId) => {
                  if (
                    confirm(
                      'Delete this point? Any measurement using it will also be removed.',
                    )
                  ) {
                    store.removePoint(activeImage.id, pointId)
                  }
                }}
                selectedMeasurementId={selectedMeasurementId}
                onSelectMeasurement={setSelectedMeasurementId}
                controlsRef={setCanvasControls}
              />
            </>
          ) : (
            <EmptyState onUploaded={store.addImage} />
          )}
        </section>

        <aside className="app-sidebar">
          <ImageList
            images={state.images}
            activeImageId={state.activeImageId}
            onSelect={onSelectImage}
            onRemove={store.removeImage}
            onRename={store.renameImage}
            onUploaded={store.addImage}
          />
          <MeasurementWizard
            session={wizard}
            hasActiveImage={Boolean(activeImage)}
            onStart={startWizard}
            onUndo={undoWizardClick}
            onCancel={cancelWizard}
          />
          {activeImage && (
            <MeasurementsList
              image={activeImage}
              selectedMeasurementId={selectedMeasurementId}
              onSelectMeasurement={setSelectedMeasurementId}
              onRemoveMeasurement={(id) =>
                store.removeMeasurement(activeImage.id, id)
              }
              onRenameMeasurement={(id, name) =>
                store.renameMeasurement(activeImage.id, id, name)
              }
              onRemovePoint={(id) => store.removePoint(activeImage.id, id)}
            />
          )}
          {activeImage && (
            <CalibrationPanel
              image={activeImage}
              onChange={(cal) => store.setCalibration(activeImage.id, cal)}
            />
          )}
          <ComparisonTable state={state} />
          <ExportPanel
            state={state}
            activeImage={activeImage}
            onReset={store.reset}
          />
          <footer className="app-footer">
            Data is stored locally in your browser. Export JSON to back it up.
          </footer>
        </aside>
      </main>
    </div>
  )
}

function EmptyState({
  onUploaded,
}: {
  onUploaded: (data: {
    name: string
    dataUrl: string
    width: number
    height: number
  }) => void
}) {
  return (
    <div className="empty-state">
      <h1 className="empty-state__title">Upload side-view photos to begin</h1>
      <p className="empty-state__lead">
        Accurate angles depend on a properly framed photo.
      </p>

      <section className="setup-card">
        <h2 className="setup-card__title">Camera setup</h2>
        <ol className="setup-card__list">
          <li>
            <span>
              <strong>Distance.</strong>{' '}
              <span className="muted-inline">
                Place the camera 3–4 metres from the bike.
              </span>
            </span>
          </li>
          <li>
            <span>
              <strong>Height.</strong>{' '}
              <span className="muted-inline">
                Lens at crank-axis level.
              </span>
            </span>
          </li>
          <li>
            <span>
              <strong>Positions.</strong>{' '}
              <span className="muted-inline">
                One photo per crank position you want to measure — 12, 3, 6
                and 9 o'clock.
              </span>
            </span>
          </li>
        </ol>
      </section>

      <UploadZone variant="hero" onUploaded={onUploaded} />
    </div>
  )
}
