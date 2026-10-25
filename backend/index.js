import { createServer } from 'node:http'
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import nodemailer from 'nodemailer'
import {
  connectDatabase,
  initializeHub,
  mutateHub,
  readHub,
} from '../connection/database.js'

const SESSION_COOKIE = 'driverhub_session'
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000
const ACCESS_FEE = 35_000
const PAYMENT_METHODS = new Set(['Airtel Uganda Money', 'MTN Uganda MoMo'])
const EMPTY_PAYMENT_NUMBERS = { airtel: '', mtn: '' }
const DEMO_EMAILS = new Set([
  'owner@driverhub.ug',
  'driver@driverhub.ug',
  'hassan@driverhub.ug',
  'hub@driverhub.ug',
])
const RESET_TOKEN_TTL = 30 * 60 * 1000
const DEMO_MODE = process.env.DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production'

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function getState() {
  return (await readHub())?.state ?? null
}

async function updateState(update) {
  const result = await mutateHub((hub) => {
    if (!hub.state) throw new HttpError(503, 'The hub has not been initialized.')
    update(hub.state)
  })
  if (result === null) throw new HttpError(503, 'The hub has not been initialized.')
}

function cleanUser(user) {
  const { password: _password, ...safeUser } = user
  return { ...safeUser, accountStatus: user.accountStatus ?? 'approved' }
}

function publicState(state) {
  if (!state) return null
  const paymentNumbers = state.paymentNumbers ?? EMPTY_PAYMENT_NUMBERS
  const drivers = state.drivers
    .filter((driver) => driver.applicationStatus === 'approved' && driver.accessFeePaid)
    .map((driver) => ({
      ...driver,
      nationalId: '',
      licenseNumber: '',
      licenseExpiry: '',
    }))
  const driverIds = new Set(drivers.map((driver) => driver.userId))
  return {
    users: state.users
      .filter((user) => driverIds.has(user.id))
      .map((user) => ({ ...cleanUser(user), email: '', phone: '' })),
    drivers,
    owners: [],
    requests: [],
    transactions: [],
    paymentNumbers,
  }
}

function stateFor(state, user) {
  if (!user) return publicState(state)
  if (!state) return null
  state = { ...state, paymentNumbers: state.paymentNumbers ?? EMPTY_PAYMENT_NUMBERS }
  if (user.role === 'admin') {
    return { ...state, users: state.users.map(cleanUser) }
  }
  if ((user.accountStatus ?? 'approved') !== 'approved') {
    return {
      users: state.users.filter((candidate) => candidate.id === user.id).map(cleanUser),
      drivers: state.drivers.filter((driver) => driver.userId === user.id),
      owners: state.owners.filter((owner) => owner.userId === user.id),
      requests: [],
      transactions: [],
      paymentNumbers: state.paymentNumbers,
    }
  }

  const listedDrivers = state.drivers.filter(
    (driver) => driver.applicationStatus === 'approved' && driver.accessFeePaid,
  )
  const listedIds = new Set(listedDrivers.map((driver) => driver.userId))
  if (user.role === 'owner') {
    const requests = state.requests.filter((request) => request.ownerId === user.id)
    const relevantDriverIds = new Set([
      ...listedIds,
      ...requests.flatMap((request) => request.driverId ? [request.driverId] : []),
    ])
    return {
      users: state.users
        .filter((candidate) => candidate.id === user.id || relevantDriverIds.has(candidate.id))
        .map(cleanUser),
      drivers: state.drivers.filter((driver) => relevantDriverIds.has(driver.userId)),
      owners: state.owners.filter((owner) => owner.userId === user.id),
      requests,
      transactions: [],
      paymentNumbers: state.paymentNumbers,
    }
  }

  const ownDriver = state.drivers.find((driver) => driver.userId === user.id)
  const requests = state.requests.filter((request) =>
    (request.approvalStatus ?? 'approved') === 'approved' &&
    (request.driverId === user.id ||
      (request.kind === 'open' && request.status === 'pending' &&
        ownDriver?.applicationStatus === 'approved')),
  )
  const relevantOwnerIds = new Set(requests.map((request) => request.ownerId))
  const driverProfiles = listedDrivers.map((driver) =>
    driver.userId === user.id
      ? driver
      : { ...driver, nationalId: '', licenseNumber: '', licenseExpiry: '' },
  )
  if (ownDriver && !listedIds.has(user.id)) driverProfiles.push(ownDriver)
  return {
    users: state.users
      .filter((candidate) =>
        candidate.id === user.id || listedIds.has(candidate.id) || relevantOwnerIds.has(candidate.id),
      )
      .map((candidate) => {
        const safeUser = cleanUser(candidate)
        return candidate.id === user.id ? safeUser : { ...safeUser, email: '', phone: '' }
      }),
    drivers: driverProfiles,
    owners: state.owners.filter((owner) => relevantOwnerIds.has(owner.userId)),
    requests,
    transactions: state.transactions.filter((transaction) => transaction.userId === user.id),
    paymentNumbers: state.paymentNumbers,
  }
}

