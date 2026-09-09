// Temporary preview-only diagnostics: numeric player state, never media URLs,
// lesson text, credentials, microphone input, or recordings.
export function observePlayback() {
  const ids = new WeakMap<HTMLMediaElement, number>()
  let nextId = 0
  let remaining = 120
  let queued: Record<string, unknown>[] = []
  const run = Math.random().toString(36).slice(2, 10)
  const finite = (n: number) => Number.isFinite(n) ? Math.round(n * 100) / 100 : null
  function capture(media: HTMLMediaElement, event: string) {
    if (remaining <= 0 || queued.length >= 12) return
    if (!ids.has(media)) ids.set(media, ++nextId)
    remaining--
    queued.push({ run, media: ids.get(media), kind: media.tagName.toLowerCase(), event,
      time: finite(media.currentTime), duration: finite(media.duration),
      ready: media.readyState, network: media.networkState, error: media.error?.code ?? 0,
      paused: media.paused, muted: media.muted, volume: finite(media.volume),
      width: media instanceof HTMLVideoElement ? media.videoWidth : 0,
      height: media instanceof HTMLVideoElement ? media.videoHeight : 0,
      visible: document.visibilityState === 'visible', focused: document.hasFocus(),
    })
  }
  function flush() {
    if (!queued.length) return
    const events = queued
    queued = []
    void fetch('/api/academy/playback-diagnostics', {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    }).catch(() => { /* Diagnostics must not interrupt the lesson. */ })
  }
  const eventTypes = ['loadstart', 'loadedmetadata', 'canplay', 'play', 'playing', 'pause', 'waiting', 'stalled', 'error', 'ended', 'volumechange', 'emptied']
  const onMedia = (event: Event) => {
    if (event.target instanceof HTMLMediaElement) capture(event.target, event.type)
  }
  function snapshot(event: string) {
    document.querySelectorAll<HTMLMediaElement>('video,audio').forEach(media => capture(media, event))
    flush()
  }
  eventTypes.forEach(event => document.addEventListener(event, onMedia, true))
  const onFocus = () => snapshot('focus')
  const onBlur = () => snapshot('blur')
  const onVisibility = () => snapshot('visibility')
  window.addEventListener('focus', onFocus)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)
  const timer = window.setInterval(() => {
    snapshot('sample')
    if (remaining <= 0) window.clearInterval(timer)
  }, 5000)
  return () => {
    window.clearInterval(timer)
    eventTypes.forEach(event => document.removeEventListener(event, onMedia, true))
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
