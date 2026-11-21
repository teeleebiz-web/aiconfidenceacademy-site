import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoStressTestPractice } from './PhaseTwoStressTestPractice'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = "Prepare normal, error and exception scenarios for this bounded system. Include unavailable tools and a request outside authority. Ask for expected human responses and evidence to retain. Scope: [plan]."
const project = { project_path: 'B', project_title: 'Existing bounded procedure', sections: { governance_literacy_evidence: { continuity_lesson_5_4: { retained: true } } } }
beforeEach(() => { vi.clearAllMocks(); api.load.mockResolvedValue(project); api.save.mockResolvedValue({ saved_version: 20 }) })
function complete(container: HTMLElement) {
  container.querySelectorAll('textarea').forEach(x => { if (!x.readOnly) fireEvent.change(x, { target: { value: 'Fictional draft checked; reception unverified. Keep simulation; reviewer stops reliance.' } }) })
  fireEvent.click(screen.getByRole('checkbox'))
}
it('saves three-case evidence, correction and integrated reviews through one scoped patch', async () => {
  const { container } = render(<PhaseTwoStressTestPractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save stress-test evidence to My Project Record' })
  expect(save).toHaveProperty('disabled', true); complete(container); fireEvent.click(save)
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce())
  const input = api.save.mock.calls[0][0]
  expect(input.path).toBe('B'); expect(input.title).toBe(project.project_title)
  expect(Object.keys(input.patch)).toEqual(['governance_literacy_evidence'])
  expect(Object.keys(input.patch.governance_literacy_evidence)).toEqual(['stress_test_lesson_5_6'])
  const e = input.patch.governance_literacy_evidence.stress_test_lesson_5_6
  expect(Object.keys(e.scenarios)).toEqual(['normal','error','exception'])
  expect(e.scenarios.normal.actual_and_evidence).toBe(e.draft.normalActual)
  expect(e.scenarios.error.actual_and_evidence).toBe(e.draft.errorActual)
  expect(e.scenarios.exception.actual_and_evidence).toBe(e.draft.exceptionActual)
  expect(e.safeguard_correction).toEqual({first_failed_result:e.draft.failed,before_and_after:e.draft.correction,actual_retest_and_limits:e.draft.retest})
  expect(Object.keys(e.integrated_reviews)).toEqual(['safe','facts_and_impact','trace','pause'])
  expect(e.recipient_notice).toBe(e.draft.notice); expect(e.interruption_and_handoff).toBe(e.draft.handoff)
  expect(e.functioning_route_demonstration).toBe(e.draft.demonstration)
  expect(e.certifies_live_tool_reliability).toBe(false); expect(e.authorizes_production_use).toBe(false)
  expect(e.ai_request).not.toContain('[plan]'); expect(screen.getByRole('status').textContent).toContain('Version 20')
})
it('requires fresh review after edits and retains answers when saving fails', async () => {
  api.save.mockRejectedValue(new Error('unavailable'))
  const { container } = render(<PhaseTwoStressTestPractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save stress-test evidence to My Project Record' })
  complete(container)
  fireEvent.change(screen.getByLabelText(/Evidence and approval needed/), { target: { value: 'New receipt evidence requires owner review' } })
  expect(save).toHaveProperty('disabled', true); expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(save)
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Save was unsuccessful'))
  expect(screen.getByLabelText(/Evidence and approval needed/)).toHaveProperty('value','New receipt evidence requires owner review')
})
it('restores the decision and provides owner preview without learner writes', async () => {
  api.load.mockResolvedValue({ ...project, sections: { governance_literacy_evidence: { stress_test_lesson_5_6: { draft: { pause:'Pause until confirmation' } } } } })
  const { unmount } = render(<PhaseTwoStressTestPractice enrollmentId="existing" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/PAUSE review/)).toHaveProperty('value','Pause until confirmation'))
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  unmount(); vi.clearAllMocks(); render(<PhaseTwoStressTestPractice approvedAiRequest={request} />)
  expect(api.load).not.toHaveBeenCalled(); expect(api.save).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', {name:'Save stress-test evidence to My Project Record'})).toBeNull()
  expect(screen.getByRole('button',{name:'Copy my Lesson 5.6 record'})).toBeTruthy()
})
