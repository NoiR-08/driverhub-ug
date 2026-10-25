import { useState, type FormEvent, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { ApplicationBadge, RequestBadge } from '../components/StatusBadge'
import { formatDate, formatUgx } from '../lib/format'
import { useHub } from '../store/HubContext'
import type { HireRequest } from '../types'

export function Dashboard() {
  const { currentUser } = useHub()
  if (!currentUser) return <Navigate to="/login" replace />
  if (currentUser.role !== 'admin' && currentUser.accountStatus !== 'approved') {
    return <AccountReview />
  }
  if (currentUser.role === 'owner') return <OwnerDesk />
  if (currentUser.role === 'driver') return <DriverDesk />
  return <AdminDesk />
}

function AccountReview() {
  const { currentUser } = useHub()
  const rejected = currentUser?.accountStatus === 'rejected'
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <p className="text-xs tracking-[0.2em] uppercase text-brick">Account review</p>
      <h1 className="mt-2 font-display text-4xl">
        {rejected ? 'Account not approved' : 'Registration awaiting approval'}
      </h1>
      <p className="mt-3 text-muted">
        {rejected
          ? currentUser?.reviewNote || 'Contact the hub desk for help with your registration.'
          : 'Your account is saved. The hub desk will review your registration before you can use member services. Refresh this page after approval to continue.'}
      </p>
    </main>
  )
}

