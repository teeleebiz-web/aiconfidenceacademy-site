import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoListeningPractice } from './PhaseTwoListeningPractice'

const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = 'Role-play a colleague without claiming real staff views. Context: [brief].'
const record = { project_path: 'B', project_title: 'Continuing intake service', sections: { leadership_and_adoption_plan: { people_lesson_3_1: { draft: { context: 'Draft only', groups: 'Customer, reviewer', openQuestions: 'Attribution needs approval', designAfter: 'Keep an assisted route' }, concerns: [{ question: 'Review control?', evidenceStatus: 'anticipated' }] } } } }
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue(record); api.save.mockResolvedValue({ saved_version: 10 }) })
function completeForm(container: HTMLElement) {
  container.querySelectorAll('textarea').forEach(input => { if (!input.readOnly) fireEvent.change(input, { target: { value: 'Fictional practice evidence and proposed support' } }) })
}
it('carries the people map forward and keeps two invitations and six reflection steps visible', async () => {
  render(<PhaseTwoListeningPractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/Continuing project, affected role/)).toHaveProperty('value', expect.stringContaining('Keep an assisted route')))
  expect(screen.getByLabelText(/People map and unresolved/)).toHaveProperty('value', expect.stringContaining('Attribution needs approval'))
  expect(screen.getByLabelText('Simulated role-play request')).toHaveProperty('value', expect.stringContaining('Draft only'))
  expect(screen.getByLabelText('Listening question 2 — Invite a concern')).toBeTruthy()
  expect(screen.getByLabelText('Listening question 3 — Invite what might become harder')).toBeTruthy()
  expect(screen.getByLabelText('Review — reflective question')).toBeTruthy()
  expect(screen.getByRole('button', { name: /Save listening section/ })).toHaveProperty('disabled', true)
})
it('requires the privacy review and saves only simulated listening evidence in the continuing plan', async () => {
  const { container } = render(<PhaseTwoListeningPractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /Save listening section/ })).toBeTruthy())
  completeForm(container)
  expect(screen.getByRole('button', { name: /Save listening section/ })).toHaveProperty('disabled', true)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: /Save listening section/ }))
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce())
  const saved = api.save.mock.calls[0][0]
  expect(saved.path).toBe('B'); expect(saved.enrollmentId).toBe('existing-enrollment')
  expect(Object.keys(saved.patch)).toEqual(['leadership_and_adoption_plan'])
  expect(Object.keys(saved.patch.leadership_and_adoption_plan)).toEqual(['listening_lesson_3_2'])
  const listening = saved.patch.leadership_and_adoption_plan.listening_lesson_3_2
  expect(listening.evidence_type).toBe('simulated_role_play')
  expect(listening.represents_real_staff).toBe(false)
  expect(listening.listening_questions).toHaveLength(5)
  expect(listening.reflective_questions).toHaveLength(6)
  expect(listening.concern_invitation_questions).toEqual([2, 3])
  expect(listening.personal_disclosures_removed_by_learner).toBe(true)
  expect(listening.support_status).toBe('proposed_for_human_review')
  expect(screen.getByRole('status').textContent).toContain('Version 10')
})
it('restores saved listening work, rechecks privacy and preserves answers after failed saving', async () => {
  api.load.mockResolvedValue({ ...record, sections: { leadership_and_adoption_plan: { listening_lesson_3_2: { draft: { context: 'Saved listening context', revisedSummary: 'Accuracy and attribution' }, listening_questions: ['Saved question'], reflective_questions: ['Saved clarify question'] } } } })
  api.save.mockRejectedValue(new Error('Unavailable'))
  const { container } = render(<PhaseTwoListeningPractice enrollmentId="existing-enrollment" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/Continuing project, affected role/)).toHaveProperty('value', 'Saved listening context'))
  expect(screen.getByLabelText('Listening question 1 — Learn the role')).toHaveProperty('value', 'Saved question')
  expect(screen.getByLabelText('Clarify — reflective question')).toHaveProperty('value', 'Saved clarify question')
  expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
  completeForm(container); fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: /Save listening section/ }))
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
  expect(screen.getByLabelText(/Revised listening summary/)).toHaveProperty('value', 'Fictional practice evidence and proposed support')
})
it('keeps owner preview copyable without claiming a save or staff agreement', () => {
  render(<PhaseTwoListeningPractice approvedAiRequest={request} />)
  expect(api.load).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: /Save listening section/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Copy my Lesson 3.2 record' })).toBeTruthy()
  const evidence = JSON.parse((screen.getByLabelText('Lesson 3.2 listening record') as HTMLTextAreaElement).value)
  expect(evidence.evidence_type).toBe('simulated_role_play')
  expect(evidence.represents_real_staff).toBe(false)
  expect(api.save).not.toHaveBeenCalled()
})
