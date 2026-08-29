import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { SignIn } from './SignIn'

describe('SignIn', () => {
  it('signs in with the learner password without sending an email', async () => {
    const user = userEvent.setup()
    const onRequestLink = vi.fn()
    const onPasswordSignIn = vi.fn().mockResolvedValue(undefined)

    render(
      <SignIn
        onRequestLink={onRequestLink}
        onPasswordSignIn={onPasswordSignIn}
      />,
    )

    await user.click(screen.getByRole('button', { name: /use my password instead/i }))
    await user.type(screen.getByLabelText(/enrollment email/i), '  learner@example.com ')
    await user.type(screen.getByLabelText(/^password$/i), 'private-password')
    await user.click(screen.getByRole('button', { name: /sign in securely/i }))

    expect(onPasswordSignIn).toHaveBeenCalledWith('learner@example.com', 'private-password')
    expect(onRequestLink).not.toHaveBeenCalled()
  })

  it('offers password sign-in when the email rate limit is reached', async () => {
    const user = userEvent.setup()
    const onRequestLink = vi.fn().mockRejectedValue(new Error('Email rate limit exceeded'))

    render(
      <SignIn
        onRequestLink={onRequestLink}
        onPasswordSignIn={vi.fn()}
      />,
    )

    await user.type(screen.getByLabelText(/enrollment email/i), 'learner@example.com')
    await user.click(screen.getByRole('button', { name: /send my sign-in link/i }))

    expect((await screen.findByRole('status')).textContent).toMatch(/temporary limit/i)
    expect(screen.getByLabelText(/^password$/i)).toBeTruthy()
    expect(screen.queryByText('Email rate limit exceeded')).toBeNull()
  })
})
