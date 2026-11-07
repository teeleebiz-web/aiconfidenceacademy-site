import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { usePageStart } from './lib/usePageStart'
import { SignIn } from './components/SignIn'
import { AcademyGuide } from './components/AcademyGuide'
import { askAcaReturnKey } from './askAcaRoute'
import { controlCenterReturnKey } from './controlCenterRoute'
import './support.css'

export function AskAcaEntry() {
  const [session, setSession] = useState<Session | null>()
  const [sessionError, setSessionError] = useState(false)
  usePageStart(session === undefined ? null : session ? 'ask-aca' : 'ask-aca-sign-in')
  useEffect(() => {
    document.title = 'Ask ACA | AI Confidence Academy'
    let active = true, revision = 0
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      revision++
      if (active) { setSessionError(false); setSession(next) }
    })
    const initialRevision = revision
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || revision !== initialRevision) return
      setSessionError(Boolean(error)); setSession(error ? null : data.session)
    }).catch(() => {
      if (active && revision === initialRevision) { setSessionError(true); setSession(null) }
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (session) window.localStorage.removeItem(askAcaReturnKey)
  }, [session?.user.id])

  async function requestLink(email: string) {
    // Return through the established Auth callback, without entering a course.
    window.localStorage.setItem(askAcaReturnKey, String(Date.now() + 60 * 60 * 1000))
    window.localStorage.removeItem(controlCenterReturnKey)
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: {
        shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/learn/`,
      } })
      if (error) throw error
    } catch (error) { window.localStorage.removeItem(askAcaReturnKey); throw error }
  }
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  if (session === undefined) return <div className="loading-screen" role="status">Opening Ask ACA…</div>
  if (!session) return <>{sessionError ? <p role="alert" className="global-error">Your session could not be restored. Please sign in again.</p> : null}<SignIn purpose="ask-aca" onRequestLink={requestLink} onPasswordSignIn={signIn} /></>
  return <main className="ask-aca-page">
    <nav aria-label="Academy navigation"><a href="/learn/">Learning home</a><a href="/library/">Books & Resources</a></nav>
    <div className="ask-aca-card"><p className="eyebrow">AI Confidence Academy · Learner guidance</p><AcademyGuide key={session.user.id} accessToken={session.access_token} page /></div>
  </main>
}