function cookieValue(request, name) {
  const cookies = request.headers.cookie?.split(';') ?? []
  for (const entry of cookies) {
    const [key, ...value] = entry.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return null
}

async function authenticatedUser(request) {
  const token = cookieValue(request, SESSION_COOKIE)
  if (!token) return null
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const hub = await readHub()
  const session = hub?.sessions.find(
    (item) => item.tokenHash === tokenHash && item.expiresAt > Date.now(),
  )
  if (!session) return null
  return hub.state?.users.find((user) => user.id === session.userId) ?? null
}

async function requireUser(request, role) {
  const user = await authenticatedUser(request)
  if (!user) throw new HttpError(401, 'Sign in to continue.')
  if (role && user.role !== role) throw new HttpError(403, 'You do not have permission to do that.')
  if (user.role !== 'admin' && (user.accountStatus ?? 'approved') !== 'approved') {
    const message = user.accountStatus === 'rejected'
      ? 'Your account was not approved. Contact the hub desk for help.'
      : 'Your account is awaiting admin approval.'
    throw new HttpError(403, message)
  }
  return user
}

async function setSession(response, userId) {
  const token = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const expiresAt = Date.now() + SESSION_TTL
  const result = await mutateHub((hub) => {
    hub.sessions = hub.sessions.filter((session) => session.expiresAt > Date.now())
    hub.sessions.push({ tokenHash, userId, expiresAt })
  })
  if (result === null) throw new HttpError(503, 'The hub has not been initialized.')
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}${secure}`,
  )
}

async function clearSession(request, response) {
  const token = cookieValue(request, SESSION_COOKIE)
  if (token) {
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await mutateHub((hub) => {
      hub.sessions = hub.sessions.filter((session) => session.tokenHash !== tokenHash)
    })
  }
  response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`)
}

function passwordRecord(password) {
  const salt = randomBytes(16).toString('hex')
  return { salt, password_hash: scryptSync(password, salt, 64).toString('hex') }
}

function verifyPassword(password, record) {
  const hash = scryptSync(password, record.salt, 64)
  const expected = Buffer.from(record.password_hash, 'hex')
  return hash.length === expected.length && timingSafeEqual(hash, expected)
}

function mailTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !process.env.EMAIL_FROM) {
    return null
  }
  const port = Number(SMTP_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HttpError(500, 'Email delivery is misconfigured.')
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
}

