import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoArtifactFinishPractice } from './PhaseTwoArtifactFinishPractice'
import production from '../../../academy/phase-two-production/J6-L6-2-production.json'
const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }))
vi.mock('./phaseTwoProject', () => ({ loadPhaseTwoProject: api.load, savePhaseTwoProjectUpdate: api.save }))
beforeEach(() => {
  vi.clearAllMocks()
  api.load.mockResolvedValue({ project_path: 'B', project_title: 'Continuing intake project', sections: { capstone_integration_package: { earlier: 'retained' }, professional_positioning_evidence: { retained: true } } })
  api.save.mockResolvedValue({ saved_version: 32 })
})
it('requires actual revision and retest review, then patches only the existing capstone section', async () => {
  const { container } = render(<PhaseTwoArtifactFinishPractice enrollmentId="existing" approvedAiRequest={production.approved_ai_request} />)
  const save = await screen.findByRole('button', { name: 'Save Capstone Integration Package to My Project Record' })
  expect(save).toHaveProperty('disabled', true)
  for (const x of [...container.querySelectorAll('textarea')].filter(x => !x.readOnly)) fireEvent.change(x, { target: { value: 'Actual version 2 tabletop observation; approval absent blocks delivery; live use untested.' } })
  const retest=screen.getByLabelText(/^Retest of the correction/)
  fireEvent.change(retest, { target: { value: '' } });fireEvent.click(screen.getByRole('checkbox'));expect(save).toHaveProperty('disabled',true)
  fireEvent.change(retest, { target: { value: 'Version 2 repeat test: absent approval leaves output unapproved.' } })
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(save)
  await waitFor(()=>expect(api.save).toHaveBeenCalledOnce())
  const input=api.save.mock.calls[0][0]
  expect(input.path).toBe('B');expect(input.title).toBe('Continuing intake project')
  expect(Object.keys(input.patch)).toEqual(['capstone_integration_package'])
  expect(Object.keys(input.patch.capstone_integration_package)).toEqual(['artifact_finish_lesson_6_2'])
  const evidence=input.patch.capstone_integration_package.artifact_finish_lesson_6_2
  expect(evidence.retest).toContain('absent approval');expect(evidence.tests.normal).toContain('version 2')
  expect(evidence.ai_request).not.toContain('[artifact and tests]');expect(evidence.human_review_confirmed).toBe(true)
  expect(screen.getByRole('status').textContent).toContain('Version 32')
})
it('restores saved revision without preapproving it and keeps review preview read-only',async()=>{
  api.load.mockResolvedValue({project_path:'B',project_title:'Existing project',sections:{capstone_integration_package:{artifact_finish_lesson_6_2:{draft:{revision:'Saved before-and-after correction'}}}}})
  const {unmount}=render(<PhaseTwoArtifactFinishPractice enrollmentId="existing" approvedAiRequest={production.approved_ai_request}/>)
  await waitFor(()=>expect(screen.getByLabelText(/^Material correction:/)).toHaveProperty('value','Saved before-and-after correction'))
  expect(screen.getByRole('checkbox')).toHaveProperty('checked',false)
  unmount();vi.clearAllMocks();render(<PhaseTwoArtifactFinishPractice approvedAiRequest={production.approved_ai_request}/>)
  expect(api.load).not.toHaveBeenCalled();expect(api.save).not.toHaveBeenCalled()
  expect(screen.getByRole('button',{name:'Copy my Lesson 6.2 record'})).toBeTruthy()
})
