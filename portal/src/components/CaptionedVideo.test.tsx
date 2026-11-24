import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CaptionedVideo } from '../../../academy/CaptionedVideo'
import { bindCaptionControl, mountPlaybackControls } from '../../../assets/caption-controls.js'

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
    const button = await screen.findByRole('button', { name: `Turn captions ${mode === 'showing' ? 'off' : 'on'}` })
    expect(button.getAttribute('aria-controls')).toBe(video.id)
    expect(button.getAttribute('aria-pressed')).toBe(String(mode === 'showing'))
    button.focus()
    await userEvent.setup().keyboard(' ')
    expect(tracks[0].mode).toBe(mode === 'showing' ? 'disabled' : 'showing')
    expect(tracks[1].mode).toBe('hidden')
    expect(video.currentTime).toBe(45)
    expect(document.activeElement).toBe(button)
    expect(video.controls).toBe(false)
    getter.mockRestore()
  })

  it('follows changes made through the native menu', async () => {
    const tracks = trackList()
    const getter = vi.spyOn(HTMLMediaElement.prototype, 'textTracks', 'get').mockReturnValue(tracks as unknown as TextTrackList)
    render(<CaptionedVideo><track kind="captions" src="/en.vtt" /></CaptionedVideo>)
    await screen.findByRole('button', { name: 'Turn captions on' })
    act(() => { tracks[0].mode = 'showing'; tracks.dispatchEvent(new Event('change')) })
    expect(screen.getByRole('button', { name: 'Turn captions off' }).getAttribute('aria-pressed')).toBe('true')
    act(() => { tracks[0].mode = 'disabled'; tracks.dispatchEvent(new Event('change')) })
    expect(screen.getByRole('button', { name: 'Turn captions on' }).getAttribute('aria-pressed')).toBe('false')
    getter.mockRestore()
  })

  it('handles captions arriving after private authorization and preserves the choice when their URL renews', async () => {
    const tracks = trackList()
    const getter = vi.spyOn(HTMLMediaElement.prototype, 'textTracks', 'get').mockReturnValue(tracks as unknown as TextTrackList)
    const { rerender } = render(<CaptionedVideo />)
    expect(screen.queryByRole('button', {name: /Turn captions/})).toBeNull()
    rerender(<CaptionedVideo><track kind="captions" src="/first.vtt" /></CaptionedVideo>)
    const button = await screen.findByRole('button', { name: 'Turn captions on' })
    fireEvent.click(button)
    tracks[0].mode = 'disabled'
    rerender(<CaptionedVideo><track kind="captions" src="/renewed.vtt" /></CaptionedVideo>)
    await waitFor(() => expect(tracks[0].mode).toBe('showing'))
    expect(screen.getByRole('button', { name: 'Turn captions off' })).toBe(button)
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
    await waitFor(() => expect(host.querySelector<HTMLElement>('.aca-player-controls')?.hidden).toBe(false))
    const video = host.querySelector('video')!
    const button = host.querySelector<HTMLButtonElement>('.aca-caption-button')!
    expect(host.querySelectorAll('.aca-caption-button').length).toBe(1)
    if (hasError) {
      expect(video.closest('video-player')?.nextElementSibling?.className).toBe('topic-video-error')
      expect(video.closest('video-player')?.nextElementSibling?.hasAttribute('hidden')).toBe(true)
    }
    expect(video.closest('media-container')?.contains(button)).toBe(true)
    expect(button.closest('.aca-playback-bar')).toBeTruthy()
    expect(button.textContent).toBe('CC')
    expect(button.getAttribute('aria-label')).toBe('Turn captions on')
    fireEvent.click(button)
    expect(tracks[0].mode).toBe('showing')
    expect(button.getAttribute('aria-label')).toBe('Turn captions off')
    expect(button.getAttribute('aria-controls')).toBe(video.id)
    host.remove()
    getter.mockRestore()
  })
})


it('retains native controls if the enhanced controls cannot load', async () => {
  const video = document.createElement('video')
  video.controls = true
  const host = document.createElement('div')
  document.body.append(video, host)
  const controller = mountPlaybackControls(video, host, async () => { throw new Error('offline') })
  await controller.ready
  expect(video.controls).toBe(true)
  expect(host.hidden).toBe(true)
  controller.destroy()
})

it('does not enhance a player after it has been unmounted', async () => {
  const video = document.createElement('video')
  video.controls = true
  const host = document.createElement('div')
  document.body.append(video, host)
  let finish!: () => void
  const controller = mountPlaybackControls(video, host, () => new Promise<void>(resolve => { finish = resolve }))
  controller.destroy()
  finish()
  await controller.ready
  expect(video.controls).toBe(true)
  expect(host.children.length).toBe(0)
})

it('routes the integrated play and mute controls to the original video', async () => {
  const { container } = render(<CaptionedVideo controls aria-label="Playback test" />)
  const video = container.querySelector('video')!
  let paused = true
  Object.defineProperty(video, 'paused', { configurable: true, get: () => paused })
  const play = vi.spyOn(video, 'play').mockImplementation(async () => {
    paused = false
    video.dispatchEvent(new Event('play'))
    video.dispatchEvent(new Event('playing'))
  })
  const pause = vi.spyOn(video, 'pause').mockImplementation(() => {
    paused = true
    video.dispatchEvent(new Event('pause'))
  })
  const playButton = await screen.findByRole('button', { name: 'Play' })
  fireEvent.click(playButton)
  await waitFor(() => expect(play).toHaveBeenCalledOnce())
  const pauseButton = await screen.findByRole('button', { name: 'Pause' })
  fireEvent.click(pauseButton)
  expect(pause).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: 'Mute' }))
  expect(video.muted).toBe(true)
  act(() => video.dispatchEvent(new Event('volumechange')))
  fireEvent.click(await screen.findByRole('button', { name: 'Unmute' }))
  expect(video.muted).toBe(false)
  expect(container.querySelector('video')).toBe(video)
})
