import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseTwoNeedLab } from './PhaseTwoNeedLab'

const caseData = {
  label: 'Fictional customer-service need investigation',
  setup: 'The team observes repeated delivery-update questions, but no cause has been established.',
  evidence_table: [
    { claim: 'Delivery updates appear repeatedly.', evidence: 'Observed in fictional notes.', action: 'Confirm the period and count.' },
    { claim: 'Information is missing.', evidence: 'Possible cause, not established.', action: 'Inspect the help material.' },
    { claim: 'Policies are inconsistent.', evidence: 'Possible cause, not established.', action: 'Check current policy versions.' },
    { claim: 'Routing is causing delays.', evidence: 'Possible cause, not established.', action: 'Follow anonymized handoffs.' },
  ],
  revised_example: 'The topic appears repeatedly, but we need authorized review before selecting a solution.',
  demonstration_steps: ['Identify the symptom.', 'Map audience need.', 'Compare causes.'],
  question: 'What evidence might change the solution?',
}

describe('Lesson 1.2 visual audience-need investigation', () => {
  it('moves through observation, audience needs, competing causes and a provisional decision', async () => {
    const user = userEvent.setup()
    render(<PhaseTwoNeedLab workedCase={caseData} />)
    expect(screen.getByRole('heading', { name: 'Begin with the symptom' })).toBeTruthy()
    await user.click(screen.getByRole('button',{name:/Next step/i}))
    expect(screen.getByRole('heading', { name: 'See the person and the need' })).toBeTruthy()
    expect(screen.getByText('Barrier')).toBeTruthy()
    await user.click(screen.getByRole('button',{name:/Next step/i}))
    expect(screen.getByRole('heading', { name: 'Test possible causes' })).toBeTruthy()
    expect(screen.getAllByText('Possible cause, not established.').length).toBe(3)
    await user.click(screen.getByRole('button',{name:/Next step/i}))
    expect(screen.getByRole('heading', { name: 'Choose the next responsible step' })).toBeTruthy()
    expect(screen.getByText(caseData.revised_example)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Five neutral questions to inspire your own' })).toBeTruthy()
    expect(screen.getByRole('button',{name:/Next step/i})).toHaveProperty('disabled',true)
  })

  it('corrects unfounded tool-first assumptions without awarding credit', async () => {
    const user=userEvent.setup()
    render(<PhaseTwoNeedLab workedCase={caseData} />)
    await user.click(screen.getByRole('button',{name:'Every customer wants an AI chatbot.'}))
    expect(screen.getByRole('status').textContent).toContain('needs verification')
    await user.click(screen.getByRole('button',{name:'Delivery updates appear repeatedly.'}))
    expect(screen.getByRole('status').textContent).toContain('Correct.')
    expect(screen.queryByText(/lesson complete|passed the course|earned a credential/i)).toBeNull()
  })

  it('lets learners revisit a step and clears the earlier decision', async () => {
    const user=userEvent.setup()
    render(<PhaseTwoNeedLab workedCase={caseData} />)
    await user.click(screen.getByRole('button',{name:'Every customer wants an AI chatbot.'}))
    expect(screen.getByRole('status')).toBeTruthy()
    await user.click(screen.getByRole('button',{name:/Understand/i}))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('heading',{name:'See the person and the need'})).toBeTruthy()
  })
})
