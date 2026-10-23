import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoNeedPractice, restoreLesson12Record } from './PhaseTwoNeedPractice'

const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({
  loadPhaseTwoProject: api.load,
  savePhaseTwoProjectUpdate: api.save,
}))

beforeEach(() => {
  vi.clearAllMocks()
  api.load.mockResolvedValue(null)
  api.save.mockResolvedValue({ saved_version: 4, saved_at: '2026-10-22T00:00:00Z' })
})

const need = (person: string) => ({
  person,
  symptom: 'Repeated delivery-status questions',
  possibleCause: 'Possibly hard to find policy information',
  evidence: 'Approved fictional service log',
  evidenceType: 'simulated',
  question: 'What information do people check before contacting support?',
})

describe('Lesson 1.2 continuing Project Record restoration', () => {
  it('restores the saved candidate evidence, selected need and five questions without changing Lesson 1.1', async () => {
    const user = userEvent.setup()
    const saved = {
      needs: [need('Staff'), need('Customers'), need('Managers')],
      selected_index: 1,
      selected_need: {
        situation: 'Uncertain delivery updates',
        barrier: 'Unverified information gap',
        desired_result: 'Understand what customers actually need',
      },
      neutral_questions: [
        'How do you check delivery status?',
        'What would you expect to see?',
        'When do you contact support?',
        'What information is missing?',
        'What would resolve the uncertainty?',
      ],
      evidence_to_request: 'Approved service logs',
      evidence_that_would_change_choice: 'Different frequency by topic',
      learner_ai_revision_note: 'Rejected an invented interview count',
    }
    api.load.mockResolvedValue({
      project_path: 'B',
      project_title: 'Continuing customer service project',
      sections: {
        professional_ai_operating_model: {
          personServed: 'The original Lesson 1.1 audience',
          humanPurpose: 'The original Lesson 1.1 purpose',
          audience_need_lesson_1_2: saved,
        },
      },
    })

    render(<PhaseTwoNeedPractice enrollmentId="enrollment-1" />)

    await waitFor(() => {
      expect(screen.getAllByLabelText('Who is affected?')[0]).toHaveProperty('value', 'Staff')
    })
    expect(screen.getAllByLabelText('Who is affected?')[1]).toHaveProperty('value', 'Customers')
    expect(screen.getAllByLabelText('Evidence category')[1]).toHaveProperty('value', 'simulated')
    expect(screen.getByLabelText(/Which of the three needs will you investigate first/)).toHaveProperty('value', '1')
    expect(screen.getByLabelText('Situation')).toHaveProperty('value', 'Uncertain delivery updates')
    expect(screen.getByLabelText('Barrier needing investigation')).toHaveProperty('value', 'Unverified information gap')
    expect(screen.getByLabelText(/Desired result, without naming an AI product/)).toHaveProperty('value', 'Understand what customers actually need')
    expect(screen.getByLabelText('Neutral question 5')).toHaveProperty('value', 'What would resolve the uncertainty?')
    expect(screen.getByLabelText(/What did you correct or reject/)).toHaveProperty('value', 'Rejected an invented interview count')
    const save = screen.getByRole('button', { name: 'Save to My Project Record' })
    expect(save).toHaveProperty('disabled', false)
    await user.click(save)
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1))
    const payload = api.save.mock.calls[0][0]
    expect(payload.enrollmentId).toBe('enrollment-1')
    expect(payload.path).toBe('B')
    expect(payload.patch.professional_ai_operating_model).toEqual({
      audience_need_lesson_1_2: expect.objectContaining({
        selected_index: 1,
        needs: expect.arrayContaining([expect.objectContaining({ person: 'Customers' })]),
        evidence_to_request: 'Approved service logs',
      }),
    })
    expect(payload.patch.professional_ai_operating_model.personServed).toBeUndefined()
    expect(screen.getByRole('status').textContent).toContain('Saved to your continuing Project Record.')
  })

  it('rejects malformed selections and invented evidence categories rather than restoring false facts', () => {
    expect(restoreLesson12Record(undefined)).toBeNull()
    const restored = restoreLesson12Record({
      selected_index: 99,
      needs: [{ person: 'Staff', evidenceType: 'invented' }, null],
      neutral_questions: [42, 'What do you do first?'],
      selected_need: { situation: 42, barrier: 'Unverified' },
    })
    expect(restored?.selected).toBe(0)
    expect(restored?.needs).toHaveLength(3)
    expect(restored?.needs[0].person).toBe('Staff')
    expect(restored?.needs[0].evidenceType).toBe('unverified')
    expect(restored?.needs[1].person).toBe('')
    expect(restored?.questions).toEqual(['', 'What do you do first?', '', '', ''])
    expect(restored?.situation).toBe('')
    expect(restored?.barrier).toBe('Unverified')
  })
})
