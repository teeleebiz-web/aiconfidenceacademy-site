import { useEffect, useState } from 'react'
import { AcademyWelcome, academyWelcomeVideoPath } from '../../../academy/AcademyWelcome'
import { GettingStarted } from '../../../academy/GettingStarted'
import { supabase } from '../lib/supabase'

export function LearnerOnboarding({ onContinue }: { onContinue?: () => Promise<void> }) {
  const [step, setStep] = useState<'welcome' | 'getting-started'>('welcome')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [continuing, setContinuing] = useState(false)

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
    continuing={continuing}
    onContinue={onContinue ? async () => {
      if (continuing) return
      setContinuing(true)
      try { await onContinue() }
      finally { setContinuing(false) }
    } : undefined}
  />
  if (error) return <p className="global-error" role="alert">{error}</p>
  if (!mediaUrl) return <p className="loading-screen">Loading Phase One…</p>
  return <AcademyWelcome mediaUrl={mediaUrl} onContinue={() => {
    setStep('getting-started'); window.scrollTo(0, 0)
  }} />
}
