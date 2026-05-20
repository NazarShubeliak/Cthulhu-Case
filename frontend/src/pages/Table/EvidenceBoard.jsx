import { useState, useRef, useEffect, useCallback } from 'react'
import useTableStore from '../../store/tableStore'
import { moveCard as apiMoveCard, createThread, deleteThread, publishCard, deleteCard } from '../../api/sessions'

// ── Constants ──

const CARD_W = 240
const CARD_H = 190

const KIND_COLOR = {
  document: '#f0e6c8',
  photo: '#d8d4cc',
  note: '#ecdfc0',
  npc: '#e4d8c0',
  location: '#d8e4d0',
}

const KIND_LAT = {
  document: 'Documentum',
  photo: 'Imago',
  note: 'Nota',
  npc: 'Persona',
  location: 'Locus',
}

const KIND_ROT = { document: -2, photo: 2, note: -1, npc: 1, location: 3 }

// ── Thread SVG layer ──

function ThreadsLayer({ cards, threads, onDeleteThread, isMaster, sessionId }) {
  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
      width="100%"
      height="100%"
    >
      <defs>
        <filter id="thread-shadow">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" floodColor="#000" floodOpacity="0.6" />
        </filter>
      </defs>
      {threads.map((t) => {
        const from = cards.find((c) => c.id === (t.card_from?.id ?? t.card_from))
        const to = cards.find((c) => c.id === (t.card_to?.id ?? t.card_to))
        if (!from || !to) return null
        const x1 = from.pos_x + CARD_W / 2
        const y1 = from.pos_y + CARD_H / 2
        const x2 = to.pos_x + CARD_W / 2
        const y2 = to.pos_y + CARD_H / 2
        const midX = (x1 + x2) / 2
        const midY = (y1 + y2) / 2
        const dx = x2 - x1
        const dy = y2 - y1
        const len = Math.sqrt(dx * dx + dy * dy)
        const sag = Math.min(40, len * 0.06)

        return (
          <g key={t.id} filter="url(#thread-shadow)" style={{ pointerEvents: 'all', cursor: 'pointer' }}>
            <path
              d={`M ${x1} ${y1} Q ${midX} ${midY + sag} ${x2} ${y2}`}
              stroke="var(--blood)"
              strokeWidth={1.8}
              strokeLinecap="round"
              fill="none"
              opacity={0.85}
            />
            {t.label && (
              <text
                x={midX}
                y={midY + sag - 6}
                textAnchor="middle"
                fill="var(--ochre)"
                fontSize="9"
                fontFamily="var(--font-mono)"
                letterSpacing="0.14em"
                style={{ textTransform: 'uppercase' }}
              >
                {t.label}
              </text>
            )}
            <circle cx={x1} cy={y1} r="4" fill="#7a2a25" stroke="#3a1410" strokeWidth="0.5" />
            <circle cx={x1} cy={y1} r="1.5" fill="#c8634d" />
            <circle cx={x2} cy={y2} r="4" fill="#7a2a25" stroke="#3a1410" strokeWidth="0.5" />
            <circle cx={x2} cy={y2} r="1.5" fill="#c8634d" />
            {/* Invisible wider path for easier clicking */}
            <path
              d={`M ${x1} ${y1} Q ${midX} ${midY + sag} ${x2} ${y2}`}
              stroke="transparent"
              strokeWidth={14}
              fill="none"
              onClick={() => {
                if (isMaster && window.confirm('Видалити нитку?')) {
                  deleteThread(sessionId, t.id)
                    .then(() => useTableStore.getState().removeThread(t.id))
                    .catch(() => {})
                }
              }}
            />
          </g>
        )
      })}
    </svg>
  )
}

// ── Cork card ──

