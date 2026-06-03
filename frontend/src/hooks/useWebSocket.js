import { useEffect, useRef, useCallback } from 'react'
import useAuthStore from '../store/authStore'
import useTableStore from '../store/tableStore'

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

export default function useWebSocket(sessionId, currentUserId, onDiceRolled, onDrawingStroke) {
  const wsRef = useRef(null)
  const retryDelay = useRef(RECONNECT_BASE_MS)
  const retryTimer = useRef(null)
  const mountedRef = useRef(false)
  const connectRef = useRef(null)
  const accessToken = useAuthStore((s) => s.accessToken)
  const {
    addCard, updateCard, moveCard, removeCard,
    addThread, removeThread,
    addNote, updateNote, removeNote,
    addConnectedUser,
    replaceCard,
    addDiceLog,
  } = useTableStore()

  const onDrawingStrokeRef = useRef(onDrawingStroke)
  useEffect(() => { onDrawingStrokeRef.current = onDrawingStroke }, [onDrawingStroke])

  const connect = useCallback(() => {
    if (!mountedRef.current || !sessionId || !accessToken) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/session/${sessionId}/?token=${accessToken}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      retryDelay.current = RECONNECT_BASE_MS
    }

    ws.onmessage = (e) => {
      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      switch (msg.type) {
        case 'card.created':
          addCard(msg.card)
          break
        case 'card.moving':
          if (msg.moved_by !== currentUserId) moveCard(msg.card_id, msg.pos_x, msg.pos_y)
          break
        case 'card.moved':
          if (msg.moved_by !== currentUserId) moveCard(msg.card_id, msg.pos_x, msg.pos_y)
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
        case 'drawing.stroke':
          if (msg.sender_id !== currentUserId) onDrawingStrokeRef.current?.(msg)
          break
        default:
          break
      }
    }

    ws.onerror = () => {}

    ws.onclose = (e) => {
      wsRef.current = null
      if (!mountedRef.current) return
      // Не перепідключатись при навмисному закритті або помилці авторизації
      if (e.code === 1000 || e.code === 4001 || e.code === 4003) return

      retryTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, RECONNECT_MAX_MS)
        connectRef.current?.()
      }, retryDelay.current)
    }
  }, [
    sessionId, accessToken, currentUserId,
    addCard, updateCard, moveCard, removeCard,
    addThread, removeThread,
    addNote, updateNote, removeNote,
    addConnectedUser, replaceCard, addDiceLog,
    onDiceRolled,
  ])

  // Завжди тримаємо актуальну версію connect у ref,
  // щоб onclose викликав її без stale closure
  connectRef.current = connect

  useEffect(() => {
    mountedRef.current = true
    retryDelay.current = RECONNECT_BASE_MS
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(retryTimer.current)
      const ws = wsRef.current
      if (ws) {
        wsRef.current = null
        ws.close(1000)
      }
    }
  }, [connect])

  return wsRef
}
