import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore.js'
import { getSessions, createSession, joinSession } from '../../api/sessions.js'

const STATUS_LABELS = {
  lobby: 'Лобі',
  active: 'Активна',
  closed: 'Закрита',
}

function StatusChip({ status }) {
  return (
    <span className={`status-chip status-chip--${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function CreateSessionModal({ onClose, onCreate }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await createSession({ name: name.trim(), description: description.trim() })
      onCreate(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Помилка створення сесії.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Нова Кампанія</div>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Назва</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Жах у Аркгемі..."
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Опис</label>
            <textarea
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Короткий опис кампанії..."
              rows={3}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Скасувати
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading || !name.trim()}>
              {loading ? 'Створення...' : 'Створити'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SessionListPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [joiningId, setJoiningId] = useState(null)
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    setLoading(true)
    getSessions()
      .then((res) => setSessions(res.data.results ?? res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleCreated(session) {
    setShowModal(false)
    navigate(`/sessions/${session.id}`)
  }

  async function handleJoin(sessionId) {
    setJoiningId(sessionId)
    try {
      await joinSession(sessionId)
      navigate(`/sessions/${sessionId}`)
    } catch {
      // silently ignore — may already be joined
      navigate(`/sessions/${sessionId}`)
    } finally {
      setJoiningId(null)
    }
  }

  function isParticipant(session) {
    if (session.is_master) return true
    if (!session.players) return false
    return session.players?.some?.((p) => p.id === user?.id) ?? false
  }

  return (
    <div className="page">
      {showModal && (
        <CreateSessionModal onClose={() => setShowModal(false)} onCreate={handleCreated} />
      )}

      <div className="page-header">
        <div className="page-header__eyebrow">№ ii · сесії · sessionae</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="page-header__title">Лобі Аркгему</h1>
            <p className="page-header__sub">
              Зали очікування перед початком розслідувань. Знайдіть свою групу або
              відкрийте нові двері в темряву.
            </p>
          </div>
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            + Нова Кампанія
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--moss-pale)', letterSpacing: '0.2em', padding: '40px 0' }}>
          Завантаження...
        </div>
      ) : (() => {
        const active = sessions.filter((s) => s.status !== 'closed')
        const archived = sessions.filter((s) => s.status === 'closed')

        const renderCard = (session) => {
          const participant = isParticipant(session)
          return (
            <div key={session.id} className="session-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div className="session-card__name">{session.name}</div>
                <StatusChip status={session.status} />
              </div>
              <div className="session-card__meta">
                Майстер: {session.master?.username ?? '—'} · {session.player_count ?? 0} гравців
              </div>
              {session.description && (
                <p className="session-card__desc">
                  {session.description.length > 120
                    ? session.description.slice(0, 120) + '…'
                    : session.description}
                </p>
              )}
              <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                {session.status === 'closed' ? (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                    Закрито
                  </span>
                ) : participant ? (
                  <button className="btn btn--primary" onClick={() => navigate(`/sessions/${session.id}`)}>
                    Відкрити
                  </button>
                ) : session.status === 'lobby' ? (
                  <button className="btn" disabled={joiningId === session.id} onClick={() => handleJoin(session.id)}>
                    {joiningId === session.id ? 'Приєднання...' : 'Приєднатись'}
                  </button>
                ) : (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                    Доступ закрито
                  </span>
                )}
              </div>
            </div>
          )
        }

        return (
          <>
            {active.length === 0 && archived.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__title">Зали порожні</div>
                <div className="empty-state__sub">Жодних розслідувань не розпочато · Nulla Investigatio</div>
                <button className="btn btn--primary" onClick={() => setShowModal(true)}>
                  Відкрити Перший Облік
                </button>
              </div>
            ) : active.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state__title">Активних сесій немає</div>
                <div className="empty-state__sub">Всі розслідування завершено</div>
                <button className="btn btn--primary" onClick={() => setShowModal(true)}>
                  Нова кампанія
                </button>
              </div>
            ) : (
              <div className="session-grid">
                {active.map(renderCard)}
              </div>
            )}

            {archived.length > 0 && (
              <div style={{ marginTop: 40 }}>
                <button
                  onClick={() => setShowArchived((v) => !v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                    letterSpacing: '0.28em', textTransform: 'uppercase',
                    color: 'var(--moss)', padding: '0 0 12px 0',
                  }}
                >
                  <span>{showArchived ? '▾' : '▸'}</span>
                  Архів · {archived.length} кампані{archived.length === 1 ? 'я' : 'ї'}
                </button>
                {showArchived && (
                  <div className="session-grid">
                    {archived.map(renderCard)}
                  </div>
                )}
              </div>
            )}
          </>
        )
      })()}
    </div>
  )
}
