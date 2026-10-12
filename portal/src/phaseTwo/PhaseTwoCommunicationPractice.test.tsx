import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PhaseTwoCommunicationPractice } from './PhaseTwoCommunicationPractice'
const api=vi.hoisted(()=>({load:vi.fn(),save:vi.fn()}))
vi.mock('./phaseTwoProject',()=>({loadPhaseTwoProject:api.load,savePhaseTwoProjectUpdate:api.save}))
const request='Draft [format] for [audience] to support [response]. Use only the supplied facts and voice sample. Ask about missing information. Keep these constraints and quality requirements: [brief].'
beforeEach(()=>{vi.clearAllMocks();api.load.mockResolvedValue({project_path:'B',project_title:'Existing project',sections:{}});api.save.mockResolvedValue({saved_version:9})})

it('keeps owner review honest and builds a tool-independent request from authorized facts',()=>{
  render(<PhaseTwoCommunicationPractice approvedAiRequest={request}/>)
  expect(screen.queryByRole('button',{name:'Save communication evidence to My Project Record'})).toBeNull()
  fireEvent.change(screen.getByLabelText('What format or channel will you use?'),{target:{value:'email'}})
  fireEvent.change(screen.getByLabelText('Approved facts and their sources (label fictional practice)'),{target:{value:'Fictional policy: review complete requests within two business days.'}})
  expect((screen.getByLabelText('Communication AI request') as HTMLTextAreaElement).value).toContain('Draft email')
  expect((screen.getByLabelText('Communication AI request') as HTMLTextAreaElement).value).toContain('Fictional policy')
  expect(screen.queryByRole('button',{name:/send message/i})).toBeNull()
})

it('saves all three versions into a dedicated nested evidence entry using the existing project identity',async()=>{
  render(<PhaseTwoCommunicationPractice approvedAiRequest={request} enrollmentId="existing-enrollment"/>)
  const button=await screen.findByRole('button',{name:'Save communication evidence to My Project Record'})
  expect((button as HTMLButtonElement).disabled).toBe(true)
  screen.getAllByRole('textbox').filter(el=>!(el as HTMLTextAreaElement).readOnly).forEach((el,i)=>fireEvent.change(el,{target:{value:'Verified evidence '+i}}))
  fireEvent.click(button)
  await waitFor(()=>expect(api.save).toHaveBeenCalledTimes(1))
  const call=api.save.mock.calls[0][0]
  expect(call.path).toBe('B');expect(call.title).toBe('Existing project')
  expect(Object.keys(call.patch)).toEqual(['prompt_and_communication_evidence'])
  expect(Object.keys(call.patch.prompt_and_communication_evidence)).toEqual(['communication_lesson_2_2'])
  const evidence=call.patch.prompt_and_communication_evidence.communication_lesson_2_2
  expect(evidence.draft.original).toBeTruthy();expect(evidence.draft.revised).toBeTruthy();expect(evidence.draft.adapted).toBeTruthy()
  expect(evidence.practice_only_not_permission_to_send).toBe(true)
  await screen.findByText('Saved to your continuing Project Record. Version 9.')
})

it('restores saved Lesson 2.2 work without mixing earlier lesson fields',async()=>{
  api.load.mockResolvedValue({project_path:'A',project_title:'Prior project',sections:{prompt_and_communication_evidence:{text:'Lesson 1.4 evidence',communication_lesson_2_2:{draft:{original:'Original retained draft',claims:'Awaiting source verification'}}}}})
  render(<PhaseTwoCommunicationPractice approvedAiRequest={request} enrollmentId="existing-enrollment"/>)
  await waitFor(()=>expect((screen.getByLabelText('Original communication or first AI draft') as HTMLTextAreaElement).value).toBe('Original retained draft'))
  expect((screen.getByLabelText('Claims still needing verification (or explain that none remain)') as HTMLTextAreaElement).value).toBe('Awaiting source verification')
  expect(api.save).not.toHaveBeenCalled()
})
