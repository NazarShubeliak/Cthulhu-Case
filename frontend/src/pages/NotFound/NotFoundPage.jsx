import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore.js'
import useUIStore from '../../store/uiStore.js'
import CursorLamp from '../../components/UI/CursorLamp.jsx'

export default function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const accessToken = useAuthStore((s) => s.accessToken)
  const { lamp, grain } = useUIStore()
  const canvasRef = useRef(null)

  useEffect(() => {
    document.documentElement.style.setProperty('--grain-opacity', grain ? '0.07' : '0')
  }, [grain])

  /* animated ink drip on canvas */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width  = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const drops = Array.from({ length: 6 }, (_, i) => ({
      x: 80 + i * (canvas.width / 6),
      y: 0,
      speed: 0.3 + Math.random() * 0.4,
      len: 20 + Math.random() * 60,
      alpha: 0.12 + Math.random() * 0.15,
    }))

    let frame
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drops.forEach(d => {
        const grad = ctx.createLinearGradient(d.x, d.y, d.x, d.y + d.len)
        grad.addColorStop(0, `rgba(26,14,10,${d.alpha})`)
        grad.addColorStop(1, 'rgba(26,14,10,0)')
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x, d.y + d.len)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5 + Math.random() * 1
        ctx.stroke()
        d.y += d.speed
        if (d.y > canvas.height) d.y = -d.len
      })
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [])

  const handleBack = () => navigate(accessToken ? '/sessions' : '/')

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--ink-0)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      padding: '40px 28px',
    }}>
      {lamp && <CursorLamp />}

      {/* ink drip canvas — top edge */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: 120,
        pointerEvents: 'none',
      }} />

      {/* decorative border frame */}
      <div style={{
        position: 'absolute', inset: 24,
        border: '1px solid var(--ochre-deep)',
        pointerEvents: 'none',
      }}>
        {[
          { top: -1, left: -1, borderTop: '1px solid var(--ochre)', borderLeft: '1px solid var(--ochre)' },
          { top: -1, right: -1, borderTop: '1px solid var(--ochre)', borderRight: '1px solid var(--ochre)' },
          { bottom: -1, left: -1, borderBottom: '1px solid var(--ochre)', borderLeft: '1px solid var(--ochre)' },
          { bottom: -1, right: -1, borderBottom: '1px solid var(--ochre)', borderRight: '1px solid var(--ochre)' },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', width: 20, height: 20, ...s }} />
        ))}
      </div>

      {/* content */}
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>

        {/* eyebrow latin */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          letterSpacing: '0.36em', textTransform: 'uppercase',
          color: 'var(--ochre-dim)', marginBottom: 32,
        }}>
          {t('notFound.latin')}
        </div>

        {/* 404 */}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(120px, 22vw, 240px)',
          lineHeight: 0.85,
          fontStyle: 'italic',
          fontWeight: 400,
          color: 'var(--ink-3)',
          userSelect: 'none',
          position: 'relative',
        }}>
          {/* ochre accent on middle zero */}
          <span style={{ color: 'var(--ink-3)' }}>4</span>
          <span style={{ color: 'var(--ochre-deep)' }}>0</span>
          <span style={{ color: 'var(--ink-3)' }}>4</span>
        </div>

        {/* divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          margin: '28px auto', maxWidth: 320,
        }}>
          <div style={{ flex: 1, height: 1, background: 'var(--ochre-deep)' }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            letterSpacing: '0.32em', color: 'var(--ochre)',
          }}>✦</span>
          <div style={{ flex: 1, height: 1, background: 'var(--ochre-deep)' }} />
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(24px, 3.5vw, 40px)',
          fontStyle: 'italic', fontWeight: 400,
          color: 'var(--cream)', marginBottom: 20,
        }}>
          {t('notFound.title')}
        </h1>

        <p style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 'clamp(16px, 1.6vw, 20px)',
          color: 'var(--cream-soft)',
          maxWidth: '42ch',
          margin: '0 auto 40px',
          lineHeight: 1.6,
        }}>
          {t('notFound.text')}
        </p>

        <button
          onClick={handleBack}
          style={{
            padding: '12px 28px',
            background: 'transparent',
            color: 'var(--ochre)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            border: '1px solid var(--ochre-deep)',
            cursor: 'pointer',
            transition: 'border-color 0.2s, color 0.2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--ochre)'
            e.currentTarget.style.color = 'var(--cream)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--ochre-deep)'
            e.currentTarget.style.color = 'var(--ochre)'
          }}
        >
          {t('notFound.back')}
        </button>

        {/* folio note */}
        <div style={{
          marginTop: 60,
          fontFamily: 'var(--font-mono)', fontSize: 10,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: 'var(--moss)',
        }}>
          {t('notFound.folio')}
        </div>
      </div>
    </div>
  )
}
