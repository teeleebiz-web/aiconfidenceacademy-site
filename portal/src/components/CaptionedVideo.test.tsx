import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CaptionedVideo } from '../../../academy/CaptionedVideo'
import { bindCaptionControl } from '../../../assets/caption-controls.js'

function trackList(mode: TextTrackMode = 'disabled') {
  const events = new EventTarget()
  const tracks = [{ kind: 'captions', language: 'en', mode }, { kind: 'metadata', language: '', mode: 'hidden' }]
  return Object.assign(tracks, {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  })
}

describe('visible caption control', () => {
  it.each(['disabled', 'showing'] as const)('reflects native %s mode, toggles with the keyboard and preserves playback', async mode => {
    const tracks = trackList(mode)
    const getter = vi.spyOn(HTMLMediaElement.prototype, 'textTracks', 'get').mockReturnValue(tracks as unknown as TextTrackList)
    const { container } = render(<CaptionedVideo aria-label="Lesson video" controls><track kind="captions" src="/en.vtt" /></CaptionedVideo>)
    const video = container.querySelector('video')!
    video.currentTime = 45
    const button = screen.getByRole('button', { name: `CC · Captions ${mode === 'showing' ? 'on' : 'off'}` })
    expect(button.getAttribute('aria-controls')).toBe(video.id)
    expect(button.getAttribute('aria-pressed')).toBe(String(mode === 'showing'))
    button.focus()
    await userEvent.setup().keyboard(' ')
    expect(tracks[0].mode).toBe(mode === 'showing' ? 'disabled' : 'showing')
    expect(tracks[1].mode).toBe('hidden')
    expect(video.currentTime).toBe(45)
    expect(document.activeElement).toBe(button)
    expect(video.controls).toBe(true)
    getter.mockRestore()
  })

  it('follows changes made through the native menu', () => {
    const tracks = trackList()
    const getter = vi.spyOn(HTMLMediaElement.prototype, 'textTracks', 'get').mockReturnValue(tracks as unknown as TextTrackList)
    render(<CaptionedVideo><track kind="captions" src="/en.vtt" /></CaptionedVideo>)
    act(() => { tracks[0].mode = 'showing'; tracks.dispatchEvent(new Event('change')) })
    expect(screen.getByRole('button', { name: 'CC · Captions on' }).getAttribute('aria-pressed')).toBe('true')
    act(() => { tracks[0].mode = 'disabled'; tracks.dispatchEvent(new Event('change')) })
    expect(screen.getByRole('button', { name: 'CC · Captions off' }).getAttribute('aria-pressed')).toBe('false')
    getter.mockRestore()
  })

  it('handles captions arriving after private authorization and preserves the choice when their URL renews', async () => {
    const tracks = trackList()
    const getter = vi.spyOn(HTMLMediaElement.prototype, 'textTracks', 'get').mockReturnValue(tracks as unknown as TextTrackList)
    const { rerender } = render(<CaptionedVideo />)
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<CaptionedVideo><track kind="captions" src="/first.vtt" /></CaptionedVideo>)
    const button = await screen.findByRole('button', { name: 'CC · Captions off' })
    fireEvent.click(button)
    tracks[0].mode = 'disabled'
    rerender(<CaptionedVideo><track kind="captions" src="/renewed.vtt" /></CaptionedVideo>)
    await waitFor(() => expect(tracks[0].mode).toBe('showing'))
    expect(screen.getByRole('button', { name: 'CC · Captions on' })).toBe(button)
    getter.mockRestore()
  })

  it('reports a failed caption file and removes its listeners on cleanup', () => {
    const video = document.createElement('video')
    const element = document.createElement('track')
    element.kind = 'captions'
    Object.defineProperty(element, 'readyState', { value: 3 })
    video.append(element)
    const tracks = trackList()
    Object.defineProperty(video, 'textTracks', { value: tracks })
    const renderState = vi.fn()
    const controller = bindCaptionControl(video, renderState)
    expect(renderState).toHaveBeenLastCalledWith({ available: true, enabled: true, on: false, failed: true })
    controller.destroy()
    renderState.mockClear()
    tracks.dispatchEvent(new Event('change'))
    expect(renderState).not.toHaveBeenCalled()
  })

  it.each([false, true])('adds the public control while preserving playback errors (%s) and burned-in videos', async hasError => {
    const tracks = trackList()
    const getter = vi.spyOn(HTMLMediaElement.prototype, 'textTracks', 'get').mockReturnValue(tracks as unknown as TextTrackList)
    const host = document.createElement('section')
    host.innerHTML = '<video data-aca-caption-player><track kind="captions" src="/en.vtt"></video>' +
      (hasError ? '<p class="topic-video-error" hidden>Playback could not load.</p>' : '') +
      '<video><track kind="captions" src="/burned-in-extra.vtt"></video>'
    document.body.append(host)
    vi.resetModules()
    await import('../../../assets/caption-controls.js')
    const video = host.querySelector('video')!
    const button = host.querySelector('button')!
    expect(host.querySelectorAll('button').length).toBe(1)
    if (hasError) {
      expect(video.nextElementSibling?.className).toBe('topic-video-error')
      expect(video.nextElementSibling?.hasAttribute('hidden')).toBe(true)
      expect(video.nextElementSibling?.nextElementSibling?.contains(button)).toBe(true)
    } else expect(video.nextElementSibling?.contains(button)).toBe(true)
    expect(button.textContent).toBe('CC · Captions off')
    fireEvent.click(button)
    expect(tracks[0].mode).toBe('showing')
    expect(button.textContent).toBe('CC · Captions on')
    expect(button.getAttribute('aria-controls')).toBe(video.id)
    host.remove()
    getter.mockRestore()
  })
})
