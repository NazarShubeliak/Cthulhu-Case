import { useEffect, useRef } from 'react'
import useAuthStore from '../store/authStore'
import useTableStore from '../store/tableStore'

export default function useWebSocket(sessionId, currentUserId) {
  const wsRef = useRef(null)
  const accessToken = useAuthStore((s) => s.accessToken)
  const { addCard, updateCard, moveCard, removeCard, addThread, removeThread, addNote, addConnectedUser } =
    useTableStore()

  useEffect(() => {
    if (!sessionId || !accessToken) return

    const host = window.location.hostname
    const wsUrl = `ws://${host}:8000/ws/session/${sessionId}/?token=${accessToken}`
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
          // skip own moves — we update locally immediately on drag
          if (msg.moved_by !== currentUserId) {
            moveCard(msg.card_id, msg.pos_x, msg.pos_y)
          }
          break
        case 'card.published':
          updateCard(msg.card)
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
        case 'player.joined':
          addConnectedUser({ user_id: msg.user_id, username: msg.username })
          break
        default:
          break
      }
    }

    ws.onerror = () => {}

    return () => ws.close()
  }, [sessionId, accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  return wsRef
}
