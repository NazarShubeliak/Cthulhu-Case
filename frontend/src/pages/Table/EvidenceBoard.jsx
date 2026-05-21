import { useState, useRef, useEffect, useCallback } from 'react'
import useTableStore from '../../store/tableStore'
import { moveCard as apiMoveCard, createThread, deleteThread, publishCard, deleteCard, updateCard as apiUpdateCard, pinCard } from '../../api/sessions'

// ── Constants ──

const CARD_W = 240
const CARD_H = 190

const DOC_W = 260
const DOC_H = 340

const NPC_W = 300
const NPC_H = 420

const NOTE_W = 200
const NOTE_H = 160

const PHOTO_W = 220
const PHOTO_H = 260

const KIND_COLOR = {
  document: '#f5f0e0',
  photo: '#d8d4cc',
  note: '#ecdfc0',
  npc: '#e8e0d0',
}

const KIND_LAT = {
  document: 'Documentum',
  photo: 'Imago',
  note: 'Nota',
  npc: 'Persona',
}

const KIND_ROT = { document: -1, photo: 2, note: -2, npc: 1 }

// ── Thread SVG layer ──

function cardDims(type) {
  if (type === 'document') return { w: DOC_W, h: DOC_H }
  if (type === 'npc') return { w: NPC_W, h: NPC_H }
  if (type === 'note') return { w: NOTE_W, h: NOTE_H }
  if (type === 'photo') return { w: PHOTO_W, h: PHOTO_H }
  return { w: CARD_W, h: CARD_H }
}

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
        const fd = cardDims(from.type); const td = cardDims(to.type)
        const x1 = from.pos_x + fd.w / 2
        const y1 = from.pos_y + fd.h / 2
        const x2 = to.pos_x + td.w / 2
        const y2 = to.pos_y + td.h / 2
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


