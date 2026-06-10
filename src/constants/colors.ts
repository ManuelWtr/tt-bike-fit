/**
 * Cycled through when assigning a color to a new measurement so each one
 * is visually distinct on the canvas and in the sidebar.
 */
export const MEASUREMENT_COLORS = [
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#eab308', // yellow
  '#3b82f6', // blue
]

export function nextColor(usedCount: number): string {
  return MEASUREMENT_COLORS[usedCount % MEASUREMENT_COLORS.length]
}
