import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LessonVideo } from './LessonVideo'

it('keeps the video closed until chosen, loads with sound, and offers a fresh retry', async () => {
  const user = userEvent.setup()
  const { container } = render(<LessonVideo src="/api/academy/welcome-video/example" label="Journey 2 welcome video" />)
  expect(container.querySelector('video')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Watch Journey 2 welcome video' }))
  const video = container.querySelector('video')!
  expect(video.preload).toBe('auto')
  expect(video.autoplay).toBe(false)
  video.muted = true; video.volume = 0
  fireEvent.loadedMetadata(video)
  expect(video.muted).toBe(false); expect(video.volume).toBe(1)
  fireEvent.error(video)
  await user.click(screen.getByRole('button', { name: 'Reload video' }))
  expect(container.querySelector('video')).not.toBe(video)
  expect(container.querySelector('video')!.getAttribute('src')).toBe('/api/academy/welcome-video/example?retry=1')
  expect(screen.queryByRole('alert')).toBeNull()
})
