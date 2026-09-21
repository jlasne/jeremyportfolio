import { useState } from 'react'
import { api, getKey, setKey } from '../lib/api'

// The way into a real account.
//
// One key an account, handed over when the account is opened. Paste it here
// and this browser is that account until you sign out. The key is checked
// against the server before it is kept, so a typo says so here rather than
// showing an empty app and leaving you to guess.
//
// The same key works on the API and on MCP, which is why there is one of them
// and not a password as well.

export function SignIn() {
  const [key, setField] = useState(getKey() ?? '')
  const [state, setState] = useState<'idle' | 'checking' | 'failed'>('idle')
  const [message, setMessage] = useState('')

  const open = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('checking')
    const before = getKey()
    setKey(key)
    try {
      const me = await api.me()
      window.location.hash = '#/app'
      window.location.reload()
      return me
    } catch (err) {
      // A key that does not open anything is not kept: leaving it in place
      // would show an empty app on every screen from here on.
      setKey(before ?? '')
      setState('failed')
      setMessage(err instanceof Error ? err.message : 'That key did not open anything')
    }
  }

  return (
    <div className="page narrow">
      <div className="page-head"><h1>Sign in</h1></div>
      <p className="subhead">Paste the key we sent you when your account was opened.</p>

      <form className="card" onSubmit={open}>
        <h2>Your key</h2>
        <input
          className="input"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          placeholder="0a88f9fc..."
          aria-label="Your account key"
          value={key}
          onChange={(e) => setField(e.target.value.trim())}
        />
        <div className="verdict-actions">
          <button type="submit" className="btn primary" disabled={!key.trim() || state === 'checking'}>
            {state === 'checking' ? 'Checking' : 'Open my account'}
          </button>
          <a className="btn quiet" href="#/demo">See the sample instead</a>
        </div>
        {state === 'failed' && <p className="notice warn">{message}</p>}
        <p className="hint">
          The same key works on the API and on MCP. Lost it? Write to{' '}
          <a href="mailto:hey@jeremylasne.com">hey@jeremylasne.com</a>.
        </p>
      </form>
    </div>
  )
}
