import { useCallback, useRef, useState } from 'react'
import { loadAndDownscaleFile } from '../utils/image'

interface UploadZoneProps {
  variant: 'hero' | 'compact'
  onUploaded: (data: {
    name: string
    dataUrl: string
    width: number
    height: number
  }) => void
}

/**
 * Drag-and-drop / click-to-pick file upload control.
 *   - `hero`: large center-screen placeholder (used when there are no images).
 *   - `compact`: tight button-like control (used inside the sidebar).
 */
export function UploadZone({ variant, onUploaded }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null)
      setBusy(true)
      try {
        for (const file of Array.from(files)) {
          if (!file.type.startsWith('image/')) {
            setError(`"${file.name}" is not an image.`)
            continue
          }
          const { dataUrl, width, height } = await loadAndDownscaleFile(file)
          // Strip extension from default name; user can rename later.
          const name = file.name.replace(/\.[^.]+$/, '')
          onUploaded({ name, dataUrl, width, height })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setBusy(false)
      }
    },
    [onUploaded],
  )

  const onPick = () => inputRef.current?.click()

  return (
    <div
      className={
        'upload-zone ' +
        (variant === 'hero' ? 'upload-zone--hero ' : 'upload-zone--compact ') +
        (dragActive ? 'is-drag ' : '')
      }
      onDragEnter={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setDragActive(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragActive(false)
        if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files)
      }}
      onClick={onPick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onPick()
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files)
          e.target.value = '' // allow re-upload of same file
        }}
      />
      {variant === 'hero' ? (
        <>
          <div className="upload-zone__icon" aria-hidden>
            ↑
          </div>
          <div className="upload-zone__title">Drop bike photos here</div>
          <div className="upload-zone__subtitle">
            or click to browse. Side-view shots work best — one image per
            crank position (12, 3, 6 o'clock, aero).
          </div>
        </>
      ) : (
        <>
          <span aria-hidden>+</span>
          <span>{busy ? 'Loading…' : 'Add image'}</span>
        </>
      )}
      {error && <div className="upload-zone__error">{error}</div>}
    </div>
  )
}
