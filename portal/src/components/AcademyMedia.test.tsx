import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { AcademyMedia } from './AcademyMedia'

const instances = vi.hoisted(() => [] as Array<{ media: HTMLMediaElement; options: Record<string, unknown>; destroy: ReturnType<typeof vi.fn> }>)
vi.mock('../vendor/plyr/plyr.mjs', () => ({
  default: class {
    destroy = vi.fn()
    constructor(media: HTMLMediaElement, options: Record<string, unknown>) {
      instances.push({ media, options, destroy: this.destroy })
    }
  },
}))

afterEach(() => { cleanup(); instances.length = 0 })

it('provides the video source immediately with one explicit play control', () => {
  render(<AcademyMedia kind="video" src="/api/academy/lesson-video/test" label="Lesson video" />)
  const media = screen.getByLabelText('Lesson video') as HTMLVideoElement
  expect(media.getAttribute('src')).toBe('/api/academy/lesson-video/test')
  expect(media.controls).toBe(false)
  expect(media.hasAttribute('playsinline')).toBe(true)
  expect(screen.getAllByRole('button', { name: /play video/i })).toHaveLength(1)
  expect(instances).toHaveLength(0)
  expect(screen.queryByRole('button', { name: /open|watch/i })).toBeNull()
})

it('replaces the media element and disposes the old player when lessons change', () => {
  const { rerender, unmount } = render(<AcademyMedia kind="audio" src="/first.mp3" label="Lesson audio" />)
  const first = instances[0]
  rerender(<AcademyMedia kind="audio" src="/second.mp3" label="Lesson audio" />)
  expect(first.destroy).toHaveBeenCalledTimes(1)
  expect(first.media.isConnected).toBe(false)
  expect(screen.getByLabelText('Lesson audio').getAttribute('src')).toBe('/second.mp3')
  expect(document.querySelectorAll('audio')).toHaveLength(1)
  unmount()
  expect(instances[1].destroy).toHaveBeenCalledTimes(1)
})

it('keeps captions attached and requests CORS only when a caption track needs it', () => {
  const { rerender } = render(<AcademyMedia kind="video" src="/movie.mp4" label="Video" captionUrl="/captions.vtt" />)
  expect(document.querySelector('track')?.getAttribute('src')).toBe('/captions.vtt')
  expect(document.querySelector('video')?.crossOrigin).toBe('anonymous')
  rerender(<AcademyMedia kind="video" src="/movie.mp4" label="Video" />)
  expect(document.querySelector('track')).toBeNull()
  expect(document.querySelector('video')?.crossOrigin).toBe('anonymous')
})

it('shows a playback failure and retries only on an explicit click', () => {
  render(<AcademyMedia kind="audio" src="/recording.mp3" label="Audio" />)
  fireEvent.error(screen.getByLabelText('Audio'))
  expect(screen.getByRole('alert').textContent).toContain('could not play')
  expect(instances).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(instances).toHaveLength(2)
  expect(instances[0].destroy).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alert')).toBeNull()
})
