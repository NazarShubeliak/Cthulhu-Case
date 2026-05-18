import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore.js'
import { getSession } from '../../api/sessions.js'
import {
  getCards, createCard, deleteCard, publishCard,
  getNotes, createNote, deleteNote,
} from '../../api/sessions.js'

// --------------- Constants ---------------

const CARD_TYPES = [
  { value: 'document', label: 'Документ' },
  { value: 'photo', label: 'Фото' },
  { value: 'note', label: 'Нотатка' },
  { value: 'npc', label: 'НПС' },
  { value: 'location', label: 'Локація' },
]

const CARD_COLORS = {
  document: '#f0e6c8',
  photo: '#d8d4cc',
  note: '#ecdfc0',
  npc: '#e4d8c0',
  location: '#d8e4d0',
}

const TYPE_LABELS_LA = {
  document: 'Documentum',
  photo: 'Imago',
  note: 'Nota',
  npc: 'Persona',
  location: 'Locus',
}

const STATUS_LABELS = {
  lobby: 'Лобі',
  active: 'Активна',
  closed: 'Закрита',
}

const FILTER_TABS = [
  { key: 'all', label: 'Всі' },
  { key: 'document', label: 'Документи' },
  { key: 'photo', label: 'Фото' },
  { key: 'npc', label: 'НПС' },
  { key: 'location', label: 'Локації' },
  { key: 'note', label: 'Нотатки' },
]

// --------------- CardItem ---------------

