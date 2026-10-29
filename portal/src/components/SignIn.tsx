import { FormEvent, useState } from 'react'

type SignInProps = {
  onRequestLink: (email: string) => Promise<void>
  onPasswordSignIn: (email: string, password: string) => Promise<void>
}

export function SignIn({ onRequestLink, onPasswordSignIn }: SignInProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [method, setMethod] = useState<'link' | 'password'>('link')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    setMessage('')

    try {
      if (method === 'password') {
        await onPasswordSignIn(email.trim(), password)
      } else {
        await onRequestLink(email.trim())
        setStatus('sent')
        setMessage('Check your email for your secure ACA sign-in link.')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ''
      const isRateLimit = /rate limit|too many requests/i.test(errorMessage)

      setStatus('error')
      if (method === 'password') {
        setMessage('That email and password combination was not recognized. Please try again.')
      } else if (isRateLimit) {
        setMethod('password')
        setMessage('The email service has reached its temporary limit. Sign in with your password below, or try a new email link later.')
      } else {
        setMessage('We could not send the sign-in link. Please try again later or use your password.')
      }
    }
  }

  function changeMethod(nextMethod: 'link' | 'password') {
    setMethod(nextMethod)
    setStatus('idle')
    setMessage('')
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="sign-in-heading">
        <p className="eyebrow">ACA learner portal</p>
        <h1 id="sign-in-heading">Welcome back to your learning journey.</h1>
        <p className="lede">
          {method === 'link'
            ? 'Enter the email connected to your ACA enrollment. We will send a secure, one-time sign-in link.'
            : 'Enter the email and password connected to your ACA enrollment.'}
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
          {method === 'password' ? (
            <>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </>
          ) : null}
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending'
              ? method === 'password' ? 'Signing in…' : 'Sending secure link…'
              : method === 'password' ? 'Sign in securely' : 'Send my sign-in link'}
          </button>
        </form>
        {message ? (
          <p className={`form-message ${status}`} role="status">
            {message}
          </p>
        ) : null}
        <div className="auth-alternative">
          <span aria-hidden="true">or</span>
          <button
            className="auth-switch"
            type="button"
            onClick={() => changeMethod(method === 'link' ? 'password' : 'link')}
          >
            {method === 'link' ? 'Use my password instead' : 'Use a one-time email link instead'}
          </button>
        </div>
        <p className="privacy-note">
          ACA will never ask you to share private information inside a lesson prompt.
        </p>
      </section>
    </main>
  )
}
