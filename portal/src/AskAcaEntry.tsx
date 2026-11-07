import { useEffect } from 'react'

// Keep previously shared links useful without authentication or course entry.
export function AskAcaEntry() {
  useEffect(() => { window.location.replace('/ask/') }, [])
  return <main className="auth-shell"><section className="auth-card"><h1>Ask ACA</h1><a href="/ask/">Open Ask ACA</a></section></main>
}