function CardItem({ card, isMaster, currentUserId, players, sessionId, onPublish, onDelete }) {
  const bg = CARD_COLORS[card.type] ?? CARD_COLORS.document
  const isPrivate = !card.is_public
  const isOwn = card.owner?.id === currentUserId

  return (
    <div
      className={`evidence-card${isPrivate ? ' evidence-card--private' : ''}`}
      style={{ background: bg }}
    >
      <div className="evidence-card__pin" />
      <div className="evidence-card__type">
        <span>{CARD_TYPES.find((t) => t.value === card.type)?.label ?? card.type}</span>
        <span style={{ opacity: 0.6 }}>{TYPE_LABELS_LA[card.type] ?? ''}</span>
      </div>
      <div className="evidence-card__title">{card.title}</div>
      {card.content && (
        <div className="evidence-card__body">{card.content}</div>
      )}
      <div className="evidence-card__footer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <span>{card.created_by?.username ?? '—'}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {isMaster && isPrivate && (
              <span style={{ color: '#a08050', fontSize: 9, letterSpacing: '0.14em' }}>приватна</span>
            )}
            {isMaster && (
              <button
                onClick={() => onPublish(card.id)}
                style={{
                  background: 'transparent',
                  border: '1px solid #7a6440',
                  color: card.is_public ? '#3a7a40' : '#7a6440',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  padding: '1px 6px',
                  cursor: 'pointer',
                }}
              >
                {card.is_public ? 'Публічна ✓' : 'Зробити публічною'}
              </button>
            )}
            {!isMaster && isOwn && isPrivate && (
              <button
                onClick={() => onPublish(card.id)}
                style={{
                  background: 'transparent',
                  border: '1px solid #7a6440',
                  color: '#7a6440',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  padding: '1px 6px',
                  cursor: 'pointer',
                }}
              >
                Винести на стіл
              </button>
            )}
            {(isMaster || isOwn) && (
              <button
                onClick={() => onDelete(card.id)}
                style={{
                  background: 'transparent',
                  border: '1px solid #a04040',
                  color: '#a04040',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  padding: '1px 6px',
                  cursor: 'pointer',
                }}
              >
                Видалити
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// --------------- CreateCardForm ---------------

function CreateCardForm({ sessionId, players, onCreated }) {
  const [type, setType] = useState('document')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [target, setTarget] = useState('public') // 'public' | player id
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    setError('')
    try {
      const payload = { type, title: title.trim(), content: content.trim() }
      if (target === 'public') {
        payload.is_public = true
      } else {
        payload.owner_id = parseInt(target, 10)
        payload.is_public = false
      }
      const res = await createCard(sessionId, payload)
      setTitle('')
      setContent('')
      setTarget('public')
      setType('document')
      onCreated(res.data)
    } catch (err) {
      setError(err.response?.data?.detail || 'Помилка створення картки.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: 'var(--ink-2)',
        border: '1px solid var(--ochre-deep)',
        padding: 20,
        marginTop: 24,
      }}
    >
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
        Нова Картка · Nova Charta
      </div>
      {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Тип</label>
            <select
              className="form-input"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {CARD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Кому</label>
            <select
              className="form-input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="public">Загальний стіл</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.username}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Назва</label>
          <input
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок картки..."
          />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Зміст</label>
          <textarea
            className="form-input"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Текст або опис..."
            rows={3}
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={loading || !title.trim()}>
          {loading ? 'Збереження...' : 'Додати картку'}
        </button>
      </form>
    </div>
  )
}

// --------------- NotesPanel ---------------

function NotesPanel({ sessionId, currentUserId, isMaster }) {
  const [notes, setNotes] = useState([])
  const [content, setContent] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getNotes(sessionId)
      .then((res) => setNotes(res.data.results ?? res.data))
      .catch(() => {})
  }, [sessionId])

  async function handleAddNote(e) {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)
    try {
      const res = await createNote(sessionId, { content: content.trim(), is_private: isPrivate })
      setNotes((prev) => [res.data, ...prev])
      setContent('')
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(noteId) {
    try {
      await deleteNote(sessionId, noteId)
      setNotes((prev) => prev.filter((n) => n.id !== noteId))
    } catch {
      // ignore
    }
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'щойно'
    if (mins < 60) return `${mins} хв тому`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} год тому`
    return `${Math.floor(hrs / 24)} дн тому`
  }

  return (
    <>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'var(--moss)',
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        Нотатки · Notae
      </div>

      {/* Add note form */}
      <form onSubmit={handleAddNote} style={{ marginBottom: 20, flexShrink: 0 }}>
        <textarea
          className="form-input"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ваші нотатки..."
          rows={3}
          style={{ marginBottom: 8, fontSize: 13 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
          <label className="toggle">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
            />
            <span className="toggle__track">
              <span className="toggle__thumb" />
            </span>
            Приватна
          </label>
          <button type="submit" className="btn btn--primary" disabled={loading || !content.trim()} style={{ padding: '6px 12px' }}>
            {loading ? '...' : 'Додати'}
          </button>
        </div>
      </form>

      {/* Notes list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notes.length === 0 ? (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--moss)',
              letterSpacing: '0.18em',
              textAlign: 'center',
              padding: '20px 0',
            }}
          >
            Нотаток немає
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="note-item">
              <div className="note-item__header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="note-item__author">{note.author?.username ?? '—'}</span>
                  {note.is_private && (
                    <span className="note-item__private">🔒 приватна</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--moss)',
                      letterSpacing: '0.12em',
                    }}
                  >
                    {timeAgo(note.created_at)}
                  </span>
                  {note.author?.id === currentUserId && (
                    <button
                      onClick={() => handleDelete(note.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--moss)',
                        cursor: 'pointer',
                        fontSize: 11,
                        padding: '0 2px',
                        lineHeight: 1,
                      }}
                      title="Видалити"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <div className="note-item__content">{note.content}</div>
            </div>
          ))
        )}
      </div>
    </>
  )
}

// --------------- TablePage ---------------

export default function TablePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const [session, setSession] = useState(null)
  const [cards, setCards] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sessRes, cardsRes] = await Promise.all([
        getSession(id),
        getCards(id),
      ])
      setSession(sessRes.data)
      setCards(cardsRes.data.results ?? cardsRes.data)
    } catch {
      // handle silently
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const isMaster = session?.is_master ?? false
  const players = session?.players ?? []

  const filteredCards = filter === 'all' ? cards : cards.filter((c) => c.type === filter)

  async function handlePublish(cardId) {
    try {
      const res = await publishCard(id, cardId)
      setCards((prev) => prev.map((c) => (c.id === cardId ? res.data : c)))
    } catch {
      // ignore
    }
  }

  async function handleDelete(cardId) {
    if (!window.confirm('Видалити картку?')) return
    try {
      await deleteCard(id, cardId)
      setCards((prev) => prev.filter((c) => c.id !== cardId))
    } catch {
      // ignore
    }
  }

  function handleCardCreated(card) {
    setCards((prev) => [card, ...prev])
  }

  if (loading) {
    return (
      <div style={{ padding: '60px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--moss-pale)', letterSpacing: '0.2em' }}>
        Завантаження столу...
      </div>
    )
  }

  return (
    <div className="table-layout">
      {/* Left: Cards area */}
      <div className="table-cards">
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginBottom: 20,
            flexWrap: 'wrap',
          }}
        >
          <button
            className="btn btn--ghost"
            style={{ padding: '5px 10px', fontSize: 10 }}
            onClick={() => navigate(`/sessions/${id}`)}
          >
            ← Лобі
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontStyle: 'italic',
                color: 'var(--cream)',
              }}
            >
              {session?.name}
            </span>
            <span className={`status-chip status-chip--${session?.status}`}>
              {STATUS_LABELS[session?.status] ?? session?.status}
            </span>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="filter-tabs">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`filter-tab${filter === tab.key ? ' filter-tab--active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Cards grid */}
        {filteredCards.length === 0 ? (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--moss)',
              textAlign: 'center',
              padding: '48px 0',
              border: '1px dashed var(--ochre-deep)',
              marginTop: 20,
            }}
          >
            Жодних карток · Nullae Chartae
          </div>
        ) : (
          <div className="card-grid">
            {filteredCards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                isMaster={isMaster}
                currentUserId={user?.id}
                players={players}
                sessionId={id}
                onPublish={handlePublish}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Master create card form */}
        {isMaster && (
          <CreateCardForm
            sessionId={id}
            players={players}
            onCreated={handleCardCreated}
          />
        )}
      </div>

      {/* Right: Notes panel */}
      <div className="table-notes">
        <NotesPanel
          sessionId={id}
          currentUserId={user?.id}
          isMaster={isMaster}
        />
      </div>
    </div>
  )
}
