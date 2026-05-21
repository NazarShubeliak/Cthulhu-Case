import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore.js'
import { getSession, startSession, deleteSession, leaveSession } from '../../api/sessions.js'

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

function PlayerRow({ player, isMaster }) {
  const initials = player.username?.slice(0, 2).toUpperCase() ?? '??'
  return (
    <div className="player-row">
      <div className="player-avatar">{initials}</div>
      <span className="player-name">{player.username}</span>
      {isMaster && (
        <span className="player-badge">Майстер</span>
      )}
    </div>
  )
}

export default function LobbyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getSession(id)
      .then((res) => setSession(res.data))
      .catch(() => setError('Сесію не знайдено або відмовлено у доступі.'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  async function handleStart() {
    setActionLoading(true)
    try {
      await startSession(id)
      navigate(`/table/${id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Помилка запуску сесії.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleClose() {
    if (!window.confirm('Видалити сесію? Це незворотня дія.')) return
    setActionLoading(true)
    try {
      await deleteSession(id)
      navigate('/sessions')
    } catch (err) {
      setError(err.response?.data?.error || 'Помилка видалення сесії.')
      setActionLoading(false)
    }
  }

  async function handleLeave() {
    if (!window.confirm('Покинути сесію?')) return
    setActionLoading(true)
    try {
      await leaveSession(id)
      navigate('/sessions')
    } catch (err) {
      setError(err.response?.data?.error || 'Помилка виходу.')
    } finally {
      setActionLoading(false)
    }
  }

  function copyId() {
    navigator.clipboard.writeText(String(id)).catch(() => {})
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 48px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--moss-pale)', letterSpacing: '0.2em' }}>
        Завантаження...
      </div>
    )
  }

  if (error && !session) {
    return (
      <div style={{ padding: '60px 48px' }}>
        <div className="auth-error">{error}</div>
        <button className="btn btn--ghost" onClick={() => navigate('/sessions')} style={{ marginTop: 16 }}>
          ← Назад до лобі
        </button>
      </div>
    )
  }

  const isMaster = session?.is_master
  const createdDate = session?.created_at
    ? new Date(session.created_at).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  return (
    <div className="lobby-layout">
      {/* Left panel */}
      <div>
        {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              fontStyle: 'italic',
              color: 'var(--cream)',
            }}
          >
            {session?.name}
          </h1>
          <StatusChip status={session?.status} />
        </div>

        {session?.description && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--moss-pale)',
              lineHeight: 1.6,
              marginBottom: 32,
              maxWidth: 600,
            }}
          >
            {session.description}
          </p>
        )}

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'var(--moss)',
            marginBottom: 12,
          }}
        >
          Учасники
        </div>

        {/* Master row */}
        {session?.master && (
          <PlayerRow player={session.master} isMaster />
        )}

        {/* Players rows */}
        {session?.players?.map((p) => (
          <PlayerRow key={p.id} player={p} isMaster={false} />
        ))}

        {(!session?.players || session.players.length === 0) && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--moss)',
              letterSpacing: '0.18em',
              padding: '16px 0',
              borderBottom: '1px solid var(--ochre-deep)',
            }}
          >
            Гравці ще не приєдналися
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
          {isMaster ? (
            <>
              {session?.status === 'lobby' && (
                <button
                  className="btn btn--primary"
                  onClick={handleStart}
                  disabled={actionLoading}
                >
                  {actionLoading ? '...' : 'Розпочати сесію'}
                </button>
              )}
              {session?.status === 'active' && (
                <button
                  className="btn btn--ghost"
                  onClick={() => navigate(`/table/${id}`)}
                >
                  Відкрити стіл
                </button>
              )}
              {session?.status !== 'closed' && (
                <button
                  className="btn btn--danger"
                  onClick={handleClose}
                  disabled={actionLoading}
                >
                  Закрити сесію
                </button>
              )}
            </>
          ) : (
            <button
              className="btn btn--ghost"
              onClick={handleLeave}
              disabled={actionLoading}
            >
              {actionLoading ? '...' : 'Покинути сесію'}
            </button>
          )}

          <button
            className="btn btn--ghost"
            onClick={() => navigate('/sessions')}
          >
            ← Усі сесії
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'var(--moss)',
            marginBottom: 16,
          }}
        >
          Інформація
        </div>

        {/* Session ID copy box */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--moss-pale)',
              marginBottom: 6,
            }}
          >
            Код для входу
          </div>
          <div className="copy-box">
            <span style={{ letterSpacing: '0.3em', fontSize: 16, fontFamily: 'var(--font-mono)' }}>
              {session?.join_code ?? '—'}
            </span>
            <button
              className="btn btn--ghost"
              style={{ padding: '4px 10px', fontSize: 9 }}
              onClick={() => navigator.clipboard.writeText(session?.join_code ?? '').catch(() => {})}
            >
              Копіювати
            </button>
          </div>
        </div>

        {/* Info box */}
        <div
          style={{
            background: 'var(--ink-2)',
            border: '1px solid var(--ochre-deep)',
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <InfoRow label="Майстер" value={session?.master?.username ?? '—'} />
            <InfoRow label="Гравців" value={session?.players?.length ?? 0} />
            <InfoRow label="Статус" value={STATUS_LABELS[session?.status] ?? session?.status} />
            <InfoRow label="Створено" value={createdDate} />
          </div>
        </div>

        {session?.status === 'active' && !isMaster && (
          <div style={{ marginTop: 20 }}>
            <button
              className="btn btn--primary"
              style={{ width: '100%' }}
              onClick={() => navigate(`/table/${id}`)}
            >
              Увійти до столу
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--moss-pale)',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--cream)',
          letterSpacing: '0.1em',
        }}
      >
        {value}
      </span>
    </div>
  )
}
