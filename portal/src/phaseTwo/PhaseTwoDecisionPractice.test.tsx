import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { PhaseTwoDecisionPractice } from './PhaseTwoDecisionPractice'

it('requires the six professional request elements and keeps preview work copyable without fake learner saving',()=>{
  render(<PhaseTwoDecisionPractice />)
  expect(screen.getByRole('heading',{name:'Build a professional request and decision memo'})).toBeTruthy()
  expect(screen.getByText(/Founder preview: copy your exercise/)).toBeTruthy()
  const fields = [
    /Purpose — why does this work matter/,
    /Audience — who needs the outcome/,
    /Context — what verified information/,
    /Task — exactly what should/,
    /Constraints — what is off limits/,
    /Quality — how will/,
  ]
  for (const field of fields) {
    expect(screen.getByLabelText(field)).toBeTruthy()
  }
  expect(screen.queryByRole('button',{name:'Save to My Project Record'})).toBeNull()
  const task=screen.getByLabelText(/Task — exactly/)
  fireEvent.change(task,{target:{value:'Compare two authorized options and list material evidence gaps'}})
  expect((task as HTMLTextAreaElement).value).toMatch(/Compare two authorized/)
  const prompt=screen.getByLabelText('Professional AI request to copy') as HTMLTextAreaElement
  expect(prompt.value).toContain('Ask necessary questions before recommending')
  expect(prompt.value).toContain('Do not invent interviews')
})
