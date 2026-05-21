import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore.js'
import useTableStore from '../../store/tableStore.js'
import useWebSocket from '../../hooks/useWebSocket.js'
import { getSession, getCards, getThreads, getNotes, createCard, createNote, deleteNote } from '../../api/sessions.js'
import EvidenceBoard from './EvidenceBoard.jsx'

// ── Constants ──

const CARD_TYPES = [
  { value: 'document', label: 'Документ' },
  { value: 'photo', label: 'Фото' },
  { value: 'note', label: 'Нотатка' },
  { value: 'npc', label: 'НПС' },
]

const STATUS_LABELS = { lobby: 'Лобі', active: 'Активна', closed: 'Закрита' }

// ── Create card form (master only) ──

function CreateCardForm({ sessionId, isMaster, currentUserId, players, onCreated }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('document')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [npc, setNpc] = useState({ role: '', age: '', status: '', appearance: '', character: '', connections: '', secret: '' })
  const [target, setTarget] = useState('public')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function setNpcField(field, value) { setNpc((p) => ({ ...p, [field]: value })) }

  function resetForm() {
    setTitle(''); setContent('')
    setNpc({ role: '', age: '', status: '', appearance: '', character: '', connections: '', secret: '' })
    setTarget('public'); setType('document')
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
      resetForm()
      setOpen(false)
    } catch (err) {
      setError(err.response?.data?.detail || 'Помилка створення картки.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        className="btn btn--primary"
        style={{ position: 'fixed', bottom: 70, right: 24, zIndex: 100 }}
        onClick={() => setOpen(true)}
      >
        + Картка
      </button>
    )
  }

  return (
    <div style={{
      position: 'fixed', bottom: 70, right: 24, zIndex: 200,
      background: 'var(--ink-1)', border: '1px solid var(--ochre-deep)',
      padding: 20, width: 340,
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      maxHeight: 'calc(100vh - 100px)', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--moss)' }}>
          Нова картка · Nova Charta
        </span>
        <button onClick={() => { setOpen(false); resetForm() }} style={{ background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontSize: 16 }}>×</button>
      </div>
      {error && <div className="auth-error" style={{ marginBottom: 10 }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Тип</label>
            <select className="form-input" value={type} onChange={(e) => setType(e.target.value)}>
              {CARD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Куди</label>
            <select className="form-input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="public">Загальний стіл</option>
              <option value="personal">Особистий</option>
              {isMaster && players.map((p) => (
                <option key={p.id} value={p.id}>→ {p.username}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">{type === 'npc' ? 'Ім\'я' : 'Назва'}</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'npc' ? 'Ім\'я персонажа...' : 'Заголовок...'} />
        </div>

        {type === 'npc' ? (
          <>
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
        ) : (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Зміст</label>
            <textarea className="form-input" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Текст..." rows={type === 'document' ? 5 : 3} />
          </div>
        )}

        <button type="submit" className="btn btn--primary" style={{ width: '100%' }} disabled={loading || !title.trim()}>
          {loading ? 'Збереження...' : 'Додати картку'}
        </button>
      </form>
    </div>
  )
}

// ── Notes sidebar ──

function NotesPanel({ sessionId, currentUserId, isMaster, open, onClose }) {
  const { notes, addNote, removeNote } = useTableStore()
  const [content, setContent] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    try {
      const res = await createNote(sessionId, { content: content.trim(), is_private: isPrivate })
      addNote(res.data)
      setContent('')
    } catch {} finally { setLoading(false) }
  }

  async function handleDelete(noteId) {
    try {
      await deleteNote(sessionId, noteId)
      removeNote(noteId)
    } catch {}
  }

  function timeAgo(d) {
    const m = Math.floor((Date.now() - new Date(d)) / 60000)
    if (m < 1) return 'щойно'
    if (m < 60) return `${m} хв`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} год`
    return `${Math.floor(h / 24)} дн`
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 300, zIndex: 150,
      background: 'var(--ink-1)', borderLeft: '1px solid var(--ochre-deep)',
      display: 'flex', flexDirection: 'column', padding: 16,
      boxShadow: '-4px 0 20px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--moss)' }}>
          Нотатки · Notae
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontSize: 18 }}>×</button>
      </div>

      <form onSubmit={handleAdd} style={{ marginBottom: 16, flexShrink: 0 }}>
        <textarea
          className="form-input" value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Нотатка..." rows={3} style={{ marginBottom: 8, fontSize: 13 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label className="toggle">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            <span className="toggle__track"><span className="toggle__thumb" /></span>
            Приватна
          </label>
          <button type="submit" className="btn btn--primary" style={{ padding: '5px 12px' }} disabled={loading || !content.trim()}>
            {loading ? '...' : 'Додати'}
          </button>
        </div>
      </form>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notes.length === 0 ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss)', letterSpacing: '0.18em', textAlign: 'center', padding: '24px 0' }}>
            Нотаток немає
          </div>
        ) : notes.map((note) => (
          <div key={note.id} className="note-item">
            <div className="note-item__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="note-item__author">{note.author?.username ?? '—'}</span>
                {note.is_private && <span className="note-item__private">🔒</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)' }}>{timeAgo(note.created_at)}</span>
                {note.author?.id === currentUserId && (
                  <button
                    onClick={() => handleDelete(note.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontSize: 12 }}
                  >×</button>
                )}
              </div>
            </div>
            <div className="note-item__content">{note.content}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── TablePage ──

export default function TablePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { setCards, setThreads, setNotes, addCard, addConnectedUser, connectedUsers, reset } = useTableStore()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notesOpen, setNotesOpen] = useState(false)

  useWebSocket(id, user?.id)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sessRes, cardsRes, threadsRes, notesRes] = await Promise.all([
        getSession(id),
        getCards(id),
        getThreads(id),
        getNotes(id),
      ])
      setSession(sessRes.data)
      setCards(cardsRes.data.results ?? cardsRes.data)
      setThreads(threadsRes.data.results ?? threadsRes.data)
      setNotes(notesRes.data.results ?? notesRes.data)

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
        <button
          className="btn btn--ghost"
          style={{ padding: '4px 10px', fontSize: 10 }}
          onClick={() => setNotesOpen((v) => !v)}
        >
          {notesOpen ? 'Закрити нотатки' : 'Нотатки'}
        </button>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <EvidenceBoard
          sessionId={id}
          isMaster={isMaster}
          currentUserId={user?.id}
          connectedUsers={connectedUsers}
          sessionName={session?.name ?? ''}
        />
      </div>

      {/* Floating create button — all participants */}
      <CreateCardForm
        sessionId={id}
        isMaster={isMaster}
        currentUserId={user?.id}
        players={players}
        onCreated={(card) => {
          if (card.is_public) addCard(card)
          else if (card.owner?.id === user?.id || card.created_by?.id === user?.id) addCard(card)
        }}
      />

      {/* Notes sidebar */}
      <NotesPanel
        sessionId={id}
        currentUserId={user?.id}
        isMaster={isMaster}
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
      />
    </div>
  )
}
