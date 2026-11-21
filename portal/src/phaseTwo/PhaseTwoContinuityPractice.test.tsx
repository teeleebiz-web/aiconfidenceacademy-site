import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoContinuityPractice } from './PhaseTwoContinuityPractice'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = 'Review this workflow using FLOW, CARE Improvement Check and READY Automation Screen. Identify handoff, fallback and continuity gaps. Compare effort before and after using supplied evidence. Map: [draft].'
const project = { project_path: 'B', project_title: 'Existing bounded procedure', sections: { governance_literacy_evidence: { safe_lesson_5_1: { retained: true }, facts_impact_lesson_5_2: { retained: true } } } }
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue(project); api.save.mockResolvedValue({ saved_version: 19 }) })
function complete(container: HTMLElement) {
  container.querySelectorAll('textarea').forEach(x => { if (!x.readOnly) fireEvent.change(x, { target: { value: 'Fictional tested input. Missing approval stops sending; record hold and seek the confirmed reviewer.' } }) })
  fireEvent.click(screen.getByRole('checkbox'))
}
it('saves three READY screens, actual failure and backup evidence and operating responsibility through a scoped patch', async () => {
  const { container } = render(<PhaseTwoContinuityPractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save continuity evidence to My Project Record' })
  expect(save).toHaveProperty('disabled', true)
  complete(container); fireEvent.click(save)
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce())
  const input = api.save.mock.calls[0][0]
  expect(input.path).toBe('B'); expect(input.title).toBe(project.project_title)
  expect(Object.keys(input.patch)).toEqual(['governance_literacy_evidence'])
  expect(Object.keys(input.patch.governance_literacy_evidence)).toEqual(['continuity_lesson_5_4'])
  const e = input.patch.governance_literacy_evidence.continuity_lesson_5_4
  expect(e.ready_three_step_screen).toEqual([e.draft.stepOne,e.draft.stepTwo,e.draft.stepThree])
  expect(e.failure_test.actual).toBe(e.draft.failureActual)
  expect(e.backup_test.actual).toBe(e.draft.backupActual)
  expect(Object.keys(e.operations_responsibility_statement)).toEqual(['owners','human_led_step_and_takeover','monitoring','fallback','maintenance'])
  expect(e.improvement_test).toEqual({change_and_expected_benefit:e.draft.improvement,before:e.draft.before,after:e.draft.after,supported_finding_and_limits:e.draft.comparison})
  expect(e.certifies_live_tool_reliability).toBe(false); expect(e.authorizes_live_automation).toBe(false)
  expect(e.ai_request).toContain('CARE Improvement Check'); expect(e.ai_request).not.toContain('[draft]')
  expect(screen.getByRole('status').textContent).toContain('Version 19')
})
it('requires fresh review after an edit and retains answers when save fails', async () => {
  api.save.mockRejectedValue(new Error('unavailable'))
  const { container } = render(<PhaseTwoContinuityPractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save continuity evidence to My Project Record' })
  complete(container)
  fireEvent.change(screen.getByLabelText(/Permitted fallback/), { target: { value: 'Stop before sending; reviewer confirmation pending' } })
  expect(save).toHaveProperty('disabled', true); expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(save)
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
  expect(screen.getByLabelText(/Permitted fallback/)).toHaveProperty('value','Stop before sending; reviewer confirmation pending')
})
it('restores operating evidence and provides owner preview without attempting learner writes', async () => {
  api.load.mockResolvedValue({ ...project, sections: { governance_literacy_evidence: { continuity_lesson_5_4: { draft: { context:'Saved scope', decision:'Pause until reviewer confirmed' } } } } })
  const { unmount } = render(<PhaseTwoContinuityPractice enrollmentId="existing" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/Human continue/)).toHaveProperty('value','Pause until reviewer confirmed'))
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  unmount(); vi.clearAllMocks()
  render(<PhaseTwoContinuityPractice approvedAiRequest={request} />)
  expect(api.load).not.toHaveBeenCalled(); expect(api.save).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', {name:'Save continuity evidence to My Project Record'})).toBeNull()
  expect(screen.getByRole('button',{name:'Copy my Lesson 5.4 record'})).toBeTruthy()
})
