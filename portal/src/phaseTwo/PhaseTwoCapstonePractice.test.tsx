import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { PhaseTwoCapstonePractice } from './PhaseTwoCapstonePractice'

it('keeps the Phase Two FOCUS charter within the same learner project with no fabricated preview save',()=>{
  render(<PhaseTwoCapstonePractice />)
  expect(screen.getByRole('heading',{name:'Design one finishable capstone artifact'})).toBeTruthy()
  expect(screen.getByText(/Founder preview: your work can be copied/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Save to My Project Record'})).toBeNull()
  for (const phrase of ['Function —','Owner —','Customer —','Use Case —','Scope —']) {
    expect(screen.getByLabelText(new RegExp(phrase))).toBeTruthy()
  }
  const f=screen.getByLabelText(/Function —/)
  fireEvent.change(f,{target:{value:'Create one fictional estimate for human review'}})
  const request=screen.getByLabelText('FOCUS AI request') as HTMLTextAreaElement
  expect(request.value).toContain('Function: Create one fictional estimate')
  expect(request.value).toContain('Do not assume approval to deploy.')
  expect(screen.getAllByText(/Candidate artifact/).length).toBeGreaterThanOrEqual(3)
})
