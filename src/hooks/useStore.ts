import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type {
  AppState,
  Calibration,
  LandmarkPoint,
  Measurement,
  MeasurementPreset,
  UploadedImage,
} from '../types'
import { loadState, saveState } from '../utils/storage'
import { makeId } from '../utils/id'
import { nextColor } from '../constants/colors'

// ---------- Store ----------
//
// Single useReducer-backed store. Component code never mutates state
// directly — it dispatches actions. State is persisted to localStorage on
// every change (debounced via microtask).

const INITIAL_STATE: AppState = {
  images: [],
  activeImageId: null,
}

type Action =
  | { type: 'load'; state: AppState }
  | { type: 'addImage'; image: UploadedImage }
  | { type: 'removeImage'; imageId: string }
  | { type: 'renameImage'; imageId: string; name: string }
  | { type: 'setActiveImage'; imageId: string | null }
  | {
      type: 'addMeasurement'
      imageId: string
      measurement: Measurement
      points: LandmarkPoint[]
    }
  | { type: 'removeMeasurement'; imageId: string; measurementId: string }
  | { type: 'renameMeasurement'; imageId: string; measurementId: string; name: string }
  | { type: 'movePoint'; imageId: string; pointId: string; x: number; y: number }
  | { type: 'removePoint'; imageId: string; pointId: string }
  | {
      type: 'setCalibration'
      imageId: string
      calibration: Calibration | null
    }
  | { type: 'reset' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'load':
      return action.state

    case 'reset':
      return INITIAL_STATE

    case 'addImage':
      return {
        ...state,
        images: [...state.images, action.image],
        activeImageId: action.image.id,
      }

    case 'removeImage': {
      const images = state.images.filter((i) => i.id !== action.imageId)
      const activeImageId =
        state.activeImageId === action.imageId
          ? images[0]?.id ?? null
          : state.activeImageId
      return { ...state, images, activeImageId }
    }

    case 'renameImage':
      return {
        ...state,
        images: state.images.map((i) =>
          i.id === action.imageId ? { ...i, name: action.name } : i,
        ),
      }

    case 'setActiveImage':
      return { ...state, activeImageId: action.imageId }

    case 'addMeasurement':
      return mapImage(state, action.imageId, (img) => ({
        ...img,
        points: [...img.points, ...action.points],
        measurements: [...img.measurements, action.measurement],
      }))

    case 'removeMeasurement':
      return mapImage(state, action.imageId, (img) => {
        const remainingMeasurements = img.measurements.filter(
          (m) => m.id !== action.measurementId,
        )
        // Drop points that were only used by the deleted measurement.
        const stillReferenced = new Set<string>()
        for (const m of remainingMeasurements) {
          for (const pid of m.pointIds) stillReferenced.add(pid)
        }
        if (img.calibration) {
          stillReferenced.add(img.calibration.pointAId)
          stillReferenced.add(img.calibration.pointBId)
        }
        return {
          ...img,
          measurements: remainingMeasurements,
          points: img.points.filter((p) => stillReferenced.has(p.id)),
        }
      })

    case 'renameMeasurement':
      return mapImage(state, action.imageId, (img) => ({
        ...img,
        measurements: img.measurements.map((m) =>
          m.id === action.measurementId ? { ...m, name: action.name } : m,
        ),
      }))

    case 'movePoint':
      return mapImage(state, action.imageId, (img) => ({
        ...img,
        points: img.points.map((p) =>
          p.id === action.pointId
            ? { ...p, x: clamp01(action.x), y: clamp01(action.y) }
            : p,
        ),
      }))

    case 'removePoint':
      return mapImage(state, action.imageId, (img) => {
        // Also drop any measurement that referenced this point and any
        // calibration that pointed at it — otherwise the UI shows ghosts.
        const measurements = img.measurements.filter(
          (m) => !m.pointIds.includes(action.pointId),
        )
        const calibration =
          img.calibration &&
          (img.calibration.pointAId === action.pointId ||
            img.calibration.pointBId === action.pointId)
            ? null
            : img.calibration
        return {
          ...img,
          points: img.points.filter((p) => p.id !== action.pointId),
          measurements,
          calibration,
        }
      })

    case 'setCalibration':
      return mapImage(state, action.imageId, (img) => ({
        ...img,
        calibration: action.calibration,
      }))
  }
}

