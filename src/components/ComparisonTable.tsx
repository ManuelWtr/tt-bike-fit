import type { AppState } from '../types'
import { angleAtVertex, angleToHorizontal, formatAngle } from '../utils/geometry'
import { PRESETS } from '../constants/presets'

interface ComparisonTableProps {
  state: AppState
}

/**
 * Optional bonus feature: side-by-side angle comparison across all uploaded
 * images. One row per image, one column per preset. Picks the FIRST
 * measurement matching each preset id (users typically only add a preset
 * once per image).
 */
export function ComparisonTable({ state }: ComparisonTableProps) {
  if (state.images.length < 2) return null

  // Which presets are actually used anywhere? Only show those columns.
  const usedPresetIds = new Set<string>()
  for (const img of state.images) {
    for (const m of img.measurements) usedPresetIds.add(m.presetId)
  }
  const cols = PRESETS.filter((p) => usedPresetIds.has(p.id))
  if (cols.length === 0) return null

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Compare across images</h2>
      </header>
      <div className="table-scroll">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Image</th>
              {cols.map((c) => (
                <th key={c.id} title={c.description}>
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.images.map((img) => (
              <tr key={img.id}>
                <th scope="row">{img.name}</th>
                {cols.map((c) => {
                  const m = img.measurements.find((x) => x.presetId === c.id)
                  if (!m) {
                    return (
                      <td key={c.id} className="muted">
                        —
                      </td>
                    )
                  }
                  const pts = m.pointIds
                    .map((pid) => img.points.find((p) => p.id === pid))
                    .filter((p): p is NonNullable<typeof p> => Boolean(p))
                    .map((p) => ({
                      x: p.x * img.width,
                      y: p.y * img.height,
                    }))
                  let deg = NaN
                  if (m.kind === 'angle3point' && pts.length === 3) {
                    deg = angleAtVertex(pts[0], pts[1], pts[2])
                  } else if (
                    m.kind === 'angleToHorizontal' &&
                    pts.length === 2
                  ) {
                    deg = angleToHorizontal(pts[0], pts[1])
                  }
                  return (
                    <td key={c.id} style={{ color: m.color }}>
                      <strong>{formatAngle(deg)}</strong>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
