import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ACCESS_FEE, formatUgx } from '../lib/format'
import { useHub } from '../store/HubContext'
import { ApplicationBadge } from '../components/StatusBadge'
import type { PaymentMethod } from '../types'

const VEHICLES = ['Saloon', 'SUV', 'Pickup', 'Van', 'Lorry', 'Coach']
const SPECIALTIES = [
  'Family',
  'Corporate',
  'Airport',
  'Cargo',
  'Long haul',
  'Night driving',
  'NGO',
  'Tourism',
]

export function RegisterDriver() {
  const {
    currentUser,
    state,
    registerDriver,
    updateDriverApplication,
    payAccessFee,
    driverById,
  } = useHub()
  const existing = currentUser?.role === 'driver' ? driverById(currentUser.id) : undefined
  const rejected = existing?.applicationStatus === 'rejected'
  const [step, setStep] = useState(existing ? (rejected ? 1 : existing.accessFeePaid ? 3 : 2) : 1)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('MTN Uganda MoMo')
  const [momo, setMomo] = useState('')
  const [reference, setReference] = useState('')
  const [form, setForm] = useState({
    name: existing?.user.name ?? '',
    email: existing?.user.email ?? '',
    phone: existing?.user.phone ?? '',
    password: '',
    nationalId: existing?.nationalId ?? '',
    licenseNumber: existing?.licenseNumber ?? '',
    licenseClass: existing?.licenseClass ?? 'B',
    licenseExpiry: existing?.licenseExpiry ?? '',
    baseLocation: existing?.baseLocation ?? 'Kampala',
    languages: existing?.languages.join(', ') ?? 'English, Luganda',
    yearsOnRoad: existing?.yearsOnRoad ?? 3,
    vehiclesHandled: existing?.vehiclesHandled ?? ['Saloon'],
    notableRoutes: existing?.notableRoutes.join(', ') ?? '',
    specialties: existing?.specialties ?? [],
    nightDriving: existing?.nightDriving ?? true,
    longHaul: existing?.longHaul ?? false,
    incidentRecord: existing?.incidentRecord ?? 'Clean record.',
    bio: existing?.bio ?? '',
  })

  const listed = existing?.applicationStatus === 'approved' && existing.accessFeePaid
  const pendingPayment = state.transactions.find(
    (transaction) => transaction.userId === currentUser?.id && transaction.status === 'pending',
  )
  const paymentNumber = method === 'Airtel Uganda Money'
    ? state.paymentNumbers.airtel
    : state.paymentNumbers.mtn

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  const onDetails = async (e: FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    const input = {
      ...form,
      languages: form.languages.split(',').map((s) => s.trim()).filter(Boolean),
      notableRoutes: form.notableRoutes.split(',').map((s) => s.trim()).filter(Boolean),
    }
    const err = rejected
      ? await updateDriverApplication(input)
      : await registerDriver(input)
    setIsSubmitting(false)
    if (err) setError(err)
    else {
      setError(null)
      setStep(rejected ? 3 : 2)
    }
  }

  const onPay = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentUser || currentUser.role !== 'driver') return
    if (currentUser.accountStatus !== 'approved') {
      setError('Your account must be approved before you can submit a payment.')
      return
    }
    if (isSubmitting) return
    if (momo.replace(/\D/g, '').length < 9) {
      setError('Enter a valid mobile money number.')
      return
    }
    if (!reference.trim()) {
      setError('Enter the transaction reference from your Mobile Money receipt.')
      return
    }
    if (!paymentNumber) {
      setError('The hub has not configured this Mobile Money number yet.')
      return
    }
    setIsSubmitting(true)
    const err = await payAccessFee(method, momo, reference.trim())
    setIsSubmitting(false)
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setStep(3)
  }

  const statusCopy = useMemo(() => {
    if (!existing) return null
    if (pendingPayment) {
      return 'Payment details submitted. The hub desk must verify the transaction before your driver application can be reviewed.'
    }
    if (existing.applicationStatus === 'unpaid') {
      return 'Your file is saved. Pay the access fee to send it for review.'
    }
    if (existing.applicationStatus === 'pending') {
      return 'Fee received. The hub desk is reviewing your application. You will be listed when approved.'
    }
    if (existing.applicationStatus === 'approved') {
      return 'You are listed. Car owners can read your road experience and request you.'
    }
    return existing.applicationNote || 'The hub did not list this application.'
  }, [existing, pendingPayment])

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs tracking-[0.2em] uppercase text-brick">Driver registration</p>
      <h1 className="mt-2 font-display text-4xl">Join DriverHub Ug</h1>
      <p className="mt-2 text-muted">
        Listing is not free. Pay {formatUgx(ACCESS_FEE)}, then wait for application status to
        move from under review to on the hub.
      </p>

      <ol className="mt-6 flex gap-2 text-xs uppercase tracking-wider">
        {['Particulars', 'Access fee', 'Status'].map((label, i) => (
          <li
            key={label}
            className={`rounded-full px-3 py-1 ${
              step === i + 1 ? 'bg-ink text-cream' : 'bg-cream text-muted'
            }`}
          >
            0{i + 1} {label}
          </li>
        ))}
      </ol>

      {step === 1 && (!existing || rejected) && (
        <form className="card mt-6 grid gap-4 p-6" onSubmit={onDetails}>
          <div className="field">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          {!rejected && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="phone">Phone</label>
                  <input
                    id="phone"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
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
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="field">
              <label htmlFor="nid">National ID</label>
              <input
                id="nid"
                required
                value={form.nationalId}
                onChange={(e) => setForm({ ...form, nationalId: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="lic">Licence number</label>
              <input
                id="lic"
                required
                value={form.licenseNumber}
                onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="field">
              <label htmlFor="class">Licence class</label>
              <select
                id="class"
                value={form.licenseClass}
                onChange={(e) => setForm({ ...form, licenseClass: e.target.value })}
              >
                <option>B</option>
                <option>B / DL</option>
                <option>C</option>
                <option>C / CM</option>
                <option>DL</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="exp">Licence expiry</label>
              <input
                id="exp"
                type="date"
                required
                value={form.licenseExpiry}
                onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="yrs">Years on road</label>
              <input
                id="yrs"
                type="number"
                min={1}
                required
                value={form.yearsOnRoad}
                onChange={(e) => setForm({ ...form, yearsOnRoad: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="base">Base location</label>
            <input
              id="base"
              required
              value={form.baseLocation}
              onChange={(e) => setForm({ ...form, baseLocation: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="lang">Languages</label>
            <input
              id="lang"
              value={form.languages}
              onChange={(e) => setForm({ ...form, languages: e.target.value })}
            />
          </div>
          <fieldset>
            <legend className="text-xs uppercase tracking-wider text-muted">Vehicles handled</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {VEHICLES.map((v) => (
                <label key={v} className="chip cursor-pointer">
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={form.vehiclesHandled.includes(v)}
                    onChange={() =>
                      setForm({ ...form, vehiclesHandled: toggle(form.vehiclesHandled, v) })
                    }
                  />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs uppercase tracking-wider text-muted">Specialties</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SPECIALTIES.map((v) => (
                <label key={v} className="chip cursor-pointer">
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={form.specialties.includes(v)}
                    onChange={() =>
                      setForm({ ...form, specialties: toggle(form.specialties, v) })
                    }
                  />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="routes">Notable routes (comma separated)</label>
            <input
              id="routes"
              placeholder="Kampala–Gulu, Entebbe Airport"
              value={form.notableRoutes}
              onChange={(e) => setForm({ ...form, notableRoutes: e.target.value })}
            />
          </div>
          <div className="flex gap-4 text-sm">
            <label>
              <input
                type="checkbox"
                checked={form.nightDriving}
                onChange={(e) => setForm({ ...form, nightDriving: e.target.checked })}
              />{' '}
              Night driving
            </label>
            <label>
              <input
                type="checkbox"
                checked={form.longHaul}
                onChange={(e) => setForm({ ...form, longHaul: e.target.checked })}
              />{' '}
              Long haul
            </label>
          </div>
          <div className="field">
            <label htmlFor="inc">Incident record</label>
            <textarea
              id="inc"
              value={form.incidentRecord}
              onChange={(e) => setForm({ ...form, incidentRecord: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="bio">About your road work</label>
            <textarea
              id="bio"
              required
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-brick">{error}</p>}
          <button className="btn-gold" type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? (rejected ? 'Resubmitting application…' : 'Saving application…')
              : (rejected ? 'Save changes and resubmit' : 'Save file and pay fee')}
          </button>
        </form>
      )}

      {step === 2 && currentUser?.role === 'driver' && existing &&
        currentUser.accountStatus !== 'approved' && (
        <div className="card mt-6 p-6">
          <h2 className="font-display text-2xl">Registration awaiting approval</h2>
          <p className="mt-2 text-muted">
            You can sign in while the hub desk reviews your account. Payment will be available after approval.
          </p>
        </div>
      )}

      {step === 2 && currentUser?.role === 'driver' && existing &&
        currentUser.accountStatus === 'approved' && pendingPayment && (
        <div className="card mt-6 p-6">
          <h2 className="font-display text-2xl">Payment awaiting verification</h2>
          <p className="mt-2 text-muted">
            Reference {pendingPayment.reference} was submitted. The hub desk will verify it before marking the fee paid.
          </p>
        </div>
      )}

      {step === 2 && currentUser?.role === 'driver' && existing &&
        currentUser.accountStatus === 'approved' && !existing.accessFeePaid && !pendingPayment && (
        <form className="card mt-6 grid gap-4 p-6" onSubmit={onPay}>
          <p className="font-display text-2xl">{formatUgx(ACCESS_FEE)} access fee</p>
          <p className="text-sm text-muted">
            Send the fee to the hub number shown below. Enter the payer number and receipt reference; the hub desk will verify your payment manually.
          </p>
          <div className="field">
            <label htmlFor="method">Pay with</label>
            <select
              id="method"
              value={method}
              onChange={(e) => {
                const value = e.target.value
                if (value === 'Airtel Uganda Money' || value === 'MTN Uganda MoMo') {
                  setMethod(value)
                }
              }}
            >
              <option value="MTN Uganda MoMo">MTN Uganda MoMo</option>
              <option value="Airtel Uganda Money">Airtel Uganda Money</option>
            </select>
          </div>
          <div className="rounded-lg bg-cream p-4 text-sm">
            <span className="block text-muted">Send to this {method} number</span>
            <strong className="mt-1 block text-lg">{paymentNumber || 'Not configured by the hub yet'}</strong>
          </div>
          <div className="field">
            <label htmlFor="momo">Your Mobile Money number</label>
            <input
              id="momo"
              required
              placeholder="0772…"
              value={momo}
              onChange={(e) => setMomo(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="reference">Transaction reference</label>
            <input
              id="reference"
              required
              maxLength={100}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-brick">{error}</p>}
          <button className="btn-gold" type="submit" disabled={isSubmitting || !paymentNumber}>
            {isSubmitting ? 'Submitting for review…' : 'Submit payment for verification'}
          </button>
        </form>
      )}

      {(step === 3 || (existing && existing.accessFeePaid) || listed) && existing && (
        <div className="card mt-6 p-6">
          <div className="flex items-center gap-2">
            <ApplicationBadge status={existing.applicationStatus} />
            {(existing.paymentRef || pendingPayment?.reference) && (
              <span className="text-sm text-muted">Ref {existing.paymentRef ?? pendingPayment?.reference}</span>
            )}
          </div>
          <p className="mt-4">{statusCopy}</p>
          {(existing.paymentMethod || pendingPayment?.method) && (
            <p className="mt-2 text-sm text-muted">
              {pendingPayment ? 'Submitted via' : 'Paid via'} {existing.paymentMethod ?? pendingPayment?.method}
              {existing.paidAt ? ` · ${new Date(existing.paidAt).toLocaleString('en-UG')}` : ''}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/dashboard" className="btn-dark">
              Driver desk
            </Link>
            {listed && (
              <Link to={`/drivers/${existing.userId}`} className="btn-ghost">
                View my public file
              </Link>
            )}
          </div>
        </div>
      )}

      {currentUser && currentUser.role !== 'driver' && (
        <p className="mt-6 text-sm text-muted">
          You are signed in as {currentUser.role}. Sign out to register a driver account.
        </p>
      )}
    </main>
  )
}
