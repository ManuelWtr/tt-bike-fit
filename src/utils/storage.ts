import type { AppState } from '../types'

const STORAGE_KEY = 'tt-bike-fit:v1'
const STORAGE_VERSION = 1

interface PersistedShape {
  version: number
  state: AppState
}

/**
 * Load app state from localStorage. Returns null if nothing stored, the
 * stored payload is corrupt, or the schema version is unknown — the caller
 * should fall back to the empty initial state.
 */
export function loadState(): AppState | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedShape
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.version !== STORAGE_VERSION) return null
    if (!parsed.state || !Array.isArray(parsed.state.images)) return null
    return parsed.state
  } catch (err) {
    console.warn('[tt-bike-fit] failed to load persisted state:', err)
    return null
  }
}

/**
 * Persist state to localStorage. Quota-exceeded errors are caught and
 * surfaced via the callback so the UI can warn the user (typically
 * triggered by uploading too many large images).
 */
export function saveState(state: AppState, onQuotaExceeded?: () => void): void {
  if (typeof localStorage === 'undefined') return
  try {
    const payload: PersistedShape = { version: STORAGE_VERSION, state }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.code === 22)
    if (isQuota) {
      console.warn('[tt-bike-fit] localStorage quota exceeded')
      onQuotaExceeded?.()
    } else {
      console.warn('[tt-bike-fit] failed to persist state:', err)
    }
  }
}

export function clearStoredState(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
