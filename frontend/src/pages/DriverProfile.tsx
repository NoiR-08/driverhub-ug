import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApplicationBadge } from '../components/StatusBadge'
import { formatDate } from '../lib/format'
import { useHub } from '../store/HubContext'

export function DriverProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { driverById, currentUser } = useHub()
  const driver = id ? driverById(id) : undefined

  if (!driver) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="font-display text-3xl">Driver not found</h1>
        <Link to="/drivers" className="mt-4 inline-block text-forest">
          Back to the hub
        </Link>
      </main>
    )
  }

  const listed = driver.applicationStatus === 'approved' && driver.accessFeePaid
  const canRequest = currentUser?.role === 'owner' && listed
  const canViewParticulars =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    (currentUser?.role === 'driver' && currentUser.id === driver.userId)

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/drivers" className="text-sm text-muted">
        ← All drivers
      </Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="card p-6 md:p-8">
          <div className="flex flex-wrap items-start gap-5">
            <div
              className="grid h-20 w-20 place-items-center rounded-3xl text-2xl font-semibold text-cream"
              style={{ background: driver.accent }}
            >
              {driver.initials}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-4xl">{driver.user.name}</h1>
                <ApplicationBadge status={driver.applicationStatus} />
              </div>
              <p className="mt-1 text-muted">
                {driver.baseLocation}{driver.user.phone ? ` · ${driver.user.phone}` : ''}
              </p>
              <p className="mt-3 max-w-xl leading-relaxed">{driver.bio}</p>
            </div>
          </div>

          <h2 className="mt-10 font-display text-2xl">Full particulars</h2>
          {!canViewParticulars && (
            <p className="mt-2 text-sm text-muted">
              Sign in as a car owner to view this driver’s verified particulars.
            </p>
          )}
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Fact label="National ID" value={canViewParticulars ? driver.nationalId : 'Owner access'} />
            <Fact label="Licence no." value={canViewParticulars ? driver.licenseNumber : 'Owner access'} />
            <Fact label="Licence class" value={driver.licenseClass} />
            <Fact
              label="Licence expiry"
              value={canViewParticulars ? formatDate(driver.licenseExpiry) : 'Owner access'}
            />
            <Fact label="Languages" value={driver.languages.join(', ')} />
            <Fact label="Vehicles handled" value={driver.vehiclesHandled.join(', ')} />
          </dl>

          <h2 className="mt-10 font-display text-2xl">Road experience</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-paper p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Years on road</p>
              <p className="font-display text-3xl">{driver.yearsOnRoad}</p>
            </div>
            <div className="rounded-2xl bg-paper p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Completed hires</p>
              <p className="font-display text-3xl">{driver.completedHires}</p>
            </div>
            <div className="rounded-2xl bg-paper p-4">
              <p className="text-xs uppercase tracking-wider text-muted">Rating</p>
              <p className="font-display text-3xl">
                {driver.rating ? driver.rating.toFixed(1) : '—'}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm">
            Night driving: <strong>{driver.nightDriving ? 'Yes' : 'No'}</strong>
            <span className="mx-2 text-muted">·</span>
            Long haul: <strong>{driver.longHaul ? 'Yes' : 'No'}</strong>
          </p>
          <p className="mt-3 text-sm">
            <span className="text-muted">Notable routes: </span>
            {driver.notableRoutes.join(' · ')}
          </p>
          <p className="mt-3 text-sm">
            <span className="text-muted">Incident record: </span>
            {driver.incidentRecord}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {driver.specialties.map((s) => (
              <span key={s} className="chip">
                {s}
              </span>
            ))}
          </div>
        </section>

        <aside className="card h-fit p-6">
          <p className="text-xs tracking-[0.18em] uppercase text-muted">Hire this driver</p>
          <h2 className="mt-1 font-display text-2xl">Request of your choice</h2>
          <p className="mt-3 text-sm text-muted">
            Send a hire request tied to this driver. They see it on their desk and accept or
            decline. You track status from your owner desk.
          </p>
          {listed ? (
            <button
              type="button"
              className="btn-gold mt-6 w-full"
              onClick={() => {
                if (!currentUser) {
                  navigate('/login', { state: { from: `/request?driver=${driver.userId}` } })
                  return
                }
                navigate(`/request?driver=${driver.userId}`)
              }}
            >
              {canRequest || !currentUser ? 'Request this driver' : 'Owners request drivers'}
            </button>
          ) : (
            <p className="mt-6 rounded-xl bg-amber-50 p-3 text-sm">
              This driver is not yet listed for hire. Application status:{' '}
              {driver.applicationStatus}.
            </p>
          )}
          {currentUser?.role === 'driver' && (
            <p className="mt-3 text-sm text-muted">You are signed in as a driver.</p>
          )}
        </aside>
      </div>
    </main>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}
