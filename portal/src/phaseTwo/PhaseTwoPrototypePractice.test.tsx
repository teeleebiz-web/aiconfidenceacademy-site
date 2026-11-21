import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoPrototypePractice } from './PhaseTwoPrototypePractice'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = 'Help build a minimal working sample for this authorized scope using these inputs and acceptance criteria. Flag missing information and assumptions. Keep approval with me. Project: [charter and map].'
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue({ project_path: 'B', project_title: 'Existing project', sections: {} }); api.save.mockResolvedValue({ saved_version: 12 }) })
function fillEvidence() {
  screen.getAllByRole('textbox').filter(el => !(el as HTMLTextAreaElement).readOnly).forEach((el, i) => fireEvent.change(el, { target: { value: 'Actual evidence ' + i } }))
}
it('keeps the review copy-only and prepares a request with input, criteria and human control', () => {
  render(<PhaseTwoPrototypePractice approvedAiRequest={request} />)
  expect(screen.queryByRole('button', { name: 'Save prototype evidence to My Project Record' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Normal-case input — fictional or authorized material'), { target: { value: 'Fictional workshop brief' } })
  fireEvent.change(screen.getByLabelText('Acceptance criteria defined before the run'), { target: { value: 'Mark unconfirmed price' } })
  const text = (screen.getByLabelText('Prepared prototype request') as HTMLTextAreaElement).value
  expect(text).toContain('Fictional workshop brief'); expect(text).toContain('Mark unconfirmed price'); expect(text).toContain('Keep approval with me.')
  expect(api.load).not.toHaveBeenCalled(); expect(api.save).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /deploy|issue proposal|approve price/i })).toBeNull()
})
it('carries prior workflow and concept forward and requires actual outputs before saving only its new entry', async () => {
  api.load.mockResolvedValue({ project_path: 'B', project_title: 'Existing project', sections: {
    professional_ai_operating_model: { workflow_view_lesson_2_1: { workflow_view: { entry_input: 'Approved brief' } } },
    ai_solution_concept: { support_pattern_lesson_2_4: { draft: { concept: 'Reviewed outline concept', choice: 'Assistant', allowed: 'Draft only', prohibited: 'No issue', checkpoints: 'Proposal reviewer', limits: 'Pricing unverified' } } },
  } })
  render(<PhaseTwoPrototypePractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  const button = await screen.findByRole('button', { name: 'Save prototype evidence to My Project Record' })
  await waitFor(() => expect((screen.getByLabelText('Existing project charter and workflow map') as HTMLTextAreaElement).value).toContain('Approved brief'))
  expect((screen.getByLabelText('Bounded solution concept carried from Lesson 2.4') as HTMLTextAreaElement).value).toContain('Reviewed outline concept')
  expect((screen.getByLabelText('One narrow path — allowed actions and excluded actions') as HTMLTextAreaElement).value).toContain('Excluded: No issue')
  expect((screen.getByLabelText('Human review owner and approval retained') as HTMLTextAreaElement).value).toBe('Proposal reviewer')
  expect((button as HTMLButtonElement).disabled).toBe(true)
  fillEvidence()
  const revised = screen.getByLabelText('Actual revised output using the same normal input')
  fireEvent.change(revised, { target: { value: '' } })
  expect((button as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(button); expect(api.save).not.toHaveBeenCalled()
  fireEvent.change(revised, { target: { value: 'Actual revised outline' } })
  fireEvent.click(button)
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1))
  const saved = api.save.mock.calls[0][0]
  expect(saved.path).toBe('B'); expect(saved.title).toBe('Existing project')
  expect(Object.keys(saved.patch)).toEqual(['ai_solution_concept'])
  expect(Object.keys(saved.patch.ai_solution_concept)).toEqual(['prototype_lesson_2_5'])
  const evidence = saved.patch.ai_solution_concept.prototype_lesson_2_5
  expect(evidence.draft.revisedOutput).toBe('Actual revised outline')
  expect(evidence.working_artifact_and_run_evidence_required).toBe(true)
  expect(evidence.practice_only_not_permission_to_deploy).toBe(true)
  await screen.findByText('Saved to your continuing Project Record. Version 12.')
})
it('restores the current prototype evidence ahead of earlier concept and workflow', async () => {
  api.load.mockResolvedValue({ project_path: 'A', project_title: 'Existing project', sections: {
    ai_solution_concept: { prototype_lesson_2_5: { draft: { artifact: 'Saved reusable template', revisedOutput: 'Saved actual output', scope: 'Current bounds' } }, support_pattern_lesson_2_4: { draft: { allowed: 'Older bounds' } } },
    professional_ai_operating_model: { workflow_view_lesson_2_1: { workflow_view: { entry_input: 'Older workflow' } } },
  } })
  render(<PhaseTwoPrototypePractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await waitFor(() => expect((screen.getByLabelText('First working artifact — reusable request/template text or accessible authorized reference') as HTMLTextAreaElement).value).toBe('Saved reusable template'))
  expect((screen.getByLabelText('Actual revised output using the same normal input') as HTMLTextAreaElement).value).toBe('Saved actual output')
  expect((screen.getByLabelText('One narrow path — allowed actions and excluded actions') as HTMLTextAreaElement).value).toBe('Current bounds')
  expect(api.save).not.toHaveBeenCalled()
})
it('retains actual evidence and enables retry after a failed save', async () => {
  api.save.mockRejectedValueOnce(new Error('Connection failed'))
  render(<PhaseTwoPrototypePractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  const button = await screen.findByRole('button', { name: 'Save prototype evidence to My Project Record' })
  fillEvidence(); fireEvent.click(button)
  await screen.findByText('Save was unsuccessful. Your answers remain here; retry or copy your record.')
  expect((screen.getByLabelText('Actual first-run output') as HTMLTextAreaElement).value).toContain('Actual evidence')
  fireEvent.click(button)
  await screen.findByText('Saved to your continuing Project Record. Version 12.')
})
