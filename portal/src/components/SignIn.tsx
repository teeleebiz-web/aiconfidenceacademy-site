import { FormEvent, useState } from 'react'

type SignInProps = {
  onRequestLink: (email: string) => Promise<void>
}

export function SignIn({ onRequestLink }: SignInProps) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    setMessage('')

    try {
      await onRequestLink(email.trim())
      setStatus('sent')
      setMessage('Check your email for your secure ACA sign-in link.')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'We could not send the sign-in link.')
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="sign-in-heading">
        <p className="eyebrow">ACA learner portal</p>
        <h1 id="sign-in-heading">Welcome back to your learning journey.</h1>
        <p className="lede">
          Enter the email connected to your ACA enrollment. We will send a secure,
          one-time sign-in link—no password to remember.
        </p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Enrollment email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending secure link…' : 'Send my sign-in link'}
          </button>
        </form>
        {message ? (
          <p className={`form-message ${status}`} role="status">
            {message}
          </p>
        ) : null}
        <p className="privacy-note">
          ACA will never ask you to share private information inside a lesson prompt.
        </p>
      </section>
    </main>
  )
}
