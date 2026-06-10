import { useState } from 'react'
import type { UploadedImage } from '../types'
import { UploadZone } from './UploadZone'

interface ImageListProps {
  images: UploadedImage[]
  activeImageId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onRename: (id: string, name: string) => void
  onUploaded: (data: {
    name: string
    dataUrl: string
    width: number
    height: number
  }) => void
}

export function ImageList({
  images,
  activeImageId,
  onSelect,
  onRemove,
  onRename,
  onUploaded,
}: ImageListProps) {
  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Images</h2>
        <span className="panel__count">{images.length}</span>
      </header>
      <ul className="image-list">
        {images.map((img) => (
          <ImageListItem
            key={img.id}
            image={img}
            active={img.id === activeImageId}
            onSelect={() => onSelect(img.id)}
            onRemove={() => {
              if (confirm(`Delete image "${img.name}" and its measurements?`)) {
                onRemove(img.id)
              }
            }}
            onRename={(name) => onRename(img.id, name)}
          />
        ))}
      </ul>
      <UploadZone variant="compact" onUploaded={onUploaded} />
    </section>
  )
}

interface ImageListItemProps {
  image: UploadedImage
  active: boolean
  onSelect: () => void
  onRemove: () => void
  onRename: (name: string) => void
}

function ImageListItem({
  image,
  active,
  onSelect,
  onRemove,
  onRename,
}: ImageListItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(image.name)
  const submit = () => {
    const next = draft.trim()
    if (next && next !== image.name) onRename(next)
    setEditing(false)
  }

  return (
    <li className={'image-list__item ' + (active ? 'is-active' : '')}>
      <button
        type="button"
        className="image-list__thumb"
        onClick={onSelect}
        aria-label={`Open ${image.name}`}
      >
        <img src={image.dataUrl} alt="" />
      </button>
      <div className="image-list__body">
        {editing ? (
          <input
            className="text-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') {
                setDraft(image.name)
                setEditing(false)
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="image-list__name"
            onClick={() => setEditing(true)}
            title="Click to rename"
          >
            {image.name}
          </button>
        )}
        <div className="image-list__meta">
          {image.measurements.length} measurement
          {image.measurements.length === 1 ? '' : 's'}
        </div>
      </div>
      <button
        type="button"
        className="icon-button icon-button--danger"
        onClick={onRemove}
        aria-label="Delete image"
        title="Delete image"
      >
        ×
      </button>
    </li>
  )
}
