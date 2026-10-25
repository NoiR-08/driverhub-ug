import { Link, NavLink, Outlet } from 'react-router-dom'
import { formatUgx, ACCESS_FEE } from '../lib/format'
import { useHub } from '../store/HubContext'

export function Layout() {
  const { currentUser, logout } = useHub()

  return (
    <div className="min-h-svh">
      <header className="site-header sticky top-0 z-20">
        <div className="site-ribbon">
          <div className="site-ribbon-inner mx-auto flex max-w-7xl items-center justify-between gap-4 px-4">
            <p><span className="site-ribbon-dot" /> Uganda's people-first driver marketplace</p>
            <p className="site-ribbon-location">Private hire · Kampala and beyond</p>
          </div>
        </div>
        <div className="site-header-main mx-auto flex max-w-7xl items-center justify-between gap-5 px-4">
          <Link to="/" className="site-brand no-underline text-ink">
            <span className="site-brand-mark" aria-hidden="true">DH</span>
            <span className="site-brand-copy">
              <span className="site-brand-name">DriverHub <span>Ug</span></span>
              <span className="site-brand-note">Owners · Drivers · Hire</span>
            </span>
          </Link>
          <nav aria-label="Main navigation" className="site-nav hidden items-center gap-1 md:flex">
            <NavLink className={navClass} to="/drivers">
              Browse drivers
            </NavLink>
            <NavLink className={navClass} to="/request">
              Hire a driver
            </NavLink>
            <NavLink className={navClass} to="/join-driver">
              Drive with us
            </NavLink>
          </nav>
          <div className="site-actions flex items-center gap-2">
            {currentUser ? (
              <>
                <Link to="/dashboard" className="btn-ghost py-2 text-sm">
                  My desk
                </Link>
                <button type="button" className="btn-dark py-2 text-sm" onClick={logout}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="site-sign-in btn-ghost py-2 text-sm">
                  Sign in
                </Link>
                <Link to="/join-owner" className="btn-gold py-2 text-sm">
                  Find a driver
                </Link>
              </>
            )}
          </div>
        </div>
        <nav aria-label="Mobile navigation" className="site-mobile-nav flex gap-2 overflow-x-auto px-4 md:hidden">
          <NavLink className={navClass} to="/drivers">
            Browse drivers
          </NavLink>
          <NavLink className={navClass} to="/request">
            Hire a driver
          </NavLink>
          <NavLink className={navClass} to="/join-driver">
            Drive with us
          </NavLink>
          {!currentUser && (
            <NavLink className={navClass} to="/login">
              Sign in
            </NavLink>
          )}
        </nav>
        <div className="site-header-rule" />
      </header>
      <Outlet />
      <footer className="site-footer mt-16">
        <section className="site-footer-lead">
          <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 px-4 py-10 md:py-12">
            <div className="max-w-2xl">
              <p className="site-footer-kicker">Good people. Better journeys.</p>
              <h2 className="site-footer-heading">Your next great driver is closer than you think.</h2>
              <p className="site-footer-intro">Compare experience, routes, and specialties, then make the connection that fits your journey.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/drivers" className="btn-gold">Browse drivers</Link>
              <Link to="/join-driver" className="site-footer-secondary">Join the hub</Link>
            </div>
          </div>
        </section>
        <div className="site-footer-content mx-auto grid max-w-7xl gap-9 px-4 py-10 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_0.8fr_1.2fr]">
          <div>
            <Link to="/" className="site-footer-brand no-underline">
              <span className="site-footer-mark" aria-hidden="true">DH</span>
              <span className="font-display text-2xl">DriverHub Ug</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-cream/70">A local home for drivers and the people who hire them, built around experience you can see.</p>
          </div>
          <div className="site-footer-links">
            <p className="site-footer-label">For owners</p>
            <Link to="/drivers">Browse drivers</Link>
            <Link to="/request">Request a driver</Link>
            <Link to="/join-owner">Create an owner account</Link>
          </div>
          <div className="site-footer-links">
            <p className="site-footer-label">For drivers</p>
            <Link to="/join-driver">Join as a driver</Link>
            <Link to="/login">Sign in to your desk</Link>
            <p className="site-footer-small">Listing access fee: {formatUgx(ACCESS_FEE)}</p>
          </div>
          <div>
            <p className="site-footer-label">Across Uganda</p>
            <p className="site-footer-places">Kampala <span>Entebbe</span> <span>Jinja</span> <span>Mbarara</span> <span>Gulu</span> <span>Mbale</span></p>
            <p className="site-footer-small mt-4">Drivers are reviewed before they appear in browse results.</p>
          </div>
        </div>
        <div className="site-footer-bottom mx-auto flex max-w-7xl flex-wrap justify-between gap-2 px-4 py-4">
          <p>DriverHub Ug <span>·</span> Built for Uganda's roads</p>
          <Link to="/login">Hub member sign in</Link>
        </div>
      </footer>
    </div>
  )
}

function navClass({ isActive }: { isActive: boolean }) {
  return `site-nav-link shrink-0 rounded-full px-3 py-2 text-sm no-underline ${
    isActive ? 'is-active' : ''
  }`
}
