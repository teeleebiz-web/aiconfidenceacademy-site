import { lazy, Suspense, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { SignIn } from './components/SignIn'
import { controlCenterReturnKey } from './controlCenterRoute'

const AcademyControlCenter = lazy(() => import('./components/AcademyControlCenter').then(module => ({ default: module.AcademyControlCenter })))

export function ControlCenterEntry() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [permission, setPermission] = useState<'checking' | 'owner' | 'denied' | 'error'>('checking')
  const [sessionError, setSessionError] = useState(false)

  useEffect(() => {
    document.title = 'Academy Control Center | AI Confidence Academy'
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      setSession(data.session)
      setSessionError(Boolean(error))
      setLoading(false)
    }).catch(() => { if (active) { setSessionError(true); setLoading(false) } })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) { setPermission('checking'); setSession(nextSession) }
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!session) return
    let active = true
    Promise.resolve(supabase.rpc('is_aca_curriculum_owner', undefined, { get: true })).then(({ data, error }) => {
      if (!active) return
      setPermission(error ? 'error' : data === true ? 'owner' : 'denied')
      try { window.localStorage.removeItem(controlCenterReturnKey) } catch { /* Navigation hint only. */ }
    }).catch(() => { if (active) setPermission('error') })
    return () => { active = false }
  }, [session])

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) { setPermission('error'); return }
    setSession(null)
    setPermission('checking')
  }

  async function requestSignInLink(email: string) {
    // Reuse the existing approved Auth callback. PortalEntry sends the callback
    // straight back here before importing or opening any curriculum component.
    window.localStorage.setItem(controlCenterReturnKey, String(Date.now() + 60 * 60 * 1000))
    const { error } = await supabase.auth.signInWithOtp({ email, options: {
      shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/learn/`,
    } })
    if (error) { window.localStorage.removeItem(controlCenterReturnKey); throw error }
  }

  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  if (loading || (session && permission === 'checking')) return <div className="loading-screen" role="status">Opening Academy control center…</div>
  if (!session) return <>{sessionError ? <p role="alert" className="global-error">Your session could not be restored. Please sign in again.</p> : null}<SignIn purpose="control-center" onRequestLink={requestSignInLink} onPasswordSignIn={signInWithPassword} /></>
  if (permission !== 'owner') return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">Academy control center</p><h1>{permission === 'error' ? 'Owner access could not be checked' : 'Owner access required'}</h1><p>{permission === 'error' ? 'Please refresh to retry, or sign out and use your owner account.' : 'This account does not have permission to manage Academy operations. Sign in with your Academy owner account.'}</p><button onClick={() => void signOut()}>Sign out</button></section></main>
  return <Suspense fallback={<div className="loading-screen">Loading Academy records…</div>}><AcademyControlCenter accessToken={session.access_token} onSignOut={() => void signOut()} /></Suspense>
}
