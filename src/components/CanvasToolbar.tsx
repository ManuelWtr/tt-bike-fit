import type { CanvasViewControls } from './ImageCanvas'

interface CanvasToolbarProps {
  imageName: string
  controls: CanvasViewControls | null
  hint: string | null
}

export function CanvasToolbar({ imageName, controls, hint }: CanvasToolbarProps) {
  return (
    <div className="canvas-toolbar">
      <div className="canvas-toolbar__title" title={imageName}>
        {imageName}
      </div>
      <div className="canvas-toolbar__hint">{hint}</div>
      <div className="canvas-toolbar__zoom">
        <button
          type="button"
          className="icon-button"
          onClick={() => controls?.zoomOut()}
          disabled={!controls}
          title="Zoom out (mouse wheel)"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => controls?.resetView()}
          disabled={!controls}
          title="Reset view"
          aria-label="Reset view"
        >
          ⌂
        </button>
        <button
          type="button"
          className="icon-button"
          onClick={() => controls?.zoomIn()}
          disabled={!controls}
          title="Zoom in (mouse wheel)"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  )
}
