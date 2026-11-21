import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoAccountabilityPractice } from './PhaseTwoAccountabilityPractice'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = 'Challenge this decision using Purpose, Affected People, Uncertainty, Safeguards and Escalation. Identify unsupported assumptions and missing ownership. Help organize a TRACE record without declaring compliance. Inputs: [evidence].'
const project = { project_path: 'B', project_title: 'Existing bounded procedure', sections: { governance_literacy_evidence: { continuity_lesson_5_4: { retained: true } } } }
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue(project); api.save.mockResolvedValue({ saved_version: 20 }) })
function complete(container: HTMLElement) {
  container.querySelectorAll('textarea').forEach(x => { if (!x.readOnly) fireEvent.change(x, { target: { value: 'Fictional draft checked; reception unverified. Keep simulation; reviewer stops reliance.' } }) })
  fireEvent.click(screen.getByRole('checkbox'))
}
it('saves six TRACE parts, five PAUSE parts, decision and notice through one scoped patch', async () => {
  const { container } = render(<PhaseTwoAccountabilityPractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save accountability evidence to My Project Record' })
  expect(save).toHaveProperty('disabled', true); complete(container); fireEvent.click(save)
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce())
  const input = api.save.mock.calls[0][0]
  expect(input.path).toBe('B'); expect(input.title).toBe(project.project_title)
  expect(Object.keys(input.patch)).toEqual(['governance_literacy_evidence'])
  expect(Object.keys(input.patch.governance_literacy_evidence)).toEqual(['accountability_lesson_5_5'])
  const e = input.patch.governance_literacy_evidence.accountability_lesson_5_5
  expect(Object.keys(e.trace_record)).toEqual(['task','role','artifacts','checks','explanation','accountability'])
  expect(Object.keys(e.pause_decision_gate)).toEqual(['purpose','affected_people','uncertainty','safeguards','escalation'])
  expect(e.trace_record.checks).toBe(e.draft.checks); expect(e.pause_decision_gate.uncertainty).toBe(e.draft.uncertainty)
  expect(e.decision_memo).toBe(e.draft.decision); expect(e.proportionate_notice).toBe(e.draft.notice)
  expect(e.responsible_practice_statement).toBe(e.draft.statement); expect(e.reassessment_trigger).toBe(e.draft.reassessment)
  expect(e.declares_legal_compliance).toBe(false); expect(e.authorizes_production_use).toBe(false)
  expect(e.ai_request).not.toContain('[evidence]'); expect(screen.getByRole('status').textContent).toContain('Version 20')
})
it('requires fresh review after edits and retains answers when saving fails', async () => {
  api.save.mockRejectedValue(new Error('unavailable'))
  const { container } = render(<PhaseTwoAccountabilityPractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save accountability evidence to My Project Record' })
  complete(container)
  fireEvent.change(screen.getByLabelText(/Reassessment trigger:/), { target: { value: 'New receipt evidence requires owner review' } })
  expect(save).toHaveProperty('disabled', true); expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(save)
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
  expect(screen.getByLabelText(/Reassessment trigger:/)).toHaveProperty('value','New receipt evidence requires owner review')
})
it('restores the decision and provides owner preview without learner writes', async () => {
  api.load.mockResolvedValue({ ...project, sections: { governance_literacy_evidence: { accountability_lesson_5_5: { draft: { decision:'Pause until confirmation' } } } } })
  const { unmount } = render(<PhaseTwoAccountabilityPractice enrollmentId="existing" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/Decision memo:/)).toHaveProperty('value','Pause until confirmation'))
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  unmount(); vi.clearAllMocks(); render(<PhaseTwoAccountabilityPractice approvedAiRequest={request} />)
  expect(api.load).not.toHaveBeenCalled(); expect(api.save).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', {name:'Save accountability evidence to My Project Record'})).toBeNull()
  expect(screen.getByRole('button',{name:'Copy my Lesson 5.5 record'})).toBeTruthy()
})
