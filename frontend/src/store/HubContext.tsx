import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  ApplicationStatus,
  DriverProfile,
  HubState,
  OwnerProfile,
  PaymentNumbers,
  PaymentMethod,
  RequestStatus,
  User,
} from '../types'

type RegisterDriverInput = {
  name: string
  email: string
  phone: string
  password: string
  nationalId: string
  licenseNumber: string
  licenseClass: string
  licenseExpiry: string
  baseLocation: string
  languages: string[]
  yearsOnRoad: number
  vehiclesHandled: string[]
  notableRoutes: string[]
  specialties: string[]
  nightDriving: boolean
  longHaul: boolean
  incidentRecord: string
  bio: string
}

type RegisterOwnerInput = {
  name: string
  email: string
  phone: string
  password: string
  vehicleMake: string
  vehicleType: string
  plateNumber: string
  district: string
}

type CreateRequestInput = {
  driverId?: string
  pickup: string
  destination: string
  startDate: string
  duration: string
  vehicle: string
  notes: string
}

type HubResponse = {
  state: HubState | null
  currentUser: User | null
}

type HubContextValue = {
  state: HubState
  currentUser: User | null
  isLoading: boolean
  error: string | null
  dismissError: () => void
  login: (email: string, password: string) => Promise<string | null>
  requestPasswordReset: (email: string) => Promise<{ error: string | null; resetUrl?: string }>
  completePasswordReset: (token: string, password: string) => Promise<string | null>
  logout: () => Promise<void>
  registerDriver: (input: RegisterDriverInput) => Promise<string | null>
  updateDriverApplication: (input: RegisterDriverInput) => Promise<string | null>
  payAccessFee: (
    method: PaymentMethod,
    payerNumber: string,
    reference: string,
  ) => Promise<string | null>
  registerOwner: (input: RegisterOwnerInput) => Promise<string | null>
  createRequest: (input: CreateRequestInput) => Promise<string | null>
  setRequestStatus: (id: string, status: RequestStatus, driverId?: string) => Promise<void>
  reviewApplication: (
    driverUserId: string,
    status: ApplicationStatus,
    note?: string,
  ) => Promise<void>
  reviewMember: (userId: string, status: 'approved' | 'rejected') => Promise<void>
  reviewPayment: (transactionId: string, status: 'approved' | 'rejected') => Promise<void>
  reviewHireRequest: (requestId: string, status: 'approved' | 'rejected') => Promise<void>
  savePaymentNumbers: (numbers: PaymentNumbers) => Promise<string | null>
  approvedDrivers: Array<DriverProfile & { user: User }>
  driverById: (id: string) => (DriverProfile & { user: User }) | undefined
  ownerById: (id: string) => (OwnerProfile & { user: User }) | undefined
  resetDemo: () => Promise<void>
}

const emptyState: HubState = {
  users: [],
  drivers: [],
  owners: [],
  requests: [],
  transactions: [],
  paymentNumbers: { airtel: '', mtn: '' },
}

const HubContext = createContext<HubContextValue | null>(null)

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  let result: { error?: string } = {}
  try {
    result = await response.json() as { error?: string }
  } catch {
    if (!response.ok) {
      const recoveryHint = response.status === 404
        ? ' Check that the API server is running the current project version.'
        : ''
      throw new Error(`Request failed (${response.status}) for ${method} ${path}.${recoveryHint}`)
    }
    throw new Error(`The server returned an invalid response for ${method} ${path}.`)
  }
  if (!response.ok) {
    throw new Error(result.error || `Request failed (${response.status}) for ${method} ${path}.`)
  }
  return result as T
}

function json(body: unknown): RequestInit {
  return { method: 'POST', body: JSON.stringify(body) }
}

