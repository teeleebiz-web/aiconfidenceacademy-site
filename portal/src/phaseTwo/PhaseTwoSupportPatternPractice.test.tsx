import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoSupportPatternPractice } from './PhaseTwoSupportPatternPractice'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = 'Compare no AI, assistant, rule-based automation and agent support for this workflow. Identify permissions, human approvals, monitoring, fallback and uncertainty. Do not propose live deployment. Workflow: [map].'
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue({ project_path: 'B', project_title: 'Existing project', sections: {} }); api.save.mockResolvedValue({ saved_version: 11 }) })
it('keeps review copy-only and includes all four patterns without deployment authority', () => {
  render(<PhaseTwoSupportPatternPractice approvedAiRequest={request} />)
  expect(screen.queryByRole('button', { name: 'Save support comparison to My Project Record' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Existing workflow and the narrow step needing support'), { target: { value: 'Review a reminder draft' } })
  const text = (screen.getByLabelText('Support-pattern comparison request') as HTMLTextAreaElement).value
  expect(text).toContain('Review a reminder draft'); expect(text).toContain('Compare no AI, assistant, rule-based automation and agent')
  expect(text).toContain('Do not propose live deployment.')
  expect(screen.queryByRole('button', { name: /deploy|send reminder|approve refund/i })).toBeNull()
})
it('carries prior workflow and CLEAR evidence forward and saves only its new concept entry', async () => {
  api.load.mockResolvedValue({ project_path: 'B', project_title: 'Existing project', sections: {
    professional_ai_operating_model: { workflow_view_lesson_2_1: { workflow_view: { entry_input: 'Verified record', reviewed_completion: 'Reviewed draft' } } },
    prompt_and_communication_evidence: { clear_lesson_2_3: { draft: { revised: 'Retained reviewed communication', approval: 'Pending accounts review', limits: 'Payment conflict' } } },
    ai_solution_concept: { text: 'Earlier concept remains' },
  } })
  render(<PhaseTwoSupportPatternPractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  const button = await screen.findByRole('button', { name: 'Save support comparison to My Project Record' })
  await waitFor(() => expect((screen.getByLabelText('Existing workflow and the narrow step needing support') as HTMLTextAreaElement).value).toContain('Verified record'))
  expect((screen.getByLabelText('Reviewed communication and human approval points carried from Lesson 2.3') as HTMLTextAreaElement).value).toContain('Pending accounts review')
  expect((button as HTMLButtonElement).disabled).toBe(true)
  screen.getAllByRole('textbox').filter(el => !(el as HTMLTextAreaElement).readOnly).forEach((el, i) => fireEvent.change(el, { target: { value: 'Evidence ' + i } }))
  fireEvent.click(button)
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1))
  const saved = api.save.mock.calls[0][0]
  expect(saved.path).toBe('B'); expect(saved.title).toBe('Existing project')
  expect(Object.keys(saved.patch)).toEqual(['ai_solution_concept'])
  expect(Object.keys(saved.patch.ai_solution_concept)).toEqual(['support_pattern_lesson_2_4'])
  expect(saved.patch.ai_solution_concept.support_pattern_lesson_2_4.practice_only_not_permission_to_deploy).toBe(true)
  await screen.findByText('Saved to your continuing Project Record. Version 11.')
})
it('restores the saved comparison instead of replacing it with older work', async () => {
  api.load.mockResolvedValue({ project_path: 'A', project_title: 'Existing project', sections: {
    ai_solution_concept: { support_pattern_lesson_2_4: { draft: { workflow: 'Current narrow task', choice: 'No AI', stopFallback: 'Stop and refer to owner' } } },
    professional_ai_operating_model: { workflow_view_lesson_2_1: { workflow_view: { entry_input: 'Older workflow' } } },
  } })
  render(<PhaseTwoSupportPatternPractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await waitFor(() => expect((screen.getByLabelText('Existing workflow and the narrow step needing support') as HTMLTextAreaElement).value).toBe('Current narrow task'))
  expect((screen.getByLabelText('Chosen support pattern') as HTMLTextAreaElement).value).toBe('No AI')
  expect(api.save).not.toHaveBeenCalled()
})
it('retains the concept and enables retry after a failed save', async () => {
  api.save.mockRejectedValueOnce(new Error('Connection failed'))
  render(<PhaseTwoSupportPatternPractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  const button = await screen.findByRole('button', { name: 'Save support comparison to My Project Record' })
  screen.getAllByRole('textbox').filter(el => !(el as HTMLTextAreaElement).readOnly).forEach(el => fireEvent.change(el, { target: { value: 'Retain my comparison' } }))
  fireEvent.click(button)
  await screen.findByText('Save was unsuccessful. Your answers remain here; retry or copy your record.')
  expect((screen.getByLabelText('Updated solution concept with scope, input, result and human control') as HTMLTextAreaElement).value).toBe('Retain my comparison')
  fireEvent.click(button)
  await screen.findByText('Saved to your continuing Project Record. Version 11.')
})
