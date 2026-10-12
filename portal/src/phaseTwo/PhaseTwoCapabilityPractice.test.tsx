import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoCapabilityPractice } from './PhaseTwoCapabilityPractice'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
const request = 'Help turn these activities into Explain, Do, Review, Improve and Show statements. Link each to supplied evidence, realistic value and a limit. Do not add titles or results. Evidence: [index].'
beforeEach(() => {
  vi.clearAllMocks()
  api.load.mockResolvedValue({ project_path: 'B', project_title: 'Continuing proposal project', sections: { professional_positioning_evidence: { earlier: 'retained' }, governance_literacy_evidence: { retained: true } } })
  api.save.mockResolvedValue({ saved_version: 31 })
})
it('requires ten entries and reviewed evidence, then saves only the professional positioning section', async () => {
  const { container } = render(<PhaseTwoCapabilityPractice enrollmentId="existing" approvedAiRequest={request} />)
  const save = await screen.findByRole('button', { name: 'Save Professional Positioning Evidence to My Project Record' })
  expect(save).toHaveProperty('disabled', true)
  const inputs = [...container.querySelectorAll('textarea')].filter(x => !x.readOnly)
  for (const x of inputs) fireEvent.change(x, { target: { value: 'Reviewed fictional draft; evidence version 2; live use untested.' } })
  fireEvent.change(screen.getByLabelText(/^Capability 10:/), { target: { value: '' } })
  fireEvent.click(screen.getByRole('checkbox')); expect(save).toHaveProperty('disabled', true)
  fireEvent.change(screen.getByLabelText(/^Capability 10:/), { target: { value: 'Show the corrected walkthrough; fictional case only.' } })
  expect(screen.getByRole('checkbox')).toHaveProperty('checked', false)
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(save)
  await waitFor(() => expect(api.save).toHaveBeenCalledOnce())
  const input = api.save.mock.calls[0][0]
  expect(input.path).toBe('B'); expect(input.title).toBe('Continuing proposal project')
  expect(Object.keys(input.patch)).toEqual(['professional_positioning_evidence'])
  expect(Object.keys(input.patch.professional_positioning_evidence)).toEqual(['capability_lesson_6_1'])
  const evidence = input.patch.professional_positioning_evidence.capability_lesson_6_1
  expect(evidence.capability_inventory).toHaveLength(10); expect(evidence.value_connections).toHaveLength(3)
  expect(evidence.grants_professional_title).toBe(false); expect(evidence.grants_authority).toBe(false)
  expect(evidence.ai_request).not.toContain('[index]')
  expect(screen.getByRole('status').textContent).toContain('Version 31')
})
it('restores the saved story without approving it and keeps owner review read-only', async () => {
  api.load.mockResolvedValue({ project_path:'B', project_title:'Existing project', sections:{professional_positioning_evidence:{capability_lesson_6_1:{draft:{story:'Saved privacy-safe story'}}}} })
  const { unmount } = render(<PhaseTwoCapabilityPractice enrollmentId="existing" approvedAiRequest={request} />)
  await waitFor(() => expect(screen.getByLabelText(/^Evidence Story:/)).toHaveProperty('value','Saved privacy-safe story'))
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  unmount(); vi.clearAllMocks(); render(<PhaseTwoCapabilityPractice approvedAiRequest={request} />)
  expect(api.load).not.toHaveBeenCalled(); expect(api.save).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Copy my Lesson 6.1 record'})).toBeTruthy()
})
