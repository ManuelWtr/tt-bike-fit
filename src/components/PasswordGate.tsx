import { useState, type ReactNode } from 'react'

// ---------- Password gate ----------
//
// Casual share-with-friends protection. NOT real security:
//   - The password is bundled into the JS at build time.
//   - Anyone who opens DevTools can read it or patch the check.
// It's a "don't show this to random visitors of the URL" gate, not a
// secret keeper. If you need real auth, put the deployment behind
// Cloudflare Access / Vercel Password / a server-side basic-auth proxy.

const PASSWORD = 'wattbomb300' // ← change this before deploying
const UNLOCK_KEY = 'tt-bike-fit:unlocked'

function isUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCK_KEY) === '1'
  } catch {
    return false
  }
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(isUnlocked)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (unlocked) return <>{children}</>

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input === PASSWORD) {
      try {
        localStorage.setItem(UNLOCK_KEY, '1')
      } catch {
        /* ignore */
      }
      setUnlocked(true)
    } else {
      setError('Wrong password.')
      setInput('')
    }
  }

  return (
    <div className="gate">
      <form className="gate__card" onSubmit={submit}>
        <h1 className="gate__title">Bike Fit</h1>
        <p className="gate__sub">Private. Enter the password to continue.</p>
        <input
          type="password"
          className="gate__input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            if (error) setError(null)
          }}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="Password"
        />
        {error && <div className="gate__error">{error}</div>}
        <button type="submit" className="gate__submit" disabled={!input}>
          Unlock
        </button>
      </form>
    </div>
  )
}