function CorkCard({ card, selected, connectMode, onMouseDown, onClick, isMaster, currentUserId, sessionId }) {
  const color = KIND_COLOR[card.type] ?? KIND_COLOR.document
  const rot = KIND_ROT[card.type] ?? 0
  const isOwn = card.owner?.id === currentUserId
  const store = useTableStore()

  async function handlePublish(e) {
    e.stopPropagation()
    try {
      const res = await publishCard(sessionId, card.id)
      store.updateCard(res.data)
    } catch {}
  }

  async function handleDelete(e) {
    e.stopPropagation()
    if (!window.confirm('Видалити картку?')) return
    try {
      await deleteCard(sessionId, card.id)
      store.removeCard(card.id)
    } catch {}
  }

  return (
    <div
      onMouseDown={onMouseDown}
      onClick={onClick}
      style={{
        position: 'absolute',
        left: card.pos_x,
        top: card.pos_y,
        width: CARD_W,
        cursor: connectMode ? 'crosshair' : 'grab',
        zIndex: selected ? 50 : 10,
        transform: `rotate(${rot}deg)`,
        transition: selected ? 'none' : 'box-shadow .2s',
      }}
    >
      {/* Pin */}
      <div style={{
        position: 'absolute',
        top: -8, left: '50%', transform: 'translateX(-50%)',
        width: 14, height: 14, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #d04a3f, #7a2a25)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
        zIndex: 2,
      }} />

      <div style={{
        background: color,
        color: '#2a2418',
        padding: 14,
        boxShadow: selected
          ? '0 0 0 2px var(--ochre), 0 8px 24px rgba(0,0,0,0.7)'
          : connectMode
          ? '0 0 0 2px var(--blood), 0 6px 16px rgba(0,0,0,0.5)'
          : '0 6px 16px rgba(0,0,0,0.55)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: CARD_H,
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: '#7a6440', display: 'flex', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <span>{card.type}</span>
          <span style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', textTransform: 'none', letterSpacing: '0.08em' }}>
            {KIND_LAT[card.type] ?? ''}
          </span>
        </div>

        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 16,
          fontStyle: 'italic', lineHeight: 1.2,
          color: '#1f1a10', marginBottom: 8,
        }}>
          {card.title}
        </div>

        {card.content && (
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            lineHeight: 1.45, color: '#3a2e1c',
            overflow: 'hidden', flex: 1,
            display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
          }}>
            {card.content}
          </div>
        )}

        <div style={{
          display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8,
          paddingTop: 6, borderTop: '1px dashed #7a6440',
          pointerEvents: 'all',
        }}
          className="no-drag"
        >
          {isMaster && !card.is_public && (
            <button
              onClick={handlePublish}
              style={btnStyle('#7a6440')}
            >
              На стіл
            </button>
          )}
          {!isMaster && isOwn && !card.is_public && (
            <button onClick={handlePublish} style={btnStyle('#7a6440')}>
              Винести
            </button>
          )}
          {(isMaster || isOwn) && (
            <button onClick={handleDelete} style={btnStyle('#a04040')}>
              ×
            </button>
          )}
          {!card.is_public && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#a08050', letterSpacing: '0.14em', alignSelf: 'center' }}>
              приватна
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function btnStyle(color) {
  return {
    background: 'transparent', border: `1px solid ${color}`, color,
    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em',
    textTransform: 'uppercase', padding: '1px 6px', cursor: 'pointer',
  }
}

// ── Detail rail (bottom bar) ──

function DetailRail({ card, onConnect, connectMode, onCancelConnect }) {
  if (!card) {
    return (
      <div style={railStyle}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--moss)' }}>
          оберіть картку · клацніть і перетягуйте для переміщення
        </span>
      </div>
    )
  }
  return (
    <div style={railStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: 'var(--ochre)',
          border: '1px solid var(--ochre-deep)', padding: '2px 8px',
        }}>
          {card.type}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--cream)' }}>
          {card.title}
        </span>
        {card.created_by && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--moss)', letterSpacing: '0.12em' }}>
            {card.created_by.username}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {connectMode ? (
          <>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blood)', letterSpacing: '0.18em', alignSelf: 'center' }}>
              оберіть іншу картку для нитки
            </span>
            <button className="btn btn--ghost" style={{ fontSize: 10, padding: '4px 10px' }} onClick={onCancelConnect}>
              Скасувати
            </button>
          </>
        ) : (
          <button className="btn btn--ghost" style={{ fontSize: 10, padding: '4px 10px' }} onClick={onConnect}>
            + Нитка
          </button>
        )}
      </div>
    </div>
  )
}

