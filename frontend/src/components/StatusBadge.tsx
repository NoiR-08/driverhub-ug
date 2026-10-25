import type { ApplicationStatus, RequestStatus } from '../types'

const requestMap: Record<RequestStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-900' },
  accepted: { label: 'Accepted', className: 'bg-emerald-100 text-emerald-900' },
  declined: { label: 'Declined', className: 'bg-rose-100 text-rose-900' },
  completed: { label: 'Completed', className: 'bg-sky-100 text-sky-900' },
  cancelled: { label: 'Cancelled', className: 'bg-stone-200 text-stone-700' },
}

const appMap: Record<ApplicationStatus, { label: string; className: string }> = {
  unpaid: { label: 'Fee unpaid', className: 'bg-rose-100 text-rose-900' },
  pending: { label: 'Under review', className: 'bg-amber-100 text-amber-900' },
  approved: { label: 'On the hub', className: 'bg-emerald-100 text-emerald-900' },
  rejected: { label: 'Not listed', className: 'bg-stone-200 text-stone-800' },
}

export function RequestBadge({ status }: { status: RequestStatus }) {
  const s = requestMap[status]
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.className}`}>
      {s.label}
    </span>
  )
}

export function ApplicationBadge({ status }: { status: ApplicationStatus }) {
  const s = appMap[status]
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.className}`}>
      {s.label}
    </span>
  )
}
