import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoFactsImpactPractice } from './PhaseTwoFactsImpactPractice'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = 'Identify claims, assumptions, missing context and possible unequal burdens in this output. Do not certify accuracy or fairness. Inputs: [sanitized output].'
const project = { project_path: 'B', project_title: 'Existing bounded guide', sections: { digital_delivery_artifact: { retained: 'Prior Journey Four evidence' } } }
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue(project); api.save.mockResolvedValue({ saved_version: 18 }) })
function complete(container: HTMLElement) {
  container.querySelectorAll('textarea').forEach(x => { if (!x.readOnly) fireEvent.change(x, { target: { value: 'Fictional input. Real authority is unconfirmed; pause and check the responsible policy owner.' } }) })
  fireEvent.click(screen.getByRole('checkbox'))
}
it('saves all six review lenses, actual variations and error case without replacing prior evidence', async () => {
  const { container } = render(<PhaseTwoFactsImpactPractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save FACTS and IMPACT review to My Project Record' })
  expect(save).toHaveProperty('disabled', true)
  complete(container); fireEvent.click(save)
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce())
  const input = api.save.mock.calls[0][0]
  expect(input.path).toBe('B'); expect(input.title).toBe(project.project_title)
  expect(Object.keys(input.patch)).toEqual(['governance_literacy_evidence'])
  const e = input.patch.governance_literacy_evidence.facts_impact_lesson_5_2
  expect(Object.keys(input.patch.governance_literacy_evidence)).toEqual(['facts_impact_lesson_5_2'])
  expect(Object.keys(e.facts_and_impact)).toEqual(['facts', 'assumptions', 'context', 'test', 'stakeholders', 'impact'])
  expect(e.facts_and_impact.test.variations).toEqual([{ input: e.draft.variationA, actual: e.draft.resultA }, { input: e.draft.variationB, actual: e.draft.resultB }])
  expect(e.facts_and_impact.test.error_case).toEqual({ input: e.draft.errorInput, actual: e.draft.errorResult })
  expect(e.certifies_universal_accuracy_or_fairness).toBe(false)
  expect(e.authorizes_live_queue_change).toBe(false)
  expect(e.material_correction).toBe(e.draft.correction)
  expect(e.ai_request).toContain('Do not certify'); expect(e.ai_request).not.toContain('[sanitized output]')
  expect(screen.getByRole('status').textContent).toContain('Version 18')
})
it('requires fresh human review after an edit and preserves answers on failed save', async () => {
  api.save.mockRejectedValue(new Error('unavailable'))
  const { container } = render(<PhaseTwoFactsImpactPractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save FACTS and IMPACT review to My Project Record' })
  complete(container)
  fireEvent.change(screen.getByLabelText(/Meaningful fictional/), { target: { value: 'Changed fictional input' } })
  expect(save).toHaveProperty('disabled', true)
  expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(save)
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
  expect(screen.getByLabelText(/Meaningful fictional/)).toHaveProperty('value', 'Changed fictional input')
})
it('restores the existing review draft and supports a read-only owner preview', async () => {
  api.load.mockResolvedValue({ ...project, sections: { governance_literacy_evidence: { facts_impact_lesson_5_2: { draft: { context: 'Saved context', decision: 'Pause routing pending evidence' } } } } })
  const { unmount } = render(<PhaseTwoFactsImpactPractice enrollmentId="existing" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/Human continue/)).toHaveProperty('value', 'Pause routing pending evidence'))
  expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
  unmount(); vi.clearAllMocks()
  render(<PhaseTwoFactsImpactPractice approvedAiRequest={request} />)
  expect(api.load).not.toHaveBeenCalled(); expect(api.save).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Save FACTS and IMPACT review to My Project Record' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Copy my Lesson 5.2 record' })).toBeTruthy()
})
