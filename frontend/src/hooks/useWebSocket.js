import { useEffect, useRef, useCallback } from 'react'
import { getFreshAccessToken } from '../api/client'
import useTableStore from '../store/tableStore'

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

export default function useWebSocket(sessionId, currentUserId, onDiceRolled, onDrawingStroke, onNewCard, onConnected, onCursorPing) {
  const wsRef = useRef(null)
  const retryDelay = useRef(RECONNECT_BASE_MS)
  const retryTimer = useRef(null)
  const mountedRef = useRef(false)
  const connectRef = useRef(null)
  const connectingRef = useRef(false)
  const forceRefreshRef = useRef(false)

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

  const scheduleReconnect = useCallback(() => {
    clearTimeout(retryTimer.current)
    retryTimer.current = setTimeout(() => {
      retryDelay.current = Math.min(retryDelay.current * 2, RECONNECT_MAX_MS)
      connectRef.current?.()
    }, retryDelay.current)
  }, [])

  const connect = useCallback(async () => {
    if (!mountedRef.current || !sessionId || connectingRef.current) return

    // Guard: don't open a second connection if one is already alive
    const isAlive = () => {
      const existing = wsRef.current
      return existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)
    }
    if (isAlive()) return

    // The token rides in the URL, so it has to be valid *now* — an expired one
    // gets the socket closed with 4001 and the table silently stops updating.
    connectingRef.current = true
    let token
    try {
      token = await getFreshAccessToken({ force: forceRefreshRef.current })
      forceRefreshRef.current = false
    } catch {
      token = undefined
    } finally {
      connectingRef.current = false
    }
    if (!mountedRef.current || isAlive()) return
    if (token === null) return            // logged out
    if (token === undefined) {            // refresh failed (network) — try later
      scheduleReconnect()
      return
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/session/${sessionId}/?token=${token}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      retryDelay.current = RECONNECT_BASE_MS
      // Releases that happened while we were offline never reached us
      useTableStore.getState().clearCardHolds()
      onConnectedRef.current?.()
    }

    ws.onmessage = (e) => {
      if (!mountedRef.current) return
      let msg
      try { msg = JSON.parse(e.data) } catch { return }

      const userId = currentUserIdRef.current
      // Read actions off the store instead of subscribing: a subscription here
      // would re-render the whole table page on every incoming card.moving.
      const {
        addCard, moveCard, removeCard,
        addThread, removeThread,
        addNote, updateNote, removeNote,
        addConnectedUser, removeConnectedUser,
        replaceCard, addDiceLog, hasDiceRoll,
        setCardHold, clearCardHold, setMusic, setTableSettings,
      } = useTableStore.getState()

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
        case 'card.grabbed':
        case 'card.grab_denied':
          // A denial means someone else won the grab — the board cancels our drag
          if (msg.user_id !== userId) setCardHold(msg.card_id, { user_id: msg.user_id, username: msg.username })
          break
        case 'session.settings':
          setTableSettings(msg.table_settings)
          break
        case 'music.updated':
          setMusic(msg)
          break
        case 'card.released':
          clearCardHold(msg.card_id, msg.user_id)
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
          // Already shown from our own REST response
          if (hasDiceRoll(msg.roll_id)) break
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
      if (e.code === 1000 || e.code === 4003) return
      // Token rejected — get a new one before the next attempt
      if (e.code === 4001) forceRefreshRef.current = true

      scheduleReconnect()
    }
  }, [sessionId, scheduleReconnect])

  connectRef.current = connect

  useEffect(() => {
    mountedRef.current = true
    retryDelay.current = RECONNECT_BASE_MS
    connect()

    // Back from sleep / a dropped Wi-Fi: reconnect now instead of waiting
    // out a backoff that may have grown to 30s
    const reconnectNow = () => {
      if (document.visibilityState === 'hidden' || wsRef.current) return
      clearTimeout(retryTimer.current)
      retryDelay.current = RECONNECT_BASE_MS
      connect()
    }
    window.addEventListener('online', reconnectNow)
    document.addEventListener('visibilitychange', reconnectNow)

    return () => {
      mountedRef.current = false
      window.removeEventListener('online', reconnectNow)
      document.removeEventListener('visibilitychange', reconnectNow)
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
