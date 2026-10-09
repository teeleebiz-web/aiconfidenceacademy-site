import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

const api = vi.hoisted(() => ({ mode: 'video', denied: false, expired: false, sign: vi.fn() }))

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
    const rows: Record<string, unknown[]> = { course_journeys: [{ id: 'qa-journey', course_id: 'qa-course', journey_number: 1, week_number: 1, title: 'Sample Journey', promise: '', release_offset_days: 0, status: 'published' }], lessons: api.expired ? [] : [lesson] }
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
    rpc: async (name: string) => name === 'get_learner_workbooks' ? {data:[{page_id:'1.1',title:'Workbook'}],error:null} : name === 'is_aca_curriculum_owner' ? { data: false, error: null } : { data: [{ current_lesson_id: 'qa-lesson', current_journey_id: 'qa-journey', access_status: api.expired ? 'scheduled' : name === 'get_learner_lesson_access' ? 'available' : 'active', released_lesson_ids: ['qa-lesson'], remaining_seconds: 7200, hard_expires_at: new Date(Date.now()+7200000).toISOString() }], error: null },
    storage: { from: () => ({ createSignedUrl: api.sign }) },
  } }
})

beforeEach(() => {
  api.mode = 'video'; api.denied = false; api.expired = false
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => ({ok:!api.denied,json:async()=>({video:api.mode==='video'?'https://media.example/approved-lesson.mp4':null,audio:api.mode==='audio'?'https://media.example/approved-lesson.mp3':null})}) as Response)
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
  expect(api.sign).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledWith('https://checkout.aiconfidenceacademy.org/api/learner/lesson-media/qa-lesson', expect.objectContaining({headers:{'X-ACA-Access-Token':'qa-token'}}))
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
  expect(screen.getByRole('link', { name: /Back to Lesson 1.1/ }).getAttribute('href')).toBe('/learn/?lesson=1.1')
  vi.unstubAllGlobals()
})


it('returns to the exact available lesson from its workbook link', async () => {
  window.history.replaceState(null, '', '/learn/?lesson=1.1')
  render(<App />)
  expect(await screen.findByRole('heading', {name:'Synthetic lesson'})).toBeTruthy()
  expect(screen.getByRole('link',{name:'Open Workbook'}).getAttribute('target')).toBeNull()
})

it('closes teaching and media at the deadline and retains the workbook entrance', async () => {
  const {container,unmount} = render(<App />)
  await userEvent.click(await screen.findByRole('button',{name:/open lesson/i}))
  await screen.findByRole('heading',{name:'Synthetic lesson'})
  const later = Date.now()+7200001
  api.expired = true
  const now = vi.spyOn(Date,'now').mockReturnValue(later)
  act(()=>window.dispatchEvent(new Event('focus')))
  await screen.findByRole('heading',{name:'My Workbooks'})
  expect(container.querySelector('video')).toBeNull()
  expect(screen.queryByText('Sample teaching')).toBeNull()
  expect(screen.queryByText('Sample prompt')).toBeNull()
  expect(screen.getByRole('link',{name:'Journey 1 Workbook'}).getAttribute('href')).toBe('/learn/?workbook=journey-one&lesson=1.1')
  unmount();now.mockRestore()
})

it('keeps an expired lesson closed on direct return', async () => {
  api.expired = true
  window.history.replaceState(null, '', '/learn/?lesson=1.1')
  const {container}=render(<App />)
  await screen.findByRole('heading',{name:'My Workbooks'})
  expect(screen.queryByRole('heading',{name:'Synthetic lesson'})).toBeNull()
  expect(container.querySelector('video')).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})

it('retains workbook answers while background access checks change its exit to My Workbooks', async () => {
  window.history.replaceState(null, '', '/learn/?workbook=journey-one&lesson=1.1')
  const record={scope:'qa-user',answers:{'answer':'Saved earlier'},revision:1,last_page:5,updated_at:null,allowedPages:[5],workbook:{pageCount:32,pages:[{number:5,kicker:'Practice',title:'Workbook after expiry',blocks:[{type:'field',id:'answer',label:'Answer'}]}]}}
  vi.mocked(fetch).mockImplementation(async()=>({ok:true,json:async()=>structuredClone(record)}) as Response)
  render(<App />)
  const input=await screen.findByRole('textbox',{name:'Answer'})
  expect((input as HTMLTextAreaElement).value).toBe('Saved earlier')
  fireEvent.change(input,{target:{value:'Continuing my workbook'}})
  api.expired=true
  act(()=>window.dispatchEvent(new Event('focus')))
  await waitFor(()=>expect(screen.getByRole('link',{name:/My Workbooks/}).getAttribute('href')).toBe('/learn/#my-workbooks'))
  expect(screen.getByRole('textbox',{name:'Answer'})).toBe(input)
  expect((input as HTMLTextAreaElement).value).toBe('Continuing my workbook')
  expect((screen.getByRole('button',{name:'Unavailable'}) as HTMLButtonElement).disabled).toBe(true)
})
