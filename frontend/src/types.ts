export type Role = 'owner' | 'driver' | 'admin'

export type AccountStatus = 'pending' | 'approved' | 'rejected'

export type PaymentMethod = 'Airtel Uganda Money' | 'MTN Uganda MoMo'

export type ApplicationStatus =
  | 'unpaid'
  | 'pending'
  | 'approved'
  | 'rejected'

export type RequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'completed'
  | 'cancelled'

export interface User {
  id: string
  role: Role
  name: string
  email: string
  phone: string
  accountStatus?: AccountStatus
  createdAt?: string
  reviewedAt?: string
  reviewNote?: string
  password?: string
}

export interface DriverProfile {
  userId: string
  initials: string
  accent: string
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
  rating: number
  completedHires: number
  accessFeePaid: boolean
  accessFeeAmount: number
  paymentMethod?: string
  paymentRef?: string
  paidAt?: string
  applicationStatus: ApplicationStatus
  applicationNote?: string
  appliedAt?: string
  reviewedAt?: string
}

export interface OwnerProfile {
  userId: string
  vehicleMake: string
  vehicleType: string
  plateNumber: string
  district: string
}

export interface HireRequest {
  id: string
  ownerId: string
  driverId?: string
  approvalStatus?: AccountStatus
  approvalNote?: string
  reviewedAt?: string
  kind: 'specific' | 'open'
  pickup: string
  destination: string
  startDate: string
  duration: string
  vehicle: string
  notes: string
  status: RequestStatus
  createdAt: string
  updatedAt: string
}

export interface Transaction {
  id: string
  userId: string
  amount: number
  method: string
  reference: string
  payerNumber?: string
  recipientNumber?: string
  status: 'successful' | 'pending' | 'failed'
  createdAt: string
  reviewedAt?: string
  reviewNote?: string
}

export interface PaymentNumbers {
  airtel: string
  mtn: string
}

export interface HubState {
  users: User[]
  drivers: DriverProfile[]
  owners: OwnerProfile[]
  requests: HireRequest[]
  transactions: Transaction[]
  paymentNumbers: PaymentNumbers
}
