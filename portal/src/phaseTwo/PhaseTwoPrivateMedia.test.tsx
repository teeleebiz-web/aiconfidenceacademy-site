import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { PhaseTwoPrivateMedia, privateMediaAccess, requestPhaseTwoMedia, type PhaseTwoMediaAccess } from './PhaseTwoPrivateMedia'

const api = vi.hoisted(() => ({ session: vi.fn(), auth: vi.fn(), unsubscribe: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: api.session, onAuthStateChange: api.auth } } }))
const source = '/assets/videos/phase-two-lesson-1-1/intro.mp4'
const bundle = (suffix = 'one') => ({ files: { [source]: 'https://private.test/' + suffix }, expiresAt: new Date(Date.now() + 70000).toISOString() })
beforeEach(() => {
  vi.stubEnv('VITE_ACA_PRIVATE_PHASE_TWO_MEDIA', 'true')
  api.session.mockResolvedValue({ data: { session: { access_token: 'session-secret' } } })
  api.auth.mockReturnValue({ data: { subscription: { unsubscribe: api.unsubscribe } } })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => bundle() }))
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); vi.clearAllMocks() })

it('resolves only authorized objects and does not fall back to a public media URL', async () => {
  const access = privateMediaAccess(bundle())
  expect(access.resolve('https://aiconfidenceacademy.org' + source + '?v=old')).toBe('https://private.test/one')
  expect(access.resolve('/assets/videos/phase-two-lesson-2-1/intro.mp4')).toBeUndefined()
  await expect(access.json('/assets/videos/phase-two-lesson-2-1/report.json')).rejects.toThrow('unavailable')
  expect(fetch).not.toHaveBeenCalled()
})
it('sends the session only in the auth header and selects the exact enrollment', async () => {
  await requestPhaseTwoMedia('lesson-1', 'enrollment-1')
  expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/phase-two-media\/lesson-1\?enrollment=enrollment-1$/), expect.objectContaining({ headers: { 'X-ACA-Access-Token': 'session-secret' }, cache: 'no-store' }))
  expect(String(vi.mocked(fetch).mock.calls[0][0])).not.toContain('session-secret')
})
it('does not render a public player while access is loading or denied', async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)
  render(<PhaseTwoPrivateMedia lessonId="lesson">{() => <video aria-label="Private video" src={source} />}</PhaseTwoPrivateMedia>)
  expect(screen.queryByLabelText('Private video')).toBeNull()
  await screen.findByRole('alert')
  expect(screen.queryByLabelText('Private video')).toBeNull()
})

function Player({ access }: { access: PhaseTwoMediaAccess }) {
  const [draft, setDraft] = useState('saved draft')
  return <><input aria-label="Work in progress" value={draft} onChange={e => setDraft(e.target.value)} /><video aria-label="Introduction" src={access.resolve(source)} /></>
}
it('retains the lesson subtree and playback position when expiring links renew', async () => {
  vi.useFakeTimers()
  vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => bundle('one') } as Response).mockResolvedValueOnce({ ok: true, json: async () => bundle('two') } as Response)
  render(<PhaseTwoPrivateMedia lessonId="lesson">{access => <Player access={access} />}</PhaseTwoPrivateMedia>)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  fireEvent.change(screen.getByLabelText('Work in progress'), { target: { value: 'unsaved progress' } })
  const video = screen.getByLabelText('Introduction') as HTMLVideoElement
  video.currentTime = 44
  await act(async () => { await vi.advanceTimersByTimeAsync(40001) })
  expect(screen.getByLabelText('Work in progress')).toHaveProperty('value', 'unsaved progress')
  expect(video.getAttribute('src')).toBe('https://private.test/two')
  video.currentTime = 0
  fireEvent.loadedMetadata(video)
  expect(video.currentTime).toBe(44)
})
it('rejects a late signed response after sign-out', async () => {
  let finish!: (value: Response) => void
  vi.mocked(fetch).mockReturnValue(new Promise(resolve => { finish = resolve }))
  render(<PhaseTwoPrivateMedia lessonId="lesson">{access => <Player access={access} />}</PhaseTwoPrivateMedia>)
  await waitFor(() => expect(fetch).toHaveBeenCalled())
  await act(async () => { api.auth.mock.calls.at(-1)![0]('SIGNED_OUT', null) })
  await act(async () => { finish({ ok: true, json: async () => bundle() } as Response) })
  expect(screen.queryByLabelText('Introduction')).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain('Please sign in')
})
