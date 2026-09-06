import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GettingStarted } from '../../../academy/GettingStarted'

it('offers the official device links and the relevant return instructions', async () => {
  const user = userEvent.setup()
  render(<GettingStarted onBack={() => {}} />)
  expect(screen.getByRole('link', { name: 'Open ChatGPT in a new tab' }).getAttribute('href')).toBe('https://chatgpt.com')
  await user.click(screen.getByRole('radio', { name: 'iPhone', exact: true }))
  expect(screen.getByRole('link', { name: 'Open ChatGPT in the App Store' }).getAttribute('href')).toContain('id6448311069')
  expect(screen.queryByRole('img')).toBeNull()
  await user.click(screen.getByRole('radio', { name: 'Android phone' }))
  expect(screen.getByRole('link', { name: 'Open ChatGPT in Google Play' }).getAttribute('href')).toContain('com.openai.chatgpt')
})

it('copies both exercises and permits a learner to continue without a forced assessment', async () => {
  const user = userEvent.setup()
  const proceed = vi.fn()
  render(<GettingStarted onBack={() => {}} onContinue={proceed} />)
  await user.click(screen.getByRole('button', { name: 'Copy first message' }))
  expect(await navigator.clipboard.readText()).toBe('Suggest three simple activities for a family gathering.')
  await user.click(screen.getByRole('button', { name: 'Copy follow-up message' }))
  expect(await navigator.clipboard.readText()).toBe('Make them suitable for indoors, without buying supplies.')
  for (const check of screen.getAllByRole('checkbox')) await user.click(check)
  expect(screen.getByText('You are ready to begin Lesson 1.1.')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Continue to Lesson 1.1' }))
  expect(proceed).toHaveBeenCalledOnce()
})
