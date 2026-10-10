import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { PhaseTwoWorkflowPractice } from './PhaseTwoWorkflowPractice'

it('uses existing Journey One project to teach the seven Workflow View dimensions and three evidence-labeled friction points',()=>{
  render(<PhaseTwoWorkflowPractice />)
  expect(screen.getByRole('heading',{name:'Map the actual work and locate three friction points'})).toBeTruthy()
  expect(screen.getByText(/Founder preview: copy your work/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:/Save Workflow View to My Project Record/})).toBeNull()
  expect(screen.getByRole('group',{name:'Current step 1'})).toBeTruthy()
  expect(screen.getByRole('group',{name:'Current step 4'})).toBeTruthy()
  expect(screen.getByRole('group',{name:'Friction 1'})).toBeTruthy()
  expect(screen.getByRole('group',{name:'Friction 2'})).toBeTruthy()
  expect(screen.getByRole('group',{name:'Friction 3'})).toBeTruthy()
  const input=screen.getByLabelText('What request or information starts the work?') as HTMLTextAreaElement
  fireEvent.change(input,{target:{value:'An authorized fictional estimate request enters the intake queue.'}})
  const prompt=screen.getByLabelText('Workflow View AI request') as HTMLTextAreaElement
  expect(prompt.value).toContain('Organize my verified process notes')
  expect(prompt.value).toContain('An authorized fictional estimate request')
  expect(prompt.value).toContain('Flag missing details and possible friction without inventing steps')
})
it('allows additional steps without inventing owner details',()=>{
  render(<PhaseTwoWorkflowPractice />)
  fireEvent.click(screen.getByRole('button',{name:'Add current workflow step'}))
  expect(screen.getByRole('group',{name:'Current step 5'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Remove last step'}))
  expect(screen.queryByRole('group',{name:'Current step 5'})).toBeNull()
})
