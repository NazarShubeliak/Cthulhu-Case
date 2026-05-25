import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore.js'
import useTableStore from '../../store/tableStore.js'
import useWebSocket from '../../hooks/useWebSocket.js'
import { getSession, getCards, getThreads, createCard } from '../../api/sessions.js'
import EvidenceBoard from './EvidenceBoard.jsx'

// ── Constants ──

const CARD_TYPES = [
  { value: 'document', label: 'Документ' },
  { value: 'photo', label: 'Фото' },
  { value: 'note', label: 'Нотатка' },
  { value: 'npc', label: 'Досьє' },
]

const STATUS_LABELS = { lobby: 'Лобі', active: 'Активна', closed: 'Закрита' }

// ── Create card form (master only) ──

function CreateCardForm({ sessionId, isMaster, currentUserId, players, onCreated, open, onClose, initialType, initialPos, initialTarget }) {
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
      setError(err.response?.data?.detail || 'Помилка створення картки.')
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
          <label className="form-label">Куди</label>
          <select className="form-input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="public">Загальний стіл</option>
            <option value="personal">Особистий</option>
            {isMaster && players.map((p) => (
              <option key={p.id} value={p.id}>→ {p.username}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">{type === 'npc' ? 'Ім\'я' : 'Назва'}</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'npc' ? 'Ім\'я персонажа...' : 'Заголовок...'} />
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
                  {imagePreview ? 'Змінити фото' : 'Додати фото (необов\'язково)'}
                </span>
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
              </label>
              {imagePreview && (
                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}
                  style={{ marginTop: 4, background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                  × прибрати фото
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Роль / Посада</label>
                <input className="form-input" value={npc.role} onChange={(e) => setNpcField('role', e.target.value)} placeholder="Детектив, крамар..." />
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Вік</label>
                <input className="form-input" value={npc.age} onChange={(e) => setNpcField('age', e.target.value)} placeholder="35..." />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Статус</label>
              <select className="form-input" value={npc.status} onChange={(e) => setNpcField('status', e.target.value)}>
                <option value="">— невідомо —</option>
                <option value="живий">Живий</option>
                <option value="мертвий">Мертвий</option>
                <option value="зниклий">Зниклий</option>
                <option value="підозрюваний">Підозрюваний</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Зовнішність</label>
              <textarea className="form-input" value={npc.appearance} onChange={(e) => setNpcField('appearance', e.target.value)} placeholder="Як виглядає, одяг, особливі прикмети..." rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label">Характер</label>
              <textarea className="form-input" value={npc.character} onChange={(e) => setNpcField('character', e.target.value)} placeholder="Поведінка, манери, страхи..." rows={2} />
            </div>
            <div className="form-group">
              <label className="form-label">Зв&apos;язки</label>
              <textarea className="form-input" value={npc.connections} onChange={(e) => setNpcField('connections', e.target.value)} placeholder="З ким пов'язаний, де буває..." rows={2} />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ color: 'rgba(196,122,114,0.8)' }}>Секрет</label>
              <textarea className="form-input" value={npc.secret} onChange={(e) => setNpcField('secret', e.target.value)} placeholder="Що приховує..." rows={2} style={{ borderColor: 'rgba(122,42,37,0.5)' }} />
            </div>
          </>
        ) : type === 'photo' ? (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Зображення</label>
            <label style={{
              display: 'block', border: '1px dashed var(--ochre-deep)',
              padding: imagePreview ? 0 : '20px 0', textAlign: 'center',
              cursor: 'pointer', overflow: 'hidden',
            }}>
              {imagePreview
                ? <img src={imagePreview} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
                : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)', letterSpacing: '0.18em' }}>
                    Клікни щоб обрати фото
                  </span>
              }
              <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
            </label>
            {imagePreview && (
              <button type="button" onClick={() => { setImageFile(null); setImagePreview(null) }}
                style={{ marginTop: 4, background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                × прибрати фото
              </button>
            )}
          </div>
        ) : (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Зміст</label>
            <textarea className="form-input" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Текст..." rows={type === 'document' ? 5 : 3} />
          </div>
        )}

        <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={loading || !title.trim() || (type === 'photo' && !imageFile)}>
          {loading ? 'Збереження...' : 'Додати картку'}
        </button>
      </form>
    </div>
  )
}

// ── TablePage ──

export default function TablePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { setCards, setThreads, addCard, addConnectedUser, connectedUsers, reset } = useTableStore()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [diceToasts, setDiceToasts] = useState([])
  const [createConfig, setCreateConfig] = useState({ open: false, type: 'document', pos: null })
  const toastId = useRef(0)

  const addDiceToast = useCallback((msg) => {
    const id = ++toastId.current
    setDiceToasts((prev) => [...prev, { id, ...msg }])
    setTimeout(() => setDiceToasts((prev) => prev.filter((t) => t.id !== id)), 5000)
  }, [])

  useWebSocket(id, user?.id, addDiceToast)

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

      // seed connected users from players list
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

  const isMaster = session?.is_master ?? false
  const players = session?.players ?? []

  if (loading) {
    return (
      <div style={{ padding: 60, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--moss-pale)', letterSpacing: '0.2em' }}>
        Завантаження столу...
      </div>
    )
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
          ← Лобі
        </button>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontStyle: 'italic', color: 'var(--cream)' }}>
          {session?.name}
        </span>
        <span className={`status-chip status-chip--${session?.status}`}>
          {STATUS_LABELS[session?.status] ?? session?.status}
        </span>
        <div style={{ flex: 1 }} />
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <EvidenceBoard
          sessionId={id}
          isMaster={isMaster}
          currentUserId={user?.id}
          masterId={session?.master?.id}
          connectedUsers={connectedUsers}
          sessionName={session?.name ?? ''}
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
        initialTarget={createConfig.tab === 'personal' ? 'personal' : 'public'}
        sessionId={id}
        isMaster={isMaster}
        currentUserId={user?.id}
        players={players}
        onCreated={(card) => {
          if (card.is_public) addCard(card)
          else if (card.owner?.id === user?.id || card.created_by?.id === user?.id) addCard(card)
        }}
      />


      {/* Dice roll toasts */}
      <div style={{ position: 'fixed', bottom: 80, left: 24, zIndex: 300, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {diceToasts.map((t) => (
          <div key={t.id} style={{
            background: 'var(--ink-1)', border: '1px solid var(--ochre-deep)',
            padding: '10px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            fontFamily: 'var(--font-mono)', animation: 'fadeInUp 0.2s ease',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: 4 }}>
              {t.rolled_by} · {t.count}{t.dice_type}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 28, color: 'var(--ochre-bright)', lineHeight: 1 }}>{t.total}</span>
              {t.count > 1 && (
                <span style={{ fontSize: 10, color: 'var(--moss-pale)' }}>
                  [{t.results.join(' + ')}]
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
