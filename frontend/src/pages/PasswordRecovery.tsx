import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useHub } from '../store/HubContext'

export function RequestPasswordReset() {
  const { requestPasswordReset } = useHub()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resetUrl, setResetUrl] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    const result = await requestPasswordReset(email)
    setIsSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setResetUrl(result.resetUrl ?? null)
    setSubmitted(true)
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-xs tracking-[0.2em] uppercase text-brick">Account recovery</p>
      <h1 className="mt-2 font-display text-4xl">Forgot your password?</h1>
      {!submitted ? (
        <>
          <p className="mt-2 text-muted">
            Enter the email address on your account. If it matches, we’ll send you a secure reset link.
          </p>
          <form className="card mt-6 grid gap-4 p-6" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {error && <p className="text-sm text-brick" role="alert">{error}</p>}
            <button className="btn-gold" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending link…' : 'Send reset link'}
            </button>
          </form>
        </>
      ) : (
        <div className="card mt-6 grid gap-4 p-6" role="status">
          <p className="text-muted">
            If an account matches <strong>{email}</strong>, password reset instructions will be sent.
          </p>
          {resetUrl && (
            <p className="text-sm text-muted">
              Development reset link:{' '}
              <Link to={resetUrl.replace(/^https?:\/\/[^/]+/, '')} className="break-all text-forest">
                Reset password
              </Link>
            </p>
          )}
          <button
            type="button"
            className="btn-ghost justify-self-start"
            onClick={() => {
              setSubmitted(false)
              setResetUrl(null)
            }}
          >
            Try another email
          </button>
        </div>
      )}
      <p className="mt-6 text-sm"><Link to="/login">Back to sign in</Link></p>
    </main>
  )
}

export function ResetPassword() {
  const { completePasswordReset } = useHub()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (isSubmitting) return
    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }
    setIsSubmitting(true)
    setError(null)
    const result = await completePasswordReset(token, password)
    setIsSubmitting(false)
    if (result) {
      setError(result)
      return
    }
    setDone(true)
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-xs tracking-[0.2em] uppercase text-brick">Account recovery</p>
      <h1 className="mt-2 font-display text-4xl">Choose a new password</h1>
      {done ? (
        <div className="card mt-6 grid gap-4 p-6" role="status">
          <p>Your password has been updated. Sign in with your new password.</p>
          <Link to="/login" className="btn-gold justify-self-start">Go to sign in</Link>
        </div>
      ) : !token ? (
        <div className="card mt-6 grid gap-4 p-6">
          <p className="text-muted">This reset link is missing its token or is invalid.</p>
          <Link to="/forgot-password" className="btn-gold justify-self-start">Request another link</Link>
        </div>
      ) : (
        <form className="card mt-6 grid gap-4 p-6" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          {error && <p className="text-sm text-brick" role="alert">{error}</p>}
          <button className="btn-gold" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      )}
    </main>
  )
}
