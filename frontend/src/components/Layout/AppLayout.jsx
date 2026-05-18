import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../../store/authStore.js'

// Octopus-like SVG glyph for brand
function OctGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="6" stroke="#b89968" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="2" fill="#b89968" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180
        const x1 = 14 + 6 * Math.cos(rad)
        const y1 = 14 + 6 * Math.sin(rad)
        const x2 = 14 + 13 * Math.cos(rad)
        const y2 = 14 + 13 * Math.sin(rad)
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3d2e1a" strokeWidth="1.5" />
        )
      })}
    </svg>
  )
}

function getBreadcrumb(pathname) {
  if (pathname.startsWith('/table/')) return ['сесії', 'стіл']
  if (pathname.startsWith('/sessions/')) return ['сесії', 'лобі']
  if (pathname === '/sessions') return ['сесії']
  if (pathname.startsWith('/characters/')) return ['дослідники', 'картка']
  if (pathname === '/characters') return ['дослідники']
  if (pathname === '/profile') return ['профіль']
  return []
}

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const crumbs = getBreadcrumb(location.pathname)

  return (
    <div className="shell">
      <nav className="nav">
        <div className="nav__brand" onClick={() => navigate('/sessions')}>
          <div className="nav__brand-mark">
            <OctGlyph />
            <div>
              <div className="nav__brand-title">Cthulhu Case</div>
              <div className="nav__brand-sub">Архів Аркгему</div>
            </div>
          </div>
        </div>

        <div className="nav__section-label">Навігація</div>

        <NavLink
          to="/sessions"
          className={({ isActive }) =>
            'nav__item' + (isActive ? ' nav__item--active' : '')
          }
        >
          <span className="nav__item-num">i</span>
          <span>Вестибюль</span>
        </NavLink>

        <NavLink
          to="/characters"
          className={({ isActive }) =>
            'nav__item' + (isActive ? ' nav__item--active' : '')
          }
        >
          <span className="nav__item-num">ii</span>
          <span>Дослідники</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            'nav__item' + (isActive ? ' nav__item--active' : '')
          }
        >
          <span className="nav__item-num">iii</span>
          <span>Профіль</span>
        </NavLink>

        <div className="nav__foot">
          <div className="nav__foot-row">
            <span>Фаза II</span>
            <span style={{ color: 'var(--ochre-dim)' }}>Реліз</span>
          </div>
          <div className="nav__foot-row">
            <span>CoC 7e</span>
            <span style={{ color: 'var(--ochre-dim)' }}>2024</span>
          </div>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <div className="topbar__crumb">
            <span style={{ color: 'var(--ochre-dim)' }}>Аркгем</span>
            {crumbs.map((c, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="sep">/</span>
                <span style={{ color: i === crumbs.length - 1 ? 'var(--cream)' : 'var(--moss-pale)' }}>
                  {c}
                </span>
              </span>
            ))}
          </div>
          <div className="topbar__actions">
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.14em',
                color: 'var(--ochre)',
              }}
            >
              {user?.username ?? '—'}
            </span>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  )
}
