import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoVisualLab } from './PhaseTwoVisualLab'

const workedCase = {
  label: 'A manager reviews an AI-generated service report',
  setup: 'The draft incorrectly claims 95% on-time resolution.',
  evidence_table: [
    { claim: '42 requests arrived.', evidence: 'Present in the fictional approved weekly record.', action: 'Check the source tally.' },
    { claim: '36 requests were resolved.', evidence: 'Present in the fictional approved weekly record.', action: 'Verify the meaning of resolved.' },
    { claim: '95% were on time.', evidence: 'No timing evidence was supplied.', action: 'Withhold until approved timing evidence exists.' },
    { claim: 'Performance improved.', evidence: 'No comparison baseline was supplied.', action: 'Do not imply an improvement.' },
  ],
  revised_example: 'The record lists 42 received and 36 resolved; timing and improvement remain unverified.',
  demonstration_steps: ['Read', 'Verify', 'Revise'],
  question: 'Which claim needs more evidence?',
}

describe('Lesson 1.1 visual teaching sequence', () => {
  it('follows source → AI draft → human check → corrected result', async () => {
    const user=userEvent.setup()
    render(<PhaseTwoVisualLab workedCase={workedCase} />)
    expect(screen.getByRole('heading',{name:'Start with the approved record'})).toBeTruthy()
    expect(screen.getByText('42 requests arrived.')).toBeTruthy()
    await user.click(screen.getByRole('button',{name:/Next step/i}))
    expect(screen.getByRole('heading',{name:'Spot the unsupported claim'})).toBeTruthy()
    expect(screen.getByText('Needs evidence')).toBeTruthy()
    await user.click(screen.getByRole('button',{name:/Next step/i}))
    expect(screen.getByRole('heading',{name:'Check the claim against its source'})).toBeTruthy()
    expect(screen.getByText('No timing evidence was supplied.')).toBeTruthy()
    await user.click(screen.getByRole('button',{name:/Next step/i}))
    expect(screen.getByRole('heading',{name:'Make the result dependable'})).toBeTruthy()
    expect(screen.getByText(workedCase.revised_example)).toBeTruthy()
    expect(screen.getByRole('button',{name:/Next step/i})).toHaveProperty('disabled',true)
  })

  it('offers specific evidence feedback instead of awarding completion for clicking', async () => {
    const user=userEvent.setup()
    render(<PhaseTwoVisualLab workedCase={workedCase} />)
    await user.click(screen.getByRole('button',{name:'42 requests arrived.'}))
    expect(screen.getByRole('status').textContent).toContain('Look again')
    await user.click(screen.getByRole('button',{name:'95% were on time.'}))
    expect(screen.getByRole('status').textContent).toContain('Correct.')
    expect(screen.queryByText(/lesson complete|credential earned|automatic pass/i)).toBeNull()
  })

  it('allows revisiting a prior teaching frame and resets its quick check', async () => {
    const user=userEvent.setup()
    render(<PhaseTwoVisualLab workedCase={workedCase} />)
    await user.click(screen.getByRole('button',{name:'95% were on time.'}))
    expect(screen.getByRole('status')).toBeTruthy()
    await user.click(screen.getByRole('button',{name:/02 Draft/i}))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('heading',{name:'Spot the unsupported claim'})).toBeTruthy()
    await user.click(screen.getByRole('button',{name:/01 Source/i}))
    expect(screen.getByRole('heading',{name:'Start with the approved record'})).toBeTruthy()
  })
})
