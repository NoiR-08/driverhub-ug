import { useMemo, useState } from 'react'
import { DriverCard } from '../components/DriverCard'
import { useHub } from '../store/HubContext'

export function BrowseDrivers() {
  const { approvedDrivers } = useHub()
  const [q, setQ] = useState('')
  const [place, setPlace] = useState('all')
  const [sort, setSort] = useState('rating')

  const places = useMemo(
    () => ['all', ...new Set(approvedDrivers.map((d) => d.baseLocation))],
    [approvedDrivers],
  )

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return approvedDrivers
      .filter((d) => (place === 'all' ? true : d.baseLocation === place))
      .filter((d) => {
        if (!needle) return true
        const hay = [
          d.user.name,
          d.bio,
          d.baseLocation,
          d.licenseClass,
          ...d.specialties,
          ...d.vehiclesHandled,
          ...d.notableRoutes,
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(needle)
      })
      .sort((a, b) =>
        sort === 'years' ? b.yearsOnRoad - a.yearsOnRoad : b.rating - a.rating,
      )
  }, [approvedDrivers, q, place, sort])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs tracking-[0.2em] uppercase text-muted">Select of your choice</p>
      <h1 className="mt-2 font-display text-4xl">Drivers on the hub</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Only drivers who paid the access fee and were approved. Open a profile for licence,
        languages, and road experience before you request.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="field md:col-span-1">
          <label htmlFor="q">Search</label>
          <input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, route, SUV, night…"
          />
        </div>
        <div className="field">
          <label htmlFor="place">Base</label>
          <select id="place" value={place} onChange={(e) => setPlace(e.target.value)}>
            {places.map((p) => (
              <option key={p} value={p}>
                {p === 'all' ? 'All bases' : p}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Sort</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="rating">Highest rated</option>
            <option value="years">Most years on road</option>
          </select>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted">{list.length} listed driver{list.length === 1 ? '' : 's'}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((d) => (
          <DriverCard key={d.userId} driver={d} />
        ))}
      </div>
    </main>
  )
}
