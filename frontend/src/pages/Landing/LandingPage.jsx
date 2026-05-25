import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useUIStore from '../../store/uiStore.js'
import GlitchText from '../../components/UI/GlitchText.jsx'
import CursorLamp from '../../components/UI/CursorLamp.jsx'

function SigilOrb() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none"
      stroke="currentColor" strokeWidth="0.7"
      style={{ color: 'var(--ochre)' }}>
      <circle cx="32" cy="32" r="28" />
      <circle cx="32" cy="32" r="22" />
      <path d="M32 4 v8 M32 52 v8 M4 32 h8 M52 32 h8" />
      <path d="M32 10 L46 32 L32 54 L18 32 Z" />
      <path d="M14 32 L32 22 L50 32 L32 42 Z" />
      <circle cx="32" cy="32" r="3" fill="currentColor" />
    </svg>
  )
}

function Rule({ glyph = '✦ ✦ ✦' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      color: 'var(--ochre-dim)',
    }}>
      <div style={{ flex: 1, height: 1, background: 'var(--ochre-deep)' }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        letterSpacing: '0.32em', color: 'var(--ochre)',
      }}>{glyph}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--ochre-deep)' }} />
    </div>
  )
}

const SECTIONS = [
  { id: 'investigators', num: 'I',   to: '/characters', iconPath: 'M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2zM4 16v3a2 2 0 0 0 2 2', latin: 'Investigatores' },
  { id: 'sessions',      num: 'II',  to: '/sessions',   iconPath: 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-7h6v7',                                                           latin: 'Vestibulum'   },
  { id: 'table',         num: 'III', to: '/sessions',   iconPath: 'M12 4v3M12 17v3M4 12h3M17 12h3M12 4c0 0 3 4 0 8s0 5 0 5',                                          latin: 'Mensa Vera'   },
  { id: 'story',         num: 'IV',  to: '/story-editor',iconPath: 'M20 4c-6 0-12 6-12 12v4l-4-4M20 4l-9 9M20 4c0 6-6 12-12 12',                                      latin: 'Fabula'       },
]

function SectionIcon({ path }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.3"
      strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  )
}

function ContentsCell({ section, titleKey, subKey, onClick }) {
  const { t } = useTranslation()
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? 'var(--ink-2)' : 'var(--ink-1)',
        border: 'none',
        padding: '32px 28px',
        textAlign: 'left',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 14,
        minHeight: 180,
        transition: 'background 0.25s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          letterSpacing: '0.32em', color: 'var(--ochre)',
        }}>№ {section.num}</span>
        <span style={{ color: 'var(--ochre-dim)' }}>
          <SectionIcon path={section.iconPath} />
        </span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 24,
          fontStyle: 'italic', color: 'var(--cream)', lineHeight: 1.1,
        }}>{t(titleKey)}</div>
        <div style={{
          marginTop: 4,
          fontFamily: 'var(--font-display)', fontSize: 14,
          fontStyle: 'italic', color: 'var(--moss-pale)',
        }}>{section.latin}</div>
      </div>
      <div style={{
        fontSize: 13, color: 'var(--cream-soft)',
        borderTop: '1px solid var(--ochre-deep)',
        paddingTop: 12,
        fontStyle: 'italic',
      }}>{t(subKey)}</div>
    </button>
  )
}

