import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getMe, updateMe, logout } from '../../api/auth.js'
import { getCharacters } from '../../api/characters.js'
import useAuthStore from '../../store/authStore.js'
import useUIStore from '../../store/uiStore.js'
import EditProfileModal from './EditProfileModal.jsx'

function formatDate(iso, lang) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(lang === 'uk' ? 'uk-UA' : 'en-GB', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const { user, setUser, clearAuth, refreshToken } = useAuthStore((s) => ({
    user: s.user,
    setUser: s.setUser,
    clearAuth: s.clearAuth,
    refreshToken: s.refreshToken,
  }))

  const [bio, setBio] = useState(user?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [charCount, setCharCount] = useState(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const fileRef = useRef(null)
  const { lamp, grain, glitchText, showLatin, lang, setLamp, setGrain, setGlitchText, setShowLatin, setLang } = useUIStore()

  useEffect(() => {
    getMe()
      .then((res) => {
        setUser(res.data)
        setBio(res.data.bio ?? '')
      })
      .catch(console.error)

    getCharacters()
      .then((res) => {
        const data = res.data.results ?? res.data
        setCharCount(Array.isArray(data) ? data.length : 0)
      })
      .catch(console.error)
  }, [])

  const handleSaveBio = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await updateMe({ bio })
      setUser(res.data)
      setSaveMsg(t('profile.saved'))
      setTimeout(() => setSaveMsg(''), 2000)
    } catch {
      setSaveMsg(t('profile.error'))
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const res = await updateMe({ avatar: file })
      setUser(res.data)
    } catch {
      console.error('Avatar upload failed')
    }
  }

  const handleLogout = async () => {
    try {
      await logout(refreshToken)
    } catch {
      // ignore
    }
    clearAuth()
    navigate('/login')
  }

  const handleLangToggle = (newLang) => {
    setLang(newLang)
    i18n.changeLanguage(newLang)
  }

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '?'

  const ROLE_LABELS = {
    player: t('profile.roles.player'),
    master: t('profile.roles.master'),
    admin: t('profile.roles.admin'),
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__eyebrow">
          {t('profile.eyebrow')}
        </div>
        <h1 className="page-header__title">{t('profile.title')}</h1>
        <p className="page-header__sub">{t('profile.sub')}</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, maxWidth: 800 }}>

        {/* User info card */}
        <div className="card" style={{ padding: 28, gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24 }}>
            {/* Avatar */}
            <div style={{ position: 'relative' }}>
              <div
                className="avatar-circle"
                style={{ cursor: 'pointer' }}
                onClick={() => fileRef.current?.click()}
                title={t('profile.change')}
              >
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.username} />
                ) : (
                  initials
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarChange}
              />
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 8,
                  letterSpacing: '0.18em',
                  color: 'var(--moss)',
                  textAlign: 'center',
                  marginTop: 4,
                  textTransform: 'uppercase',
                }}
              >
                {t('profile.change')}
              </div>
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 28,
                    fontStyle: 'italic',
                    color: 'var(--cream)',
                  }}
                >
                  {user?.username ?? '—'}
                </div>
                <button
                  onClick={() => setShowEditModal(true)}
                  style={{
                    background: 'none', border: '1px solid var(--ochre-deep)', cursor: 'pointer',
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em',
                    color: 'var(--moss)', textTransform: 'uppercase', padding: '3px 10px',
                    transition: 'border-color .15s, color .15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ochre)'; e.currentTarget.style.color = 'var(--ochre)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ochre-deep)'; e.currentTarget.style.color = 'var(--moss)' }}
                >
                  {t('profile.change')}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="chip">
                  {ROLE_LABELS[user?.role] ?? user?.role ?? '—'}
                </span>
                {user?.email && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--moss-pale)',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {user.email}
                  </span>
                )}
              </div>
              <div
                style={{
                  marginTop: 10,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  color: 'var(--moss)',
                }}
              >
                {t('profile.joinedAt')} {formatDate(user?.date_joined, lang)}
              </div>
            </div>

            {/* Stats */}
            <div
              style={{
                textAlign: 'center',
                padding: '16px 20px',
                border: '1px solid var(--ochre-deep)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 36,
                  color: 'var(--ochre)',
                  lineHeight: 1,
                }}
              >
                {charCount ?? '—'}
              </div>
              <div className="eyebrow" style={{ marginTop: 4 }}>{t('profile.characters')}</div>
            </div>
          </div>
        </div>

        {/* Bio card */}
        <div className="card" style={{ padding: 28, gridColumn: 'span 2' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{t('profile.bioEyebrow')}</div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontStyle: 'italic',
              marginBottom: 16,
            }}
          >
            {t('profile.bioTitle')}
          </div>

          <div className="form-group">
            <textarea
              className="form-input"
              style={{ minHeight: 120 }}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('profile.bioPlaceholder')}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn btn--primary"
              onClick={handleSaveBio}
              disabled={saving}
            >
              {saving ? t('profile.saving') : t('profile.save')}
            </button>
            {saveMsg && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  color: saveMsg === t('profile.error') ? 'var(--blood-bright)' : 'var(--moss-pale)',
                }}
              >
                {saveMsg}
              </span>
            )}
          </div>
        </div>

        {/* Appearance */}
        <div className="card" style={{ padding: 28, gridColumn: 'span 2' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>{t('profile.appearance')}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic', marginBottom: 20 }}>
            {t('profile.atmosphere')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: t('profile.lamp'),     sub: t('profile.lampSub'),    value: lamp,      set: setLamp },
              { label: t('profile.grain'),    sub: t('profile.grainSub'),   value: grain,     set: setGrain },
              { label: t('profile.glitch'),   sub: t('profile.glitchSub'),  value: glitchText, set: setGlitchText },
              { label: t('profile.latin'),    sub: t('profile.latinSub'),   value: showLatin, set: setShowLatin },
            ].map(({ label, sub, value, set }) => (
              <div
                key={label}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 0', borderBottom: '1px solid var(--ochre-deep)',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--cream)' }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--moss-pale)', marginTop: 2 }}>{sub}</div>
                </div>
                <button
                  onClick={() => set(!value)}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: value ? 'var(--ochre)' : 'var(--ink-3)',
                    position: 'relative', transition: 'background .2s',
                    flexShrink: 0,
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
            ))}

            {/* Language toggle */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 0', borderBottom: '1px solid var(--ochre-deep)',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--cream)' }}>{t('profile.language')}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', color: 'var(--moss-pale)', marginTop: 2 }}>{t('profile.languageSub')}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['uk', 'en'].map(l => (
                  <button
                    key={l}
                    onClick={() => handleLangToggle(l)}
                    style={{
                      padding: '4px 12px',
                      border: '1px solid',
                      borderColor: lang === l ? 'var(--ochre)' : 'var(--ochre-deep)',
                      background: lang === l ? 'var(--ochre)' : 'transparent',
                      color: lang === l ? 'var(--ink-0)' : 'var(--moss-pale)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      cursor: 'pointer',
                      transition: 'all .15s',
                      textTransform: 'uppercase',
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="card" style={{ padding: 24, gridColumn: 'span 2' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{t('profile.actionsEyebrow')}</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn--danger"
              onClick={handleLogout}
            >
              {t('profile.logout')}
            </button>
          </div>
        </div>
      </div>

      {showEditModal && <EditProfileModal onClose={() => setShowEditModal(false)} />}
    </div>
  )
}
