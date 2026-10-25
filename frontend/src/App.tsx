import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { BrowseDrivers } from './pages/BrowseDrivers'
import { Dashboard } from './pages/Dashboard'
import { DriverProfile } from './pages/DriverProfile'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { RequestPasswordReset, ResetPassword } from './pages/PasswordRecovery'
import { RegisterDriver } from './pages/RegisterDriver'
import { RegisterOwner } from './pages/RegisterOwner'
import { RequestDriver } from './pages/RequestDriver'
import { HubProvider } from './store/HubContext'

export default function App() {
  return (
    <HubProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/drivers" element={<BrowseDrivers />} />
            <Route path="/drivers/:id" element={<DriverProfile />} />
            <Route path="/request" element={<RequestDriver />} />
            <Route path="/join-driver" element={<RegisterDriver />} />
            <Route path="/join-owner" element={<RegisterOwner />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<RequestPasswordReset />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </HubProvider>
  )
}

function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brick">404 · Page not found</p>
      <h1 className="mt-3 font-display text-4xl">We couldn’t find that page.</h1>
      <p className="mt-3 text-muted">The link may be outdated, or the address may have a typo.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-gold">Back to home</Link>
        <Link to="/drivers" className="btn-ghost">Browse drivers</Link>
      </div>
    </main>
  )
}
