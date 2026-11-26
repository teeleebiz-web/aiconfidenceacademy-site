import { act, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PhaseTwoIntroductionCaptions } from './PhaseTwoIntroductionCaptions'
import { requestPhaseTwoMedia, publicPhaseTwoMedia } from './PhaseTwoPrivateMedia'
vi.mock('./PhaseTwoPrivateMedia', async importOriginal => ({ ...await importOriginal<typeof import('./PhaseTwoPrivateMedia')>(), requestPhaseTwoMedia: vi.fn() }))
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks() })
const path = '/assets/videos/phase-two-lesson-2-1/ACA-Phase-Two-Lesson-2-1-Introduction-landscape.en.vtt'
it('offers English with captions on and renews the selected introduction without remounting the video', async () => {
  vi.useFakeTimers()
  vi.mocked(requestPhaseTwoMedia).mockResolvedValueOnce({ files: { [path]: 'https://private.test/first' }, expiresAt: new Date(Date.now()+90000).toISOString() }).mockResolvedValueOnce({ files: { [path]: 'https://private.test/renewed' }, expiresAt: new Date(Date.now()+180000).toISOString() })
  const { container } = render(<video><PhaseTwoIntroductionCaptions lessonId="lesson" pageId="2.1" access={publicPhaseTwoMedia}/></video>)
  await act(async () => {})
  const video = container.querySelector('video')
  expect(container.querySelector('track')?.getAttribute('src')).toBe('https://private.test/first')
  expect(container.querySelector('track')?.hasAttribute('default')).toBe(true)
  expect(requestPhaseTwoMedia).toHaveBeenCalledWith('lesson', undefined, expect.any(AbortSignal), true)
  await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  expect(container.querySelector('video')).toBe(video)
  expect(container.querySelector('track')?.getAttribute('src')).toBe('https://private.test/renewed')
})
it('clears a failed caption request and never falls back to public caption text', async () => {
  vi.mocked(requestPhaseTwoMedia).mockRejectedValue(new Error('Unavailable'))
  const { container } = render(<video><PhaseTwoIntroductionCaptions lessonId="lesson" pageId="2.1" access={publicPhaseTwoMedia}/></video>)
  await waitFor(() => expect(requestPhaseTwoMedia).toHaveBeenCalled())
  expect(container.querySelector('track')).toBeNull()
})