function DocumentCard({ card, selected, connectMode }) {
  return (
    <div style={{
      background: '#f6f2e4',
      color: '#1a1208',
      width: DOC_W,
      minHeight: DOC_H,
      padding: '20px 22px 14px',
      boxShadow: selected
        ? '0 0 0 2px var(--ochre), 0 12px 32px rgba(0,0,0,0.75)'
        : connectMode
        ? '0 0 0 2px var(--blood), 0 8px 20px rgba(0,0,0,0.5)'
        : '2px 4px 8px rgba(0,0,0,0.4), 4px 8px 24px rgba(0,0,0,0.35)',
      display: 'flex', flexDirection: 'column',
      borderLeft: '3px solid #c8b890',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.3em',
        textTransform: 'uppercase', color: '#8a7450',
        borderBottom: '1px solid #c8b890', paddingBottom: 6, marginBottom: 10,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Documentum</span>
        <span style={{ letterSpacing: '0.1em' }}>{card.created_by?.username ?? ''}</span>
      </div>

      <div style={{
        fontFamily: 'var(--font-display)', fontStyle: 'italic',
        fontSize: 17, lineHeight: 1.2, color: '#1a1208', marginBottom: 12,
        borderBottom: '1px solid #d4c8a0', paddingBottom: 8,
      }}>
        {card.title}
      </div>

      {card.content && (
        <div style={{
          fontFamily: 'var(--font-body, Georgia, serif)', fontSize: 12,
          lineHeight: 1.7, color: '#2a2010', flex: 1,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {card.content}
        </div>
      )}
    </div>
  )
}

const STATUS_COLOR = {
  'живий': '#3a6040',
  'мертвий': '#7a2a25',
  'зниклий': '#6a5020',
  'підозрюваний': '#4a3a70',
}

function parseNpcContent(raw) {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function NpcField({ label, value, secret }) {
  const text = value || 'невідомо'
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 7.5, letterSpacing: '0.22em',
        textTransform: 'uppercase', marginBottom: 2,
        color: secret ? 'rgba(196,100,90,0.7)' : '#8a7450',
      }}>{label}</div>
      <div style={{
        fontFamily: 'Georgia, serif', fontSize: 11,
        lineHeight: 1.5, color: secret ? '#5a1a15' : '#2a2010',
        background: secret ? 'rgba(122,42,37,0.08)' : 'transparent',
        padding: secret ? '3px 5px' : 0,
        borderLeft: secret ? '2px solid rgba(122,42,37,0.3)' : 'none',
        fontStyle: value ? 'normal' : 'italic',
        opacity: value ? 1 : 0.5,
      }}>{text}</div>
    </div>
  )
}

function NpcCard({ card, selected, connectMode, isMaster }) {
  const d = parseNpcContent(card.content)
  const statusColor = STATUS_COLOR[d.status] ?? '#5a5040'

  return (
    <div style={{
      background: '#ddd0b8',
      color: '#1a1208',
      width: NPC_W,
      minHeight: NPC_H,
      boxShadow: selected
        ? '0 0 0 2px var(--ochre), 0 12px 32px rgba(0,0,0,0.75)'
        : connectMode
        ? '0 0 0 2px var(--blood), 0 8px 20px rgba(0,0,0,0.5)'
        : '2px 4px 8px rgba(0,0,0,0.4), 4px 8px 24px rgba(0,0,0,0.35)',
      display: 'flex', flexDirection: 'column',
      border: '1px solid #9a8860',
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* Watermark stamp */}
      <div style={{
        position: 'absolute', top: '38%', left: '50%',
        transform: 'translate(-50%, -50%) rotate(-18deg)',
        fontFamily: 'var(--font-mono)', fontSize: 36, fontWeight: 'bold',
        letterSpacing: '0.18em', textTransform: 'uppercase',
        color: 'rgba(122,42,37,0.07)', pointerEvents: 'none',
        whiteSpace: 'nowrap', zIndex: 0,
      }}>ДОСЬЄ</div>

      {/* Header bar */}
      <div style={{
        background: '#1e1608', color: '#c8a84a',
        fontFamily: 'var(--font-mono)', fontSize: 8,
        letterSpacing: '0.32em', textTransform: 'uppercase',
        padding: '5px 12px', display: 'flex', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span>Особова справа · Persona</span>
        <span style={{ opacity: 0.5 }}>{card.created_by?.username ?? ''}</span>
      </div>

      <div style={{ padding: '12px 14px 10px', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 1 }}>

        {/* Photo + name block */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #b8a878' }}>
          {/* Photo placeholder */}
          <div style={{
            width: 64, height: 80, flexShrink: 0,
            border: '1px dashed #9a8860',
            background: 'rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9a8860" strokeWidth="1">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>
          {/* Name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontStyle: 'italic',
              fontSize: 17, lineHeight: 1.2, color: '#1a1208', marginBottom: 5,
            }}>{card.title}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {d.role && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#6a5828', letterSpacing: '0.1em' }}>
                  {d.role}
                </span>
              )}
              {d.age && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#8a7450', letterSpacing: '0.08em' }}>
                  · {d.age} р.
                </span>
              )}
            </div>
            {d.status && (
              <div style={{
                marginTop: 5, display: 'inline-block',
                fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em',
                textTransform: 'uppercase', padding: '1px 6px',
                border: `1px solid ${statusColor}`,
                color: statusColor,
              }}>{d.status}</div>
            )}
          </div>
        </div>

        {/* Sections */}
        {(d.appearance !== undefined || !card.content) && <NpcField label="Зовнішність" value={d.appearance} />}
        {(d.character !== undefined || !card.content) && <NpcField label="Характер" value={d.character} />}
        {(d.connections !== undefined || !card.content) && <NpcField label="Зв'язки" value={d.connections} />}
        {isMaster && <NpcField label="Секрет" value={d.secret} secret />}

        <div style={{ marginTop: 'auto', paddingTop: 6 }} />
      </div>
    </div>
  )
}

function NoteCard({ card, selected, connectMode }) {
  return (
    <div style={{
      background: KIND_COLOR.note,
      color: '#2a2418',
      width: NOTE_W,
      minHeight: NOTE_H,
      padding: 14,
      boxShadow: selected
        ? '0 0 0 2px var(--ochre), 0 8px 24px rgba(0,0,0,0.7)'
        : connectMode
        ? '0 0 0 2px var(--blood), 0 6px 16px rgba(0,0,0,0.5)'
        : '0 6px 16px rgba(0,0,0,0.55)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 9,
        letterSpacing: '0.28em', textTransform: 'uppercase',
        color: '#7a6440', display: 'flex', justifyContent: 'space-between',
        marginBottom: 6,
      }}>
        <span>note</span>
        <span style={{ fontStyle: 'italic', fontFamily: 'var(--font-display)', textTransform: 'none', letterSpacing: '0.08em' }}>
          Nota
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 15,
        fontStyle: 'italic', lineHeight: 1.2,
        color: '#1f1a10', marginBottom: 8,
      }}>
        {card.title}
      </div>
      {card.content && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          lineHeight: 1.45, color: '#3a2e1c', overflow: 'hidden', flex: 1,
          display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
        }}>
          {card.content}
        </div>
      )}
    </div>
  )
}

function DefaultCard({ card, selected, connectMode }) {
  return (
    <div style={{
      background: KIND_COLOR[card.type] ?? KIND_COLOR.document,
      color: '#2a2418',
      padding: 14,
      boxShadow: selected
        ? '0 0 0 2px var(--ochre), 0 8px 24px rgba(0,0,0,0.7)'
        : connectMode
        ? '0 0 0 2px var(--blood), 0 6px 16px rgba(0,0,0,0.5)'
        : '0 6px 16px rgba(0,0,0,0.55)',
      display: 'flex', flexDirection: 'column',
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
    </div>
  )
}

function PhotoCard({ card, selected, connectMode }) {
  const shadow = selected
    ? '0 0 0 2px var(--ochre), 0 12px 32px rgba(0,0,0,0.75)'
    : connectMode
    ? '0 0 0 2px var(--blood), 0 8px 20px rgba(0,0,0,0.5)'
    : '3px 3px 10px rgba(0,0,0,0.5), 6px 8px 28px rgba(0,0,0,0.4)'

  return (
    <div style={{
      background: '#f8f4ec',
      width: PHOTO_W,
      padding: '10px 10px 0',
      boxShadow: shadow,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Photo area */}
      <div style={{
        width: '100%', height: 180,
        background: '#c8c0b0',
        overflow: 'hidden', flexShrink: 0,
      }}>
        {card.image
          ? <img src={card.image} alt={card.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 9, color: '#8a8070', letterSpacing: '0.14em',
            }}>немає зображення</div>
        }
      </div>

      {/* White bottom strip — polaroid caption */}
      <div style={{ padding: '8px 4px 6px', minHeight: 44 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic',
          fontSize: 13, color: '#2a2010', lineHeight: 1.2,
        }}>
          {card.title}
        </div>
      </div>
    </div>
  )
}

function CorkCard({ card, selected, connectMode, onMouseDown, onClick, onContextMenu, isMaster }) {
  const rot = KIND_ROT[card.type] ?? 0
  const dims = cardDims(card.type)
  const sharedProps = { card, selected, connectMode, isMaster }

  return (
    <div
      onMouseDown={onMouseDown}
      onClick={onClick}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e) }}
      style={{
        position: 'absolute',
        left: card.pos_x,
        top: card.pos_y,
        width: dims.w,
        cursor: card.is_pinned ? 'default' : connectMode ? 'crosshair' : 'grab',
        zIndex: selected ? 50 : 10,
        transform: `rotate(${rot}deg)`,
        transition: selected ? 'none' : 'box-shadow .2s',
      }}
    >
      {/* Pin indicator — only shown when card is pinned */}
      {card.is_pinned && (
        <div style={{
          position: 'absolute',
          top: -9, left: '50%', transform: 'translateX(-50%)',
          width: 16, height: 16, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #e05050, #7a1a1a)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.7), 0 0 0 2px rgba(200,60,60,0.3)',
          zIndex: 2,
        }} />
      )}

      {card.type === 'document' && <DocumentCard {...sharedProps} />}
      {card.type === 'npc' && <NpcCard {...sharedProps} />}
      {card.type === 'note' && <NoteCard {...sharedProps} />}
      {card.type === 'photo' && <PhotoCard {...sharedProps} />}
      {card.type !== 'document' && card.type !== 'npc' && card.type !== 'note' && card.type !== 'photo' && <DefaultCard {...sharedProps} />}
    </div>
  )
}


// ── Full view / edit modal ──

const fvInput = (extra = {}) => ({
  background: 'transparent', border: 'none', borderBottom: '1px solid rgba(122,98,64,0.35)',
  outline: 'none', width: '100%', color: 'inherit', fontFamily: 'inherit',
  fontSize: 'inherit', lineHeight: 'inherit', resize: 'vertical', padding: '2px 0',
  ...extra,
})

function CardFullView({ card, isMaster, sessionId, onClose, onSaved }) {
  const initNpc = () => {
    const d = parseNpcContent(card.content)
    return { role: d.role ?? '', age: d.age ?? '', status: d.status ?? '',
             appearance: d.appearance ?? '', character: d.character ?? '',
             connections: d.connections ?? '', secret: d.secret ?? '' }
  }

  const [title, setTitle] = useState(card.title)
  const [content, setContent] = useState(card.content ?? '')
  const [npc, setNpc] = useState(initNpc)
  const [saving, setSaving] = useState(false)
  const canEdit = card.type !== 'photo'

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleSave() {
    setSaving(true)
    try {
      const finalContent = card.type === 'npc'
        ? JSON.stringify({
            role: npc.role.trim(), age: npc.age.trim(), status: npc.status.trim(),
            appearance: npc.appearance.trim(), character: npc.character.trim(),
            connections: npc.connections.trim(), secret: npc.secret.trim(),
          })
        : content
      const res = await apiUpdateCard(sessionId, card.id, { title: title.trim(), content: finalContent })
      useTableStore.getState().updateCard(res.data)
      onSaved(res.data)
      onClose()
    } catch {} finally { setSaving(false) }
  }

  function setNpcField(f, v) { setNpc((p) => ({ ...p, [f]: v })) }

  const dirty = canEdit && (
    title !== card.title || content !== (card.content ?? '') ||
    (card.type === 'npc' && JSON.stringify(npc) !== JSON.stringify(initNpc()))
  )

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* ── Document ── */}
        {card.type === 'document' && (
          <div style={{ background: '#f6f2e4', width: 560, padding: '48px 56px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)', borderLeft: '4px solid #c8b890' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#8a7450', borderBottom: '1px solid #c8b890', paddingBottom: 8, marginBottom: 20, display: 'flex', justifyContent: 'space-between' }}>
              <span>Documentum</span><span>{card.created_by?.username ?? ''}</span>
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              style={{ ...fvInput(), fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: '#1a1208', marginBottom: 20, paddingBottom: 10, borderBottom: '1px solid #d4c8a0' }} />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14}
              style={{ ...fvInput(), fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.9, color: '#2a2010' }} />
            <SaveBar onSave={handleSave} onClose={onClose} saving={saving} dirty={dirty} />
          </div>
        )}

        {/* ── Note ── */}
        {card.type === 'note' && (
          <div style={{ background: '#ecdfc0', width: 420, padding: '32px 36px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)', transform: 'rotate(-1deg)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#7a6440', marginBottom: 14 }}>Nota</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              style={{ ...fvInput(), fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 22, color: '#1f1a10', marginBottom: 14 }} />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6}
              style={{ ...fvInput(), fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.7, color: '#3a2e1c' }} />
            <SaveBar onSave={handleSave} onClose={onClose} saving={saving} dirty={dirty} dark />
          </div>
        )}

        {/* ── Photo (read-only) ── */}
        {card.type === 'photo' && (
          <div style={{ background: '#f8f4ec', padding: '16px 16px 12px', boxShadow: '0 20px 60px rgba(0,0,0,0.8)', maxWidth: 640 }}>
            {card.image
              ? <img src={card.image} alt={card.title} style={{ display: 'block', maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
              : <div style={{ width: 400, height: 300, background: '#c8c0b0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a8070', fontFamily: 'var(--font-mono)', fontSize: 10 }}>немає зображення</div>
            }
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: '#2a2010', marginTop: 12, textAlign: 'center' }}>{card.title}</div>
            <button onClick={onClose} style={{ display: 'block', margin: '12px auto 0', background: 'none', border: '1px solid #9a8860', color: '#7a6440', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '4px 14px', cursor: 'pointer' }}>Закрити</button>
          </div>
        )}

        {/* ── NPC dossier ── */}
        {card.type === 'npc' && (
          <div style={{ background: '#ddd0b8', width: 560, boxShadow: '0 20px 60px rgba(0,0,0,0.8)', border: '1px solid #9a8860', overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%) rotate(-18deg)', fontFamily: 'var(--font-mono)', fontSize: 72, fontWeight: 'bold', letterSpacing: '0.18em', color: 'rgba(122,42,37,0.06)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>ДОСЬЄ</div>
            <div style={{ background: '#1e1608', color: '#c8a84a', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.32em', textTransform: 'uppercase', padding: '8px 20px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Особова справа · Persona</span>
              <span style={{ opacity: 0.5 }}>{card.created_by?.username ?? ''}</span>
            </div>
            <div style={{ padding: '24px 28px', position: 'relative' }}>
              <div style={{ display: 'flex', gap: 20, marginBottom: 20, paddingBottom: 16, borderBottom: '2px solid #9a8860' }}>
                <div style={{ width: 100, height: 126, flexShrink: 0, border: '1px dashed #9a8860', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9a8860" strokeWidth="1"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <input value={title} onChange={(e) => setTitle(e.target.value)}
                    style={{ ...fvInput(), fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 24, color: '#1a1208', marginBottom: 8 }} placeholder="Ім'я..." />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8, marginBottom: 8 }}>
                    <input value={npc.role} onChange={(e) => setNpcField('role', e.target.value)} placeholder="Роль / Посада..."
                      style={{ ...fvInput(), fontFamily: 'var(--font-mono)', fontSize: 11, color: '#5a4820' }} />
                    <input value={npc.age} onChange={(e) => setNpcField('age', e.target.value)} placeholder="Вік..."
                      style={{ ...fvInput(), fontFamily: 'var(--font-mono)', fontSize: 11, color: '#8a7450' }} />
                  </div>
                  <select value={npc.status} onChange={(e) => setNpcField('status', e.target.value)}
                    style={{ ...fvInput({ resize: 'none' }), fontFamily: 'var(--font-mono)', fontSize: 10, color: STATUS_COLOR[npc.status] ?? '#5a5040' }}>
                    <option value="">— статус —</option>
                    {Object.keys(STATUS_COLOR).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {[['Зовнішність', 'appearance'], ['Характер', 'character'], ["Зв'язки", 'connections']].map(([label, field]) => (
                <div key={field} style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#8a7450', marginBottom: 4 }}>{label}</div>
                  <textarea value={npc[field]} onChange={(e) => setNpcField(field, e.target.value)} rows={2} placeholder="невідомо"
                    style={{ ...fvInput(), fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.6, color: '#2a2010' }} />
                </div>
              ))}
              {isMaster && (
                <div style={{ marginTop: 4, padding: '10px 14px', background: 'rgba(122,42,37,0.1)', borderLeft: '3px solid rgba(122,42,37,0.4)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(196,100,90,0.8)', marginBottom: 4 }}>Секрет</div>
                  <textarea value={npc.secret} onChange={(e) => setNpcField('secret', e.target.value)} rows={2} placeholder="невідомо"
                    style={{ ...fvInput(), fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.6, color: '#3a1008' }} />
                </div>
              )}
              <SaveBar onSave={handleSave} onClose={onClose} saving={saving} dirty={dirty} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SaveBar({ onSave, onClose, saving, dirty, dark }) {
  const color = dark ? '#5a4820' : '#7a6440'
  const border = dark ? 'rgba(90,72,32,0.3)' : 'rgba(122,98,64,0.3)'
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, paddingTop: 12, borderTop: `1px solid ${border}` }}>
      <button onClick={onClose} style={{ background: 'none', border: `1px solid ${border}`, color, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '4px 14px', cursor: 'pointer' }}>
        Закрити
      </button>
      <button onClick={onSave} disabled={saving || !dirty} style={{ background: dirty ? 'rgba(122,98,64,0.15)' : 'none', border: `1px solid ${dirty ? color : border}`, color: dirty ? color : border, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', padding: '4px 14px', cursor: dirty ? 'pointer' : 'default' }}>
        {saving ? 'Збереження...' : 'Зберегти'}
      </button>
    </div>
  )
}

// ── Context menu ──

function CtxItem({ label, onClick, danger }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '8px 18px', cursor: 'pointer',
        fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: danger
          ? (hov ? '#e06060' : '#a04040')
          : (hov ? 'var(--ochre-bright)' : 'var(--ochre)'),
        background: hov ? 'rgba(184,153,104,0.1)' : 'transparent',
        borderBottom: '1px solid rgba(184,153,104,0.08)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  )
}

function ContextMenu({ x, y, card, isMaster, isOwn, isCreator, onFullView, onPin, onPublish, onConnect, onDelete, onClose }) {
  return (
    <>
      <div
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose() }}
        style={{ position: 'fixed', inset: 0, zIndex: 800 }}
      />
      <div style={{
        position: 'fixed', left: x, top: y, zIndex: 801,
        background: '#1a1410',
        border: '1px solid var(--ochre-deep)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.75)',
        minWidth: 170,
        overflow: 'hidden',
      }}>
        <CtxItem label="Переглянути" onClick={() => { onFullView(); onClose() }} />
        <CtxItem label={card.is_pinned ? 'Відкріпити' : 'Закріпити'} onClick={() => { onPin(); onClose() }} />
        {(isMaster || isOwn) && !card.is_public && (
          <CtxItem label={isMaster ? 'На стіл' : 'Винести'} onClick={() => { onPublish(); onClose() }} />
        )}
        <CtxItem label="+ Нитка" onClick={() => { onConnect(); onClose() }} />
        {(isMaster || isCreator) && (
          <CtxItem label="Видалити" onClick={onDelete} danger />
        )}
      </div>
    </>
  )
}

// ── Detail rail (bottom bar) ──

function DetailRail({ card, isMaster, onConnect, connectMode, onCancelConnect, onFullView }) {
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
        <button className="btn btn--ghost" style={{ fontSize: 10, padding: '4px 10px' }} onClick={onFullView}>
          🔍 Переглянути
        </button>
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
  const [fullViewCard, setFullViewCard] = useState(null)
  const [tab, setTab] = useState('public')
  const [contextMenu, setContextMenu] = useState(null)
  const stageRef = useRef(null)
  const moveTimer = useRef(null)
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  useEffect(() => { zoomRef.current = zoom }, [zoom])
  useEffect(() => { panRef.current = pan }, [pan])

  // ── Auto-position new cards at view center ──
  const seenCardIds = useRef(null)
  useEffect(() => {
    if (seenCardIds.current === null) {
      seenCardIds.current = new Set(cards.map((c) => c.id))
      return
    }
    const newCards = cards.filter((c) => !seenCardIds.current.has(c.id))
    newCards.forEach((c) => seenCardIds.current.add(c.id))
    if (newCards.length === 0) return

    const el = stageRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const z = zoomRef.current
    const p = panRef.current

    newCards.forEach((card, i) => {
      if (card.pos_x !== 0 || card.pos_y !== 0) return
      const dims = cardDims(card.type)
      const nx = (rect.width / 2 - p.x) / z - dims.w / 2 + i * 24
      const ny = (rect.height / 2 - p.y) / z - dims.h / 2 + i * 24
      useTableStore.getState().moveCard(card.id, nx, ny)
      apiMoveCard(sessionId, card.id, nx, ny).catch(() => {})
    })
  }, [cards, sessionId])

  const selectedCard = cards.find((c) => c.id === selectedId) ?? null

  // ── Drag card (left click only) ──
  const onCardMouseDown = useCallback((e, cardId) => {
    if (e.button !== 0) return  // middle/right click falls through to stage pan
    if (e.target.closest('.no-drag')) return
    if (connectMode) return
    e.stopPropagation()
    setSelectedId(cardId)
    const card = useTableStore.getState().cards.find((c) => c.id === cardId)
    if (!card || card.is_pinned) return  // pinned cards can be selected but not dragged
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

  // ── Pan stage (left click on bg OR middle click anywhere) ──
  const onStageMouseDown = useCallback((e) => {
    if (e.button === 1) {
      e.preventDefault()
      setPanning({ startX: e.clientX - pan.x, startY: e.clientY - pan.y })
      return
    }
    if (e.button !== 0) return
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

  // ── Scroll wheel zoom toward cursor ──
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const z = zoomRef.current
      const p = panRef.current
      const delta = e.deltaY < 0 ? 0.08 : -0.08
      const newZoom = Math.max(0.3, Math.min(1.6, +(z + delta).toFixed(2)))
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setZoom(newZoom)
      setPan({
        x: cx - (cx - p.x) * (newZoom / z),
        y: cy - (cy - p.y) * (newZoom / z),
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

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

  // ── Context menu handlers ──
  const openContextMenu = useCallback((e, card) => {
    setSelectedId(card.id)
    setContextMenu({ card, x: e.clientX, y: e.clientY })
  }, [])

  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  async function handleCtxPin() {
    const card = contextMenu?.card
    if (!card) return
    try {
      const res = await pinCard(sessionId, card.id)
      useTableStore.getState().replaceCard(res.data)
    } catch {}
  }

  async function handleCtxPublish() {
    const card = contextMenu?.card
    if (!card) return
    try {
      const res = await publishCard(sessionId, card.id)
      useTableStore.getState().updateCard(res.data)
    } catch {}
  }

  async function handleCtxDelete() {
    const card = contextMenu?.card
    if (!card) return
    closeContextMenu()
    if (!window.confirm('Видалити картку?')) return
    try {
      await deleteCard(sessionId, card.id)
      useTableStore.getState().removeCard(card.id)
    } catch {}
  }

  const visibleCards = tab === 'public'
    ? cards.filter((c) => c.is_public)
    : cards.filter((c) => !c.is_public && (c.owner?.id === currentUserId || (!c.owner && c.created_by?.id === currentUserId)))
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
          {/* Tab switcher */}
          {[['public', 'Загальний стіл'], ['personal', 'Особистий']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: '4px 14px', fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.18em', textTransform: 'uppercase', cursor: 'pointer',
              border: `1px solid ${tab === k ? 'var(--ochre)' : 'var(--ochre-deep)'}`,
              color: tab === k ? 'var(--ochre-bright)' : 'var(--moss-pale)',
              background: tab === k ? 'rgba(184,153,104,0.08)' : 'transparent',
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
              onContextMenu={(e) => openContextMenu(e, card)}
              isMaster={isMaster}
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
            {tab === 'public' ? 'Загальний стіл порожній · Mensa Vacua' : 'Особистих карток немає · Nullae Chartae'}
          </div>
        )}
      </div>

      {/* ── Detail rail ── */}
      <DetailRail
        card={selectedCard}
        isMaster={isMaster}
        connectMode={connectMode}
        onConnect={() => setConnectMode(true)}
        onCancelConnect={() => setConnectMode(false)}
        onFullView={() => selectedCard && setFullViewCard(selectedCard)}
      />

      {/* ── Full view modal ── */}
      {fullViewCard && (
        <CardFullView
          card={fullViewCard}
          isMaster={isMaster}
          sessionId={sessionId}
          onClose={() => setFullViewCard(null)}
          onSaved={(updated) => setFullViewCard(updated)}
        />
      )}

      {/* ── Context menu ── */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          card={contextMenu.card}
          isMaster={isMaster}
          isOwn={contextMenu.card.owner?.id === currentUserId}
          isCreator={contextMenu.card.created_by?.id === currentUserId}
          onFullView={() => { setFullViewCard(contextMenu.card) }}
          onPin={handleCtxPin}
          onPublish={handleCtxPublish}
          onConnect={() => { setSelectedId(contextMenu.card.id); setConnectMode(true) }}
          onDelete={handleCtxDelete}
          onClose={closeContextMenu}
        />
      )}
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
