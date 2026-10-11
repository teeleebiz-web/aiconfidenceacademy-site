import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoOperatingGuidancePractice } from './PhaseTwoOperatingGuidancePractice'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = 'Draft the selected documentation format using Context, Lead, Entry, Actions, Result, Exceptions and Record. Use only the tested workflow. Flag missing owners or rules. Inputs: [map and tests].'
const project = { project_path: 'B', project_title: 'Existing bounded procedure', sections: { governance_literacy_evidence: { safe_lesson_5_1: { retained: true }, facts_impact_lesson_5_2: { retained: true } } } }
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue(project); api.save.mockResolvedValue({ saved_version: 19 }) })
function complete(container: HTMLElement) {
  container.querySelectorAll('textarea').forEach(x => { if (!x.readOnly) fireEvent.change(x, { target: { value: 'Fictional tested input. Missing approval stops sending; record hold and seek the confirmed reviewer.' } }) })
  fireEvent.click(screen.getByRole('checkbox'))
}
it('saves seven CLEARER parts, actual normal and exception evidence through a scoped patch', async () => {
  const { container } = render(<PhaseTwoOperatingGuidancePractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save CLEARER guidance to My Project Record' })
  expect(save).toHaveProperty('disabled', true)
  complete(container); fireEvent.click(save)
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce())
  const input = api.save.mock.calls[0][0]
  expect(input.path).toBe('B'); expect(input.title).toBe(project.project_title)
  expect(Object.keys(input.patch)).toEqual(['governance_literacy_evidence'])
  expect(Object.keys(input.patch.governance_literacy_evidence)).toEqual(['operating_guidance_lesson_5_3'])
  const e = input.patch.governance_literacy_evidence.operating_guidance_lesson_5_3
  expect(Object.keys(e.clearer_operating_document)).toEqual(['context','lead','entry','actions','result','exceptions','record'])
  expect(e.walkthrough.normal.actual).toBe(e.draft.normalActual)
  expect(e.walkthrough.exception.actual).toBe(e.draft.exceptionActual)
  expect(e.before_after_corrections).toBe(e.draft.corrections)
  expect(e.invents_organizational_policy).toBe(false); expect(e.authorizes_live_sending).toBe(false)
  expect(e.ai_request).toContain('Flag missing owners'); expect(e.ai_request).not.toContain('[map and tests]')
  expect(screen.getByRole('status').textContent).toContain('Version 19')
})
it('requires fresh review after an edit and retains answers when save fails', async () => {
  api.save.mockRejectedValue(new Error('unavailable'))
  const { container } = render(<PhaseTwoOperatingGuidancePractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save CLEARER guidance to My Project Record' })
  complete(container)
  fireEvent.change(screen.getByLabelText(/Exceptions: stop/), { target: { value: 'Stop before sending; reviewer confirmation pending' } })
  expect(save).toHaveProperty('disabled', true); expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(save)
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
  expect(screen.getByLabelText(/Exceptions: stop/)).toHaveProperty('value','Stop before sending; reviewer confirmation pending')
})
it('restores operating evidence and provides owner preview without attempting learner writes', async () => {
  api.load.mockResolvedValue({ ...project, sections: { governance_literacy_evidence: { operating_guidance_lesson_5_3: { draft: { context:'Saved scope', decision:'Pause until reviewer confirmed' } } } } })
  const { unmount } = render(<PhaseTwoOperatingGuidancePractice enrollmentId="existing" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/Human usability/)).toHaveProperty('value','Pause until reviewer confirmed'))
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  unmount(); vi.clearAllMocks()
  render(<PhaseTwoOperatingGuidancePractice approvedAiRequest={request} />)
  expect(api.load).not.toHaveBeenCalled(); expect(api.save).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', {name:'Save CLEARER guidance to My Project Record'})).toBeNull()
  expect(screen.getByRole('button',{name:'Copy my Lesson 5.3 record'})).toBeTruthy()
})
