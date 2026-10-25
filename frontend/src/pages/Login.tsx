import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useHub } from '../store/HubContext'

export function Login() {
  const { login, currentUser } = useHub()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const next = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const target = params.get('next') || from
    return target.startsWith('/') && !target.startsWith('//') ? target : '/dashboard'
  }, [from, location.search])

  if (currentUser) {
    return <Navigate to={next} replace />
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    const err = await login(email, password)
    setIsSubmitting(false)
    if (err) setError(err)
    else navigate(next, { replace: true })
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-4xl">Sign in</h1>
      <p className="mt-2 text-muted">Owner, driver, or hub desk.</p>
      <form className="card mt-6 space-y-4 p-6" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-brick">{error}</p>}
        <button className="btn-gold w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Enter the hub'}
        </button>
      </form>
      <p className="mt-4 text-right text-sm">
        <Link to="/forgot-password">Forgot password?</Link>
      </p>
      {import.meta.env.DEV && <div className="mt-6 rounded-2xl border border-ink/10 bg-cream/60 p-4 text-sm">
        <p className="font-medium">Demo desks (password: demo)</p>
        <ul className="mt-2 space-y-1 text-muted">
          <li>owner@driverhub.ug — car owner</li>
          <li>driver@driverhub.ug — listed driver</li>
          <li>hassan@driverhub.ug — paid, awaiting review</li>
          <li>hub@driverhub.ug — reviews applications</li>
        </ul>
      </div>}
      <p className="mt-6 text-sm">
        New here? <Link to="/join-owner">Car owner</Link> ·{' '}
        <Link to="/join-driver">Driver</Link>
      </p>
    </main>
  )
}
