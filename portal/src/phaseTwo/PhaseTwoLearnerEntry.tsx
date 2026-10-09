import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { PhaseTwoLearnerHome } from './PhaseTwoLearnerHome'
import './phaseTwoLearnerEntry.css'

const phaseTwoCourseCode = 'phase-two-ai-professional-builder'

type AccessStatus = 'loading' | 'sign-in' | 'not-released' | 'not-enrolled' | 'active' | 'error'

/**
 * Phase Two-only learner entry gate. The course must be explicitly published
 * and the signed-in learner must have an ACTIVE, scoped enrollment.
 *
 * No enrollment creation, payment, publication, course modification, or
 * administrator bypass occurs here. This route stays on a review branch
 * until founder release approval.
 */
export function PhaseTwoLearnerEntry() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [state, setState] = useState<AccessStatus>('loading')
  const [enrollmentId, setEnrollmentId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setAuthReady(true)
      }
    }).catch(() => {
      if (mounted) {
        setSession(null)
        setAuthReady(true)
      }
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession)
        setAuthReady(true)
      }
    })
    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!authReady) return
    if (!session?.user.id) {
      setEnrollmentId(null)
      setState('sign-in')
      return
    }

    let cancelled = false
    const loadScopedEnrollment = async () => {
      setState('loading')
      setEnrollmentId(null)
      // A draft course can never unlock the learning surface.
      const course = await supabase.from('courses')
        .select('id, code, status')
        .eq('code', phaseTwoCourseCode)
        .eq('status', 'published')
        .maybeSingle()

      if (cancelled) return
      if (course.error) {
        setState('error')
        return
      }
      if (!course.data) {
        setState('not-released')
        return
      }

      const found = await supabase.from('enrollments')
        .select('id, status, learner_id, course_id, starts_at, access_expires_at')
        .eq('learner_id', session.user.id)
        .eq('course_id', course.data.id)
        .eq('status', 'active')
        .maybeSingle()

      if (cancelled) return
      if (found.error) {
        setState('error')
        return
      }
      const enrollment = found.data
      const now = Date.now()
      const eligible = enrollment?.status === 'active' &&
        enrollment.learner_id === session.user.id &&
        enrollment.course_id === course.data.id &&
        (!enrollment.starts_at || Date.parse(enrollment.starts_at) <= now) &&
        (!enrollment.access_expires_at || Date.parse(enrollment.access_expires_at) > now)

      if (!eligible) {
        setState('not-enrolled')
        return
      }

      setEnrollmentId(enrollment.id)
      setState('active')
    }
    void loadScopedEnrollment().catch(() => {
      if (!cancelled) setState('error')
    })

    return () => { cancelled = true }
  }, [authReady, session?.user.id])

  if (state === 'active' && enrollmentId) {
    return <PhaseTwoLearnerHome enrollmentId={enrollmentId} />
  }
  return (
    <main className="p2-entry-page">
      <section className="p2-entry-panel" aria-labelledby="p2-entry-title">
        <p className="eyebrow">AI Confidence Academy · Phase Two</p>
        <h1 id="p2-entry-title">AI Professional and Builder Pathway</h1>
        {state === 'loading' && <p role="status">Checking your Academy course access…</p>}
        {state === 'sign-in' && <>
          <p>Sign in with your existing Academy account to check your Phase Two enrollment.</p>
          <a href="/learn/">Open Academy sign-in</a>
        </>}
        {state === 'not-released' && <p role="status">Phase Two enrollment and learning access are not yet open.</p>}
        {state === 'not-enrolled' && <p role="status">No active Phase Two enrollment was found for this account.</p>}
        {state === 'error' && <p role="alert">Phase Two access could not be verified. Please try again later.</p>}
      </section>
    </main>
  )
}
