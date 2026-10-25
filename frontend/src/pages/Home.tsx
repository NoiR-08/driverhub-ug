import { Link } from 'react-router-dom'
import { DriverCard } from '../components/DriverCard'
import { useHub } from '../store/HubContext'

export function Home() {
  const { approvedDrivers, isLoading } = useHub()
  const featured = approvedDrivers.slice(0, 3)
  const featuredDriver = featured[0]

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-eyebrow">
            <span className="home-eyebrow-mark" aria-hidden="true" />
            Uganda's driver marketplace
          </p>
          <h1 className="home-title">
            Find a driver who feels like the <span>right fit.</span>
          </h1>
          <p className="home-intro">
            Thoughtful driver profiles. Real road experience. A simpler way to find the
            person you trust with your journey.
          </p>
          <div className="home-actions">
            <Link to="/drivers" className="btn-gold">
              Explore drivers <span aria-hidden="true">→</span>
            </Link>
            <Link to="/request" className="home-text-link">
              Tell us what you need <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="home-assurances" aria-label="About DriverHub">
            <span><span aria-hidden="true">✓</span> Profiles reviewed</span>
            <span><span aria-hidden="true">✓</span> Experience up front</span>
            <span><span aria-hidden="true">✓</span> Built for Uganda</span>
          </div>
        </div>

        <div className="home-hero-visual">
          <div className="home-visual-heading">
            <span>GOOD JOURNEYS START HERE</span>
            <span className="home-live-indicator"><i /> DRIVERHUB UG</span>
          </div>
          <svg className="home-route-map" viewBox="0 0 560 400" fill="none" aria-hidden="true">
            <path className="home-map-line" d="M-30 322C58 301 72 228 156 236c72 7 64 91 146 73 63-14 45-102 112-122 54-17 79 2 177-40" />
            <path className="home-map-line home-map-line-muted" d="M-15 144c75 12 88 85 166 63s82-88 155-56 68 82 119 53 59-89 154-94" />
            <path className="home-map-line home-map-line-muted" d="M77 420c-8-62 33-98 21-151s-49-66-44-130 51-75 45-151" />
            <path className="home-map-line home-map-line-muted" d="M354 423c14-61 61-76 56-142s-43-95-11-147 62-56 64-155" />
            <path className="home-route-highlight" d="M-30 322C58 301 72 228 156 236c72 7 64 91 146 73 63-14 45-102 112-122" />
            <circle className="home-map-stop" cx="156" cy="236" r="8" />
            <circle className="home-map-stop home-map-stop-end" cx="414" cy="187" r="8" />
          </svg>
          <span className="home-map-label home-map-label-one">KAMPALA</span>
          <span className="home-map-label home-map-label-two">EN ROUTE</span>
          <div className="home-profile-card">
            <div className="home-profile-topline">
              <span>THE RIGHT FIT</span>
              {featuredDriver ? (
                <span className="home-rating"><span aria-hidden="true">★</span> {featuredDriver.rating.toFixed(1)}</span>
              ) : (
                <span>LOCAL HIRE, THOUGHTFULLY DONE</span>
              )}
            </div>
            {featuredDriver ? (
              <>
                <div className="home-profile-details">
                  <span className="home-avatar" style={{ background: featuredDriver.accent }}>
                    {featuredDriver.initials}
                  </span>
                  <div>
                    <strong>{featuredDriver.user.name}</strong>
                    <span>{featuredDriver.baseLocation} · {featuredDriver.yearsOnRoad} years on road</span>
                  </div>
                </div>
                <Link to={`/drivers/${featuredDriver.userId}`} className="home-profile-link">
                  View profile <span aria-hidden="true">→</span>
                </Link>
              </>
            ) : (
              <div className="home-profile-details home-profile-message">
                <span className="home-avatar home-avatar-monogram" aria-hidden="true">DH</span>
                <div>
                  <strong>Good people. Better journeys.</strong>
                  <span>Meet drivers with experience you can explore.</span>
                </div>
              </div>
            )}
          </div>
          <div className="home-visual-stamp" aria-hidden="true">
            <span>YOUR NEXT</span>
            <strong>great<br />journey</strong>
            <span>STARTS HERE</span>
          </div>
        </div>
      </section>

      <section className="home-benefits" aria-label="The DriverHub difference">
        <div className="home-benefit">
          <span className="home-benefit-number">01</span>
          <div><h2>People, not guesswork</h2><p>Get to know a driver's experience before you reach out.</p></div>
        </div>
        <div className="home-benefit">
          <span className="home-benefit-number">02</span>
          <div><h2>Details that matter</h2><p>Compare routes, vehicle experience, languages and more.</p></div>
        </div>
        <div className="home-benefit">
          <span className="home-benefit-number">03</span>
          <div><h2>Your journey, your choice</h2><p>Choose a driver or share what kind of hire you need.</p></div>
        </div>
      </section>

      <section className="home-featured">
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">A good place to start</p>
            <h2>Meet drivers on the hub</h2>
            <p>Explore reviewed profiles and find the experience that fits your plans.</p>
          </div>
          <Link to="/drivers" className="home-outline-link">
            Browse all drivers <span aria-hidden="true">→</span>
          </Link>
        </div>
        {featured.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((driver) => (
              <DriverCard key={driver.userId} driver={driver} />
            ))}
          </div>
        ) : (
          <div className="home-empty-state" role="status">
            <span className="home-empty-mark" aria-hidden="true">DH</span>
            <div>
              <h3>{isLoading ? 'Finding drivers for you…' : 'New driver profiles are on their way.'}</h3>
              <p>
                {isLoading
                  ? 'We’re getting the latest reviewed profiles.'
                  : 'Browse the hub to see available drivers, or tell us what kind of hire you need.'}
              </p>
            </div>
            {!isLoading && <Link to="/request" className="home-text-link">Request a driver <span aria-hidden="true">→</span></Link>}
          </div>
        )}
      </section>

      <section className="home-join">
        <div className="home-join-copy">
          <p className="home-section-kicker">For professional drivers</p>
          <h2>Good at what you do? Let the right people find you.</h2>
          <p>Build a profile around your experience, routes and specialties, then apply to join the hub.</p>
        </div>
        <Link to="/join-driver" className="home-join-link">
          Join as a driver <span aria-hidden="true">→</span>
        </Link>
        <span className="home-join-decoration" aria-hidden="true">DH</span>
      </section>
    </main>
  )
}
