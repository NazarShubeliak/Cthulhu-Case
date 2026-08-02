import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore.js'
import useTableStore from '../../store/tableStore.js'
import useWebSocket from '../../hooks/useWebSocket.js'
import { getSession, getCards, getThreads, createCard, getMySessionCharacter } from '../../api/sessions.js'
import EvidenceBoard from './EvidenceBoard.jsx'
import MusicPlayer from '../../components/MusicPlayer/MusicPlayer.jsx'

// ── Constants ──

function getCardTypes(t) {
  return [
    { value: 'document', label: t('cardType.document') },
    { value: 'photo',    label: t('cardType.photo') },
    { value: 'note',     label: t('cardType.note') },
    { value: 'npc',      label: t('cardType.npc') },
    { value: 'sketch',   label: t('cardType.sketch') },
  ]
}

// ── Create card form (master only) ──

function CreateCardForm({ sessionId, isMaster, currentUserId, players, onCreated, open, onClose, initialType, initialPos, initialTarget }) {
  const { t } = useTranslation()
  const CARD_TYPES = getCardTypes(t)

  const [type, setType] = useState(initialType ?? 'document')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [npc, setNpc] = useState({ role: '', age: '', status: '', appearance: '', character: '', connections: '', secret: '' })
  const [target, setTarget] = useState('public')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setType(initialType ?? 'document')
      setTitle(''); setContent(''); setImageFile(null); setImagePreview(null)
      setNpc({ role: '', age: '', status: '', appearance: '', character: '', connections: '', secret: '' })
      setTarget(initialTarget ?? 'public'); setError('')
    }
  }, [open, initialType])

  function setNpcField(field, value) { setNpc((p) => ({ ...p, [field]: value })) }

  function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError('')
    try {
      const finalContent = type === 'npc'
        ? JSON.stringify({
            role: npc.role.trim(), age: npc.age.trim(), status: npc.status.trim(),
            appearance: npc.appearance.trim(), character: npc.character.trim(),
            connections: npc.connections.trim(), secret: npc.secret.trim(),
          })
        : content.trim()
      const payload = { type, title: title.trim(), content: finalContent }
      if (imageFile) payload.image = imageFile
      if (initialPos) { payload.pos_x = initialPos.x; payload.pos_y = initialPos.y }
      if (target === 'public') {
        payload.is_public = true
      } else if (target === 'personal') {
        payload.is_public = false
        payload.owner_id = currentUserId
      } else {
        payload.owner_id = parseInt(target, 10)
        payload.is_public = false
      }
      const res = await createCard(sessionId, payload)
      onCreated(res.data)
      onClose()
    } catch (err) {
      setError(err.response?.data?.detail || t('table.createError'))
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      zIndex: 200, background: 'var(--ink-1)', border: '1px solid var(--ochre-deep)',
      padding: 20, width: 340,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      maxHeight: 'calc(100vh - 60px)', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: 3 }}>
            Nova Charta
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--ochre)' }}>
            {CARD_TYPES.find((t) => t.value === type)?.label ?? type}
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontSize: 16 }}>×</button>
      </div>
      {error && <div className="auth-error" style={{ marginBottom: 10 }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: 10 }}>
          <label className="form-label">{t('table.destination')}</label>
          <select className="form-input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="public">{t('table.publicTable')}</option>
            <option value="personal">{t('table.personal')}</option>
            {isMaster && players.map((p) => (
              <option key={p.id} value={p.id}>→ {p.username}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">{type === 'npc' ? t('npc.nameLabel') : t('npc.titleLabel')}</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'npc' ? t('npc.namePlaceholder') : t('npc.titlePlaceholder')} />
        </div>

        {type === 'npc' ? (
          <>
            {/* Portrait upload */}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 12,
                border: '1px dashed var(--ochre-deep)', padding: '8px 12px', cursor: 'pointer',
              }}>
                <div style={{ width: 44, height: 56, flexShrink: 0, background: 'rgba(184,153,104,0.06)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {imagePreview
                    ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--moss)" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  }
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {imagePreview ? t('npc.changePhoto') : t('npc.addPhoto')}
                </span>
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
              </label>
              {imagePreview && (
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}
                  style={{ marginTop: 4, background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                  {t('npc.removePhoto')}
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">{t('npc.role')}</label>
                <input className="form-input" value={npc.role} onChange={(e) => setNpcField('role', e.target.value)} placeholder={t('npc.rolePlaceholder')} />
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">{t('npc.age')}</label>
                <input className="form-input" value={npc.age} onChange={(e) => setNpcField('age', e.target.value)} placeholder={t('npc.agePlaceholder')} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('npc.status')}</label>
              <select className="form-input" value={npc.status} onChange={(e) => setNpcField('status', e.target.value)}>
                <option value="">{t('npc.statusUnknown')}</option>
                <option value="живий">{t('npc.alive')}</option>
                <option value="мертвий">{t('npc.dead')}</option>
                <option value="зниклий">{t('npc.missing')}</option>
                <option value="підозрюваний">{t('npc.suspect')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('npc.appearance')}</label>
              <textarea className="form-input" value={npc.appearance} onChange={(e) => setNpcField('appearance', e.target.value)} placeholder={t('npc.appearancePlaceholder')} rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('npc.character')}</label>
              <textarea className="form-input" value={npc.character} onChange={(e) => setNpcField('character', e.target.value)} placeholder={t('npc.characterPlaceholder')} rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('npc.connections')}</label>
              <textarea className="form-input" value={npc.connections} onChange={(e) => setNpcField('connections', e.target.value)} placeholder={t('npc.connectionPlaceholder')} rows={2} />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ color: 'rgba(196,122,114,0.8)' }}>{t('npc.secret')}</label>
              <textarea className="form-input" value={npc.secret} onChange={(e) => setNpcField('secret', e.target.value)} placeholder={t('npc.secretPlaceholder')} rows={2} style={{ borderColor: 'rgba(122,42,37,0.5)' }} />
            </div>
          </>
        ) : type === 'photo' ? (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">{t('photo.label')}</label>
            <label style={{
              display: 'block', border: '1px dashed var(--ochre-deep)',
              padding: imagePreview ? 0 : '20px 0', textAlign: 'center',
              cursor: 'pointer', overflow: 'hidden',
            }}>
              {imagePreview
                ? <img src={imagePreview} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
                : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)', letterSpacing: '0.18em' }}>
                    {t('photo.click')}
                  </span>
              }
              <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
            </label>
            {imagePreview && (
              <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}
                style={{ marginTop: 4, background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                {t('npc.removePhoto')}
              </button>
            )}
          </div>
        ) : type === 'sketch' ? (
          <div style={{ padding: '12px 0 4px', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)', letterSpacing: '0.14em' }}>
            {t('board.sketchHint')}
          </div>
        ) : (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">{t('table.content')}</label>
            <textarea className="form-input" value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('table.text')} rows={type === 'document' ? 5 : 3} />
          </div>
        )}

        <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={loading || !title.trim() || (type === 'photo' && !imageFile) || (type === 'sketch' && !title.trim())}>
          {loading ? t('table.saving') : t('table.addCard')}
        </button>
      </form>
    </div>
  )
}

