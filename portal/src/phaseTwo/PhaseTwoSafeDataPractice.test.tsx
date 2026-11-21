import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoSafeDataPractice } from './PhaseTwoSafeDataPractice'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = 'Review this fictional data inventory using Scope, Authority, Filter, Environment and Exit. Do not infer permissions. Inventory: [categories].'
const project = { project_path: 'B', project_title: 'Existing bounded guide', sections: { digital_delivery_artifact: { retained: 'Prior Journey Four evidence' } } }
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue(project); api.save.mockResolvedValue({ saved_version: 18 }) })
function complete(container: HTMLElement) {
  container.querySelectorAll('textarea').forEach(x => { if (!x.readOnly) fireEvent.change(x, { target: { value: 'Fictional input. Real authority is unconfirmed; pause and check the responsible policy owner.' } }) })
  fireEvent.click(screen.getByRole('checkbox'))
}
it('saves only the new SAFE evidence and retains explicit permission and test limits', async () => {
  const { container } = render(<PhaseTwoSafeDataPractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save SAFE record to My Project Record' })
  expect(save).toHaveProperty('disabled', true)
  complete(container); fireEvent.click(save)
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce())
  const input = api.save.mock.calls[0][0]
  expect(input.path).toBe('B'); expect(input.title).toBe(project.project_title)
  expect(Object.keys(input.patch)).toEqual(['governance_literacy_evidence'])
  const e = input.patch.governance_literacy_evidence.safe_lesson_5_1
  expect(Object.keys(e.safe)).toEqual(['scope', 'authority', 'filter', 'environment', 'exit'])
  expect(e.saved_record_grants_data_permission).toBe(false)
  expect(e.test_establishes_universal_safety).toBe(false)
  expect(e.fictional_instruction_test.actual).toBe(e.draft.actual)
  expect(e.ai_request).toContain('Do not infer permissions'); expect(e.ai_request).not.toContain('[categories]')
  expect(screen.getByRole('status').textContent).toContain('Version 18')
})
it('requires fresh human review after an edit and preserves answers on failed save', async () => {
  api.save.mockRejectedValue(new Error('unavailable'))
  const { container } = render(<PhaseTwoSafeDataPractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save SAFE record to My Project Record' })
  complete(container)
  fireEvent.change(screen.getByLabelText(/Complete minimized/), { target: { value: 'Changed fictional input' } })
  expect(save).toHaveProperty('disabled', true)
  expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(save)
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
  expect(screen.getByLabelText(/Complete minimized/)).toHaveProperty('value', 'Changed fictional input')
})
it('restores an existing SAFE draft and supports a read-only owner preview', async () => {
  api.load.mockResolvedValue({ ...project, sections: { governance_literacy_evidence: { safe_lesson_5_1: { draft: { context: 'Saved context', decision: 'Pause real use' } } } } })
  const { unmount } = render(<PhaseTwoSafeDataPractice enrollmentId="existing" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/Human continue/)).toHaveProperty('value', 'Pause real use'))
  expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
  unmount(); vi.clearAllMocks()
  render(<PhaseTwoSafeDataPractice approvedAiRequest={request} />)
  expect(api.load).not.toHaveBeenCalled(); expect(api.save).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Save SAFE record to My Project Record' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Copy my Lesson 5.1 record' })).toBeTruthy()
})
