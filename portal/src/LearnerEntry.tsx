import { lazy, Suspense, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { SignIn } from './components/SignIn'

const PhaseOne = lazy(() => import('./App').then(module => ({ default: module.App })))
const phaseCodes = ['phase-one-chatgpt-foundations', 'phase-two-ai-professional-builder'] as const
type Phase = { number: 1 | 2; title: string }
type Access = { userId: string; phases: Phase[]; error: boolean }
const openPhaseTwo = () => window.location.replace('/learn/?course=phase-two')

// This selects an existing learning space. Enrollment, publication, billing and
// lesson eligibility remain enforced by that space and the database's RLS.
export function LearnerEntry({ onOpenPhaseTwo = openPhaseTwo }: { onOpenPhaseTwo?: () => void }) {
  const [session, setSession] = useState<Session | null>()
  const [sessionError, setSessionError] = useState(false)
  const [access, setAccess] = useState<Access | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    let revision = 0
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      revision++
      if (active) { setSessionError(false); setSession(nextSession) }
    })
    const initialRevision = revision
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active || revision !== initialRevision) return
      setSessionError(Boolean(error))
      setSession(error ? null : data.session)
    }).catch(() => {
      if (active && revision === initialRevision) { setSessionError(true); setSession(null) }
    })
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!session?.user) { setAccess(null); return }
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const userId = session.user.id
    setAccess(null)
    const request = supabase.from('enrollments')
      .select('course:courses!inner(code,title)')
      .eq('learner_id', userId)
    Promise.race([request, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Enrollment check timed out')), 15000)
    })]).then(({ data, error }) => {
      if (!active) return
      if (error) throw error
      const phases = new Map<number, Phase>()
      for (const row of data ?? []) {
        const course = Array.isArray(row.course) ? row.course[0] : row.course
        const position = phaseCodes.indexOf(course?.code as typeof phaseCodes[number])
        if (position >= 0) {
          const number = (position + 1) as 1 | 2
          phases.set(number, { number, title: course.title })
        }
      }
      setAccess({ userId, phases: [...phases.values()].sort((a, b) => a.number - b.number), error: false })
    }).catch(() => {
      if (active) setAccess({ userId, phases: [], error: true })
    }).finally(() => clearTimeout(timer))
    return () => { active = false; clearTimeout(timer) }
  }, [session?.user.id, retry])

  const currentAccess = access?.userId === session?.user.id ? access : null
  const phaseTwoOnly = currentAccess && !currentAccess.error
    && currentAccess.phases.length === 1 && currentAccess.phases[0].number === 2
  useEffect(() => {
    if (phaseTwoOnly) onOpenPhaseTwo()
  }, [phaseTwoOnly, onOpenPhaseTwo])

  async function requestSignInLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email, options: {
      shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/learn/`,
    } })
    if (error) throw error
  }
  async function signInWithPassword(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }
  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) { setSessionError(true); return }
    setAccess(null)
    setSession(null)
  }

  const loading = <div className="loading-screen" role="status">Preparing your ACA learning space…</div>
  if (session === undefined) return loading
  if (!session) return <>
    {sessionError ? <p role="alert" className="global-error">Your session could not be restored. Please sign in again.</p> : null}
    <SignIn onRequestLink={requestSignInLink} onPasswordSignIn={signInWithPassword} />
  </>
  if (!currentAccess || phaseTwoOnly) return loading
  if (currentAccess.error) return <main className="auth-shell"><section className="auth-card">
    <h1>Your learning space could not be checked</h1>
    <p role="alert">Please try again. Your enrollment and saved work have not been changed.</p>
    <button onClick={() => setRetry(value => value + 1)}>Try again</button>
    <button className="quiet-button" onClick={() => void signOut()}>Sign out</button>
  </section></main>
  if (currentAccess.phases.length === 1) return <Suspense fallback={loading}><PhaseOne /></Suspense>
  return <main className="auth-shell"><section className="auth-card">
    <p className="eyebrow">ACA learner portal</p>
    <h1>{currentAccess.phases.length ? 'Choose your learning phase' : 'Your enrollment is not available here'}</h1>
    <p>{currentAccess.phases.length
      ? 'You are signed in. Choose the phase you want to continue. Your saved work and lesson allowance stay with that phase.'
      : 'Use the email connected to your enrollment. If you have paid and need help finding your access, contact ACA support.'}</p>
    {currentAccess.phases.map(phase => <p key={phase.number}>
      <a className="primary-link" href={`/learn/?course=phase-${phase.number === 1 ? 'one' : 'two'}`}>Open Phase {phase.number === 1 ? 'One' : 'Two'}</a>
    </p>)}
    {!currentAccess.phases.length ? <p><a href="/contact/#request">Contact ACA support</a></p> : null}
    {sessionError ? <p role="alert">Sign-out could not finish. Please try again.</p> : null}
    <button className="quiet-button" onClick={() => void signOut()}>Sign out</button>
  </section></main>
}
