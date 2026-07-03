import { useEffect, useRef, useCallback } from 'react'
import useAuthStore from '../store/authStore'
import useTableStore from '../store/tableStore'

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

export default function useWebSocket(sessionId, currentUserId, onDiceRolled, onDrawingStroke, onNewCard, onConnected, onCursorPing) {
  const wsRef = useRef(null)
  const retryDelay = useRef(RECONNECT_BASE_MS)
  const retryTimer = useRef(null)
  const mountedRef = useRef(false)
  const connectRef = useRef(null)
  const accessToken = useAuthStore((s) => s.accessToken)

  const {
    addCard, moveCard, removeCard,
    addThread, removeThread,
    addNote, updateNote, removeNote,
    addConnectedUser, removeConnectedUser,
    replaceCard,
    addDiceLog,
  } = useTableStore()

  // Volatile props → refs so connect() doesn't need them as deps
  const onDiceRolledRef = useRef(onDiceRolled)
  useEffect(() => { onDiceRolledRef.current = onDiceRolled }, [onDiceRolled])

  const onDrawingStrokeRef = useRef(onDrawingStroke)
  useEffect(() => { onDrawingStrokeRef.current = onDrawingStroke }, [onDrawingStroke])

  const onNewCardRef = useRef(onNewCard)
  useEffect(() => { onNewCardRef.current = onNewCard }, [onNewCard])

  const onConnectedRef = useRef(onConnected)
  useEffect(() => { onConnectedRef.current = onConnected }, [onConnected])

  const onCursorPingRef = useRef(onCursorPing)
  useEffect(() => { onCursorPingRef.current = onCursorPing }, [onCursorPing])

  const currentUserIdRef = useRef(currentUserId)
  useEffect(() => { currentUserIdRef.current = currentUserId }, [currentUserId])

  const connect = useCallback(() => {
    if (!mountedRef.current || !sessionId || !accessToken) return

    // Guard: don't open a second connection if one is already alive
    const existing = wsRef.current
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/session/${sessionId}/?token=${accessToken}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      retryDelay.current = RECONNECT_BASE_MS
      onConnectedRef.current?.()
    }

    ws.onmessage = (e) => {
      if (!mountedRef.current) return
      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      const userId = currentUserIdRef.current

      switch (msg.type) {
        case 'card.created':
          addCard(msg.card)
          if (msg.card.owner?.id === userId && !msg.card.is_public) {
            onNewCardRef.current?.(msg.card)
          }
          break
        case 'card.moving':
          if (msg.moved_by !== userId) moveCard(msg.card_id, msg.pos_x, msg.pos_y)
          break
        case 'card.moved':
          if (msg.moved_by !== userId) moveCard(msg.card_id, msg.pos_x, msg.pos_y)
          break
        case 'card.published':
          addCard(msg.card)
          break
        case 'card.transferred':
          if (msg.card.owner?.id === userId) {
            // Я отримувач — картка з'являється в особистому
            addCard(msg.card)
            onNewCardRef.current?.(msg.card)
          } else if (msg.from_user_id === userId) {
            // Я відправник — картка зникає
            removeCard(msg.card.id)
          } else {
            // Майстер або інші — просто оновлюємо дані
            replaceCard(msg.card)
          }
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
        case 'player.left':
          removeConnectedUser(msg.user_id)
          break
        case 'dice.rolled':
          addDiceLog(msg)
          onDiceRolledRef.current?.(msg)
          break
        case 'drawing.stroke':
          if (msg.sender_id !== userId) onDrawingStrokeRef.current?.(msg)
          break
        case 'cursor.ping':
          if (msg.user_id !== userId) onCursorPingRef.current?.(msg)
          break
        default:
          break
      }
    }

    ws.onerror = () => {}

    ws.onclose = (e) => {
      // Only clear the ref if it still points to THIS connection —
      // a reconnect may have already put a new socket there
      if (wsRef.current === ws) wsRef.current = null
      if (!mountedRef.current) return
      if (e.code === 1000 || e.code === 4001 || e.code === 4003) return

      retryTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, RECONNECT_MAX_MS)
        connectRef.current?.()
      }, retryDelay.current)
    }
  }, [
    sessionId, accessToken,
    addCard, moveCard, removeCard,
    addThread, removeThread,
    addNote, updateNote, removeNote,
    addConnectedUser, removeConnectedUser, replaceCard, addDiceLog,
  ])

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