export default function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lamp, grain, showLatin } = useUIStore()
  const [scrollY, setScrollY] = useState(0)

  useEffect(() => {
    document.documentElement.style.setProperty('--grain-opacity', grain ? '0.07' : '0')
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [grain])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-1)' }}>
      {lamp && <CursorLamp />}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 28px' }}>

        {/* ── HERO ── */}
        <section style={{
          position: 'relative',
          padding: '70px 0 60px',
          minHeight: '78vh',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', top: 60, left: '50%',
            transform: 'translateX(-50%)',
          }}>
            <SigilOrb />
          </div>

          <div style={{ textAlign: 'center', marginTop: 110 }}>
            {showLatin && (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 13,
                letterSpacing: '0.18em', textTransform: 'uppercase',
                marginBottom: 30, opacity: 0.65,
                color: 'var(--ochre-dim)',
              }}>
                {t('landing.latin')}
              </div>
            )}

            <h1 style={{
              fontSize: 'clamp(64px, 10vw, 128px)',
              lineHeight: 0.92,
              letterSpacing: '-0.03em',
              fontStyle: 'italic',
              fontWeight: 400,
              color: 'var(--cream)',
              marginBottom: 8,
            }}>
              <GlitchText>{t('landing.title1')}</GlitchText>
            </h1>
            <h1 style={{
              fontSize: 'clamp(64px, 10vw, 128px)',
              lineHeight: 0.92,
              letterSpacing: '-0.03em',
              fontWeight: 400,
              color: 'var(--ochre-bright)',
              marginBottom: 40,
            }}>
              <GlitchText>{t('landing.title2')}</GlitchText>
            </h1>

            <Rule glyph="✦ · ✦ · ✦" />

            <p style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 'clamp(20px, 2.2vw, 28px)',
              color: 'var(--cream-soft)',
              maxWidth: '44ch',
              margin: '30px auto 0',
              lineHeight: 1.4,
            }}>
              {t('landing.tagline')}
            </p>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 44 }}>
              <button
                onClick={() => navigate('/login')}
                style={{
                  padding: '12px 28px',
                  background: 'var(--ochre)',
                  color: 'var(--ink-0)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  border: '1px solid var(--ochre)',
                  cursor: 'pointer',
                }}
              >
                {t('landing.enterBtn')}
              </button>
              <button
                onClick={() => navigate('/register')}
                style={{
                  padding: '12px 28px',
                  background: 'transparent',
                  color: 'var(--ochre)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  border: '1px solid var(--ochre-deep)',
                  cursor: 'pointer',
                }}
              >
                {t('landing.createBtn')}
              </button>
            </div>

            <div style={{
              marginTop: 60,
              fontFamily: 'var(--font-mono)', fontSize: 10,
              letterSpacing: '0.24em', color: 'var(--moss)',
              textTransform: 'uppercase',
            }}>
              {t('landing.scrollHint')}
            </div>
          </div>
        </section>

        {/* ── EPIGRAPH ── */}
        <section style={{
          padding: '70px 0',
          textAlign: 'center',
          position: 'relative',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 'clamp(22px, 2.6vw, 36px)',
            lineHeight: 1.4,
            color: 'var(--cream-soft)',
            maxWidth: '32ch',
            margin: '0 auto',
          }}>
            {t('landing.quoteText')}
          </div>
          <div style={{
            marginTop: 28,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'var(--ochre-dim)',
          }}>
            {t('landing.quoteSource')}
          </div>

          {/* floating ink stain */}
          <div style={{
            position: 'absolute',
            top: 40, right: '12%',
            width: 160, height: 140,
            opacity: Math.min(0.4, scrollY / 1800),
            pointerEvents: 'none',
          }}>
            <svg viewBox="0 0 160 140" fill="#1a0e0a">
              <path d="M40 30 Q20 60 30 90 Q40 110 70 105 Q100 120 120 90 Q140 50 110 35 Q80 20 40 30 Z" opacity="0.5" />
              <ellipse cx="50" cy="100" rx="10" ry="3" opacity="0.3" />
              <ellipse cx="130" cy="60" rx="6" ry="2" opacity="0.3" />
            </svg>
          </div>
        </section>

        {/* ── CONTENTS ── */}
        <section style={{ padding: '60px 0' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            letterSpacing: '0.32em', textTransform: 'uppercase',
            color: 'var(--ochre)', textAlign: 'center', marginBottom: 24,
          }}>
            {t('landing.contentsEyebrow')}
          </div>
          <h2 style={{
            fontSize: 'clamp(36px, 4.5vw, 52px)',
            textAlign: 'center',
            fontStyle: 'italic',
            marginBottom: 60,
          }}>
            {t('landing.contentsTitle')}
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 1,
            background: 'var(--ochre-deep)',
            border: '1px solid var(--ochre-deep)',
          }}>
            {SECTIONS.map(s => (
              <ContentsCell
                key={s.id}
                section={s}
                titleKey={`landing.section${s.id.charAt(0).toUpperCase() + s.id.slice(1)}`}
                subKey={`landing.section${s.id.charAt(0).toUpperCase() + s.id.slice(1)}Sub`}
                onClick={() => navigate(s.to)}
              />
            ))}
          </div>
        </section>

        {/* ── FOOTER ── */}
        <section style={{ padding: '60px 0 20px' }}>
          <Rule glyph="ω · α" />
          <div style={{
            textAlign: 'center', marginTop: 40,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'var(--moss)',
            lineHeight: 2,
          }}>
            {t('landing.footer')}<br />
            {t('landing.footerYears')}
          </div>
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button
              onClick={() => navigate('/about')}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                letterSpacing: '0.24em', textTransform: 'uppercase',
                color: 'var(--ochre-dim)', cursor: 'pointer',
                background: 'none', border: 'none', padding: 0,
              }}
            >
              tntr · taver near the river
            </button>
          </div>
        </section>

      </div>
    </div>
  )
}
