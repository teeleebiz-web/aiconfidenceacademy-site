import { useEffect, useState } from 'react'
import { requestPhaseTwoMedia, type PhaseTwoMediaAccess } from './PhaseTwoPrivateMedia'

// Existing recordings retain their delivery route. New caption text stays private.
export function PhaseTwoIntroductionCaptions({ lessonId, enrollmentId, pageId, access }: {
  lessonId: string; enrollmentId?: string; pageId: string; access: PhaseTwoMediaAccess
}) {
  const [url, setUrl] = useState<string>()
  const number = pageId.replace('.', '-')
  const suffix = pageId.startsWith('6.') ? '-wide' : pageId === '2.1' ? '-landscape' : ''
  const path = `/assets/videos/phase-two-lesson-${number}/ACA-Phase-Two-Lesson-${number}-Introduction${suffix}.en.vtt`
  useEffect(() => {
    if (access.private) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const controller = new AbortController()
    setUrl(undefined)
    async function load() {
      try {
        const bundle = await requestPhaseTwoMedia(lessonId, enrollmentId, controller.signal, true)
        if (cancelled) return
        setUrl(bundle.files[path])
        timer = setTimeout(() => { void load() }, Math.max(1000, Date.parse(bundle.expiresAt) - Date.now() - 30000))
      } catch {
        if (!cancelled) { setUrl(undefined); timer = setTimeout(() => { void load() }, 30000) }
      }
    }
    void load()
    return () => { cancelled = true; controller.abort(); clearTimeout(timer) }
  }, [lessonId, enrollmentId, path, access.private])
  const source = access.private ? access.resolve(path) : url
  return source ? <track kind="captions" label="English" srcLang="en" src={source} default /> : null
}
