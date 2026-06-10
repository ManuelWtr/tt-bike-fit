import type { MeasurementPreset } from '../types'

/**
 * Standard TT / triathlon bike fit measurements.
 *
 * For 3-point angles the vertex is the MIDDLE landmark.
 * For `angleToHorizontal` the vertex (where the arc is drawn) is the FIRST
 * landmark; the second defines the line whose tilt is being measured.
 *
 * Reference ranges (rough industry guidelines, not medical advice):
 *   - Knee angle at bottom dead center: ~140–150° (extension)
 *   - Hip angle in aero: ~45–55° (more closed in TT than road)
 *   - Elbow angle in aero: ~90–100°
 *   - Torso angle to horizontal: ~5–15° for aggressive TT
 */
export const PRESETS: MeasurementPreset[] = [
  {
    id: 'knee-angle',
    name: 'Knee angle',
    description: 'Hip → Knee → Ankle. Vertex at knee.',
    kind: 'angle3point',
    color: '#06b6d4',
    landmarks: [
      { type: 'hip', label: 'Hip', instruction: 'Click the greater trochanter (hip joint).' },
      { type: 'knee', label: 'Knee', instruction: 'Click the lateral knee joint center.' },
      { type: 'ankle', label: 'Ankle', instruction: 'Click the lateral malleolus (ankle bone).' },
    ],
  },
  {
    id: 'hip-angle',
    name: 'Hip angle',
    description: 'Shoulder → Hip → Knee. Vertex at hip. Key for aero closure.',
    kind: 'angle3point',
    color: '#10b981',
    landmarks: [
      { type: 'shoulder', label: 'Shoulder', instruction: 'Click the acromion (shoulder joint).' },
      { type: 'hip', label: 'Hip', instruction: 'Click the greater trochanter (hip joint).' },
      { type: 'knee', label: 'Knee', instruction: 'Click the lateral knee joint center.' },
    ],
  },
  {
    id: 'shoulder-angle',
    name: 'Shoulder angle',
    description: 'Hip → Shoulder → Elbow. Vertex at shoulder.',
    kind: 'angle3point',
    color: '#f59e0b',
    landmarks: [
      { type: 'hip', label: 'Hip', instruction: 'Click the greater trochanter.' },
      { type: 'shoulder', label: 'Shoulder', instruction: 'Click the acromion.' },
      { type: 'elbow', label: 'Elbow', instruction: 'Click the elbow joint center.' },
    ],
  },
  {
    id: 'elbow-angle',
    name: 'Elbow angle',
    description: 'Shoulder → Elbow → Wrist. Vertex at elbow.',
    kind: 'angle3point',
    color: '#ef4444',
    landmarks: [
      { type: 'shoulder', label: 'Shoulder', instruction: 'Click the acromion.' },
      { type: 'elbow', label: 'Elbow', instruction: 'Click the elbow joint center.' },
      { type: 'wrist', label: 'Wrist', instruction: 'Click the wrist joint.' },
    ],
  },
  {
    id: 'ankle-angle',
    name: 'Ankle angle',
    description: 'Knee → Ankle → Pedal spindle. Vertex at ankle.',
    kind: 'angle3point',
    color: '#8b5cf6',
    landmarks: [
      { type: 'knee', label: 'Knee', instruction: 'Click the lateral knee joint center.' },
      { type: 'ankle', label: 'Ankle', instruction: 'Click the lateral malleolus.' },
      { type: 'pedal', label: 'Pedal spindle', instruction: 'Click the pedal spindle / cleat axis.' },
    ],
  },
  {
    id: 'torso-angle',
    name: 'Torso angle (to horizontal)',
    description: 'Angle between hip→shoulder line and horizontal. 0° = flat.',
    kind: 'angleToHorizontal',
    color: '#ec4899',
    landmarks: [
      { type: 'hip', label: 'Hip', instruction: 'Click the greater trochanter (anchor of torso).' },
      { type: 'shoulder', label: 'Shoulder', instruction: 'Click the acromion.' },
    ],
  },
  // ---- Useful but optional ----
  {
    id: 'custom-3point',
    name: 'Custom 3-point angle',
    description: 'Any three points; vertex is the middle one.',
    kind: 'angle3point',
    color: '#3b82f6',
    landmarks: [
      { type: 'custom', label: 'Point A', instruction: 'Click first point.' },
      { type: 'custom', label: 'Vertex', instruction: 'Click vertex (angle is measured here).' },
      { type: 'custom', label: 'Point C', instruction: 'Click third point.' },
    ],
  },
]

export function findPreset(id: string): MeasurementPreset | undefined {
  return PRESETS.find((p) => p.id === id)
}
