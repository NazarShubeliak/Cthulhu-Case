import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setTableSettings } from '../../api/sessions.js'

// Order shown to the master; the labels live under tableSettings.<key>
const SETTINGS = ['board_locked', 'players_delete_others', 'players_take_cards', 'players_transfer']

// Master-only: what players may do at the table. Every toggle is saved right
// away and pushed to the open tables over the WebSocket.
export default function TableSettingsModal({ sessionId, settings, onSaved, onClose }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function toggle(key) {
    setSaving(key)
    try {
      const { data } = await setTableSettings(sessionId, { [key]: !settings[key] })
      onSaved(data)
      setError('')
    } catch {
      setError(t('tableSettings.saveError'))
    } finally {
      setSaving(null)
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--ink-1)', border: '1px solid var(--ochre-deep)',
        padding: '22px 28px', width: 440, maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 20, color: 'var(--cream)' }}>
            {t('tableSettings.title')}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', color: 'var(--moss)', lineHeight: 1.5, marginBottom: 8 }}>
          {t('tableSettings.subtitle')}
        </div>

        {SETTINGS.map((key) => {
          const value = !!settings?.[key]
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              padding: '12px 0', borderBottom: '1px solid var(--ochre-deep)',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--cream)' }}>
                  {t(`tableSettings.${key}`)}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--moss-pale)', marginTop: 3, lineHeight: 1.5 }}>
                  {t(`tableSettings.${key}Hint`)}
                </div>
              </div>
              <button
                onClick={() => toggle(key)}
                disabled={saving !== null}
                aria-pressed={value}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: value ? 'var(--ochre)' : 'var(--ink-3)',
                  position: 'relative', transition: 'background .2s',
                  flexShrink: 0, opacity: saving === key ? 0.6 : 1,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: value ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: value ? 'var(--ink-0)' : 'var(--moss)',
                  transition: 'left .2s, background .2s',
                }} />
              </button>
            </div>
          )
        })}

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--moss)', lineHeight: 1.5, marginTop: 12 }}>
          {t('tableSettings.alwaysNote')}
        </div>
        {error && <div className="auth-error" style={{ marginTop: 8, fontSize: 10 }}>{error}</div>}
      </div>
    </div>
  )
}
