import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../../api/auth.js'
import useAuthStore from '../../store/authStore.js'

export default function LoginPage() {
  const navigate = useNavigate()
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
        setError(msgs[0] || 'Помилка входу.')
      } else {
        setError('Помилка сервера.')
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
          Університет Міскатонік · Реєстратура
        </div>
        <h1 className="auth-title">Вхід до Архіву</h1>
        <p className="auth-sub">Ідентифікуйте себе, щоб отримати доступ</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Логін
            </label>
            <input
              id="username"
              name="username"
              type="text"
              className="form-input"
              value={form.username}
              onChange={handleChange}
              placeholder="ім'я дослідника"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-input"
              value={form.password}
              onChange={handleChange}
              placeholder="секретний код"
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
            {loading ? 'Перевірка...' : 'Увійти до архіву'}
          </button>
        </form>

        <div className="auth-switch">
          Ще не зареєстровані?{' '}
          <Link to="/register">Створити досьє</Link>
        </div>
      </div>
    </div>
  )
}
