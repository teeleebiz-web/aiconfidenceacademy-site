import { useEffect, useState } from 'react'
import { AcademyWelcome, academyWelcomeVideoPath } from '../../../academy/AcademyWelcome'
import { GettingStarted } from '../../../academy/GettingStarted'
import { supabase } from '../lib/supabase'

export function onboardingStorageKey(enrollmentId: string) {
  return `aca-onboarding:v1:${enrollmentId}`
}

export function hasCompletedOnboarding(enrollmentId: string) {
  try { return localStorage.getItem(onboardingStorageKey(enrollmentId)) === 'complete' }
  catch { return false }
}

export function rememberCompletedOnboarding(enrollmentId: string) {
  try { localStorage.setItem(onboardingStorageKey(enrollmentId), 'complete') }
  catch { /* The current session can continue when device storage is unavailable. */ }
}

export function LearnerOnboarding({ onContinue }: { onContinue?: () => void }) {
  const [step, setStep] = useState<'welcome' | 'getting-started'>('welcome')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    supabase.storage.from('aca-learning-media').createSignedUrl(academyWelcomeVideoPath, 3600)
      .then(({ data, error: mediaError }) => {
        if (cancelled) return
        if (mediaError || !data?.signedUrl) setError('The academy could not load this material. Please try again.')
        else setMediaUrl(data.signedUrl)
      })
      .catch(() => { if (!cancelled) setError('The academy could not load this material. Please try again.') })
    return () => { cancelled = true }
  }, [])

  if (step === 'getting-started') return <GettingStarted
    onBack={() => { setStep('welcome'); window.scrollTo(0, 0) }}
    onContinue={onContinue}
  />
  if (error) return <p className="global-error" role="alert">{error}</p>
  if (!mediaUrl) return <p className="loading-screen">Loading Phase One…</p>
  return <AcademyWelcome mediaUrl={mediaUrl} onContinue={() => {
    setStep('getting-started'); window.scrollTo(0, 0)
  }} />
}