const railStyle = {
  height: 52, flexShrink: 0,
  borderTop: '1px solid var(--ochre-deep)',
  background: 'var(--ink-0)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 28px', gap: 16,
}

// ── Main EvidenceBoard ──

export default function EvidenceBoard({ sessionId, isMaster, currentUserId, connectedUsers, sessionName }) {
  const { cards, threads } = useTableStore()
  const [selectedId, setSelectedId] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [zoom, setZoom] = useState(0.8)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panning, setPanning] = useState(null)
  const [connectMode, setConnectMode] = useState(false)
  const [filter, setFilter] = useState('all')
  const stageRef = useRef(null)
  const moveTimer = useRef(null)

  const selectedCard = cards.find((c) => c.id === selectedId) ?? null

  // ── Drag card ──
  const onCardMouseDown = useCallback((e, cardId) => {
    if (e.target.closest('.no-drag')) return
    if (connectMode) return
    e.stopPropagation()
    setSelectedId(cardId)
    const card = useTableStore.getState().cards.find((c) => c.id === cardId)
    if (!card) return
    setDragging({
      id: cardId,
      offsetX: e.clientX / zoom - card.pos_x,
      offsetY: e.clientY / zoom - card.pos_y,
    })
  }, [zoom, connectMode])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const pos_x = e.clientX / zoom - dragging.offsetX
      const pos_y = e.clientY / zoom - dragging.offsetY
      useTableStore.getState().moveCard(dragging.id, pos_x, pos_y)
    }
    const onUp = (e) => {
      const card = useTableStore.getState().cards.find((c) => c.id === dragging.id)
      if (card) {
        clearTimeout(moveTimer.current)
        moveTimer.current = setTimeout(() => {
          apiMoveCard(sessionId, dragging.id, card.pos_x, card.pos_y).catch(() => {})
        }, 0)
      }
      setDragging(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, zoom, sessionId])

  // ── Pan stage ──
  const onStageMouseDown = useCallback((e) => {
    if (e.target !== stageRef.current && !e.target.classList.contains('board-inner')) return
    setSelectedId(null)
    setPanning({ startX: e.clientX - pan.x, startY: e.clientY - pan.y })
  }, [pan])

  useEffect(() => {
    if (!panning) return
    const onMove = (e) => setPan({ x: e.clientX - panning.startX, y: e.clientY - panning.startY })
    const onUp = () => setPanning(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [panning])

  // ── Connect mode: click card to create thread ──
  const handleCardClick = useCallback(async (e, cardId) => {
    if (!connectMode || !selectedId || cardId === selectedId) return
    e.stopPropagation()
    const label = window.prompt('Підпис нитки (необов\'язково):') ?? ''
    try {
      const res = await createThread(sessionId, {
        card_from_id: selectedId,
        card_to_id: cardId,
        label: label.trim(),
      })
      useTableStore.getState().addThread(res.data)
    } catch {}
    setConnectMode(false)
  }, [connectMode, selectedId, sessionId])

  // Escape to cancel connect mode
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setConnectMode(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const visibleCards = filter === 'all' ? cards : cards.filter((c) => c.type === filter)
  const visibleIds = new Set(visibleCards.map((c) => c.id))
  const visibleThreads = threads.filter((t) => {
    const fId = t.card_from?.id ?? t.card_from
    const tId = t.card_to?.id ?? t.card_to
    return visibleIds.has(fId) && visibleIds.has(tId)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 24px', borderBottom: '1px solid var(--ochre-deep)',
        background: 'var(--ink-0)', flexShrink: 0, gap: 12,
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--moss)' }}>
            Дошка доказів · Mensa Probationum
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic', color: 'var(--cream)', marginTop: 2 }}>
            {sessionName}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Filter tabs */}
          {[['all', 'Всі'], ['document', 'Документи'], ['photo', 'Фото'], ['npc', 'НПС'], ['location', 'Локації'], ['note', 'Нотатки']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
              border: `1px solid ${filter === k ? 'var(--ochre)' : 'var(--ochre-deep)'}`,
              color: filter === k ? 'var(--ochre-bright)' : 'var(--moss-pale)',
              background: filter === k ? 'rgba(184,153,104,0.08)' : 'transparent',
            }}>{l}</button>
          ))}

          <div style={{ width: 1, height: 20, background: 'var(--ochre-deep)' }} />

          {/* Connected users */}
          <div style={{ display: 'flex', gap: 6 }}>
            {connectedUsers.map((u, i) => (
              <div key={u.user_id ?? i} title={u.username} style={{
                width: 26, height: 26, borderRadius: '50%',
                border: '1.5px solid var(--ochre)',
                background: 'var(--ink-1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12,
                color: 'var(--ochre)',
              }}>
                {u.username?.[0]?.toUpperCase() ?? '?'}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stage ── */}
      <div
        ref={stageRef}
        onMouseDown={onStageMouseDown}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          cursor: panning ? 'grabbing' : connectMode ? 'crosshair' : 'grab',
          background: `
            radial-gradient(circle at 30% 20%, rgba(184,153,104,0.04), transparent 50%),
            radial-gradient(circle at 70% 80%, rgba(61,90,68,0.05), transparent 50%),
            #1a1410
          `,
        }}
      >
        <div
          className="board-inner"
          style={{
            position: 'absolute', top: 0, left: 0,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: 2400, height: 1600,
          }}
        >
          <ThreadsLayer
            cards={visibleCards}
            threads={visibleThreads}
            onDeleteThread={(tid) => useTableStore.getState().removeThread(tid)}
            isMaster={isMaster}
            sessionId={sessionId}
          />
          {visibleCards.map((card) => (
            <CorkCard
              key={card.id}
              card={card}
              selected={selectedId === card.id}
              connectMode={connectMode && selectedId !== null && selectedId !== card.id}
              onMouseDown={(e) => onCardMouseDown(e, card.id)}
              onClick={(e) => handleCardClick(e, card.id)}
              isMaster={isMaster}
              currentUserId={currentUserId}
              sessionId={sessionId}
            />
          ))}
        </div>

        {/* Zoom controls */}
        <div style={{
          position: 'absolute', bottom: 20, right: 20,
          display: 'flex', flexDirection: 'column', gap: 4,
          background: 'var(--ink-0)', border: '1px solid var(--ochre-deep)', padding: 4,
        }}>
          <ZoomBtn label="+" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(1)))} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textAlign: 'center', color: 'var(--ochre-dim)', letterSpacing: '0.1em' }}>
            {Math.round(zoom * 100)}%
          </div>
          <ZoomBtn label="−" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.1).toFixed(1)))} />
          <ZoomBtn label="⌂" onClick={() => { setZoom(0.8); setPan({ x: 0, y: 0 }) }} title="Скинути" />
        </div>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 20, left: 20,
          background: 'var(--ink-0)', border: '1px solid var(--ochre-deep)',
          padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 9,
          letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--moss-pale)',
          lineHeight: 2,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke="var(--blood)" strokeWidth="1.8" /></svg>
            <span>нитка зв&apos;язку</span>
          </div>
        </div>

        {/* Empty state */}
        {visibleCards.length === 0 && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.28em',
            textTransform: 'uppercase', color: 'var(--moss)', textAlign: 'center',
          }}>
            Дошка порожня · Nullae Chartae
          </div>
        )}
      </div>

      {/* ── Detail rail ── */}
      <DetailRail
        card={selectedCard}
        connectMode={connectMode}
        onConnect={() => setConnectMode(true)}
        onCancelConnect={() => setConnectMode(false)}
      />
    </div>
  )
}

function ZoomBtn({ label, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28, color: 'var(--ochre)', background: 'transparent',
        fontFamily: 'var(--font-display)', fontSize: 16,
        border: '1px solid transparent', cursor: 'pointer',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ochre-deep)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
    >
      {label}
    </button>
  )
}