function OwnerDesk() {
  const { currentUser, state, ownerById, driverById, setRequestStatus } = useHub()
  const owner = ownerById(currentUser!.id)
  const mine = state.requests.filter((r) => r.ownerId === currentUser!.id)

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs tracking-[0.2em] uppercase text-muted">Car owner</p>
      <h1 className="font-display text-4xl">{currentUser!.name}</h1>
      {owner && (
        <p className="mt-2 text-muted">
          {owner.vehicleMake} · {owner.plateNumber} · {owner.district}
        </p>
      )}
      <h2 className="mt-8 font-display text-2xl">Request status</h2>
      <div className="mt-4 grid gap-3">
        {mine.length === 0 && <p className="text-muted">No hire requests yet.</p>}
        {mine.map((r) => {
          const driver = r.driverId ? driverById(r.driverId) : undefined
          return (
            <article key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {r.pickup} → {r.destination}
                  </p>
                  <p className="text-sm text-muted">
                    {formatDate(r.startDate)} · {r.duration} · {r.vehicle}
                  </p>
                  <p className="mt-1 text-sm">
                    {r.kind === 'specific' && driver
                      ? `Driver: ${driver.user.name}`
                      : 'Open request — waiting for a listed driver'}
                  </p>
                  {r.approvalStatus === 'pending' && (
                    <p className="mt-1 text-sm text-muted">Waiting for hub approval before drivers can see this request.</p>
                  )}
                  {r.approvalStatus === 'rejected' && (
                    <p className="mt-1 text-sm text-brick">Request not approved by the hub desk{r.approvalNote ? `: ${r.approvalNote}` : '.'}</p>
                  )}
                  {r.notes && <p className="mt-2 text-sm text-muted">{r.notes}</p>}
                </div>
                <RequestBadge status={r.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {r.status === 'pending' && (
                  <button
                    type="button"
                    className="btn-ghost !py-2 text-sm"
                    onClick={() => setRequestStatus(r.id, 'cancelled')}
                  >
                    Cancel
                  </button>
                )}
                {r.status === 'accepted' && (
                  <button
                    type="button"
                    className="btn-gold !py-2 text-sm"
                    onClick={() => setRequestStatus(r.id, 'completed')}
                  >
                    Mark completed
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </main>
  )
}

function DriverDesk() {
  const { currentUser, state, driverById, ownerById, setRequestStatus } = useHub()
  const profile = driverById(currentUser!.id)
  const incoming = state.requests.filter(
    (r) =>
      r.status === 'pending' &&
      (r.driverId === currentUser!.id || (!r.driverId && profile?.applicationStatus === 'approved')),
  )
  const mine = state.requests.filter((r) => r.driverId === currentUser!.id)

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <p className="text-xs tracking-[0.2em] uppercase text-muted">Driver</p>
      <h1 className="font-display text-4xl">{currentUser!.name}</h1>
      {profile && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ApplicationBadge status={profile.applicationStatus} />
          <span className="text-sm text-muted">
            {profile.accessFeePaid
              ? `Fee paid ${formatUgx(profile.accessFeeAmount)}`
              : 'Access fee unpaid — you will not be listed'}
          </span>
        </div>
      )}

      <h2 className="mt-10 font-display text-2xl">Incoming hire requests</h2>
      <p className="text-sm text-muted">
        Specific requests sent to you, plus open jobs if you are approved on the hub.
      </p>
      <div className="mt-4 grid gap-3">
        {incoming.length === 0 && <p className="text-muted">Nothing waiting right now.</p>}
        {incoming.map((r) => (
          <RequestRow
            key={r.id}
            request={r}
            ownerName={ownerById(r.ownerId)?.user.name ?? 'Owner'}
            actions={
              profile?.applicationStatus === 'approved' ? (
                <>
                  <button
                    type="button"
                    className="btn-gold !py-2 text-sm"
                    onClick={() => setRequestStatus(r.id, 'accepted', currentUser!.id)}
                  >
                    Accept
                  </button>
                  {r.driverId === currentUser!.id && (
                    <button
                      type="button"
                      className="btn-ghost !py-2 text-sm"
                      onClick={() => setRequestStatus(r.id, 'declined')}
                    >
                      Decline
                    </button>
                  )}
                </>
              ) : (
                <span className="text-sm text-muted">Get approved to accept work.</span>
              )
            }
          />
        ))}
      </div>

      <h2 className="mt-10 font-display text-2xl">My request history</h2>
      <div className="mt-4 grid gap-3">
        {mine
          .filter((r) => r.status !== 'pending')
          .map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              ownerName={ownerById(r.ownerId)?.user.name ?? 'Owner'}
            />
          ))}
      </div>
    </main>
  )
}

type AdminView =
  | 'overview'
  | 'transactions'
  | 'members'
  | 'requests'
  | 'applications'
  | 'payment-settings'

function AdminDesk() {
  const {
    state,
    driverById,
    ownerById,
    reviewApplication,
    reviewMember,
    reviewPayment,
    reviewHireRequest,
    savePaymentNumbers,
    resetDemo,
  } = useHub()
  const [view, setView] = useState<AdminView>('overview')
  const [transactionSearch, setTransactionSearch] = useState('')
  const [airtelNumber, setAirtelNumber] = useState(state.paymentNumbers.airtel)
  const [mtnNumber, setMtnNumber] = useState(state.paymentNumbers.mtn)
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null)
  const pending = state.drivers.filter((driver) => driver.applicationStatus === 'pending')
  const pendingMembers = state.users.filter(
    (user) => user.role !== 'admin' && user.accountStatus === 'pending',
  )
  const pendingPayments = state.transactions.filter((transaction) => transaction.status === 'pending')
  const pendingRequests = state.requests.filter((request) => request.approvalStatus === 'pending')
  const paidTotal = state.transactions
    .filter((transaction) => transaction.status === 'successful')
    .reduce((total, transaction) => total + transaction.amount, 0)
  const openRequests = state.requests.filter(
    (request) => request.status === 'pending' || request.status === 'accepted',
  ).length
  const activeDrivers = state.drivers.filter(
    (driver) => driver.applicationStatus === 'approved',
  ).length
  const stats = [
    { label: 'Members', value: state.users.filter((user) => user.role !== 'admin').length, note: 'Owners and drivers' },
    { label: 'Listed drivers', value: activeDrivers, note: 'Approved and visible' },
    { label: 'Open requests', value: openRequests, note: 'Pending or accepted' },
    { label: 'Access fees collected', value: formatUgx(paidTotal), note: `${state.transactions.length} recorded transactions` },
  ]
  const activity = [
    ...state.transactions.map((transaction) => ({
      id: transaction.id,
      date: new Date(transaction.reviewedAt ?? transaction.createdAt).getTime(),
      label: `Payment ${transaction.status}`,
      detail: `${state.users.find((user) => user.id === transaction.userId)?.name ?? 'Driver'} · ${formatUgx(transaction.amount)} · ${transaction.reference}`,
      tone: transaction.status === 'successful' ? 'bg-forest' : 'bg-gold',
    })),
    ...state.users.flatMap((user) => [
      ...(user.createdAt
        ? [{
            id: `registration-${user.id}`,
            date: new Date(user.createdAt).getTime(),
            label: `${user.role === 'owner' ? 'Owner' : 'Driver'} registration submitted`,
            detail: `${user.name} · ${user.accountStatus ?? 'approved'}`,
            tone: 'bg-gold',
          }]
        : []),
      ...(user.reviewedAt
        ? [{
            id: `member-review-${user.id}`,
            date: new Date(user.reviewedAt).getTime(),
            label: `Account ${user.accountStatus}`,
            detail: `${user.name} · reviewed by hub desk`,
            tone: 'bg-brick',
          }]
        : []),
    ]),
    ...state.drivers.flatMap((driver) => {
      const user = state.users.find((item) => item.id === driver.userId)
      return [
        ...(driver.appliedAt
          ? [{
              id: `application-${driver.userId}`,
              date: new Date(driver.appliedAt).getTime(),
              label: 'Driver application submitted',
              detail: `${user?.name ?? 'Driver'} · ${driver.baseLocation}`,
              tone: 'bg-gold',
            }]
          : []),
        ...(driver.reviewedAt
          ? [{
              id: `review-${driver.userId}`,
              date: new Date(driver.reviewedAt).getTime(),
              label: `Application ${driver.applicationStatus}`,
              detail: `${user?.name ?? 'Driver'} · reviewed by hub desk`,
              tone: 'bg-brick',
            }]
          : []),
      ]
    }),
    ...state.requests.map((request) => ({
      id: request.id,
      date: new Date(request.reviewedAt ?? request.updatedAt).getTime(),
      label: request.approvalStatus === 'pending'
        ? 'Hire request submitted for review'
        : `Hire request ${request.status} · ${request.approvalStatus ?? 'approved'}`,
      detail: `${state.users.find((user) => user.id === request.ownerId)?.name ?? 'Owner'} · ${request.pickup} to ${request.destination}`,
      tone: 'bg-ink',
    })),
  ].sort((first, second) => second.date - first.date).slice(0, 8)
  const visibleTransactions = [...state.transactions]
    .sort((first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime())
    .filter((transaction) => {
      const driverName = state.users.find((user) => user.id === transaction.userId)?.name ?? ''
      const query = transactionSearch.trim().toLowerCase()
      return `${driverName} ${transaction.reference} ${transaction.method}`.toLowerCase().includes(query)
    })

  const onSavePaymentNumbers = async (event: FormEvent) => {
    event.preventDefault()
    const error = await savePaymentNumbers({ airtel: airtelNumber, mtn: mtnNumber })
    setSettingsMessage(error ? null : 'Payment numbers saved.')
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.2em] uppercase text-brick">Administration</p>
          <h1 className="font-display text-4xl">Control room</h1>
          <p className="mt-2 text-muted">Members, payments, requests, and driver listings.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={resetDemo}>
          Reset demo data
        </button>
      </div>

      <section aria-label="Platform summary" className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <article key={stat.label} className="card rounded-lg border-l-4 border-l-gold p-4">
            <p className="text-xs uppercase tracking-wider text-muted">{stat.label}</p>
            <p className="mt-2 font-display text-2xl">{stat.value}</p>
            <p className="mt-1 text-xs text-muted">{stat.note}</p>
          </article>
        ))}
      </section>

      <nav aria-label="Admin sections" className="mt-8 flex gap-1 overflow-x-auto border-b border-ink/15">
        {([
          ['overview', 'Overview'],
          ['transactions', 'Transactions'],
          ['members', 'Members'],
          ['requests', 'Requests'],
          ['applications', `Applications${pending.length ? ` (${pending.length})` : ''}`],
          ['payment-settings', 'Payment numbers'],
        ] as [AdminView, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            className={`shrink-0 border-b-2 px-3 py-3 text-sm ${
              view === key ? 'border-forest font-semibold text-forest' : 'border-transparent text-muted hover:text-ink'
            }`}
            onClick={() => setView(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === 'overview' && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="card rounded-lg p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">Recent activity</h2>
                <p className="text-sm text-muted">Latest recorded changes across the hub.</p>
              </div>
              <button type="button" className="text-sm font-semibold text-forest" onClick={() => setView('transactions')}>
                View payments
              </button>
            </div>
            <ol className="mt-5 space-y-4">
              {activity.length === 0 && <li className="text-sm text-muted">No activity recorded yet.</li>}
              {activity.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${event.tone}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{event.label}</p>
                    <p className="wrap-break-word text-sm text-muted">{event.detail}</p>
                    <time className="text-xs text-muted" dateTime={new Date(event.date).toISOString()}>
                      {formatDate(new Date(event.date).toISOString())}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <aside className="space-y-5">
            <section className="card rounded-lg p-5">
              <h2 className="font-display text-2xl">Needs attention</h2>
              <div className="mt-4 divide-y divide-ink/10">
                <button type="button" className="flex w-full items-center justify-between py-3 text-left" onClick={() => setView('applications')}>
                  <span><strong className="block">Applications to review</strong><span className="text-sm text-muted">Paid driver files awaiting a decision</span></span>
                  <span className="font-display text-2xl">{pending.length}</span>
                </button>
                <button type="button" className="flex w-full items-center justify-between py-3 text-left" onClick={() => setView('members')}>
                  <span><strong className="block">Registrations to review</strong><span className="text-sm text-muted">New owner and driver accounts</span></span>
                  <span className="font-display text-2xl">{pendingMembers.length}</span>
                </button>
                <button type="button" className="flex w-full items-center justify-between py-3 text-left" onClick={() => setView('transactions')}>
                  <span><strong className="block">Payments to verify</strong><span className="text-sm text-muted">Mobile Money references awaiting checks</span></span>
                  <span className="font-display text-2xl">{pendingPayments.length}</span>
                </button>
                <button type="button" className="flex w-full items-center justify-between py-3 text-left" onClick={() => setView('requests')}>
                  <span><strong className="block">Hire requests to review</strong><span className="text-sm text-muted">Owner bookings not yet shared with drivers</span></span>
                  <span className="font-display text-2xl">{pendingRequests.length}</span>
                </button>
              </div>
            </section>
            <section className="card rounded-lg p-5">
              <h2 className="font-display text-2xl">Request status</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                {(['pending', 'accepted', 'completed', 'cancelled'] as const).map((status) => (
                  <div key={status} className="border-l-2 border-gold pl-3">
                    <p className="capitalize text-muted">{status}</p>
                    <p className="font-display text-xl">{state.requests.filter((request) => request.status === status).length}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}

      {view === 'transactions' && (
        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl">All transactions</h2>
              <p className="text-sm text-muted">Driver access-fee payments recorded by the hub.</p>
            </div>
            <label className="field w-full sm:w-72">
              <span className="sr-only">Search transactions</span>
              <input
                type="search"
                value={transactionSearch}
                onChange={(event) => setTransactionSearch(event.target.value)}
                placeholder="Search name, reference, method"
              />
            </label>
          </div>
          <div className="card mt-4 overflow-x-auto rounded-lg p-4">
            <table className="w-full min-w-225 text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-xs uppercase tracking-wider text-muted">
                <th className="py-3 pr-4">Date</th><th className="pr-4">Driver</th><th className="pr-4">Reference</th><th className="pr-4">Method / destination</th><th className="pr-4">Amount</th><th className="pr-4">Status</th><th>Review</th>
                </tr>
              </thead>
              <tbody>
                {visibleTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-ink/5">
                    <td className="py-3 pr-4 whitespace-nowrap">{formatDate(transaction.createdAt)}</td>
                    <td className="pr-4">{state.users.find((user) => user.id === transaction.userId)?.name ?? 'Unknown driver'}</td>
                    <td className="pr-4 font-mono text-xs">{transaction.reference}</td>
                    <td className="pr-4">
                      <span className="block">{transaction.method}</span>
                      {transaction.recipientNumber && <span className="text-xs text-muted">{transaction.recipientNumber}</span>}
                      {transaction.payerNumber && <span className="block text-xs text-muted">From {transaction.payerNumber}</span>}
                    </td>
                    <td className="pr-4 font-medium whitespace-nowrap">{formatUgx(transaction.amount)}</td>
                    <td className="pr-4"><span className="chip capitalize">{transaction.status}</span></td>
                    <td>
                      {transaction.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button type="button" className="text-sm font-semibold text-forest" onClick={() => reviewPayment(transaction.id, 'approved')}>Approve</button>
                          <button type="button" className="text-sm font-semibold text-brick" onClick={() => reviewPayment(transaction.id, 'rejected')}>Reject</button>
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
                {visibleTransactions.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted">No matching transactions.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'members' && (
        <section className="mt-6">
          <h2 className="font-display text-2xl">Member directory</h2>
          <p className="text-sm text-muted">All owner and driver accounts registered on the hub.</p>
          <div className="card mt-4 overflow-x-auto rounded-lg p-4">
            <table className="w-full min-w-200 text-left text-sm">
            <thead><tr className="border-b border-ink/10 text-xs uppercase tracking-wider text-muted"><th className="py-3 pr-4">Member</th><th className="pr-4">Role</th><th className="pr-4">Contact</th><th className="pr-4">Location</th><th className="pr-4">Account status</th><th>Review</th></tr></thead>
              <tbody>
                {state.users.filter((user) => user.role !== 'admin').map((user) => {
                  const driver = user.role === 'driver' ? driverById(user.id) : undefined
                  const owner = user.role === 'owner' ? ownerById(user.id) : undefined
                  return (
                    <tr key={user.id} className="border-b border-ink/5">
                      <td className="py-3 pr-4"><span className="block font-medium">{user.name}</span><span className="text-xs text-muted">{user.email}</span></td>
                      <td className="pr-4 capitalize">{user.role}</td>
                      <td className="pr-4 whitespace-nowrap">{user.phone}</td>
                      <td className="pr-4">{driver?.baseLocation ?? owner?.district ?? '—'}</td>
                      <td className="pr-4">
                        <span className="chip capitalize">{user.accountStatus ?? 'approved'}</span>
                        {driver && <span className="mt-1 block"><ApplicationBadge status={driver.applicationStatus} /></span>}
                      </td>
                      <td>
                        {user.accountStatus === 'pending' ? (
                          <div className="flex gap-2">
                            <button type="button" className="text-sm font-semibold text-forest" onClick={() => reviewMember(user.id, 'approved')}>Approve</button>
                            <button type="button" className="text-sm font-semibold text-brick" onClick={() => reviewMember(user.id, 'rejected')}>Reject</button>
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === 'requests' && (
        <section className="mt-6">
          <h2 className="font-display text-2xl">All hire requests</h2>
          <p className="text-sm text-muted">Track bookings from request through completion.</p>
          <div className="mt-4 grid gap-3">
            {state.requests.length === 0 && <p className="text-sm text-muted">No hire requests recorded.</p>}
            {[...state.requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((request) => (
              <article key={request.id} className="card rounded-lg p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{request.pickup} → {request.destination}</p>
                    <p className="text-sm text-muted">{state.users.find((user) => user.id === request.ownerId)?.name ?? 'Owner'} · {formatDate(request.createdAt)} · {request.duration}</p>
                    <p className="mt-1 text-sm">{request.driverId ? `Driver: ${driverById(request.driverId)?.user.name ?? 'Unknown'}` : 'Open request'} · {request.vehicle}</p>
                  </div>
                  <div className="grid justify-items-end gap-2">
                    <RequestBadge status={request.status} />
                    <span className="chip capitalize">{request.approvalStatus ?? 'approved'} by admin</span>
                  </div>
                </div>
                {request.approvalStatus === 'pending' && (
                  <div className="mt-4 flex gap-2">
                    <button type="button" className="btn-gold py-2 text-sm" onClick={() => reviewHireRequest(request.id, 'approved')}>Approve and share with drivers</button>
                    <button type="button" className="btn-ghost py-2 text-sm" onClick={() => reviewHireRequest(request.id, 'rejected')}>Reject</button>
                  </div>
                )}
                {request.approvalNote && <p className="mt-2 text-sm text-muted">Admin note: {request.approvalNote}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {view === 'payment-settings' && (
        <section className="mt-6 max-w-2xl">
          <h2 className="font-display text-2xl">Mobile Money destinations</h2>
          <p className="mt-1 text-sm text-muted">
            These numbers are shown to drivers before they submit a payment reference. Update them when your receiving lines change.
          </p>
          <form className="card mt-4 grid gap-4 p-5" onSubmit={onSavePaymentNumbers}>
            <div className="field">
              <label htmlFor="airtel-payment-number">Airtel Uganda Money number</label>
              <input
                id="airtel-payment-number"
                type="tel"
                required
                value={airtelNumber}
                onChange={(event) => setAirtelNumber(event.target.value)}
                placeholder="+256 7XX XXX XXX"
              />
            </div>
            <div className="field">
              <label htmlFor="mtn-payment-number">MTN Uganda MoMo number</label>
              <input
                id="mtn-payment-number"
                type="tel"
                required
                value={mtnNumber}
                onChange={(event) => setMtnNumber(event.target.value)}
                placeholder="+256 7XX XXX XXX"
              />
            </div>
            {settingsMessage && <p className="text-sm text-forest" role="status">{settingsMessage}</p>}
            <button className="btn-gold justify-self-start" type="submit">Save payment numbers</button>
          </form>
        </section>
      )}

      {view === 'applications' && (
        <section className="mt-6">
          <h2 className="font-display text-2xl">Applications under review</h2>
          <p className="text-sm text-muted">Approve only after the access fee is paid. Approved drivers appear for owners.</p>
          <div className="mt-4 grid gap-3">
            {pending.length === 0 && <p className="text-sm text-muted">No pending applications.</p>}
            {pending.map((driver) => {
              const user = driverById(driver.userId)?.user
              return (
                <article key={driver.userId} className="card rounded-lg p-5">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="font-display text-xl">{user?.name}</p>
                      <p className="text-sm text-muted">{driver.baseLocation} · {driver.yearsOnRoad} yrs · class {driver.licenseClass} · {driver.accessFeePaid ? `Paid ${formatUgx(driver.accessFeeAmount)}` : 'UNPAID'}</p>
                      <p className="mt-2 text-sm">{driver.bio}</p>
                    </div>
                    <ApplicationBadge status={driver.applicationStatus} />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button type="button" className="btn-gold py-2 text-sm" disabled={!driver.accessFeePaid} onClick={() => reviewApplication(driver.userId, 'approved')}>Approve listing</button>
                    <button type="button" className="btn-ghost py-2 text-sm" onClick={() => reviewApplication(driver.userId, 'rejected', 'Did not meet hub listing standard.')}>Reject</button>
                  </div>
                </article>
              )
            })}
          </div>
          <h2 className="mt-10 font-display text-2xl">All driver files</h2>
          <div className="card mt-4 overflow-x-auto rounded-lg p-4">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead><tr className="border-b border-ink/10 text-xs uppercase tracking-wider text-muted"><th className="py-3 pr-4">Driver</th><th className="pr-4">Fee</th><th className="pr-4">Status</th><th>Experience</th></tr></thead>
              <tbody>
                {state.drivers.map((driver) => (
                  <tr key={driver.userId} className="border-b border-ink/5">
                    <td className="py-3 pr-4">{driverById(driver.userId)?.user.name}</td>
                    <td className="pr-4">{driver.accessFeePaid ? formatUgx(driver.accessFeeAmount) : '—'}</td>
                    <td className="pr-4"><ApplicationBadge status={driver.applicationStatus} /></td>
                    <td>{driver.yearsOnRoad} yrs · {driver.baseLocation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  )
}

function RequestRow({
  request,
  ownerName,
  actions,
}: {
  request: HireRequest
  ownerName: string
  actions?: ReactNode
}) {
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {request.pickup} → {request.destination}
          </p>
          <p className="text-sm text-muted">
            {ownerName} · {formatDate(request.startDate)} · {request.duration}
          </p>
          {request.notes && <p className="mt-1 text-sm">{request.notes}</p>}
        </div>
        <RequestBadge status={request.status} />
      </div>
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </article>
  )
}