// ── TablePage ──

export default function TablePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { setCards, setThreads, addCard, addConnectedUser, connectedUsers, diceLog, reset } = useTableStore()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [diceToasts, setDiceToasts] = useState([])
  const [cardToasts, setCardToasts] = useState([])
  const [boardTab, setBoardTab] = useState('public')
  const [createConfig, setCreateConfig] = useState({ open: false, type: 'document', pos: null })
  const [diceLogOpen, setDiceLogOpen] = useState(false)
  const [musicOpen, setMusicOpen] = useState(false)
  const [boundChar, setBoundChar] = useState(null)
  const toastId = useRef(0)

  const drawingStrokeHandlerRef = useRef(null)
  const cursorPingHandlerRef = useRef(null)

  const addDiceToast = useCallback((msg) => {
    const id = ++toastId.current
    setDiceToasts((prev) => [...prev, { id, ...msg }])
    setTimeout(() => setDiceToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
  }, [])

  const addCardToast = useCallback((card) => {
    const id = ++toastId.current
    setCardToasts((prev) => [...prev, { id, card }])
    setTimeout(() => setCardToasts((prev) => prev.filter((t) => t.id !== id)), 6000)
    setBoardTab('personal')
  }, [])

  const onDrawingStroke = useCallback((msg) => { drawingStrokeHandlerRef.current?.(msg) }, [])
  const onCursorPing = useCallback((msg) => { cursorPingHandlerRef.current?.(msg) }, [])

  const onWsConnected = useCallback(() => {
    getSession(id)
      .then((res) => {
        setSession(res.data)
        const players = res.data.players ?? []
        players.forEach((p) => addConnectedUser({ user_id: p.id, username: p.username }))
      })
      .catch(() => {})
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const wsRef = useWebSocket(id, user?.id, addDiceToast, onDrawingStroke, addCardToast, onWsConnected, onCursorPing)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sessRes, cardsRes, threadsRes] = await Promise.all([
        getSession(id),
        getCards(id),
        getThreads(id),
      ])
      setSession(sessRes.data)
      setCards(cardsRes.data.results ?? cardsRes.data)
      setThreads(threadsRes.data.results ?? threadsRes.data)

      const players = sessRes.data.players ?? []
      players.forEach((p) => addConnectedUser({ user_id: p.id, username: p.username }))
      if (sessRes.data.master) {
        addConnectedUser({ user_id: sessRes.data.master.id, username: sessRes.data.master.username })
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
    return () => reset()
  }, [load]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session || session.is_master) return
    getMySessionCharacter(id)
      .then((res) => setBoundChar(res.status === 204 ? null : (res.data ?? null)))
      .catch(() => {})
  }, [session, id])

  const isMaster = session?.is_master ?? false
  const players = session?.players ?? []

  if (loading) {
    return (
      <div style={{ padding: 60, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--moss-pale)', letterSpacing: '0.2em' }}>
        {t('table.loading')}
      </div>
    )
  }

  const STATUS_LABELS = {
    lobby: t('status.lobby'),
    active: t('status.active'),
    closed: t('status.closed'),
  }

  return (
    <div style={{ height: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px',
        borderBottom: '1px solid var(--ochre-deep)', background: 'var(--ink-0)',
        flexShrink: 0,
      }}>
        <button className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 10 }} onClick={() => navigate(`/sessions/${id}`)}>
          {t('table.lobby')}
        </button>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontStyle: 'italic', color: 'var(--cream)' }}>
          {session?.name}
        </span>
        <span className={`status-chip status-chip--${session?.status}`}>
          {STATUS_LABELS[session?.status] ?? session?.status}
        </span>
        <div style={{ flex: 1 }} />
        {!isMaster && boundChar && (
          <div style={{
            fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14,
            color: 'var(--ochre)', borderLeft: '1px solid var(--ochre-deep)', paddingLeft: 12,
          }}>
            {boundChar.character_name}
          </div>
        )}
        {!isMaster && !boundChar && !loading && (
          <div
            title={t('table.noCharWarningHint')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              borderLeft: '1px solid rgba(196,122,114,0.4)', paddingLeft: 12,
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/sessions/${id}`)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(196,122,114,0.85)" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              color: 'rgba(196,122,114,0.85)', letterSpacing: '0.18em', textTransform: 'uppercase',
            }}>
              {t('table.noCharWarning')}
            </span>
          </div>
        )}
        <button
          className="btn btn--ghost"
          style={{ padding: '4px 10px', fontSize: 10, position: 'relative' }}
          onClick={() => { setDiceLogOpen((v) => !v); setMusicOpen(false) }}
        >
          {t('table.diceLog')} {diceLog.length > 0 && (
            <span style={{
              marginLeft: 4, background: 'var(--blood)', color: '#fff',
              borderRadius: 8, fontSize: 8, padding: '1px 5px',
            }}>{diceLog.length}</span>
          )}
        </button>
        <button
          className="btn btn--ghost"
          style={{ padding: '4px 10px', fontSize: 10 }}
          onClick={() => { setMusicOpen((v) => !v); setDiceLogOpen(false) }}
        >
          {t('table.music')}
        </button>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <EvidenceBoard
          sessionId={id}
          isMaster={isMaster}
          currentUserId={user?.id}
          masterId={session?.master?.id}
          players={players}
          connectedUsers={connectedUsers}
          sessionName={session?.name ?? ''}
          wsRef={wsRef}
          drawingStrokeHandlerRef={drawingStrokeHandlerRef}
          cursorPingHandlerRef={cursorPingHandlerRef}
          tab={boardTab}
          onTabChange={setBoardTab}
          onBoardCreate={(type, boardX, boardY, tab) =>
            setCreateConfig({ open: true, type, pos: { x: boardX, y: boardY }, tab })
          }
        />
      </div>

      <CreateCardForm
        open={createConfig.open}
        onClose={() => setCreateConfig((c) => ({ ...c, open: false }))}
        initialType={createConfig.type}
        initialPos={createConfig.pos}
        initialTarget={boardTab === 'personal' ? 'personal' : 'public'}
        sessionId={id}
        isMaster={isMaster}
        currentUserId={user?.id}
        players={players}
        onCreated={(card) => {
          if (card.is_public) addCard(card)
          else if (card.owner?.id === user?.id || card.created_by?.id === user?.id) addCard(card)
        }}
      />

      {/* Dice log panel */}
      {diceLogOpen && (
        <div style={{
          position: 'fixed', top: 50, right: 0, bottom: 0, width: 300, zIndex: 400,
          background: 'var(--ink-0)', borderLeft: '1px solid var(--ochre-deep)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderBottom: '1px solid var(--ochre-deep)', flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--moss)' }}>
              {t('table.diceLogTitle')}
            </span>
            <button onClick={() => setDiceLogOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {diceLog.length === 0 && (
              <div style={{ padding: '24px 16px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss)', letterSpacing: '0.16em', textAlign: 'center' }}>
                {t('table.noDice')}
              </div>
            )}
            {diceLog.map((entry, i) => {
              const isPrivate = entry.visible_to_all === false
              const canSee = !isPrivate || isMaster || entry.rolled_by_id === user?.id
              if (!canSee) return null
              const tierColors = { critical: '#c8634d', extreme: '#8a6a30', hard: '#5a7850', regular: '#4a6878', failure: '#6a5050', fumble: '#7a2a25' }
              return (
                <div key={i} style={{
                  padding: '10px 16px', borderBottom: '1px solid rgba(184,153,104,0.08)',
                  opacity: isPrivate ? 0.85 : 1,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--moss)', letterSpacing: '0.18em' }}>
                      {entry.rolled_by}
                    </span>
                    {entry.character_name && (
                      <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 11, color: 'var(--ochre)' }}>
                        · {entry.character_name}
                      </span>
                    )}
                    {isPrivate && (
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--blood)', letterSpacing: '0.14em' }}>
                        {t('table.private')}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 26, fontFamily: 'var(--font-mono)', color: entry.tier ? tierColors[entry.tier] ?? 'var(--ochre-bright)' : 'var(--ochre-bright)', lineHeight: 1 }}>
                      {entry.total}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)', letterSpacing: '0.14em' }}>
                      {entry.count}{entry.dice_type}
                    </span>
                    {entry.skill_name && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--moss-pale)', letterSpacing: '0.12em' }}>
                        {entry.skill_name}
                      </span>
                    )}
                    {entry.tier && (
                      <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8, color: tierColors[entry.tier] ?? 'var(--ochre)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                        {entry.tier}
                      </span>
                    )}
                  </div>
                  {entry.count > 1 && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--moss)', marginTop: 2 }}>
                      [{entry.results?.join(' + ')}]
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <MusicPlayer sessionId={id} open={musicOpen} onClose={() => setMusicOpen(false)} />

      {/* Dice roll toasts */}
      <div style={{ position: 'fixed', bottom: 80, left: 24, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {diceToasts.map((toast) => (
          <div key={toast.id} style={{
            background: 'var(--ink-1)', border: '1px solid var(--ochre-deep)',
            padding: '10px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            fontFamily: 'var(--font-mono)', animation: 'fadeInUp 0.2s ease',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: 4 }}>
              {toast.rolled_by} · {toast.count}{toast.dice_type}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 28, color: 'var(--ochre-bright)', lineHeight: 1 }}>{toast.total}</span>
              {toast.count > 1 && (
                <span style={{ fontSize: 10, color: 'var(--moss-pale)' }}>
                  [{toast.results.join(' + ')}]
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* New card (evidence) toasts */}
      <div style={{ position: 'fixed', bottom: 80, right: 24, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
        {cardToasts.map(({ id, card }) => (
          <div key={id} style={{
            background: 'var(--ink-0)',
            border: '1px solid var(--blood)',
            borderLeft: '3px solid var(--blood)',
            padding: '14px 18px',
            boxShadow: '0 4px 24px rgba(122,42,37,0.35)',
            maxWidth: 280,
            animation: 'fadeInUp 0.3s ease',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 8,
              letterSpacing: '0.3em', textTransform: 'uppercase',
              color: 'rgba(196,100,90,0.8)', marginBottom: 6,
            }}>
              {t('table.newEvidenceSub')}
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 17, color: 'var(--cream)', lineHeight: 1.25, marginBottom: 4,
            }}>
              {t('table.newEvidence')}
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--ochre)', letterSpacing: '0.08em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {card.title}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
