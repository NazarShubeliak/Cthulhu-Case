import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore.js'
import { getSessions, createSession, joinByCode } from '../../api/sessions.js'

function StatusChip({ status }) {
  const { t } = useTranslation()
  return (
    <span className={`status-chip status-chip--${status}`}>
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  )
}

function CreateSessionModal({ onClose, onCreate }) {
  const { t } = useTranslation()
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
      setError(err.response?.data?.detail || t('sessions.createError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{t('sessions.modalTitle')}</div>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('sessions.nameLabel')}</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('sessions.namePlaceholder')}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('sessions.descLabel')}</label>
            <textarea
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('sessions.descPlaceholder')}
              rows={3}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t('sessions.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading || !name.trim()}>
              {loading ? t('sessions.creating') : t('sessions.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SessionListPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState('')
  const [joiningByCode, setJoiningByCode] = useState(false)

  useEffect(() => {
    setLoading(true)
    getSessions()
      .then((res) => setSessions((res.data.results ?? res.data).filter((s) => s.status !== 'closed')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleCreated(session) {
    setShowModal(false)
    navigate(`/sessions/${session.id}`)
  }

  async function handleJoinByCode(e) {
    e.preventDefault()
    const code = codeInput.trim().toUpperCase()
    if (!code) { setCodeError(t('sessions.codeError')); return }
    setCodeError('')
    setJoiningByCode(true)
    try {
      const res = await joinByCode(code)
      navigate(`/sessions/${res.data.id}`)
    } catch (err) {
      const msg = err.response?.data?.error
      setCodeError(msg || t('sessions.notFound'))
    } finally {
      setJoiningByCode(false)
    }
  }

  return (
    <div className="page">
      {showModal && (
        <CreateSessionModal onClose={() => setShowModal(false)} onCreate={handleCreated} />
      )}

      <div className="page-header">
        <div className="page-header__eyebrow">{t('sessions.eyebrow')}</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="page-header__title">{t('sessions.title')}</h1>
            <p className="page-header__sub">{t('sessions.sub')}</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <form onSubmit={handleJoinByCode} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div>
                <input
                  className="form-input"
                  value={codeInput}
                  onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCodeError('') }}
                  placeholder={t('sessions.codeInput')}
                  maxLength={6}
                  style={{ width: 130, padding: '7px 10px', textTransform: 'uppercase', letterSpacing: '0.2em' }}
                />
                {codeError && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--blood-bright)', marginTop: 3 }}>
                    {codeError}
                  </div>
                )}
              </div>
              <button type="submit" className="btn" disabled={joiningByCode || !codeInput.trim()}>
                {joiningByCode ? t('sessions.joining') : t('sessions.join')}
              </button>
            </form>
            <button className="btn btn--primary" onClick={() => setShowModal(true)}>
              {t('sessions.newCampaign')}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--moss-pale)', letterSpacing: '0.2em', padding: '40px 0' }}>
          {t('sessions.loading')}
        </div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__title">{t('sessions.empty')}</div>
          <div className="empty-state__sub">{t('sessions.emptySub')}</div>
          <button className="btn btn--primary" onClick={() => setShowModal(true)}>
            {t('sessions.openFirst')}
          </button>
        </div>
      ) : (
        <div className="session-grid">
          {sessions.map((session) => (
            <div key={session.id} className="session-card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <div className="session-card__name">{session.name}</div>
                <StatusChip status={session.status} />
              </div>
              <div className="session-card__meta">
                {session.is_master ? t('sessions.youAreMaster') : `${t('sessions.masterLabel')} ${session.master?.username ?? '—'}`}
                {' · '}{session.player_count ?? 0} {t('sessions.players')}
              </div>
              {session.description && (
                <p className="session-card__desc">
                  {session.description.length > 120
                    ? session.description.slice(0, 120) + '…'
                    : session.description}
                </p>
              )}
              <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                <button
                  className="btn btn--primary"
                  onClick={() => navigate(`/sessions/${session.id}`)}
                >
                  {t('sessions.open')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
