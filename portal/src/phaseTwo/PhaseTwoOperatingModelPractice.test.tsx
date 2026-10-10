import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { PhaseTwoOperatingModelPractice } from './PhaseTwoOperatingModelPractice'

it('concludes Journey One with six human-first fields, three stress cases, and clear proceed/pause decisions',()=>{
  render(<PhaseTwoOperatingModelPractice />)
  expect(screen.getByRole('heading',{name:'Stress test your Professional AI Operating Model'})).toBeTruthy()
  expect(screen.getByText(/Founder preview: copy your evidence/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Save Journey One Operating Model'})).toBeNull()
  for(const prefix of ['Purpose and outcome','Appropriate AI role','Human responsibility','Review process','Responsible boundaries','Growth commitments']){
    expect(screen.getByLabelText(new RegExp(prefix))).toBeTruthy()
  }
  expect(screen.getByRole('group',{name:'Routine task'})).toBeTruthy()
  expect(screen.getByRole('group',{name:'Inaccurate AI output'})).toBeTruthy()
  expect(screen.getByRole('group',{name:'High-consequence privacy or authority request'})).toBeTruthy()
  const value=screen.getByLabelText(/Purpose and outcome/)
  fireEvent.change(value,{target:{value:'Support a person with safe, dependable work'}})
  const ai=screen.getByLabelText('Operating Model AI challenge prompt') as HTMLTextAreaElement
  expect(ai.value).toContain('Support a person with safe, dependable work')
  expect(ai.value).toContain('Challenge this operating model')
  expect(screen.getByLabelText(/Defend one PROCEED/)).toBeTruthy()
  expect(screen.getByLabelText(/Defend one PAUSE/)).toBeTruthy()
})
