// ---------- Domain types ----------
//
// All shared types for the TT bike fit app live here. Keeping them in one
// place makes it easy to evolve the shape of stored data and to bump the
// STORAGE_VERSION (see utils/storage.ts) when a breaking change is made.

/** A human-meaningful landmark category. `custom` is for ad-hoc points. */
export type LandmarkType =
  | 'ankle'
  | 'knee'
  | 'hip'
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'ear'
  | 'pedal'
  | 'bottomBracket'
  | 'saddle'
  | 'handlebar'
  | 'custom'

/**
 * A point placed by the user on an image.
 *
 * Coordinates are stored normalized to the image's natural size
 * (`x`, `y` in [0, 1]) so they survive image resizing and don't depend on
 * the current zoom level.
 */
export interface LandmarkPoint {
  id: string
  type: LandmarkType
  label: string
  x: number // 0..1
  y: number // 0..1
}

/** What shape of angle a preset measures. */
export type MeasurementKind =
  /** Classic 3-point angle. Vertex is `pointIds[1]`. */
  | 'angle3point'
  /**
   * Angle between line `point0 -> point1` and the horizontal axis.
   * Used for torso angle. Vertex (for visual arc) is `pointIds[0]`.
   */
  | 'angleToHorizontal'

/** Result of an angle calculation. */
export interface AngleResult {
  /** Degrees in [0, 180]. */
  degrees: number
  /** Which point id is the vertex of the angle. */
  vertexId: string
}

/**
 * One configured measurement on an image (e.g. "Knee angle").
 * References landmark points by id rather than embedding them, so multiple
 * measurements can share landmarks if a future version allows it.
 */
export interface Measurement {
  id: string
  presetId: string
  /** Display name; usually copied from the preset but user-editable. */
  name: string
  kind: MeasurementKind
  /** Ordered point ids: 3 for `angle3point`, 2 for `angleToHorizontal`. */
  pointIds: string[]
  /** SVG color used to draw lines/arc/label. */
  color: string
  /** Computed live from the points (cached for export convenience). */
  result: AngleResult | null
}

/** Optional pixel↔mm calibration (e.g. crank length 172.5 mm). */
export interface Calibration {
  pointAId: string
  pointBId: string
  realLengthMm: number
}

/**
 * One uploaded image with all its annotations.
 *
 * `dataUrl` keeps the image self-contained (and persistable to localStorage).
 * For very large images, the upload pipeline (utils/image.ts) downscales
 * to keep storage usage reasonable.
 */
export interface UploadedImage {
  id: string
  name: string
  dataUrl: string
  /** Natural (post-downscale) pixel dimensions. */
  width: number
  height: number
  points: LandmarkPoint[]
  measurements: Measurement[]
  calibration: Calibration | null
  createdAt: number
}

/** Slot in a preset — one landmark to be placed. */
export interface PresetLandmark {
  type: LandmarkType
  label: string
  /** User-facing instruction shown while placing this landmark. */
  instruction: string
}

/** A reusable measurement template. */
export interface MeasurementPreset {
  id: string
  name: string
  description: string
  kind: MeasurementKind
  landmarks: PresetLandmark[]
  color: string
}

/** Persisted top-level app state. */
export interface AppState {
  images: UploadedImage[]
  activeImageId: string | null
}
