import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

const api = vi.hoisted(() => ({
  rpc: vi.fn(),
  ownerData: false,
  ownerError: { code: 'PGRST303', message: 'JWT claims validation failed' } as { code: string; message: string } | null,
  enrollmentError: null as { message: string } | null,
}))

vi.mock('./lib/supabase', () => {
  const enrollment = {
    id: 'synthetic-enrollment', learner_id: 'synthetic-learner', course_id: 'synthetic-course',
    status: 'active', starts_at: null, access_expires_at: null,
    course: { id: 'synthetic-course', code: 'synthetic', title: 'Synthetic Course', summary: 'A test course.' },
  }
  const rows: Record<string, unknown[]> = {
    course_journeys: [{
      id: 'synthetic-journey', course_id: 'synthetic-course', journey_number: 1, week_number: 1,
      title: 'Synthetic Journey', promise: 'Practice safely.', release_offset_days: 0, status: 'published',
    }],
    lessons: [{
      id: 'synthetic-lesson', course_id: 'synthetic-course', journey_id: 'synthetic-journey',
      page_id: '1.1', title: 'Synthetic First Lesson', purpose: 'Practice.',
      estimated_minutes: 45, course_position: 1, journey_position: 1,
      unlock_offset_days: 0, status: 'published', content: {},
    }],
    lesson_progress: [], journey_introductions: [], learner_artifacts: [],
  }
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'synthetic-learner' } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signOut: async () => ({ error: null }),
      },
      rpc: api.rpc,
      from: (table: string) => {
        const arrayResult = Promise.resolve({ data: rows[table] ?? [], error: null })
        const query = {
          select: () => query, eq: () => query, in: () => query,
          order: () => query, limit: () => query,
          maybeSingle: async () => ({
            data: table === 'enrollments' ? enrollment : table === 'profiles' ? { first_name: 'Learner' } : null,
            error: table === 'enrollments' ? api.enrollmentError : null,
          }),
          then: arrayResult.then.bind(arrayResult),
        }
        return query
      },
    },
  }
})

vi.mock('./components/LessonView', () => ({
  LessonView: ({ lesson }: { lesson: { page_id: string } }) => <h1>Lesson {lesson.page_id}</h1>,
}))

describe('signed-in learner enrollment entry', () => {
  beforeEach(() => {
    api.ownerData = false
    api.ownerError = { code: 'PGRST303', message: 'JWT claims validation failed' }
    api.enrollmentError = null
    api.rpc.mockReset()
    api.rpc.mockImplementation(async (name: string) => {
      if (name === 'is_aca_curriculum_owner') return { data: api.ownerData, error: api.ownerError }
      if (name === 'get_learner_lesson_access') return { data: [{
        current_lesson_id: 'synthetic-lesson', current_journey_id: 'synthetic-journey',
        access_status: 'available', available_at: null, active_seconds: 0, remaining_seconds: 7200,
        completed_lessons: 0, total_lessons: 1, released_lesson_ids: ['synthetic-lesson'],
      }], error: null }
      if (name === 'touch_lesson_access') return { data: [{
        enrollment_id: 'synthetic-enrollment', lesson_id: 'synthetic-lesson',
        access_status: 'active', active_seconds: 0, remaining_seconds: 7200,
      }], error: null }
      throw new Error('Unexpected RPC in enrollment entry test')
    })
  })

  it('opens Lesson 1.1 for an active learner when the reviewer check fails', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /open lesson/i }))
    expect(await screen.findByRole('heading', { name: 'Lesson 1.1' })).toBeTruthy()
    expect(api.rpc).toHaveBeenCalledWith('is_aca_curriculum_owner', undefined, { get: true })
    expect(screen.queryByText('Your enrollment is not active yet.')).toBeNull()
  })

  it('keeps learner mode when a reviewer result contains an error', async () => {
    api.ownerData = true
    render(<App />)
    expect(await screen.findByRole('button', { name: /open lesson/i })).toBeTruthy()
    expect(screen.queryByText(/protected owner review/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /review lesson/i })).toBeNull()
    expect(api.rpc).toHaveBeenCalledWith('get_learner_lesson_access', { p_enrollment_id: 'synthetic-enrollment' })
  })

  it('still blocks course entry when enrollment verification fails', async () => {
    api.enrollmentError = { message: 'Enrollment unavailable' }
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Enrollment unavailable')
    expect(screen.queryByRole('button', { name: /open lesson/i })).toBeNull()
  })
})
