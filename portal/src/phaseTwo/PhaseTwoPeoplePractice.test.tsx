import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoPeoplePractice } from './PhaseTwoPeoplePractice'

const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = 'Review this change: [project context].'
const record = { project_path: 'A', project_title: 'Continuing project', sections: { ai_solution_concept: { exception_tests_lesson_2_6: { draft: { scope: 'Draft-only intake', updatedMap: 'Customer to human reviewer', limits: 'Route needs approval' } } } } }
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue(record); api.save.mockResolvedValue({ saved_version: 9 }) })
function completeForm(container: HTMLElement) {
  container.querySelectorAll('textarea').forEach(input => { if (!input.readOnly) fireEvent.change(input, { target: { value: 'Supplied project evidence and proposed next step' } }) })
}
it('uses the approved request with project context and provides five evidence-aware concerns', async () => {
  render(<PhaseTwoPeoplePractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/Continuing project scope/)).toHaveProperty('value', expect.stringContaining('Draft-only intake')))
  expect(screen.getByLabelText('People-mapping request')).toHaveProperty('value', expect.stringContaining('Customer to human reviewer'))
  expect(screen.getAllByRole('combobox')).toHaveLength(5)
  expect(screen.getByLabelText(/Unresolved questions/)).toHaveProperty('value', 'Route needs approval')
  expect(screen.getByRole('button', { name: /Save people section/ })).toHaveProperty('disabled', true)
})
it('requires sources for reported feedback and saves only the people section in the continuing record', async () => {
  const { container } = render(<PhaseTwoPeoplePractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /Save people section/ })).toBeTruthy())
  completeForm(container)
  fireEvent.change(screen.getByLabelText('Evidence status for concern 1'), { target: { value: 'reported' } })
  const source = screen.getByLabelText('Source, observation or next question to investigate — concern 1')
  fireEvent.change(source, { target: { value: '' } })
  expect(screen.getByRole('button', { name: /Save people section/ })).toHaveProperty('disabled', true)
  fireEvent.change(source, { target: { value: 'Authorized feedback note, October 10' } })
  fireEvent.click(screen.getByRole('button', { name: /Save people section/ }))
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce())
  const saved = api.save.mock.calls[0][0]
  expect(saved.enrollmentId).toBe('existing-enrollment'); expect(saved.path).toBe('A')
  expect(Object.keys(saved.patch)).toEqual(['leadership_and_adoption_plan'])
  const people = saved.patch.leadership_and_adoption_plan.people_lesson_3_1
  expect(people.concerns).toHaveLength(5); expect(people.concerns[0].evidenceStatus).toBe('reported')
  expect(people.concerns[0].source).toBe('Authorized feedback note, October 10')
  expect(people.design_status).toBe('proposed_for_human_review')
  expect(screen.getByRole('status').textContent).toContain('Version 9')
})
it('restores prior people evidence and leaves answers available after a failed save', async () => {
  api.load.mockResolvedValue({ ...record, sections: { leadership_and_adoption_plan: { people_lesson_3_1: { draft: { context: 'Previously saved context' }, concerns: [{ group: 'Customer', question: 'Correction?', evidenceStatus: 'reported', source: 'Authorized note' }] } } } })
  api.save.mockRejectedValue(new Error('Unavailable'))
  const { container } = render(<PhaseTwoPeoplePractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/Continuing project scope/)).toHaveProperty('value', 'Previously saved context'))
  expect(screen.getByLabelText('Affected group and role — concern 1')).toHaveProperty('value', 'Customer')
  expect(screen.getByLabelText('Evidence status for concern 1')).toHaveProperty('value', 'reported')
  completeForm(container)
  fireEvent.click(screen.getByRole('button', { name: /Save people section/ }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
  expect(screen.getByLabelText(/Revised design decision/)).toHaveProperty('value', 'Supplied project evidence and proposed next step')
})
it('keeps owner preview copyable without pretending that it saved a learner record', () => {
  render(<PhaseTwoPeoplePractice approvedAiRequest={request} />)
  expect(api.load).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /Save people section/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Copy my Lesson 3.1 record' })).toBeTruthy()
  expect(screen.getByText(/Saving requires your existing active learner Project Record/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Add another concern' }))
  expect(screen.getAllByRole('combobox')).toHaveLength(6)
  expect(api.save).not.toHaveBeenCalled()
})