function mapImage(
  state: AppState,
  imageId: string,
  fn: (img: UploadedImage) => UploadedImage,
): AppState {
  return {
    ...state,
    images: state.images.map((i) => (i.id === imageId ? fn(i) : i)),
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

// ---------- Hook ----------

export interface Store {
  state: AppState
  activeImage: UploadedImage | null

  // Image actions
  addImage: (data: {
    name: string
    dataUrl: string
    width: number
    height: number
  }) => UploadedImage
  removeImage: (imageId: string) => void
  renameImage: (imageId: string, name: string) => void
  setActiveImage: (imageId: string | null) => void

  // Measurement actions
  createMeasurementFromPreset: (
    imageId: string,
    preset: MeasurementPreset,
    /** Normalized (0..1) coordinates, one per preset.landmarks slot. */
    coords: { x: number; y: number }[],
  ) => Measurement | null
  removeMeasurement: (imageId: string, measurementId: string) => void
  renameMeasurement: (
    imageId: string,
    measurementId: string,
    name: string,
  ) => void

  // Point actions
  movePoint: (imageId: string, pointId: string, x: number, y: number) => void
  removePoint: (imageId: string, pointId: string) => void

  // Calibration
  setCalibration: (imageId: string, cal: Calibration | null) => void

  // Misc
  reset: () => void
  storageWarning: string | null
  clearStorageWarning: () => void
}

export function useStore(): Store {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)
  // Storage-quota warning lives outside the reducer so it can be set
  // synchronously inside the save effect without triggering another save loop.
  const warningRef = useRef<string | null>(null)
  const [, setTick] = useState(0)
  const forceRender = useCallback(() => setTick((t) => t + 1), [])

  // Snapshot state for callbacks that need current state without re-binding
  // (e.g. createMeasurementFromPreset reads images by id at call time).
  // Declared at the top so all callbacks that reference it are below.
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Load persisted state on mount.
  useEffect(() => {
    const persisted = loadState()
    if (persisted) dispatch({ type: 'load', state: persisted })
  }, [])

  // Persist state on every change (skips first render's empty state).
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    saveState(state, () => {
      warningRef.current =
        'localStorage is full. Newest changes may not be saved on refresh. Consider exporting JSON and removing old images.'
      forceRender()
    })
  }, [state])

  const activeImage = useMemo(
    () =>
      state.activeImageId
        ? state.images.find((i) => i.id === state.activeImageId) ?? null
        : null,
    [state.activeImageId, state.images],
  )

  const addImage = useCallback<Store['addImage']>(
    ({ name, dataUrl, width, height }) => {
      const image: UploadedImage = {
        id: makeId('img_'),
        name,
        dataUrl,
        width,
        height,
        points: [],
        measurements: [],
        calibration: null,
        createdAt: Date.now(),
      }
      dispatch({ type: 'addImage', image })
      return image
    },
    [],
  )

  const removeImage = useCallback<Store['removeImage']>((imageId) => {
    dispatch({ type: 'removeImage', imageId })
  }, [])

  const renameImage = useCallback<Store['renameImage']>((imageId, name) => {
    dispatch({ type: 'renameImage', imageId, name })
  }, [])

  const setActiveImage = useCallback<Store['setActiveImage']>((imageId) => {
    dispatch({ type: 'setActiveImage', imageId })
  }, [])

  const createMeasurementFromPreset = useCallback<
    Store['createMeasurementFromPreset']
  >(
    (imageId, preset, coords) => {
      if (coords.length !== preset.landmarks.length) return null
      const img = stateRef.current.images.find((i) => i.id === imageId)
      if (!img) return null

      const points: LandmarkPoint[] = preset.landmarks.map((slot, i) => ({
        id: makeId('p_'),
        type: slot.type,
        label: slot.label,
        x: clamp01(coords[i].x),
        y: clamp01(coords[i].y),
      }))

      const color = nextColor(img.measurements.length)
      const measurement: Measurement = {
        id: makeId('m_'),
        presetId: preset.id,
        name: preset.name,
        kind: preset.kind,
        pointIds: points.map((p) => p.id),
        color,
        // result is computed in render; we don't bother caching it here.
        result: null,
      }
      dispatch({ type: 'addMeasurement', imageId, measurement, points })
      return measurement
    },
    [],
  )

  const removeMeasurement = useCallback<Store['removeMeasurement']>(
    (imageId, measurementId) => {
      dispatch({ type: 'removeMeasurement', imageId, measurementId })
    },
    [],
  )

  const renameMeasurement = useCallback<Store['renameMeasurement']>(
    (imageId, measurementId, name) => {
      dispatch({ type: 'renameMeasurement', imageId, measurementId, name })
    },
    [],
  )

  const movePoint = useCallback<Store['movePoint']>(
    (imageId, pointId, x, y) => {
      dispatch({ type: 'movePoint', imageId, pointId, x, y })
    },
    [],
  )

  const removePoint = useCallback<Store['removePoint']>(
    (imageId, pointId) => {
      dispatch({ type: 'removePoint', imageId, pointId })
    },
    [],
  )

  const setCalibration = useCallback<Store['setCalibration']>(
    (imageId, calibration) => {
      dispatch({ type: 'setCalibration', imageId, calibration })
    },
    [],
  )

  const reset = useCallback<Store['reset']>(() => {
    dispatch({ type: 'reset' })
  }, [])

  const clearStorageWarning = useCallback(() => {
    warningRef.current = null
    forceRender()
  }, [])

  return {
    state,
    activeImage,
    addImage,
    removeImage,
    renameImage,
    setActiveImage,
    createMeasurementFromPreset,
    removeMeasurement,
    renameMeasurement,
    movePoint,
    removePoint,
    setCalibration,
    reset,
    storageWarning: warningRef.current,
    clearStorageWarning,
  }
}
