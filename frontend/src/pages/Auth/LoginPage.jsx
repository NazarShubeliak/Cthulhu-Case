import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { login } from '../../api/auth.js'
import useAuthStore from '../../store/authStore.js'

export default function LoginPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(form)
      const { user, access, refresh } = res.data
      setAuth(user, access, refresh)
      navigate('/characters')
    } catch (err) {
      const data = err.response?.data
      if (data?.non_field_errors) {
        setError(data.non_field_errors[0])
      } else if (typeof data === 'object') {
        const msgs = Object.values(data).flat()
        setError(msgs[0] || t('auth.loginError'))
      } else {
        setError(t('auth.serverError'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'var(--moss)',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          {t('auth.miskatonic')}
        </div>
        <h1 className="auth-title">{t('auth.loginTitle')}</h1>
        <p className="auth-sub">{t('auth.loginSub')}</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              {t('auth.username')}
            </label>
            <input
              id="username"
              name="username"
              type="text"
              className="form-input"
              value={form.username}
              onChange={handleChange}
              placeholder={t('auth.usernamePlaceholder')}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              {t('auth.password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-input"
              value={form.password}
              onChange={handleChange}
              placeholder={t('auth.passwordPlaceholder')}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            style={{ width: '100%', padding: '12px 16px', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? t('auth.checking') : t('auth.loginBtn')}
          </button>
        </form>

        <div className="auth-switch">
          {t('auth.noAccount')}{' '}
          <Link to="/register">{t('auth.createDossier')}</Link>
        </div>
      </div>
    </div>
  )
}
