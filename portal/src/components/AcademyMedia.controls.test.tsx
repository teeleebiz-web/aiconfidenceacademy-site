import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AcademyMedia } from './AcademyMedia'

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('uses one play button and one video element', async () => {
  render(<AcademyMedia kind="video" src="/fixture.mp4" label="Video" />)
  const media = screen.getByLabelText('Video') as HTMLVideoElement
  fireEvent.click(screen.getByRole('button', { name: 'Play video' }))
  await waitFor(() => expect(media.play).toHaveBeenCalledTimes(1))
  expect(document.querySelectorAll('video')).toHaveLength(1)
  expect(screen.getAllByText('Play')).toHaveLength(1)
})

it('restores an audible level after sound was set to zero', () => {
  render(<AcademyMedia kind="video" src="/fixture.mp4" label="Video" />)
  const volume = screen.getByText('Sound').closest('label')?.querySelector('input') as HTMLInputElement
  fireEvent.change(volume, { target: { value: '0.55' } })
  fireEvent.change(volume, { target: { value: '0' } })
  fireEvent.click(screen.getByRole('button', { name: 'Turn sound on' }))
  expect(volume.value).toBe('0.55')
  expect(screen.getByRole('button', { name: 'Mute sound' })).not.toBeNull()
})
