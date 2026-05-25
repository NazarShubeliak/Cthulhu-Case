import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useUIStore from '../../store/uiStore.js'
import GlitchText from '../../components/UI/GlitchText.jsx'
import CursorLamp from '../../components/UI/CursorLamp.jsx'

function Rule() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ flex: 1, height: 1, background: 'var(--ochre-deep)' }} />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        letterSpacing: '0.32em', color: 'var(--ochre)',
      }}>✦ · ✦ · ✦</span>
      <div style={{ flex: 1, height: 1, background: 'var(--ochre-deep)' }} />
    </div>
  )
}

function Eyebrow({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 11,
      letterSpacing: '0.32em', textTransform: 'uppercase',
      color: 'var(--ochre)', marginBottom: 14,
    }}>{children}</div>
  )
}

const PILLARS = ['1', '2', '3']

export default function AboutPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lamp, grain } = useUIStore()

  useEffect(() => {
    document.documentElement.style.setProperty('--grain-opacity', grain ? '0.07' : '0')
  }, [grain])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink-1)' }}>
      {lamp && <CursorLamp />}

      {/* top bar */}
      <div style={{
        borderBottom: '1px solid var(--ochre-deep)',
        padding: '18px 28px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            letterSpacing: '0.24em', textTransform: 'uppercase',
            color: 'var(--ochre)', cursor: 'pointer',
            background: 'none', border: 'none', padding: 0,
          }}
        >
          {t('about.backToArchive')}
        </button>
        <div style={{ flex: 1 }} />
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          letterSpacing: '0.24em', textTransform: 'uppercase',
          color: 'var(--moss)',
        }}>
          {t('about.eyebrow')}
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 28px 80px' }}>

        {/* ── HERO ── */}
        <section style={{
          padding: '80px 0 60px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center',
        }}>
          {/* sigil */}
          <svg width="48" height="48" viewBox="0 0 40 40" fill="none"
            stroke="currentColor" strokeWidth="0.9"
            style={{ color: 'var(--ochre)', marginBottom: 32 }}>
            <circle cx="20" cy="20" r="17" />
            <circle cx="20" cy="20" r="13" />
            <path d="M20 3 v6 M20 31 v6 M3 20 h6 M31 20 h6" />
            <path d="M20 7 L26 20 L20 33 L14 20 Z" />
            <path d="M7 20 L20 14 L33 20 L20 26 Z" />
            <circle cx="20" cy="20" r="2.5" fill="currentColor" />
          </svg>

          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 13,
            letterSpacing: '0.36em', textTransform: 'uppercase',
            color: 'var(--ochre)', marginBottom: 16,
          }}>
            {t('about.titleSub')}
          </div>

          <h1 style={{
            fontSize: 'clamp(48px, 7vw, 96px)',
            lineHeight: 0.95,
            letterSpacing: '-0.03em',
            fontStyle: 'italic',
            fontWeight: 400,
            color: 'var(--cream)',
            marginBottom: 28,
          }}>
            <GlitchText>{t('about.title')}</GlitchText>
          </h1>

          <p style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 'clamp(18px, 2vw, 24px)',
            color: 'var(--cream-soft)',
            maxWidth: '48ch',
            lineHeight: 1.5,
          }}>
            {t('about.sub')}
          </p>
        </section>

        <Rule />

        {/* ── MISSION ── */}
        <section style={{ padding: '72px 0' }}>
          <div style={{ maxWidth: 680 }}>
            <Eyebrow>{t('about.missionEyebrow')}</Eyebrow>
            <h2 style={{
              fontSize: 'clamp(32px, 4vw, 48px)',
              fontStyle: 'italic',
              lineHeight: 1.1,
              marginBottom: 28,
            }}>
              {t('about.missionTitle')}
            </h2>
            <p style={{
              fontSize: 17,
              lineHeight: 1.75,
              color: 'var(--cream-soft)',
            }}>
              {t('about.missionText')}
            </p>
          </div>
        </section>

        {/* ── PILLARS ── */}
        <section style={{ padding: '20px 0 72px' }}>
          <Eyebrow>{t('about.pillarsEyebrow')}</Eyebrow>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 1,
            background: 'var(--ochre-deep)',
            border: '1px solid var(--ochre-deep)',
          }}>
            {PILLARS.map(n => (
              <div key={n} style={{
                background: 'var(--ink-1)',
                padding: '32px 28px',
              }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  letterSpacing: '0.32em', color: 'var(--ochre)',
                  marginBottom: 16,
                }}>
                  № {n === '1' ? 'I' : n === '2' ? 'II' : 'III'}
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 22,
                  fontStyle: 'italic', color: 'var(--cream)',
                  marginBottom: 10, lineHeight: 1.15,
                }}>
                  {t(`about.pillar${n}Title`)}
                </div>
                <div style={{
                  fontSize: 14, color: 'var(--cream-soft)',
                  lineHeight: 1.6, fontStyle: 'italic',
                }}>
                  {t(`about.pillar${n}Text`)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <Rule />

        {/* ── CTHULHU CASE PROJECT ── */}
        <section style={{ padding: '72px 0 48px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 64,
            alignItems: 'center',
          }}>
            <div>
              <Eyebrow>{t('about.projectEyebrow')}</Eyebrow>
              <h2 style={{
                fontSize: 'clamp(32px, 4vw, 52px)',
                fontStyle: 'italic',
                lineHeight: 1.05,
                marginBottom: 24,
                color: 'var(--ochre-bright)',
              }}>
                {t('about.projectTitle')}
              </h2>
              <p style={{
                fontSize: 16, lineHeight: 1.75,
                color: 'var(--cream-soft)',
              }}>
                {t('about.projectText')}
              </p>
              <button
                onClick={() => navigate('/login')}
                style={{
                  marginTop: 32,
                  padding: '12px 24px',
                  background: 'var(--ochre)',
                  color: 'var(--ink-0)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t('landing.enterBtn')}
              </button>
            </div>

            {/* decorative panel */}
            <div style={{
              border: '1px solid var(--ochre-deep)',
              padding: '36px 32px',
              position: 'relative',
              background: 'linear-gradient(180deg, rgba(184,153,104,0.04), transparent)',
            }}>
              {/* corner decorations */}
              {[
                { top: -1, right: -1, borderTop: '1px solid var(--ochre)', borderRight: '1px solid var(--ochre)' },
                { bottom: -1, left: -1, borderBottom: '1px solid var(--ochre)', borderLeft: '1px solid var(--ochre)' },
              ].map((s, i) => (
                <div key={i} style={{
                  position: 'absolute', width: 16, height: 16, ...s,
                }} />
              ))}

              {[
                { label: 'Characters', value: 'CoC 7e · STR/CON/SIZ/DEX/APP/INT/POW/EDU' },
                { label: 'Evidence Board', value: 'Cards · Red threads · Real-time' },
                { label: 'Sessions', value: 'Lobby · Join code · WebSocket' },
                { label: 'Story Editor', value: 'Campaigns · Acts · Scenes · NPCs' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  borderBottom: '1px solid var(--ochre-deep)',
                  padding: '14px 0',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    letterSpacing: '0.28em', textTransform: 'uppercase',
                    color: 'var(--ochre)', marginBottom: 4,
                  }}>{label}</div>
                  <div style={{
                    fontSize: 13, color: 'var(--moss-pale)',
                    fontStyle: 'italic',
                  }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <section style={{ padding: '40px 0 0' }}>
          <Rule />
          <div style={{
            textAlign: 'center', marginTop: 40,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            color: 'var(--moss)',
            lineHeight: 2,
          }}>
            {t('about.footer')}<br />
            {t('about.footerSub')}
          </div>
        </section>

      </div>
    </div>
  )
}
