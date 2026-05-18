import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../../api/auth.js'
import useAuthStore from '../../store/authStore.js'

export default function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.password2) {
      setError('Паролі не збігаються.')
      return
    }

    setLoading(true)
    try {
      const res = await register(form)
      const { user, access, refresh } = res.data
      setAuth(user, access, refresh)
      navigate('/characters')
    } catch (err) {
      const data = err.response?.data
      if (data?.non_field_errors) {
        setError(data.non_field_errors[0])
      } else if (data?.password) {
        setError(Array.isArray(data.password) ? data.password[0] : data.password)
      } else if (data?.username) {
        setError(Array.isArray(data.username) ? data.username[0] : data.username)
      } else if (typeof data === 'object') {
        const msgs = Object.values(data).flat()
        setError(msgs[0] || 'Помилка реєстрації.')
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
        <h1 className="auth-title">Нове досьє</h1>
        <p className="auth-sub">Зареєструйтесь, щоб почати розслідування</p>

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
            <label className="form-label" htmlFor="email">
              Електронна пошта
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="form-input"
              value={form.email}
              onChange={handleChange}
              placeholder="arkham@miskatonic.edu"
              autoComplete="email"
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
              placeholder="мінімум 8 символів"
              required
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password2">
              Підтвердження пароля
            </label>
            <input
              id="password2"
              name="password2"
              type="password"
              className="form-input"
              value={form.password2}
              onChange={handleChange}
              placeholder="повторіть пароль"
              required
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            style={{ width: '100%', padding: '12px 16px', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Реєстрація...' : 'Відкрити досьє'}
          </button>
        </form>

        <div className="auth-switch">
          Вже є акаунт?{' '}
          <Link to="/login">Увійти до архіву</Link>
        </div>
      </div>
    </div>
  )
}
