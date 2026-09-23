import React, { useState, useEffect, useRef } from "react";
import "../styles/login.css";
import { apiService } from '../lib/api-service';
import { useQueueSocket } from '../lib/useQueueSocket';

// ── Import images
import sfcLogo   from '../pictures/sfc-nobg-logo.png';
import sfcBanner from '../pictures/sfc-nobg-banner.png';
import sfcMain   from '../pictures/sfc-main.jpg';

const ROUTES_PER_PAGE = 2;
const ROTATE_INTERVAL_MS = 15000;

function PublicView() {
  const [queue,          setQueue]          = useState([]);
  const [loadingQueue,   setLoadingQueue]   = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [now,            setNow]            = useState(new Date());
  const [pageIndex,      setPageIndex]      = useState(0);
  const [pageVisible,    setPageVisible]    = useState(true);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    loadQueue();
    const handleScroll = () => setHeaderScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const clockTimer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // ── Core queue loader ──────────────────────────────────────────────────────
  // Hits the dedicated public queue endpoint (no login required) instead of
  // the authenticated /vehicles/ and /tickets/ endpoints — those 401 for an
  // unauthenticated visitor and the api-service's refresh/logout flow then
  // bounces this page to the login screen. The backend already returns
  // vehicles ordered earliest-queued-first, so index 0 within a route group
  // is the next to be dispatched.
  const loadQueue = async () => {
    // Only show the loading spinner on first mount — a websocket-triggered
    // refetch (e.g. a new vehicle joining the queue) should swap the table
    // data in place, not flash the whole board back to a loading state on
    // the terminal TV.
    if (!hasLoadedOnce.current) setLoadingQueue(true);
    try {
      const data = await apiService.get('/queue/');
      setQueue(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      hasLoadedOnce.current = true;
      setLoadingQueue(false);
    }
  };

  // Backend pushes a "queue_updated" ping whenever a vehicle/ticket
  // change affects the board, so we refetch immediately instead of
  // waiting for the next fallback poll.
  useQueueSocket(loadQueue);

  // ── Derived display data ───────────────────────────────────────────────────

  // Group by route → one table per route
  const queueGrouped = queue.reduce((acc, v) => {
    const key = v.route || 'No Route';
    if (!acc[key]) acc[key] = [];
    acc[key].push(v);
    return acc;
  }, {});
  const queueGroupEntries = Object.entries(queueGrouped);

  // Split the route tables into pages of ROUTES_PER_PAGE so the board can
  // rotate through them like a revolving belt instead of cramming every
  // route onto the screen at once.
  const pages = [];
  for (let i = 0; i < queueGroupEntries.length; i += ROUTES_PER_PAGE) {
    pages.push(queueGroupEntries.slice(i, i + ROUTES_PER_PAGE));
  }

  // Keep the current page in range when the route count shrinks/grows
  // (e.g. a route empties out and drops off the board).
  useEffect(() => {
    if (pageIndex >= pages.length) setPageIndex(0);
  }, [pages.length, pageIndex]);

  // Auto-advance the page on an interval, with a brief fade between pages.
  useEffect(() => {
    if (pages.length <= 1) return;
    const rotateTimer = setInterval(() => {
      setPageVisible(false);
      setTimeout(() => {
        setPageIndex((prev) => (prev + 1) % pages.length);
        setPageVisible(true);
      }, 250);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(rotateTimer);
  }, [pages.length]);

  const currentPage = pages[pageIndex] || [];

  return (
    <div className="lp-root" style={{ backgroundImage: `url(${sfcMain})` }}>

      {/* Background overlay */}
      <div className="lp-bg-overlay" />

      {/* ── HEADER ── */}
      <header className={`lp-header ${headerScrolled ? 'lp-header--scrolled' : ''}`}>
        <div className="lp-header__inner">
          <div className="lp-header__brand">
            <img src={sfcLogo} alt="SFC Logo" className="lp-header__logo" style={{ borderRadius: '40px' }} />
            <div className="lp-header__brand-text">
              <span className="lp-header__title">North Central Terminal</span>
              <span className="lp-header__sub">City Government of San Fernando</span>
            </div>
          </div>
          <div className="lp-header__clock">
            <span className="lp-header__clock-time">
              {now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="lp-header__clock-date">
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="lp-main">
        <div className="lp-container">

          {/* Page title bar */}
          <div className="lp-page-title">
            <div>
              <span className="lp-section-eyebrow">Live Updates</span>
              <h2 className="lp-section-title lp-section-title--light">Jeepney Queue Board</h2>
            </div>
          </div>

        
          {loadingQueue ? (
            <div className="lp-queue-card">
              <div className="lp-queue-loading">
                <div className="lp-spinner" />
                <p>Loading queue data…</p>
              </div>
            </div>
          ) : queueGroupEntries.length === 0 ? (
            <div className="lp-queue-card">
              <div className="lp-queue-empty">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.35">
                  <rect x="1" y="3" width="15" height="13" rx="1"/>
                  <path d="M16 8h4l3 3v5h-7V8z"/>
                  <circle cx="5.5" cy="18.5" r="2.5"/>
                  <circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
                <p>No vehicles in queue.</p>
              </div>
            </div>
          ) : (
            <>
              <div
                className="lp-carousel"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 20,
                  opacity: pageVisible ? 1 : 0,
                }}
              >
              {currentPage.map(([routeName, vehicles]) => (
                <div className="lp-queue-card" key={routeName}>
                  <div className="lp-route-label-wrap">
                    <div className="lp-route-label-badge lp-route-label-badge--active">
                      
                      {routeName}
                    </div>
                  </div>
                  <div className="lp-table-wrap">
                    <table className="lp-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Plate Number</th>
                          <th>Driver</th>
                          <th>Est. Departure</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicles.map((v, idx) => (
                          <tr key={v.id}>
                            <td className="lp-td--num">{idx + 1}</td>
                            <td><span className="lp-plate">{v.plate_number}</span></td>
                            <td>{v.driver || <span className="lp-na">Unassigned</span>}</td>
                            <td className="lp-td--time">
                              {idx === 0 && v.departure_time ? v.departure_time : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              </div>

              {pages.length > 1 && (
                <div className="lp-carousel-dots">
                  {pages.map((_, idx) => (
                    <span
                      key={idx}
                      className={`lp-carousel-dot ${idx === pageIndex ? 'lp-carousel-dot--active' : ''}`}
                    />
                  ))}
                </div>
              )}
            </>
          )}

        </div>
      </main>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-container lp-footer__inner">
          <div className="lp-footer__brand">
            <img src={sfcBanner} alt="San Fernando City Banner" className="lp-footer__banner" style={{ borderRadius: '100px' }} />
            <p className="lp-footer__desc">
              Serving the commuters of San Fernando City with organized, efficient, and transparent
              public transport management under the City Government of San Fernando, La Union.
            </p>
          </div>
          <div className="lp-footer__info">
            <h4 className="lp-footer__label">Location</h4>
            <address className="lp-footer__address">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Tanqui, San Fernando City, La Union
            </address>
            <h4 className="lp-footer__label" style={{ marginTop: 20 }}>System</h4>
            <p className="lp-footer__sys-name">North Central Terminal<br />Management System</p>
          </div>
        </div>
        <div className="lp-footer__bottom">
          <span>© {new Date().getFullYear()} City Government of San Fernando, La Union. All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}

export default PublicView;
