// ---------- Image loading & downscaling ----------
//
// localStorage is capped (~5 MB on most browsers) and a single 12-megapixel
// phone photo as a base64 data URL is easily 4–8 MB. We downscale on upload
// to keep things storable without throwing away meaningful detail.

const MAX_DIMENSION = 1920 // px — wide enough for accurate landmark placement
const JPEG_QUALITY = 0.85

export interface LoadedImage {
  dataUrl: string
  width: number
  height: number
}

/**
 * Read a File, downscale if larger than MAX_DIMENSION on either side, and
 * return a JPEG data URL together with its natural pixel dimensions.
 *
 * If the file is small enough to keep as-is AND already a JPEG/PNG, it's
 * passed through unmodified to preserve quality.
 */
export async function loadAndDownscaleFile(file: File): Promise<LoadedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`Not an image file: ${file.name} (${file.type})`)
  }

  const originalDataUrl = await fileToDataUrl(file)
  const bitmap = await loadImageElement(originalDataUrl)
  const { width: w0, height: h0 } = bitmap

  if (w0 <= MAX_DIMENSION && h0 <= MAX_DIMENSION) {
    return { dataUrl: originalDataUrl, width: w0, height: h0 }
  }

  const scale = MAX_DIMENSION / Math.max(w0, h0)
  const w = Math.round(w0 * scale)
  const h = Math.round(h0 * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get 2D canvas context for image resize')
  ctx.drawImage(bitmap, 0, 0, w, h)

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  return { dataUrl, width: w, height: h }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('FileReader returned non-string result'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(file)
  })
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = src
  })
}

// ---------------------------------------------------------------------------
// FUTURE: Automatic landmark detection could plug in here.
//
// A computer-vision pipeline (e.g. MediaPipe Pose, MoveNet, OpenPose, or a
// custom model) would consume the same `HTMLImageElement` and return a list
// of keypoints. The output could be mapped to our `LandmarkPoint[]` and
// pre-filled before the user fine-tunes them. Keep `loadAndDownscaleFile`
// the single entry point so detection can be invoked from there.
// ---------------------------------------------------------------------------
