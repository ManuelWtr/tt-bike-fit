/**
 * Generate a short, unique-ish id. Uses crypto.randomUUID when available
 * and falls back to a timestamp+random string for older browsers.
 */
export function makeId(prefix = ''): string {
  const cryptoObj = typeof crypto !== 'undefined' ? crypto : undefined
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return prefix + cryptoObj.randomUUID().slice(0, 8)
  }
  return (
    prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8)
  )
}
