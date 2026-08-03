import { useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore.js'
import useUIStore from '../../store/uiStore.js'
import CursorLamp from '../UI/CursorLamp.jsx'
import GlitchText from '../UI/GlitchText.jsx'

function getNavItems(t) {
  return [
    { to: '/sessions',    num: 'I',   label: t('nav.vestibule'),   latin: 'Vestibulum' },
    { to: '/characters',  num: 'II',  label: t('nav.investigators'), latin: 'Investigatores' },
    { to: '/profile',     num: 'III', label: t('nav.profile'),     latin: 'Persona' },
    { to: '/story-editor',num: 'IV',  label: t('nav.story'),       latin: 'Fabula' },
  ]
}

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

function getBreadcrumb(pathname, t) {
  if (pathname.startsWith('/table/')) return [t('breadcrumb.sessions'), t('breadcrumb.table')]
  if (pathname.startsWith('/sessions/')) return [t('breadcrumb.sessions'), t('breadcrumb.lobby')]
  if (pathname === '/sessions') return [t('breadcrumb.sessions')]
  if (pathname.startsWith('/characters/')) return [t('breadcrumb.investigators'), t('breadcrumb.card')]
  if (pathname === '/characters') return [t('breadcrumb.investigators')]
  if (pathname === '/profile') return [t('breadcrumb.profile')]
  if (pathname === '/story-editor') return [t('breadcrumb.story')]
  return []
}

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const crumbs = getBreadcrumb(location.pathname, t)
  const { grain, showLatin, lang, theme, fontSize, sidebarHidden, toggleSidebar } = useUIStore()

  useEffect(() => {
    document.documentElement.style.setProperty('--grain-opacity', grain ? '0.07' : '0')
  }, [grain])

  useEffect(() => {
    if (i18n.language !== lang) i18n.changeLanguage(lang)
  }, [lang, i18n])

  useEffect(() => {
    document.body.classList.toggle('theme-light', theme === 'light')
  }, [theme])

  useEffect(() => {
    document.documentElement.classList.remove('font-sm', 'font-md', 'font-lg')
    document.documentElement.classList.add(`font-${fontSize}`)
  }, [fontSize])

  const NAV_ITEMS = getNavItems(t)

  return (
    <>
      <CursorLamp />
      <div className="shell">
        {!sidebarHidden && (
        <nav className="nav">
          <div className="nav__brand" onClick={() => navigate('/sessions')} style={{ cursor: 'pointer' }}>
            <div className="nav__brand-mark">
              <SigilGlyph />
              <div>
                <div className="nav__brand-title" style={{ fontStyle: 'italic' }}>
                  <GlitchText>{t('nav.title1')}</GlitchText>
                </div>
                <div className="nav__brand-title">
                  <GlitchText>{t('nav.title2')}</GlitchText>
                </div>
              </div>
            </div>
            <div className="nav__brand-sub">{t('nav.sub')}</div>
          </div>

          <div className="nav__section-label">{t('nav.navigation')}</div>

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
              <span>{t('nav.phaseII')}</span>
              <span style={{ color: 'var(--blood)', fontSize: 10 }}>●</span>
            </div>
          </div>
        </nav>
        )}

        <div className="main">
          <header className="topbar">
            <div className="topbar__crumb">
              <span style={{ color: 'var(--ochre-dim)' }}>{t('breadcrumb.arkham')}</span>
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
              <button
                type="button"
                className="topbar__sidebar-toggle"
                onClick={toggleSidebar}
                title={sidebarHidden ? t('nav.showSidebar') : t('nav.hideSidebar')}
                aria-label={sidebarHidden ? t('nav.showSidebar') : t('nav.hideSidebar')}
              >
                {sidebarHidden ? '☰' : '⟨⟩'}
              </button>
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
