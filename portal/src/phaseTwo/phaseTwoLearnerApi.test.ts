import {
  loadPhaseTwoOutline,
  openPhaseTwoLesson,
  loadPhaseTwoLessonAccess,
} from './phaseTwoLearnerApi'

const api = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { rpc: api.rpc } }))

beforeEach(() => { vi.clearAllMocks() })

describe('Phase Two protected learner RPC adapter', () => {
  it('loads metadata-only lessons for an authorized enrollment', async () => {
    api.rpc.mockResolvedValueOnce({ data: [{
      lesson_id: 'lesson-1', page_id: '1.1', journey_number: 1, lesson_number: 1,
      lesson_title: 'Professional AI judgment and direction', access_status: 'available',
      remaining_seconds: 0, deadline_at: null,
    }], error: null })
    const outline = await loadPhaseTwoOutline('test-phase-two-enrollment')
    expect(api.rpc).toHaveBeenCalledWith('aca_phase_two_my_outline', {
      p_enrollment_id: 'test-phase-two-enrollment',
    })
    expect(outline).toHaveLength(1)
    expect(outline[0].access_status).toBe('available')
  })

  it('uses an authenticated server RPC to open protected teaching', async () => {
    api.rpc.mockResolvedValueOnce({ data: [{
      page_id: '1.1', lesson_title: 'Professional AI judgment and direction',
      lesson_purpose: 'Apply professional judgment.',
      lesson_content: { phase_two: { teaching: 'A protected teaching brief.' } },
      remaining_seconds: 7100,
      closes_at: '2026-10-08T22:00:00Z',
    }], error: null })
    const opened = await openPhaseTwoLesson('enrollment-a', 'lesson-a')
    expect(api.rpc).toHaveBeenCalledWith('open_aca_phase_two_lesson', {
      p_enrollment_id: 'enrollment-a', p_lesson_id: 'lesson-a',
    })
    expect(opened.lesson_content.phase_two?.teaching).toContain('teaching brief')
  })

  it('does not assume access when a server deadline is closed', async () => {
    api.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Expired' } })
    await expect(openPhaseTwoLesson('enrollment-a', 'lesson-a')).rejects.toThrow(/could not open/)
  })

  it('reads remaining time without reopening or resetting a session', async () => {
    api.rpc.mockResolvedValueOnce({ data: [{
      access_status: 'active', released_at: '2026-10-08T16:00:00Z',
      deadline_at: '2026-10-08T18:00:00Z', remaining_seconds: 2400,
    }], error: null })
    const state = await loadPhaseTwoLessonAccess('enrollment-a', 'lesson-a')
    expect(state.remaining_seconds).toBe(2400)
    expect(api.rpc).toHaveBeenCalledWith('aca_phase_two_access_status', {
      p_enrollment_id: 'enrollment-a', p_lesson_id: 'lesson-a',
    })
  })
})
