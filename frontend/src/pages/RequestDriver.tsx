import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useHub } from '../store/HubContext'

export function RequestDriver() {
  const { currentUser, createRequest, driverById, ownerById } = useHub()
  const [params] = useSearchParams()
  const driverId = params.get('driver') || undefined
  const driver = driverId ? driverById(driverId) : undefined
  const listedDriver = driver?.applicationStatus === 'approved' && driver.accessFeePaid
  const owner = currentUser?.role === 'owner' ? ownerById(currentUser.id) : undefined

  const [pickup, setPickup] = useState(owner?.district ? `${owner.district}` : '')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [duration, setDuration] = useState('1 day')
  const [vehicle, setVehicle] = useState(owner?.vehicleMake ?? '')
  const [notes, setNotes] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [minDate] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })

  const title = useMemo(
    () => (driver ? `Request ${driver.user.name}` : 'Open request: any listed driver'),
    [driver],
  )

  if (!currentUser) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `/request${driverId ? `?driver=${driverId}` : ''}` }}
      />
    )
  }

  if (currentUser.role !== 'owner') {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-display text-3xl">Owners request drivers</h1>
        <p className="mt-3 text-muted">
          Sign in on a car-owner account to send a hire request. Drivers respond from their desk.
        </p>
        <Link to="/join-owner" className="btn-gold mt-6 inline-flex">
          Register as a car owner
        </Link>
      </main>
    )
  }

  if (driverId && !listedDriver) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-display text-3xl">That driver is no longer available</h1>
        <p className="mt-3 text-muted">
          The selected profile may have been removed or is no longer approved for hire.
          Choose another listed driver, or create an open request instead.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/drivers" className="btn-gold">Browse listed drivers</Link>
          <Link to="/request" className="btn-ghost">Create an open request</Link>
        </div>
      </main>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    const err = await createRequest({
      driverId: listedDriver ? driver.userId : undefined,
      pickup,
      destination,
      startDate,
      duration,
      vehicle,
      notes,
    })
    setIsSubmitting(false)
    if (err) setError(err)
    else setDone(true)
  }

  if (done) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-display text-4xl">Request sent</h1>
        <p className="mt-3 text-muted">
          The hub desk will review your request first. Once approved, it will be shared with the selected driver or listed drivers.
        </p>
        <Link to="/dashboard" className="btn-gold mt-6 inline-flex">
          Open owner desk
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs tracking-[0.2em] uppercase text-muted">Hire request</p>
      <h1 className="mt-2 font-display text-4xl">{title}</h1>
      {driver && (
        <p className="mt-2 text-muted">
          {driver.yearsOnRoad} years on road · {driver.baseLocation} · class {driver.licenseClass}
        </p>
      )}
      {!driver && (
        <p className="mt-2 text-muted">
          Leave this as an open request. Approved drivers can pick it up from the hub desk.
        </p>
      )}

      <form className="card mt-8 grid gap-4 p-6" onSubmit={onSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="pickup">Pickup</label>
            <input id="pickup" required value={pickup} onChange={(e) => setPickup(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="destination">Destination</label>
            <input
              id="destination"
              required
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field">
            <label htmlFor="start">Start date</label>
            <input
              id="start"
              type="date"
              min={minDate}
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="duration">Duration</label>
            <select id="duration" value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option>Half day</option>
              <option>1 day</option>
              <option>2 days</option>
              <option>1 week</option>
              <option>Live-in / ongoing</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="vehicle">Vehicle they will drive</label>
          <input id="vehicle" required value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Airport time, family trip, cargo, night run…"
          />
        </div>
        {error && <p className="text-sm text-brick" role="alert">{error}</p>}
        <button className="btn-gold" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending request…' : 'Submit request'}
        </button>
      </form>
    </main>
  )
}
