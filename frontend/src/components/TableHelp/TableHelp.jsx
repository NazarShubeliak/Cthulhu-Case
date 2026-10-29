import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

// Cheat sheet for the table — the board has a lot of gestures nobody remembers
// between sessions. Content lives in i18n under tableHelp.sections:
// [{ title, items: [[keys, what], ...] }]
export default function TableHelp({ isMaster, onClose }) {
  const { t } = useTranslation()
  const sections = t('tableHelp.sections', { returnObjects: true })
  const masterSection = t('tableHelp.master', { returnObjects: true })
  const shown = isMaster ? [...sections, masterSection] : sections

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--ink-1)', border: '1px solid var(--ochre-deep)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        width: 760, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '1px solid var(--ochre-deep)', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--moss)' }}>
              Vade Mecum
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--cream)', marginTop: 2 }}>
              {t('tableHelp.title')}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{
          overflowY: 'auto', padding: '8px 24px 20px',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', columnGap: 32,
        }}>
          {shown.map((section) => (
            <section key={section.title} style={{ marginTop: 14 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.24em', textTransform: 'uppercase',
                color: 'var(--ochre)', borderBottom: '1px solid var(--ochre-deep)', paddingBottom: 4, marginBottom: 6,
              }}>
                {section.title}
              </div>
              {section.items.map(([keys, what]) => (
                <div key={keys + what} style={{ display: 'flex', gap: 12, padding: '5px 0', alignItems: 'baseline' }}>
                  <span style={{
                    flex: '0 0 118px', fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'var(--ochre-bright)', letterSpacing: '0.04em',
                  }}>
                    {keys}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--cream)', lineHeight: 1.45 }}>
                    {what}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
