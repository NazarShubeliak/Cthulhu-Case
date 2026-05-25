import { useEffect, useRef } from 'react'
import useAuthStore from '../store/authStore'
import useTableStore from '../store/tableStore'

export default function useWebSocket(sessionId, currentUserId, onDiceRolled) {
  const wsRef = useRef(null)
  const accessToken = useAuthStore((s) => s.accessToken)
  const {
    addCard, updateCard, moveCard, removeCard,
    addThread, removeThread,
    addNote, updateNote, removeNote,
    addConnectedUser,
    replaceCard,
    addDiceLog,
  } = useTableStore()

  useEffect(() => {
    if (!sessionId || !accessToken) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/session/${sessionId}/?token=${accessToken}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (e) => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      switch (msg.type) {
        case 'card.created':
          addCard(msg.card)
          break
        case 'card.moved':
          if (msg.moved_by !== currentUserId) {
            moveCard(msg.card_id, msg.pos_x, msg.pos_y)
          }
          break
        case 'card.published':
          updateCard(msg.card)
          break
        case 'card.updated':
          replaceCard(msg.card)
          break
        case 'card.deleted':
          removeCard(msg.card_id)
          break
        case 'thread.created':
          addThread(msg.thread)
          break
        case 'thread.deleted':
          removeThread(msg.thread_id)
          break
        case 'note.created':
          addNote(msg.note)
          break
        case 'note.updated':
          updateNote(msg.note)
          break
        case 'note.deleted':
          removeNote(msg.note_id)
          break
        case 'player.joined':
          addConnectedUser({ user_id: msg.user_id, username: msg.username })
          break
        case 'dice.rolled':
          addDiceLog(msg)
          if (onDiceRolled) onDiceRolled(msg)
          break
        default:
          break
      }
    }

    ws.onerror = () => {}

    return () => ws.close()
  }, [sessionId, accessToken, currentUserId]) // eslint-disable-line react-hooks/exhaustive-deps

  return wsRef
}
