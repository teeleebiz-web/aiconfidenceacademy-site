import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoNeedPractice, restoreLesson12Record } from './PhaseTwoNeedPractice'

const projectApi = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({
  loadPhaseTwoProject: projectApi.load,
  savePhaseTwoProjectUpdate: projectApi.save,
}))

const savedNeeds = Array.from({ length: 3 }, (_, i) => ({
  person: 'Saved person ' + (i + 1),
  symptom: 'Saved symptom ' + (i + 1),
  possibleCause: 'Possible cause ' + (i + 1),
  evidence: 'Authorized source ' + (i + 1),
  evidenceType: 'observed',
  question: 'Unanswered question ' + (i + 1),
}))
const savedPractice = {
  lesson: '1.2',
  needs: savedNeeds,
  selected_index: 2,
  selected_need: {
    person: 'Saved person 3',
    situation: 'Existing approved-work context',
    need: 'Saved symptom 3',
    barrier: 'Information is difficult to find',
    desired_result: 'A clear verified answer',
    possible_cause_hypothesis: 'Possible cause 3',
  },
  neutral_questions: [
    'What question occurs repeatedly?',
    'Where do you find the current answer?',
    'What happens when the source is missing?',
    'Which part of the process takes effort?',
    'What result would help the person?',
  ],
  evidence_to_request: 'Current approved support log',
  evidence_that_would_change_choice: 'A current log proves it rarely occurs',
  learner_ai_revision_note: 'Rejected an unsupported model assertion',
}

beforeEach(() => {
  vi.clearAllMocks()
  projectApi.load.mockResolvedValue(null)
  projectApi.save.mockResolvedValue({ saved_version: 4, saved_at: '2026-10-11T00:00:00Z' })
})

describe('Lesson 1.2 continuing Project Record resume', () => {
  it('restores three complete needs, all questions, the selection and evidence fields without creating a new project', async () => {
    const user = userEvent.setup()
    projectApi.load.mockResolvedValue({
      enrollment_id: 'enrollment-1',
      project_path: 'B',
      project_title: 'Existing Lesson 1.1 project',
      version_number: 3,
      sections: {
        professional_ai_operating_model: {
          lesson_1_1_original: { human_decision: 'Retain human approval' },
          audience_need_lesson_1_2: savedPractice,
        },
      },
    })
    render(<PhaseTwoNeedPractice enrollmentId="enrollment-1" />)
    expect(await screen.findByDisplayValue('Saved person 3')).toBeTruthy()
    expect(screen.getByDisplayValue('Existing approved-work context')).toBeTruthy()
    expect(screen.getByDisplayValue('A clear verified answer')).toBeTruthy()
    expect(screen.getByDisplayValue('Rejected an unsupported model assertion')).toBeTruthy()
    expect(screen.getByDisplayValue('A current log proves it rarely occurs')).toBeTruthy()
    expect(screen.getByDisplayValue('Where do you find the current answer?')).toBeTruthy()
    expect(screen.getByLabelText('Which of the three needs will you investigate first?'))
      .toHaveProperty('value', '2')
    await user.click(screen.getByRole('button', { name: 'Save to My Project Record' }))
    await waitFor(() => expect(projectApi.save).toHaveBeenCalledTimes(1))
    const input = projectApi.save.mock.calls[0][0]
    expect(input).toEqual(expect.objectContaining({
      enrollmentId: 'enrollment-1', path: 'B', title: 'Existing Lesson 1.1 project',
    }))
    expect(input.patch).toEqual({
      professional_ai_operating_model: {
        audience_need_lesson_1_2: expect.objectContaining({
          needs: savedNeeds, selected_index: 2,
          neutral_questions: savedPractice.neutral_questions,
          evidence_to_request: savedPractice.evidence_to_request,
        }),
      },
    })
    expect(await screen.findByText(/Saved to your continuing Project Record. Version 4/)).toBeTruthy()
  })

  it('rejects invalid historical shapes safely and does not pretend an absent record exists', async () => {
    expect(restoreLesson12Record(null)).toBeNull()
    expect(restoreLesson12Record(['untrusted'])).toBeNull()
    const restored = restoreLesson12Record({
      needs: [{ person: 'Staff', evidenceType: 'invented-fact' }],
      selected_index: 47,
      neutral_questions: ['What is the present process?'],
      selected_need: { situation: 42 },
      evidence_to_request: { not: 'text' },
    })
    expect(restored?.needs).toHaveLength(3)
    expect(restored?.needs[0].person).toBe('Staff')
    expect(restored?.needs[0].evidenceType).toBe('unverified')
    expect(restored?.needs[1].person).toBe('')
    expect(restored?.selected).toBe(0)
    expect(restored?.questions).toHaveLength(5)
    expect(restored?.questions[0]).toBe('What is the present process?')
    expect(restored?.situation).toBe('')
    expect(restored?.sourceToCheck).toBe('')
    render(<PhaseTwoNeedPractice enrollmentId="enrollment-absent" />)
    await waitFor(() => expect(projectApi.load).toHaveBeenCalledWith('enrollment-absent'))
    expect(screen.queryByRole('button', { name: 'Save to My Project Record' })).toBeNull()
    expect(projectApi.save).not.toHaveBeenCalled()
  })
})
