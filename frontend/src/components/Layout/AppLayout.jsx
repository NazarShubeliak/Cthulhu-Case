import { useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '../../store/authStore.js'
import useUIStore from '../../store/uiStore.js'
import CursorLamp from '../UI/CursorLamp.jsx'
import GlitchText from '../UI/GlitchText.jsx'

const NAV_ITEMS = [
  { to: '/sessions',    num: 'i',   label: 'Вестибюль', latin: 'Vestibulum' },
  { to: '/characters',  num: 'ii',  label: 'Дослідники', latin: 'Investigatores' },
  { to: '/profile',     num: 'iii', label: 'Профіль',   latin: 'Persona' },
  { to: '/story-editor',num: 'iv',  label: 'Сюжет',     latin: 'Fabula' },
]

function SigilGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="0.9" style={{ color: 'var(--ochre)' }}>
      <circle cx="20" cy="20" r="17" />
      <circle cx="20" cy="20" r="13" />
      <path d="M20 3 v6 M20 31 v6 M3 20 h6 M31 20 h6" />
      <path d="M20 7 L26 20 L20 33 L14 20 Z" />
      <path d="M7 20 L20 14 L33 20 L20 26 Z" />
      <circle cx="20" cy="20" r="2.5" fill="currentColor" />
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
  if (pathname === '/story-editor') return ['сюжет']
  return []
}

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const crumbs = getBreadcrumb(location.pathname)
  const { grain, showLatin } = useUIStore()

  useEffect(() => {
    document.documentElement.style.setProperty('--grain-opacity', grain ? '0.07' : '0')
  }, [grain])

  return (
    <>
      <CursorLamp />
      <div className="shell">
        <nav className="nav">
          <div className="nav__brand" onClick={() => navigate('/sessions')} style={{ cursor: 'pointer' }}>
            <div className="nav__brand-mark">
              <SigilGlyph />
              <div>
                <div className="nav__brand-title" style={{ fontStyle: 'italic' }}>
                  <GlitchText>Поклик</GlitchText>
                </div>
                <div className="nav__brand-title">
                  <GlitchText>Ктулху</GlitchText>
                </div>
              </div>
            </div>
            <div className="nav__brand-sub">архів аркгему · est. mcmxxvi</div>
          </div>

          <div className="nav__section-label">Навігація</div>

          {NAV_ITEMS.map(({ to, num, label, latin }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => 'nav__item' + (isActive ? ' nav__item--active' : '')}
            >
              <span className="nav__item-num">{num}</span>
              <span className="nav__item-label">
                <GlitchText>{label}</GlitchText>
                {showLatin && (
                  <span className="nav__item-latin">{latin}</span>
                )}
              </span>
            </NavLink>
          ))}

          <div className="nav__foot">
            <div className="nav__foot-row">
              <span>CoC 7e</span>
              <span style={{ color: 'var(--ochre-dim)' }}>mcmxxvi</span>
            </div>
            <div className="nav__foot-row">
              <span>Фаза II</span>
              <span style={{ color: 'var(--blood)', fontSize: 10 }}>●</span>
            </div>
          </div>
        </nav>

        <div className="main">
          <header className="topbar">
            <div className="topbar__crumb">
              <span style={{ color: 'var(--ochre-dim)' }}>Аркгем</span>
              {crumbs.map((c, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="sep" style={{ color: 'var(--ochre-deep)' }}>∴</span>
                  <span style={{ color: i === crumbs.length - 1 ? 'var(--cream)' : 'var(--moss-pale)' }}>
                    {c}
                  </span>
                </span>
              ))}
            </div>
            <div className="topbar__actions">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.14em', color: 'var(--ochre)' }}>
                {user?.username ?? '—'}
              </span>
            </div>
          </header>

          <Outlet />
        </div>
      </div>
    </>
  )
}