function passwordResetUrl(token) {
  const baseUrl = process.env.PUBLIC_APP_URL || (DEMO_MODE ? 'http://127.0.0.1:5173' : '')
  if (!baseUrl) throw new HttpError(503, 'Password recovery is not configured.')
  let url
  try {
    url = new URL('/reset-password', baseUrl)
  } catch {
    throw new HttpError(500, 'The public application URL is misconfigured.')
  }
  if (!['https:', 'http:'].includes(url.protocol) ||
    (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')) {
    throw new HttpError(500, 'The public application URL must use HTTPS in production.')
  }
  url.searchParams.set('token', token)
  return url.toString()
}

async function sendPasswordResetEmail(transport, user, resetUrl) {
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: 'Reset your DriverHub Ug password',
    text: `Hello ${user.name},\n\nUse this link to reset your DriverHub Ug password. It expires in 30 minutes:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  })
  return true
}

async function readBody(request) {
  if (request.body !== undefined) {
    if (typeof request.body === 'string') {
      try {
        return JSON.parse(request.body)
      } catch {
        throw new HttpError(400, 'Request body must be valid JSON.')
      }
    }
    if (Buffer.isBuffer(request.body)) {
      try {
        return JSON.parse(request.body.toString('utf8'))
      } catch {
        throw new HttpError(400, 'Request body must be valid JSON.')
      }
    }
    if (request.body && typeof request.body === 'object') return request.body
  }
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 1_000_000) throw new HttpError(413, 'Request body is too large.')
  }
  if (!body) return {}
  try {
    return JSON.parse(body)
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.')
  }
}

function requiredString(value, label, max = 500) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new HttpError(400, `${label} is required.`)
  }
  return value.trim()
}

function requiredPhone(value, label) {
  const phone = requiredString(value, label, 40)
  const digits = phone.replace(/\D/g, '')
  if (!/^[+\d\s()-]+$/.test(phone)) {
    throw new HttpError(400, `Enter a valid ${label.toLowerCase()}.`)
  }
  return phone
}

function currentUgandaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts()
  const part = (type) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function validateHireDate(value) {
  const date = requiredString(value, 'Start date', 40)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new HttpError(400, 'Enter a valid start date.')
  const [year, month, day] = match.slice(1).map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day) {
    throw new HttpError(400, 'Enter a valid start date.')
  }
  if (date < currentUgandaDate()) throw new HttpError(400, 'Start date cannot be in the past.')
  return date
}

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

async function sendHub(response, status = 200, user = null) {
  send(response, status, {
    state: stateFor(await getState(), user),
    currentUser: user ? cleanUser(user) : null,
  })
}

function makeUserId(prefix) {
  return `${prefix}-${randomBytes(8).toString('hex')}`
}

async function createAccount(response, input, role) {
  const name = requiredString(input.name, 'Name', 120)
  const email = requiredString(input.email, 'Email', 254).toLowerCase()
  const phone = requiredString(input.phone, 'Phone', 40)
  const password = requiredString(input.password, 'Password', 200)
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email.')
  const userId = makeUserId(role === 'driver' ? 'drv' : 'own')
  const createdAt = new Date().toISOString()
  const user = { id: userId, role, name, email, phone, accountStatus: 'pending', createdAt }
  const credential = passwordRecord(password)

  let owner
  let profile
  if (role === 'owner') {
    owner = {
      userId,
      vehicleMake: requiredString(input.vehicleMake, 'Vehicle', 120),
      vehicleType: requiredString(input.vehicleType, 'Vehicle type', 80),
      plateNumber: requiredString(input.plateNumber, 'Number plate', 40),
      district: requiredString(input.district, 'District', 100),
    }
  } else {
    const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    profile = {
      userId,
      initials,
      accent: '#1c3d32',
      nationalId: requiredString(input.nationalId, 'National ID', 80),
      licenseNumber: requiredString(input.licenseNumber, 'Licence number', 80),
      licenseClass: requiredString(input.licenseClass, 'Licence class', 40),
      licenseExpiry: requiredString(input.licenseExpiry, 'Licence expiry', 40),
      baseLocation: requiredString(input.baseLocation, 'Base location', 100),
      languages: Array.isArray(input.languages) ? input.languages : [],
      yearsOnRoad: Math.max(0, Number(input.yearsOnRoad) || 0),
      vehiclesHandled: Array.isArray(input.vehiclesHandled) ? input.vehiclesHandled : [],
      notableRoutes: Array.isArray(input.notableRoutes) ? input.notableRoutes : [],
      specialties: Array.isArray(input.specialties) ? input.specialties : [],
      nightDriving: Boolean(input.nightDriving),
      longHaul: Boolean(input.longHaul),
      incidentRecord: requiredString(input.incidentRecord, 'Incident record', 1000),
      bio: requiredString(input.bio, 'About your road work', 2000),
      rating: 0,
      completedHires: 0,
      accessFeePaid: false,
      accessFeeAmount: ACCESS_FEE,
      applicationStatus: 'unpaid',
      appliedAt: new Date().toISOString(),
    }
  }

  const result = await mutateHub((hub) => {
    if (!hub.state) throw new HttpError(503, 'The hub has not been initialized.')
    if (hub.state.users.some((account) => account.email.toLowerCase() === email)) {
      throw new HttpError(409, 'That email is already on the hub.')
    }
    hub.state.users.push(user)
    if (owner) hub.state.owners.push(owner)
    if (profile) hub.state.drivers.push(profile)
    hub.credentials.push({ userId, ...credential })
  })
  if (result === null) throw new HttpError(503, 'The hub has not been initialized.')
  await setSession(response, userId)
  return sendHub(response, 201, user)
}

async function handle(request, response) {
  const url = new URL(request.url, 'http://localhost')
  const path = url.pathname
  if (request.method === 'GET' && path === '/api/health') {
    return send(response, 200, { status: 'ok' })
  }
  if (!path.startsWith('/api/')) throw new HttpError(404, 'Route not found.')

  if (request.method === 'GET' && path === '/api/state') {
    const user = await authenticatedUser(request)
    return sendHub(response, 200, user)
  }
  if (request.method === 'POST' && path === '/api/bootstrap') {
    if (!DEMO_MODE) throw new HttpError(404, 'Route not found.')
    const body = await readBody(request)
    const state = body.state
    if (!state || !Array.isArray(state.users) || !Array.isArray(state.drivers)) {
      throw new HttpError(400, 'Initial hub data is invalid.')
    }
    const safeUsers = state.users.map(cleanUser)
    const initial = { ...state, users: safeUsers }
    const credentials = state.users.map((user) => ({
      userId: user.id,
      ...passwordRecord(user.password || 'demo'),
    }))
    const initialized = await initializeHub({ state: initial, credentials })
    if (!initialized) return send(response, 409, { error: 'The hub has already been initialized.' })
    return sendHub(response, 201)
  }
  if (request.method === 'POST' && path === '/api/auth/login') {
    const body = await readBody(request)
    const email = requiredString(body.email, 'Email', 254).toLowerCase()
    const password = requiredString(body.password, 'Password', 200)
    const hub = await readHub()
    const user = hub?.state?.users.find((item) => item.email.toLowerCase() === email)
    const credential = user
      ? hub.credentials.find((item) => item.userId === user.id)
      : null
    if ((!DEMO_MODE && DEMO_EMAILS.has(email)) ||
      !user || !credential || !verifyPassword(password, credential)) {
      throw new HttpError(401, 'No matching account. Check email and password.')
    }
    await setSession(response, user.id)
    return sendHub(response, 200, user)
  }
  if (request.method === 'POST' && path === '/api/auth/password-reset/request') {
    const body = await readBody(request)
    const email = requiredString(body.email, 'Email', 254).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'Enter a valid email.')
    }
    const transport = mailTransport()
    if (!transport && !DEMO_MODE) {
      throw new HttpError(503, 'Password recovery email is not configured.')
    }
    const user = (await getState())?.users.find((item) => item.email.toLowerCase() === email)
    if (!user) return send(response, 202, { message: 'If an account matches that email, reset instructions will be sent.' })

    const token = randomBytes(32).toString('hex')
    const resetUrl = passwordResetUrl(token)
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = Date.now() + RESET_TOKEN_TTL
    await mutateHub((hub) => {
      hub.passwordResetTokens = hub.passwordResetTokens.filter((item) => item.userId !== user.id)
      hub.passwordResetTokens.push({ tokenHash, userId: user.id, expiresAt })
    })
    try {
      if (transport) await sendPasswordResetEmail(transport, user, resetUrl)
    } catch (error) {
      await mutateHub((hub) => {
        hub.passwordResetTokens = hub.passwordResetTokens.filter((item) => item.tokenHash !== tokenHash)
      })
      console.error('Password reset email delivery failed:', error)
      if (error instanceof HttpError) throw error
      throw new HttpError(503, 'Password reset email could not be sent. Try again later.')
    }
    return send(response, 202, {
      message: 'If an account matches that email, reset instructions will be sent.',
      ...(DEMO_MODE && !transport ? { resetUrl } : {}),
    })
  }
  if (request.method === 'POST' && path === '/api/auth/password-reset/complete') {
    const body = await readBody(request)
    const token = requiredString(body.token, 'Reset token', 128)
    const password = requiredString(body.password, 'Password', 200)
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const hub = await readHub()
    const record = hub?.passwordResetTokens.find(
      (item) => item.tokenHash === tokenHash && item.expiresAt > Date.now(),
    )
    if (!record) throw new HttpError(400, 'This reset link is invalid or expired. Request a new one.')
    const credential = passwordRecord(password)
    const updated = await mutateHub((data) => {
      const activeToken = data.passwordResetTokens.find(
        (item) => item.tokenHash === tokenHash && item.expiresAt > Date.now(),
      )
      if (!activeToken || activeToken.userId !== record.userId) return false
      const activeCredential = data.credentials.find((item) => item.userId === record.userId)
      if (!activeCredential) return false
      Object.assign(activeCredential, credential)
      data.passwordResetTokens = data.passwordResetTokens.filter(
        (item) => item.userId !== record.userId,
      )
      data.sessions = data.sessions.filter((item) => item.userId !== record.userId)
      return true
    })
    if (!updated) throw new HttpError(400, 'This reset link is invalid or expired. Request a new one.')
    return send(response, 200, { message: 'Password updated. Sign in with your new password.' })
  }
  if (request.method === 'POST' && path === '/api/auth/logout') {
    await clearSession(request, response)
    return sendHub(response)
  }
  if (request.method === 'POST' && path === '/api/auth/register-owner') {
    return createAccount(response, await readBody(request), 'owner')
  }
  if (request.method === 'POST' && path === '/api/auth/register-driver') {
    return createAccount(response, await readBody(request), 'driver')
  }
  if (request.method === 'PATCH' && path === '/api/driver/application') {
    const user = await requireUser(request, 'driver')
    const body = await readBody(request)
    const name = requiredString(body.name, 'Name', 120)
    const profileFields = {
      nationalId: requiredString(body.nationalId, 'National ID', 80),
      licenseNumber: requiredString(body.licenseNumber, 'Licence number', 80),
      licenseClass: requiredString(body.licenseClass, 'Licence class', 40),
      licenseExpiry: requiredString(body.licenseExpiry, 'Licence expiry', 40),
      baseLocation: requiredString(body.baseLocation, 'Base location', 100),
      languages: Array.isArray(body.languages) ? body.languages : [],
      yearsOnRoad: Number(body.yearsOnRoad),
      vehiclesHandled: Array.isArray(body.vehiclesHandled) ? body.vehiclesHandled : [],
      notableRoutes: Array.isArray(body.notableRoutes) ? body.notableRoutes : [],
      specialties: Array.isArray(body.specialties) ? body.specialties : [],
      nightDriving: Boolean(body.nightDriving),
      longHaul: Boolean(body.longHaul),
      incidentRecord: requiredString(body.incidentRecord, 'Incident record', 1000),
      bio: requiredString(body.bio, 'About your road work', 2000),
    }
    if (!Number.isInteger(profileFields.yearsOnRoad) || profileFields.yearsOnRoad < 1) {
      throw new HttpError(400, 'Years on road must be at least 1.')
    }
    await updateState((state) => {
      const profile = state.drivers.find((item) => item.userId === user.id)
      if (!profile) throw new HttpError(404, 'Driver file not found.')
      if (!profile.accessFeePaid || profile.applicationStatus !== 'rejected') {
        throw new HttpError(409, 'Only a rejected, paid application can be resubmitted.')
      }
      Object.assign(profile, profileFields, {
        applicationStatus: 'pending',
        applicationNote: undefined,
        appliedAt: new Date().toISOString(),
        reviewedAt: undefined,
      })
      const account = state.users.find((item) => item.id === user.id)
      if (account) account.name = name
    })
    user.name = name
    return sendHub(response, 200, user)
  }
  if (request.method === 'POST' && path === '/api/payments') {
    const user = await requireUser(request, 'driver')
    const body = await readBody(request)
    const method = requiredString(body.method, 'Payment method', 60)
    if (!PAYMENT_METHODS.has(method)) {
      throw new HttpError(400, 'Choose Airtel Uganda Money or MTN Uganda MoMo.')
    }
    const reference = requiredString(body.reference, 'Mobile Money transaction reference', 100)
    const payerNumber = requiredPhone(body.payerNumber, 'Mobile Money number')
    await updateState((state) => {
      const driver = state.drivers.find((item) => item.userId === user.id)
      if (!driver) throw new HttpError(404, 'Driver file not found.')
      if (driver.accessFeePaid) throw new HttpError(409, 'The access fee has already been paid.')
      if (state.transactions.some((transaction) =>
        transaction.reference.toLowerCase() === reference.toLowerCase(),
      )) throw new HttpError(409, 'That transaction reference has already been submitted.')
      if (state.transactions.some((transaction) =>
        transaction.userId === user.id && transaction.status === 'pending',
      )) throw new HttpError(409, 'A payment is already waiting for admin review.')
      const paymentNumbers = state.paymentNumbers ?? EMPTY_PAYMENT_NUMBERS
      const recipientNumber = method === 'Airtel Uganda Money'
        ? paymentNumbers.airtel
        : paymentNumbers.mtn
      if (!recipientNumber) {
        throw new HttpError(503, `The hub has not configured its ${method} payment number yet.`)
      }
      const createdAt = new Date().toISOString()
      state.transactions.unshift({
        id: makeUserId('txn'),
        userId: user.id,
        amount: ACCESS_FEE,
        method,
        reference,
        payerNumber,
        recipientNumber,
        status: 'pending',
        createdAt,
      })
    })
    return sendHub(response, 201, user)
  }
  if (request.method === 'POST' && path === '/api/requests') {
    const user = await requireUser(request, 'owner')
    const body = await readBody(request)
    let requestId
    await updateState((state) => {
      const owner = state.owners.find((item) => item.userId === user.id)
      if (!owner) throw new HttpError(404, 'Owner profile not found.')
      const driverId = body.driverId ? requiredString(body.driverId, 'Driver', 100) : undefined
      if (driverId && !state.drivers.some((driver) =>
        driver.userId === driverId && driver.applicationStatus === 'approved' && driver.accessFeePaid,
      )) throw new HttpError(400, 'That driver is not listed on the hub.')
      const now = new Date().toISOString()
      requestId = makeUserId('req')
      state.requests.unshift({
        id: requestId,
        ownerId: user.id,
        driverId,
        approvalStatus: 'pending',
        kind: driverId ? 'specific' : 'open',
        pickup: requiredString(body.pickup, 'Pickup', 200),
        destination: requiredString(body.destination, 'Destination', 200),
        startDate: validateHireDate(body.startDate),
        duration: requiredString(body.duration, 'Duration', 100),
        vehicle: typeof body.vehicle === 'string' && body.vehicle.trim()
          ? body.vehicle.trim()
          : owner.vehicleMake || 'Owner vehicle',
        notes: typeof body.notes === 'string' ? body.notes.slice(0, 2000) : '',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })
    })
    return sendHub(response, 201, user)
  }
  const memberMatch = path.match(/^\/api\/members\/([^/]+)$/)
  if (request.method === 'PATCH' && memberMatch) {
    const user = await requireUser(request, 'admin')
    const body = await readBody(request)
    const status = requiredString(body.status, 'Account status', 20)
    if (!['approved', 'rejected'].includes(status)) {
      throw new HttpError(400, 'Account status must be approved or rejected.')
    }
    await updateState((state) => {
      const member = state.users.find((item) => item.id === decodeURIComponent(memberMatch[1]))
      if (!member || member.role === 'admin') throw new HttpError(404, 'Member not found.')
      if ((member.accountStatus ?? 'approved') !== 'pending') {
        throw new HttpError(409, 'Only pending registrations can be reviewed.')
      }
      member.accountStatus = status
      member.reviewNote = typeof body.note === 'string' ? body.note.slice(0, 1000) : undefined
      member.reviewedAt = new Date().toISOString()
    })
    return sendHub(response, 200, user)
  }
  if (request.method === 'PUT' && path === '/api/admin/payment-numbers') {
    const user = await requireUser(request, 'admin')
    const body = await readBody(request)
    const airtel = requiredPhone(body.airtel, 'Airtel payment number')
    const mtn = requiredPhone(body.mtn, 'MTN payment number')
    await updateState((state) => {
      state.paymentNumbers = { airtel, mtn }
    })
    return sendHub(response, 200, user)
  }
  const paymentMatch = path.match(/^\/api\/payments\/([^/]+)$/)
  if (request.method === 'PATCH' && paymentMatch) {
    const user = await requireUser(request, 'admin')
    const body = await readBody(request)
    const status = requiredString(body.status, 'Payment decision', 20)
    if (!['approved', 'rejected'].includes(status)) {
      throw new HttpError(400, 'Payment decision must be approved or rejected.')
    }
    await updateState((state) => {
      const transaction = state.transactions.find(
        (item) => item.id === decodeURIComponent(paymentMatch[1]),
      )
      if (!transaction) throw new HttpError(404, 'Payment submission not found.')
      if (transaction.status !== 'pending') {
        throw new HttpError(409, 'Only pending payments can be reviewed.')
      }
      const driver = state.drivers.find((item) => item.userId === transaction.userId)
      if (!driver) throw new HttpError(404, 'Driver file not found.')
      const reviewedAt = new Date().toISOString()
      transaction.status = status === 'approved' ? 'successful' : 'failed'
      transaction.reviewedAt = reviewedAt
      transaction.reviewNote = typeof body.note === 'string' ? body.note.slice(0, 1000) : undefined
      if (status === 'approved') {
        driver.accessFeePaid = true
        driver.accessFeeAmount = transaction.amount
        driver.paymentMethod = transaction.method
        driver.paymentRef = transaction.reference
        driver.paidAt = reviewedAt
        driver.applicationStatus = 'pending'
      }
    })
    return sendHub(response, 200, user)
  }
  const requestApprovalMatch = path.match(/^\/api\/requests\/([^/]+)\/approval$/)
  if (request.method === 'PATCH' && requestApprovalMatch) {
    const user = await requireUser(request, 'admin')
    const body = await readBody(request)
    const status = requiredString(body.status, 'Request decision', 20)
    if (!['approved', 'rejected'].includes(status)) {
      throw new HttpError(400, 'Request decision must be approved or rejected.')
    }
    await updateState((state) => {
      const item = state.requests.find(
        (entry) => entry.id === decodeURIComponent(requestApprovalMatch[1]),
      )
      if (!item) throw new HttpError(404, 'Hire request not found.')
      if ((item.approvalStatus ?? 'approved') !== 'pending') {
        throw new HttpError(409, 'Only requests awaiting admin review can be decided.')
      }
      item.approvalStatus = status
      item.approvalNote = typeof body.note === 'string' ? body.note.slice(0, 1000) : undefined
      item.reviewedAt = new Date().toISOString()
      item.updatedAt = item.reviewedAt
    })
    return sendHub(response, 200, user)
  }
  const requestMatch = path.match(/^\/api\/requests\/([^/]+)$/)
  if (request.method === 'PATCH' && requestMatch) {
    const user = await requireUser(request)
    const body = await readBody(request)
    const status = requiredString(body.status, 'Request status', 20)
    const validStatuses = ['accepted', 'declined', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) throw new HttpError(400, 'Invalid request status.')
    await updateState((state) => {
      const item = state.requests.find((entry) => entry.id === decodeURIComponent(requestMatch[1]))
      if (!item) throw new HttpError(404, 'Hire request not found.')
      if (user.role === 'owner') {
        if (item.ownerId !== user.id || !['cancelled', 'completed'].includes(status)) {
          throw new HttpError(403, 'You cannot update this hire request.')
        }
        if (status === 'cancelled' && item.status !== 'pending') {
          throw new HttpError(409, 'Only pending requests can be cancelled.')
        }
        if (status === 'completed' && item.status !== 'accepted') {
          throw new HttpError(409, 'Only accepted requests can be completed.')
        }
      } else if (user.role === 'driver') {
        if ((item.approvalStatus ?? 'approved') !== 'approved') {
          throw new HttpError(403, 'This hire request is waiting for admin approval.')
        }
        const targetDriver = item.driverId || (status === 'accepted' ? user.id : undefined)
        if (!targetDriver || targetDriver !== user.id ||
          !['accepted', 'declined'].includes(status) || item.status !== 'pending') {
          throw new HttpError(403, 'You cannot update this hire request.')
        }
        item.driverId = user.id
      } else {
        throw new HttpError(403, 'You cannot update this hire request.')
      }
      item.status = status
      item.updatedAt = new Date().toISOString()
    })
    return sendHub(response, 200, user)
  }
  const applicationMatch = path.match(/^\/api\/applications\/([^/]+)$/)
  if (request.method === 'PATCH' && applicationMatch) {
    const user = await requireUser(request, 'admin')
    const body = await readBody(request)
    const status = requiredString(body.status, 'Application status', 20)
    if (!['approved', 'rejected'].includes(status)) {
      throw new HttpError(400, 'Application status must be approved or rejected.')
    }
    await updateState((state) => {
      const profile = state.drivers.find((item) => item.userId === decodeURIComponent(applicationMatch[1]))
      if (!profile) throw new HttpError(404, 'Driver application not found.')
      if (status === 'approved' && !profile.accessFeePaid) {
        throw new HttpError(409, 'The access fee must be paid before approval.')
      }
      profile.applicationStatus = status
      profile.applicationNote = typeof body.note === 'string' ? body.note.slice(0, 1000) : undefined
      profile.reviewedAt = new Date().toISOString()
    })
    return sendHub(response, 200, user)
  }
  if (request.method === 'POST' && path === '/api/demo/reset') {
    await requireUser(request, 'admin')
    if (!DEMO_MODE) throw new HttpError(404, 'Route not found.')
    const reset = await mutateHub((hub) => {
      if (!hub.initialState) throw new HttpError(503, 'The hub has not been initialized.')
      hub.state = hub.initialState
      hub.credentials = hub.initialCredentials
      hub.sessions = []
      hub.passwordResetTokens = []
    })
    if (reset === null) throw new HttpError(503, 'The hub has not been initialized.')
    await clearSession(request, response)
    return sendHub(response, 200)
  }
  throw new HttpError(404, 'Route not found.')
}

export async function handleApiRequest(request, response) {
  try {
    await connectDatabase()
    return await handle(request, response)
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500
    if (status === 500) console.error('API request failed:', error)
    if (!response.headersSent) {
      send(response, status, {
        error: status === 500 ? 'The server could not complete the request.' : error.message,
      })
    } else {
      response.destroy(error)
    }
  }
}

const port = Number(process.env.API_PORT || 3001)
const host = process.env.API_HOST || '127.0.0.1'

if (process.env.VERCEL !== '1') {
  const server = createServer((request, response) => {
    void handleApiRequest(request, response)
  })

  server.listen(port, host, () => {
    console.log(`DriverHub API listening on http://${host}:${port}`)
  })
}
