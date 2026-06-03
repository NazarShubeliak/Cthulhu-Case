import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore.js'
import { getSession, startSession, deleteSession, leaveSession, setSessionCharacter, getMySessionCharacter, loadCampaign } from '../../api/sessions.js'
import { getCharacters } from '../../api/characters.js'
import { getCampaigns } from '../../api/campaigns.js'

function ConfirmModal({ message, onConfirm, onClose }) {
  const { t } = useTranslation()
  const inputRef = useRef(null)
  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter') { onConfirm(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onConfirm, onClose])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div ref={inputRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--ink-1)', border: '1px solid var(--ochre-deep)',
        padding: '24px 28px', minWidth: 280,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)', outline: 'none',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--cream)', marginBottom: 20,
          letterSpacing: '0.04em', lineHeight: 1.5,
        }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn--ghost" style={{ fontSize: 10, padding: '4px 14px' }} onClick={onClose}>
            {t('board.cancel')}
          </button>
          <button
            className="btn btn--primary"
            style={{ fontSize: 10, padding: '4px 14px', background: 'rgba(122,42,37,0.25)', borderColor: 'var(--blood)', color: '#c87070' }}
            onClick={() => { onConfirm(); onClose() }}
          >
            {t('board.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusChip({ status }) {
  const { t } = useTranslation()
  return (
    <span className={`status-chip status-chip--${status}`}>
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  )
}

function PlayerRow({ player, isMaster }) {
  const { t } = useTranslation()
  const initials = player.username?.slice(0, 2).toUpperCase() ?? '??'
  return (
    <div className="player-row">
      <div className="player-avatar">{initials}</div>
      <span className="player-name">{player.username}</span>
      {isMaster && (
        <span className="player-badge">{t('lobby.master')}</span>
      )}
    </div>
  )
}

export default function LobbyPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [characters, setCharacters] = useState([])
  const [boundCharId, setBoundCharId] = useState(null)
  const [charLoading, setCharLoading] = useState(false)
  const [campaigns, setCampaigns] = useState([])
  const [showCampaignPicker, setShowCampaignPicker] = useState(false)
  const [loadingCampaign, setLoadingCampaign] = useState(false)
  const [loadSuccess, setLoadSuccess] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getSession(id)
      .then((res) => setSession(res.data))
      .catch(() => setError(t('lobby.notFound')))
      .finally(() => setLoading(false))
  }, [id, t])

  const silentRefresh = useCallback(() => {
    getSession(id)
      .then((res) => setSession(res.data))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // Poll every 5s while session is open so the master sees new players
  useEffect(() => {
    if (!session || session.status === 'closed') return
    const timer = setInterval(silentRefresh, 5000)
    return () => clearInterval(timer)
  }, [session?.status, silentRefresh])

  useEffect(() => {
    if (!session || session.is_master) return
    Promise.all([
      getCharacters(),
      getMySessionCharacter(id),
    ]).then(([charsRes, boundRes]) => {
      setCharacters(charsRes.data.results ?? charsRes.data)
      setBoundCharId(boundRes.status === 204 ? null : (boundRes.data?.character_id ?? null))
    }).catch(() => {})
  }, [session, id])

  useEffect(() => {
    if (!session?.is_master) return
    getCampaigns()
      .then(res => {
        const all = res.data.results ?? res.data
        setCampaigns(all.filter(c => (c.asset_count ?? 0) > 0))
      })
      .catch(() => {})
  }, [session?.is_master])

  async function handleLoadCampaign(campaignId) {
    setLoadingCampaign(true)
    setLoadSuccess(null)
    try {
      const res = await loadCampaign(id, campaignId)
      setLoadSuccess(t('lobby.loadedAssets', { count: res.data.created }))
      setShowCampaignPicker(false)
    } catch (err) {
      setError(err.response?.data?.error || t('lobby.loadError'))
    } finally {
      setLoadingCampaign(false)
    }
  }

  async function handleSelectCharacter(charId) {
    setCharLoading(true)
    try {
      await setSessionCharacter(id, charId || null)
      setBoundCharId(charId || null)
    } catch {
      // ignore
    } finally {
      setCharLoading(false)
    }
  }

  async function handleStart() {
    setActionLoading(true)
    try {
      await startSession(id)
      navigate(`/table/${id}`)
    } catch (err) {
      setError(err.response?.data?.error || t('lobby.sessionError'))
    } finally {
      setActionLoading(false)
    }
  }

  function handleClose() {
    setConfirmModal({
      message: t('lobby.deleteConfirm'),
      onConfirm: async () => {
        setActionLoading(true)
        try {
          await deleteSession(id)
          navigate('/sessions')
        } catch (err) {
          setError(err.response?.data?.error || t('lobby.closeError'))
          setActionLoading(false)
        }
      },
    })
  }

  function handleLeave() {
    setConfirmModal({
      message: t('lobby.leaveConfirm'),
      onConfirm: async () => {
        setActionLoading(true)
        try {
          await leaveSession(id)
          navigate('/sessions')
        } catch (err) {
          setError(err.response?.data?.error || t('lobby.leaveError'))
          setActionLoading(false)
        }
      },
    })
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 48px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--moss-pale)', letterSpacing: '0.2em' }}>
        {t('lobby.loading')}
      </div>
    )
  }

  if (error && !session) {
    return (
      <div style={{ padding: '60px 48px' }}>
        <div className="auth-error">{error}</div>
        <button className="btn btn--ghost" onClick={() => navigate('/sessions')} style={{ marginTop: 16 }}>
          {t('lobby.back')}
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
          {t('lobby.participants')}
        </div>

        {session?.master && (
          <PlayerRow player={session.master} isMaster />
        )}

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
            {t('lobby.noPlayers')}
          </div>
        )}

        {loadSuccess && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ochre)',
            letterSpacing: '0.18em', marginTop: 16, padding: '8px 12px',
            border: '1px solid var(--ochre-deep)', background: 'rgba(184,153,104,0.08)',
          }}>
            {loadSuccess}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          {isMaster ? (
            <>
              {session?.status === 'lobby' && (
                <button
                  className="btn btn--primary"
                  onClick={handleStart}
                  disabled={actionLoading}
                >
                  {actionLoading ? '...' : t('lobby.startSession')}
                </button>
              )}
              {session?.status === 'active' && (
                <button
                  className="btn btn--ghost"
                  onClick={() => navigate(`/table/${id}`)}
                >
                  {t('lobby.openTable')}
                </button>
              )}
              {session?.status !== 'closed' && campaigns.length > 0 && (
                <button
                  className="btn btn--ghost"
                  onClick={() => setShowCampaignPicker(v => !v)}
                  disabled={loadingCampaign}
                >
                  {loadingCampaign ? '...' : t('lobby.loadCampaign')}
                </button>
              )}
              {session?.status !== 'closed' && (
                <button
                  className="btn btn--danger"
                  onClick={handleClose}
                  disabled={actionLoading}
                >
                  {t('lobby.closeSession')}
                </button>
              )}
            </>
          ) : (
            <button
              className="btn btn--ghost"
              onClick={handleLeave}
              disabled={actionLoading}
            >
              {actionLoading ? '...' : t('lobby.leaveSession')}
            </button>
          )}

          <button
            className="btn btn--ghost"
            onClick={() => navigate('/sessions')}
          >
            {t('lobby.allSessions')}
          </button>
        </div>

        {showCampaignPicker && campaigns.length > 0 && (
          <div style={{
            marginTop: 16,
            border: '1px solid var(--ochre-deep)',
            background: 'var(--ink-2)',
            padding: 12,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em',
              textTransform: 'uppercase', color: 'var(--moss)', marginBottom: 10,
            }}>
              {t('lobby.selectCampaign')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {campaigns.map(c => (
                <button
                  key={c.id}
                  disabled={loadingCampaign}
                  onClick={() => handleLoadCampaign(c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'transparent', border: '1px solid var(--ochre-deep)',
                    padding: '8px 12px', cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ochre)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--ochre-deep)'}
                >
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--cream)' }}>
                      {c.title}
                    </div>
                    {(c.setting || c.era) && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)', letterSpacing: '0.12em' }}>
                        {[c.setting, c.era].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  {c.asset_count > 0 && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ochre)', letterSpacing: '0.2em' }}>
                      {c.asset_count} {t('lobby.assets')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
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
          {t('lobby.info')}
        </div>

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
            {t('lobby.joinCode')}
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
              {t('lobby.copy')}
            </button>
          </div>
        </div>

        <div
          style={{
            background: 'var(--ink-2)',
            border: '1px solid var(--ochre-deep)',
            padding: 20,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <InfoRow label={t('lobby.masterLabel')} value={session?.master?.username ?? '—'} />
            <InfoRow label={t('lobby.playersCount')} value={session?.players?.length ?? 0} />
            <InfoRow label={t('lobby.statusLabel')} value={t(`status.${session?.status}`, { defaultValue: session?.status })} />
            <InfoRow label={t('lobby.created')} value={createdDate} />
          </div>
        </div>

        {!isMaster && characters.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em',
              textTransform: 'uppercase', color: 'var(--moss)', marginBottom: 10,
            }}>
              {t('lobby.yourCharacter')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {characters.map((c) => (
                <button
                  key={c.id}
                  disabled={charLoading}
                  onClick={() => handleSelectCharacter(boundCharId === c.id ? null : c.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: boundCharId === c.id ? 'rgba(184,153,104,0.12)' : 'transparent',
                    border: `1px solid ${boundCharId === c.id ? 'var(--ochre)' : 'var(--ochre-deep)'}`,
                    padding: '8px 12px', cursor: 'pointer', textAlign: 'left',
                    transition: 'all .15s',
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: boundCharId === c.id ? 'var(--ochre)' : 'var(--ochre-deep)',
                  }} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--cream)' }}>
                      {c.name}
                    </div>
                    {c.occupation && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)', letterSpacing: '0.12em' }}>
                        {c.occupation}
                      </div>
                    )}
                  </div>
                  {boundCharId === c.id && (
                    <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--ochre)', letterSpacing: '0.2em' }}>
                      {t('lobby.selected')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {session?.status === 'active' && !isMaster && (
          <div style={{ marginTop: 20 }}>
            <button
              className="btn btn--primary"
              style={{ width: '100%' }}
              onClick={() => navigate(`/table/${id}`)}
            >
              {t('lobby.enterTable')}
            </button>
          </div>
        )}
      </div>

      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onClose={() => setConfirmModal(null)}
        />
      )}
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
