import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe, updateMe, logout } from '../../api/auth.js'
import { getCharacters } from '../../api/characters.js'
import useAuthStore from '../../store/authStore.js'

const ROLE_LABELS = {
  player: 'Гравець',
  master: 'Майстер',
  admin: 'Адміністратор',
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ProfilePage() {
  const navigate = useNavigate()
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
  const fileRef = useRef(null)

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
      setSaveMsg('збережено')
      setTimeout(() => setSaveMsg(''), 2000)
    } catch {
      setSaveMsg('помилка')
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

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__eyebrow">
          № iii · профіль · profile
        </div>
        <h1 className="page-header__title">Особисте досьє</h1>
        <p className="page-header__sub">
          Ваші дані в архіві Університету Міскатонік.
        </p>
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
                title="Натисніть, щоб змінити аватар"
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
                змінити
              </div>
            </div>

            {/* Info */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  fontStyle: 'italic',
                  color: 'var(--cream)',
                  marginBottom: 6,
                }}
              >
                {user?.username ?? '—'}
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
                У справах з {formatDate(user?.date_joined)}
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
              <div className="eyebrow" style={{ marginTop: 4 }}>Персонажів</div>
            </div>
          </div>
        </div>

        {/* Bio card */}
        <div className="card" style={{ padding: 28, gridColumn: 'span 2' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Біографія</div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontStyle: 'italic',
              marginBottom: 16,
            }}
          >
            Про дослідника
          </div>

          <div className="form-group">
            <textarea
              className="form-input"
              style={{ minHeight: 120 }}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Розкажіть про себе як дослідника..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn btn--primary"
              onClick={handleSaveBio}
              disabled={saving}
            >
              {saving ? 'Збереження...' : 'Зберегти'}
            </button>
            {saveMsg && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  color: saveMsg === 'помилка' ? 'var(--blood-bright)' : 'var(--moss-pale)',
                }}
              >
                {saveMsg}
              </span>
            )}
          </div>
        </div>

        {/* Logout */}
        <div className="card" style={{ padding: 24, gridColumn: 'span 2' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Дії</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn btn--danger"
              onClick={handleLogout}
            >
              Вийти з архіву
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
