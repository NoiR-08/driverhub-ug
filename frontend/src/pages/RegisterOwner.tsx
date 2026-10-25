import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useHub } from '../store/HubContext'

export function RegisterOwner() {
  const { registerOwner, currentUser } = useHub()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    vehicleMake: '',
    vehicleType: 'Saloon',
    plateNumber: '',
    district: 'Kampala',
  })

  if (currentUser?.role === 'owner') {
    return <Navigate to="/dashboard" replace />
  }

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    const err = await registerOwner(form)
    setIsSubmitting(false)
    if (err) setError(err)
    else navigate('/dashboard', { replace: true })
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="font-display text-4xl">Car owner desk</h1>
      <p className="mt-2 text-muted">
        Register your vehicle, browse full driver files, and send hire requests.
      </p>
      <form className="card mt-6 grid gap-4 p-6" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" required value={form.name} onChange={set('name')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={form.email} onChange={set('email')} />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" required value={form.phone} onChange={set('phone')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={set('password')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="make">Vehicle</label>
            <input
              id="make"
              required
              placeholder="Toyota Premio"
              value={form.vehicleMake}
              onChange={set('vehicleMake')}
            />
          </div>
          <div className="field">
            <label htmlFor="type">Type</label>
            <select id="type" value={form.vehicleType} onChange={set('vehicleType')}>
              <option>Saloon</option>
              <option>SUV</option>
              <option>Pickup</option>
              <option>Van</option>
              <option>Lorry</option>
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="plate">Number plate</label>
            <input id="plate" required value={form.plateNumber} onChange={set('plateNumber')} />
          </div>
          <div className="field">
            <label htmlFor="district">District</label>
            <input id="district" required value={form.district} onChange={set('district')} />
          </div>
        </div>
        {error && <p className="text-sm text-brick">{error}</p>}
        <button className="btn-gold" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create owner account'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </main>
  )
}
