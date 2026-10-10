import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoChangeMessagePractice } from './PhaseTwoChangeMessagePractice'

const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = 'Draft a message using only supplied facts. Inputs: [facts].'
const record = { project_path: 'B', project_title: 'Continuing intake service', sections: { leadership_and_adoption_plan: { listening_lesson_3_2: { draft: { context: 'Draft-only practice', revisedSummary: 'Accuracy and attribution', supportAction: 'Editable fictional draft', supportOwner: 'Reviewer', reviewLimit: 'Manager approval pending' } } } } }
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue(record); api.save.mockResolvedValue({ saved_version: 11 }) })
function completeForm(container: HTMLElement) {
  container.querySelectorAll('textarea').forEach(input => { if (!input.readOnly && !input.parentElement?.textContent?.includes('Human approval owner')) fireEvent.change(input, { target: { value: 'Reviewed fictional evidence' } }) })
  fireEvent.click(screen.getByRole('checkbox'))
}
it('carries listening forward as simulation without populating confirmed facts', async () => {
  render(<PhaseTwoChangeMessagePractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/Listening carry-forward/)).toHaveProperty('value', expect.stringContaining('SIMULATED REHEARSAL')))
  expect(screen.getByLabelText(/Listening carry-forward/)).toHaveProperty('value', expect.stringContaining('Manager approval pending'))
  expect(screen.getByLabelText('Confirmed facts and approval boundaries')).toHaveProperty('value', '')
  expect(screen.getByLabelText(/Continuing project and bounded/)).toHaveProperty('value', expect.stringContaining('Draft-only practice'))
  expect(screen.getByRole('button', { name: /Save change-message draft/ })).toHaveProperty('disabled', true)
})
it('saves only the new message section with one selected adaptation and pending approval', async () => {
  const { container } = render(<PhaseTwoChangeMessagePractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await screen.findByRole('button', { name: /Save change-message draft/ })
  completeForm(container)
  fireEvent.change(screen.getByLabelText('Manager audience adaptation'), { target: { value: 'Manager decision evidence' } })
  fireEvent.change(screen.getByLabelText('Audience adaptation to retain'), { target: { value: 'manager' } })
  fireEvent.click(screen.getByRole('button', { name: /Save change-message draft/ }))
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce())
  const saved = api.save.mock.calls[0][0]
  expect(saved.path).toBe('B')
  expect(Object.keys(saved.patch)).toEqual(['leadership_and_adoption_plan'])
  expect(Object.keys(saved.patch.leadership_and_adoption_plan)).toEqual(['change_message_lesson_3_3'])
  const evidence = saved.patch.leadership_and_adoption_plan.change_message_lesson_3_3
  expect(evidence.approval_status).toBe('pending_human_review')
  expect(evidence.approval_reference).toBeNull()
  expect(evidence.selected_audience_adaptation).toBe('Manager decision evidence')
  expect(evidence.review_framework).toBe('CLEAR')
  expect(screen.getByRole('status').textContent).toContain('Version 11')
})
it('requires an actual approval reference when approval is reported', async () => {
  const { container } = render(<PhaseTwoChangeMessagePractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await screen.findByRole('button', { name: /Save change-message draft/ })
  completeForm(container)
  fireEvent.change(screen.getByLabelText('Human approval status'), { target: { value: 'approved_reported_by_learner' } })
  expect(screen.getByRole('button', { name: /Save reviewed change message/ })).toHaveProperty('disabled', true)
  fireEvent.change(screen.getByLabelText(/Human approval owner and reference/), { target: { value: 'Manager; approved practice brief dated today' } })
  fireEvent.click(screen.getByRole('button', { name: /Save reviewed change message/ }))
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce())
  expect(api.save.mock.calls[0][0].patch.leadership_and_adoption_plan.change_message_lesson_3_3.approval_reference).toContain('Manager')
})
it('restores this lesson before prior listening and preserves answers on save failure', async () => {
  api.load.mockResolvedValue({ ...record, sections: { leadership_and_adoption_plan: { change_message_lesson_3_3: { draft: { context: 'Saved message context', finalMessage: 'Saved final message' }, selected_audience: 'manager', approval_status: 'pending_human_review' } } } })
  api.save.mockRejectedValue(new Error('Unavailable'))
  const { container } = render(<PhaseTwoChangeMessagePractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/Continuing project and bounded/)).toHaveProperty('value', 'Saved message context'))
  expect(screen.getByLabelText('Audience adaptation to retain')).toHaveProperty('value', 'manager')
  expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
  completeForm(container); fireEvent.click(screen.getByRole('button', { name: /Save change-message draft/ }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
  expect(screen.getByLabelText('Final reviewed change message')).toHaveProperty('value', 'Reviewed fictional evidence')
})
it('allows copyable owner review without a learner save', () => {
  render(<PhaseTwoChangeMessagePractice approvedAiRequest={request} />)
  expect(api.load).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /Save change-message draft/ })).toBeNull()
  const evidence = JSON.parse((screen.getByLabelText('Lesson 3.3 change-message record') as HTMLTextAreaElement).value)
  expect(evidence.approval_status).toBe('pending_human_review')
  expect(screen.getByRole('button', { name: 'Copy my Lesson 3.3 record' })).toBeTruthy()
})
