import { useEffect, useState } from 'react'
import { AcademyWelcome, academyWelcomeVideoPath, academyWelcomeCaptionPath } from '../../../academy/AcademyWelcome'
import { GettingStarted } from '../../../academy/GettingStarted'
import { supabase } from '../lib/supabase'
import { usePageStart } from '../lib/usePageStart'

export function LearnerOnboarding({ onContinue }: { onContinue?: () => Promise<void> }) {
  const [step, setStep] = useState<'welcome' | 'getting-started'>('welcome')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [captionUrl, setCaptionUrl] = useState<string | undefined>()
  const [error, setError] = useState('')
  const [continuing, setContinuing] = useState(false)
  usePageStart(mediaUrl ? `onboarding:${step}` : null)

  useEffect(() => {
    let cancelled = false
    Promise.all([academyWelcomeVideoPath, academyWelcomeCaptionPath].map(path =>
      supabase.storage.from('aca-learning-media').createSignedUrl(path, 3600)))
      .then(([video, captions]) => {
        if (cancelled) return
        if (video.error || !video.data?.signedUrl || captions.error || !captions.data?.signedUrl) setError('The academy could not load this material. Please try again.')
        else { setMediaUrl(video.data.signedUrl); setCaptionUrl(captions.data.signedUrl) }
      })
      .catch(() => { if (!cancelled) setError('The academy could not load this material. Please try again.') })
    return () => { cancelled = true }
  }, [])

  if (step === 'getting-started') return <GettingStarted
    onBack={() => setStep('welcome')}
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
  return <AcademyWelcome mediaUrl={mediaUrl} captionUrl={captionUrl} onContinue={() => {
    setStep('getting-started')
  }} />
}
