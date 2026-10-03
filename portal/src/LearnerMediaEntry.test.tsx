import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

const api = vi.hoisted(() => ({ mode: 'video', denied: false, sign: vi.fn() }))

vi.mock('./lib/supabase', () => {
  const query = (table: string) => {
    const lesson = { id: 'qa-lesson', course_id: 'qa-course', journey_id: 'qa-journey', page_id: '1.1', title: 'Synthetic lesson', purpose: 'Practice safely.', estimated_minutes: 45, course_position: 1, journey_position: 1, unlock_offset_days: 0, status: 'published', content: {
      video_path: api.mode === 'video' ? 'approved-lesson.mp4' : null,
      audio_path: api.mode === 'audio' ? 'approved-lesson.mp3' : null,
      outcomes: ['Practice'], vocabulary: {}, teaching: ['Sample teaching'], examples: [],
      practice_prompt: 'Sample prompt', practice_steps: ['Practice'], artifact: 'Sample reflection',
      stay_engaged: 'Reflect', knowledge_check: [], review_questions: [], rhythm: 'Practice', accessibility: 'Read or listen',
    } }
    const enrollment = { id: 'qa-enrollment', learner_id: 'qa-user', course_id: 'qa-course', status: 'active', starts_at: null, access_expires_at: null, course: { id: 'qa-course', code: 'synthetic', title: 'Synthetic course', summary: '' } }
    const rows: Record<string, unknown[]> = { course_journeys: [{ id: 'qa-journey', course_id: 'qa-course', journey_number: 1, week_number: 1, title: 'Sample Journey', promise: '', release_offset_days: 0, status: 'published' }], lessons: [lesson] }
    const result = Promise.resolve({ data: rows[table] ?? [], error: null })
    const q = {
      select: () => q, eq: () => q, in: () => q, order: () => q, limit: () => q,
      maybeSingle: async () => ({ data: table === 'enrollments' ? enrollment : table === 'profiles' ? { first_name: 'QA' } : null, error: null }),
      then: result.then.bind(result),
    }
    return q
  }
  return { supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'qa-user' }, access_token: 'qa-token' } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    from: query,
    rpc: async (name: string) => name === 'is_aca_curriculum_owner' ? { data: false, error: null } : { data: [{ current_lesson_id: 'qa-lesson', current_journey_id: 'qa-journey', access_status: name === 'get_learner_lesson_access' ? 'available' : 'active', released_lesson_ids: ['qa-lesson'], remaining_seconds: 7200 }], error: null },
    storage: { from: () => ({ createSignedUrl: api.sign }) },
  } }
})

beforeEach(() => {
  api.mode = 'video'; api.denied = false
  api.sign.mockReset()
  api.sign.mockImplementation(async (path: string) => ({ data: api.denied ? null : { signedUrl: `https://media.example/${path}` }, error: api.denied ? { message: 'Denied' } : null }))
  window.history.replaceState(null, '', '/learn/')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState(null, '', '/learn/') })

it.each(['video', 'audio'])('connects the saved %s to the actual lesson player', async (kind) => {
  api.mode = kind
  const { container } = render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /open lesson/i }))
  expect(await screen.findByRole('heading', { name: 'Synthetic lesson' })).toBeTruthy()
  const path = `approved-lesson.${kind === 'video' ? 'mp4' : 'mp3'}`
  expect(api.sign).toHaveBeenCalledWith(path, 7200)
  expect(container.querySelector(kind)?.getAttribute('src')).toBe(`https://media.example/${path}`)
  expect(screen.getByRole('link', { name: 'Open Workbook' }).getAttribute('href')).toBe('/learn/?workbook=journey-one&lesson=1.1')
  expect(screen.queryByText(/will be available here/i)).toBeNull()
})

it('does not present a completed recording as a placeholder when signing fails', async () => {
  api.denied = true
  const { container } = render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /open lesson/i }))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'The academy could not load this material. Please try again.')
  expect(container.querySelector('video')).toBeNull()
})

it('opens the existing workbook inside learner access using the authenticated backend', async () => {
  window.history.replaceState(null, '', '/learn/?workbook=journey-one&lesson=1.1')
  const request = vi.fn(async () => ({ ok: true, json: async () => ({ scope: 'qa-user', answers: {}, revision: 0, last_page: 5, updated_at: null, allowedPages: [5], workbook: { pages: [{ number: 5, kicker: 'Sample', title: 'Synthetic workbook page', blocks: [{ type: 'field', id: 'sample-answer', label: 'My answer' }] }] } }) }))
  vi.stubGlobal('fetch', request)
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Synthetic workbook page' })).toBeTruthy()
  expect(request).toHaveBeenCalledWith('https://checkout.aiconfidenceacademy.org/api/learner/workbooks/journey-one', expect.objectContaining({ headers: expect.objectContaining({ 'X-ACA-Access-Token': 'qa-token' }) }))
  expect(screen.getByRole('link', { name: /Back to Phase One/ }).getAttribute('href')).toBe('/learn/')
  vi.unstubAllGlobals()
})
