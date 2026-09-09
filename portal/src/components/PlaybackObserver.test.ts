import { vi } from 'vitest'
import { observePlayback } from '../../../academy/playback-observer'

it('reports state changes without controlling playback or sending the recording URL', () => {
  vi.useFakeTimers()
  const fetcher = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetcher)
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const media = document.createElement('audio')
  media.src = 'https://example.test/private-recording.mp3?token=secret'
  document.body.append(media)
  const stop = observePlayback()
  try {
    media.currentTime = 4
    media.dispatchEvent(new Event('playing'))
    vi.advanceTimersByTime(5000)
    media.currentTime = 9
    window.dispatchEvent(new Event('blur'))
    const sent = fetcher.mock.calls.flatMap(call => JSON.parse(call[1].body).events)
    expect(sent.some(event => event.time === 4)).toBe(true)
    expect(sent.some(event => event.time === 9 && event.event === 'blur')).toBe(true)
    expect(JSON.stringify(sent)).not.toMatch(/private-recording|secret|example\.test/)
    expect(play).not.toHaveBeenCalled()
    expect(pause).not.toHaveBeenCalled()
  } finally {
    stop(); media.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers()
  }
})