export function HubProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<HubState>(emptyState)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applyResponse = (result: HubResponse) => {
    setState(result.state
      ? { ...result.state, paymentNumbers: result.state.paymentNumbers ?? emptyState.paymentNumbers }
      : emptyState)
    setCurrentUser(result.currentUser)
  }

  useEffect(() => {
    let active = true
    const initialize = async () => {
      try {
        let result = await api<HubResponse>('/api/state')
        if (!result.state && import.meta.env.DEV) {
          try {
            const { seedState } = await import('../data/seed')
            await api('/api/bootstrap', json({ state: seedState() }))
          } catch (bootstrapError) {
            if (!(bootstrapError instanceof Error) ||
              !bootstrapError.message.includes('already been initialized')) {
              throw bootstrapError
            }
          }
          result = await api<HubResponse>('/api/state')
        }
        if (active) applyResponse(result)
      } catch (initializationError) {
        if (active) {
          setError(
            initializationError instanceof Error
              ? initializationError.message
              : 'Unable to connect to the DriverHub API.',
          )
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }
    void initialize()
    return () => {
      active = false
    }
  }, [])

  const perform = async (operation: () => Promise<HubResponse>) => {
    try {
      applyResponse(await operation())
      setError(null)
      return null
    } catch (operationError) {
      const message = operationError instanceof Error
        ? operationError.message
        : 'The request could not be completed.'
      setError(message)
      return message
    }
  }

  const login = (email: string, password: string) =>
    perform(() => api<HubResponse>('/api/auth/login', json({ email, password })))

  const requestPasswordReset = async (email: string) => {
    try {
      const result = await api<{ resetUrl?: string }>('/api/auth/password-reset/request', json({ email }))
      return { error: null, resetUrl: result.resetUrl }
    } catch (requestError) {
      return {
        error: requestError instanceof Error ? requestError.message : 'Unable to request a password reset.',
      }
    }
  }

  const completePasswordReset = async (token: string, password: string) => {
    try {
      await api<{ message: string }>('/api/auth/password-reset/complete', json({ token, password }))
      return null
    } catch (requestError) {
      return requestError instanceof Error ? requestError.message : 'Unable to reset the password.'
    }
  }

  const logout = async () => {
    try {
      applyResponse(await api<HubResponse>('/api/auth/logout', json({})))
      setError(null)
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Unable to sign out.')
    }
  }

  const registerDriver = (input: RegisterDriverInput) =>
    perform(() => api<HubResponse>('/api/auth/register-driver', json(input)))

  const updateDriverApplication = (input: RegisterDriverInput) =>
    perform(() => api<HubResponse>('/api/driver/application', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }))

  const payAccessFee = (method: PaymentMethod, payerNumber: string, reference: string) =>
    perform(() => api<HubResponse>('/api/payments', json({ method, payerNumber, reference })))

  const registerOwner = (input: RegisterOwnerInput) =>
    perform(() => api<HubResponse>('/api/auth/register-owner', json(input)))

  const createRequest = (input: CreateRequestInput) =>
    perform(() => api<HubResponse>('/api/requests', json(input)))

  const setRequestStatus = async (id: string, status: RequestStatus, driverId?: string) => {
    await perform(() =>
      api<HubResponse>(`/api/requests/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, driverId }),
      }),
    )
  }

  const reviewApplication = async (
    driverUserId: string,
    status: ApplicationStatus,
    note?: string,
  ) => {
    await perform(() =>
      api<HubResponse>(`/api/applications/${encodeURIComponent(driverUserId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      }),
    )
  }

  const reviewMember = async (userId: string, status: 'approved' | 'rejected') => {
    await perform(() =>
      api<HubResponse>(`/api/members/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    )
  }

  const reviewPayment = async (
    transactionId: string,
    status: 'approved' | 'rejected',
  ) => {
    await perform(() =>
      api<HubResponse>(`/api/payments/${encodeURIComponent(transactionId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    )
  }

  const reviewHireRequest = async (
    requestId: string,
    status: 'approved' | 'rejected',
  ) => {
    await perform(() =>
      api<HubResponse>(`/api/requests/${encodeURIComponent(requestId)}/approval`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    )
  }

  const savePaymentNumbers = (numbers: PaymentNumbers) =>
    perform(() => api<HubResponse>('/api/admin/payment-numbers', {
      method: 'PUT',
      body: JSON.stringify(numbers),
    }))

  const resetDemo = async () => {
    try {
      applyResponse(await api<HubResponse>('/api/demo/reset', json({})))
      setError(null)
    } catch (operationError) {
      setError(operationError instanceof Error ? operationError.message : 'Unable to reset the demo.')
    }
  }

  const approvedDrivers = useMemo(
    () =>
      state.drivers
        .filter((driver) => driver.applicationStatus === 'approved' && driver.accessFeePaid)
        .map((driver) => ({
          ...driver,
          user: state.users.find((user) => user.id === driver.userId)!,
        }))
        .filter((driver) => driver.user)
        .sort((a, b) => b.rating - a.rating),
    [state],
  )

  const driverById = (id: string) => {
    const profile = state.drivers.find((driver) => driver.userId === id)
    const user = state.users.find((candidate) => candidate.id === id)
    if (!profile || !user) return undefined
    return { ...profile, user }
  }

  const ownerById = (id: string) => {
    const profile = state.owners.find((owner) => owner.userId === id)
    const user = state.users.find((candidate) => candidate.id === id)
    if (!profile || !user) return undefined
    return { ...profile, user }
  }

  const value: HubContextValue = {
    state,
    currentUser,
    isLoading,
    error,
    dismissError: () => setError(null),
    login,
    requestPasswordReset,
    completePasswordReset,
    logout,
    registerDriver,
    updateDriverApplication,
    payAccessFee,
    registerOwner,
    createRequest,
    setRequestStatus,
    reviewApplication,
    reviewMember,
    reviewPayment,
    reviewHireRequest,
    savePaymentNumbers,
    approvedDrivers,
    driverById,
    ownerById,
    resetDemo,
  }

  return (
    <HubContext.Provider value={value}>
      {isLoading ? (
        <main className="mx-auto max-w-6xl px-4 py-16 text-muted">Connecting to DriverHub…</main>
      ) : (
        <>
          {error && (
            <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3">
              <div className="flex max-w-2xl items-center gap-4 rounded-xl border border-brick/30 bg-white px-4 py-3 text-sm shadow-lg" role="alert">
                <span>{error}</span>
                <button type="button" className="font-semibold" onClick={() => setError(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {children}
        </>
      )}
    </HubContext.Provider>
  )
}

export function useHub() {
  const context = useContext(HubContext)
  if (!context) throw new Error('useHub must be used inside HubProvider')
  return context
}
