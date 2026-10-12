import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoExceptionPractice } from './PhaseTwoExceptionPractice'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = 'Suggest difficult but realistic test inputs for this bounded prototype. Include missing information, conflicting instructions and an out-of-scope request. State expected safe behavior for my review. Scope: [brief].'
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue({ project_path: 'B', project_title: 'Existing project', sections: {} }); api.save.mockResolvedValue({ saved_version: 13 }) })
function fillEvidence() {
  for (let pass = 0; pass < 2; pass++) screen.getAllByRole('textbox').filter(el => !(el as HTMLTextAreaElement).readOnly).forEach((el, i) => {
    if (!(el as HTMLTextAreaElement).disabled) fireEvent.change(el, { target: { value: 'Observed evidence ' + i } })
  })
}
it('keeps review copy-only and makes each actual result available after its expectation', () => {
  render(<PhaseTwoExceptionPractice approvedAiRequest={request} />)
  expect(screen.queryByRole('button', { name: 'Save Journey Two test evidence to My Project Record' })).toBeNull()
  const actual = screen.getByLabelText('Conflicting-specification case — actual output, check result and supporting evidence') as HTMLTextAreaElement
  expect(actual.disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Conflicting-specification case — expected behavior defined before the run'), { target: { value: 'Flag both counts and ask reviewer' } })
  expect(actual.disabled).toBe(false)
  fireEvent.change(screen.getByLabelText('Continuing project scope, criteria and human review/approval owner'), { target: { value: 'Draft only; proposal reviewer retains approval' } })
  const text = (screen.getByLabelText('Test-design request') as HTMLTextAreaElement).value
  expect(text).toContain('Draft only; proposal reviewer retains approval')
  expect(text).toContain('missing information, conflicting instructions and an out-of-scope request')
  expect(api.load).not.toHaveBeenCalled(); expect(api.save).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /deploy|issue proposal|complete journey/i })).toBeNull()
})
it('carries the actual working sample forward and saves only the new test and tested-map entries', async () => {
  api.load.mockResolvedValue({ project_path: 'B', project_title: 'Existing project', sections: {
    professional_ai_operating_model: { workflow_view_lesson_2_1: { workflow_view: { entry_input: 'Approved brief' } } },
    prompt_and_communication_evidence: { clear_lesson_2_3: { draft: { revised: 'Earlier communication retained' } } },
    ai_solution_concept: { prototype_lesson_2_5: { draft: { scope: 'Draft only', criteria: 'Retain supplied facts', owner: 'Proposal reviewer', revisedArtifact: 'Saved reusable artifact', baseline: 'Manual baseline', revisedOutput: 'Earlier observed normal output', concept: 'Bounded outline concept', limits: 'Exceptions untested' } } },
    workflow_design_artifact: { text: 'Earlier map retained' },
  } })
  render(<PhaseTwoExceptionPractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  const button = await screen.findByRole('button', { name: 'Save Journey Two test evidence to My Project Record' })
  await waitFor(() => expect((screen.getByLabelText('Saved working artifact and version used for these tests') as HTMLTextAreaElement).value).toBe('Saved reusable artifact'))
  expect((screen.getByLabelText('Continuing project scope, criteria and human review/approval owner') as HTMLTextAreaElement).value).toContain('Proposal reviewer')
  expect((screen.getByLabelText('Earlier baseline and normal-run evidence retained from Lesson 2.5') as HTMLTextAreaElement).value).toContain('Earlier observed normal output')
  expect((screen.getByLabelText('Assembled evidence — communication, maps, concept, working artifact and test references') as HTMLTextAreaElement).value).toContain('Communication evidence: retained')
  expect((button as HTMLButtonElement).disabled).toBe(true)
  fillEvidence()
  const retest = screen.getByLabelText('Retest — same failing input, original expectation, exact revised request and actual output')
  fireEvent.change(retest, { target: { value: '' } })
  expect((button as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(button); expect(api.save).not.toHaveBeenCalled()
  fireEvent.change(retest, { target: { value: 'Same 12 versus 20 input; actual result flags both counts' } })
  fireEvent.click(button)
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1))
  const saved = api.save.mock.calls[0][0]
  expect(saved.path).toBe('B'); expect(saved.title).toBe('Existing project')
  expect(Object.keys(saved.patch)).toEqual(['ai_solution_concept', 'workflow_design_artifact'])
  expect(Object.keys(saved.patch.ai_solution_concept)).toEqual(['exception_tests_lesson_2_6'])
  expect(Object.keys(saved.patch.workflow_design_artifact)).toEqual(['tested_workflow_lesson_2_6'])
  const evidence = saved.patch.ai_solution_concept.exception_tests_lesson_2_6
  expect(evidence.draft.retest).toContain('actual result flags both counts')
  expect(evidence.expected_behavior_separate_from_observation).toBe(true)
  expect(evidence.practice_only_not_permission_to_deploy).toBe(true)
  expect(saved.patch.workflow_design_artifact.tested_workflow_lesson_2_6.text).toBe(evidence.draft.updatedMap)
  expect(saved.decisionNote).toContain(evidence.draft.decisionNote)
  await screen.findByText('Saved to your continuing Project Record. Version 13.')
})
it('restores saved tests ahead of the older prototype evidence', async () => {
  api.load.mockResolvedValue({ project_path: 'A', project_title: 'Existing project', sections: {
    ai_solution_concept: { exception_tests_lesson_2_6: { draft: { artifact: 'Current tested artifact', conflictExpected: 'Ask reviewer about both counts', conflictObserved: 'Actual conflict response', retest: 'Saved actual retest' } }, prototype_lesson_2_5: { draft: { revisedArtifact: 'Older sample' } } },
  } })
  render(<PhaseTwoExceptionPractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await waitFor(() => expect((screen.getByLabelText('Saved working artifact and version used for these tests') as HTMLTextAreaElement).value).toBe('Current tested artifact'))
  expect((screen.getByLabelText('Conflicting-specification case — actual output, check result and supporting evidence') as HTMLTextAreaElement).value).toBe('Actual conflict response')
  expect((screen.getByLabelText('Retest — same failing input, original expectation, exact revised request and actual output') as HTMLTextAreaElement).value).toBe('Saved actual retest')
  expect(api.save).not.toHaveBeenCalled()
})
it('retains actual test evidence and permits retry after a failed save', async () => {
  api.save.mockRejectedValueOnce(new Error('Connection failed'))
  render(<PhaseTwoExceptionPractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  const button = await screen.findByRole('button', { name: 'Save Journey Two test evidence to My Project Record' })
  fillEvidence(); fireEvent.click(button)
  await screen.findByText('Save was unsuccessful. Your answers remain here; retry or copy your record.')
  expect((screen.getByLabelText('Missing-information case — actual output, check result and supporting evidence') as HTMLTextAreaElement).value).toContain('Observed evidence')
  fireEvent.click(button)
  await screen.findByText('Saved to your continuing Project Record. Version 13.')
})
