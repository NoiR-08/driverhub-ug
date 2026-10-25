import { Link } from 'react-router-dom'
import type { DriverProfile, User } from '../types'

export function DriverCard({
  driver,
}: {
  driver: DriverProfile & { user: User }
}) {
  return (
    <article className="card flex flex-col p-5">
      <div className="flex items-start gap-4">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-semibold text-cream"
          style={{ background: driver.accent }}
        >
          {driver.initials}
        </div>
        <div className="min-w-0">
          <p className="text-xs tracking-[0.16em] text-muted uppercase">
            {driver.baseLocation} · {driver.yearsOnRoad} yrs on road
          </p>
          <h3 className="font-display text-xl leading-tight">{driver.user.name}</h3>
          <p className="mt-1 text-sm text-muted">
            Class {driver.licenseClass} · {driver.rating.toFixed(1)} ★ · {driver.completedHires}{' '}
            hires
          </p>
        </div>
      </div>
      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-soil/80">{driver.bio}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {driver.specialties.slice(0, 3).map((s) => (
          <span key={s} className="chip">
            {s}
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <p className="text-sm text-muted">{driver.vehiclesHandled.join(' · ')}</p>
        <Link to={`/drivers/${driver.userId}`} className="btn-dark !px-4 !py-2 text-sm">
          View driver
        </Link>
      </div>
    </article>
  )
}
