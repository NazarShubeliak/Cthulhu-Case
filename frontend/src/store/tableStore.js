import { create } from 'zustand'

const useTableStore = create((set, get) => ({
  cards: [],
  threads: [],
  notes: [],
  connectedUsers: [],
  diceLog: [],
  // card_id → { user_id, username } of whoever else is dragging it right now
  cardHolds: {},
  // The master's music as last heard from the server, plus when we heard it
  // (local clock) so the playback position can be extrapolated
  music: null,
  // What the master lets players do (session.table_settings)
  tableSettings: null,

  setCards: (cards) => set({ cards }),
  setThreads: (threads) => set({ threads }),
  setNotes: (notes) => set({ notes }),

  addCard: (card) => set((s) => ({
    cards: s.cards.find((c) => c.id === card.id)
      ? s.cards.map((c) => {
          if (c.id !== card.id) return c
          // preserve position if card was already moved and incoming has default (0,0)
          const pos_x = (card.pos_x === 0 && c.pos_x !== 0) ? c.pos_x : card.pos_x
          const pos_y = (card.pos_y === 0 && c.pos_y !== 0) ? c.pos_y : card.pos_y
          return { ...card, pos_x, pos_y }
        })
      : [card, ...s.cards],
  })),
  updateCard: (card) => set((s) => ({ cards: s.cards.map((c) => (c.id === card.id ? card : c)) })),
  replaceCard: (card) => set((s) => ({ cards: s.cards.map((c) => (c.id === card.id ? { ...c, ...card } : c)) })),
  moveCard: (cardId, pos_x, pos_y) =>
    set((s) => ({ cards: s.cards.map((c) => (c.id === cardId ? { ...c, pos_x, pos_y } : c)) })),
  resizeCard: (cardId, width, height) =>
    set((s) => ({ cards: s.cards.map((c) => (c.id === cardId ? { ...c, width, height } : c)) })),
  removeCard: (cardId) => set((s) => ({ cards: s.cards.filter((c) => c.id !== cardId) })),

  setCardHold: (cardId, holder) => set((s) => ({ cardHolds: { ...s.cardHolds, [cardId]: holder } })),
  clearCardHold: (cardId, userId) => set((s) => {
    const hold = s.cardHolds[cardId]
    if (!hold || (userId !== undefined && hold.user_id !== userId)) return s
    const { [cardId]: _, ...rest } = s.cardHolds
    return { cardHolds: rest }
  }),
  clearCardHolds: () => set({ cardHolds: {} }),
  setTableSettings: (tableSettings) => set({ tableSettings }),

  // Ignores out-of-order updates: a WS echo can arrive after a newer REST reply
  setMusic: ({ music, server_now }) => set((s) => {
    if (s.music && (music.updated_at ?? 0) < (s.music.updated_at ?? 0)) return s
    return { music: { ...music, server_now, receivedAt: Date.now() } }
  }),

  addThread: (thread) => set((s) => ({
    threads: s.threads.find((t) => t.id === thread.id) ? s.threads : [...s.threads, thread],
  })),
  removeThread: (threadId) => set((s) => ({ threads: s.threads.filter((t) => t.id !== threadId) })),

  addNote: (note) => set((s) => ({
    notes: s.notes.find((n) => n.id === note.id)
      ? s.notes.map((n) => (n.id === note.id ? note : n))
      : [note, ...s.notes],
  })),
  updateNote: (note) => set((s) => ({ notes: s.notes.map((n) => (n.id === note.id ? note : n)) })),
  removeNote: (noteId) => set((s) => ({ notes: s.notes.filter((n) => n.id !== noteId) })),

  addConnectedUser: (user) =>
    set((s) => ({
      connectedUsers: s.connectedUsers.find((u) => u.user_id === user.user_id)
        ? s.connectedUsers
        : [...s.connectedUsers, user],
    })),
  removeConnectedUser: (userId) =>
    set((s) => ({ connectedUsers: s.connectedUsers.filter((u) => u.user_id !== userId) })),

  // A roll reaches the roller twice — from the REST response and the WS echo —
  // so rolls carrying a roll_id are deduplicated by it.
  hasDiceRoll: (rollId) => !!rollId && get().diceLog.some((e) => e.roll_id === rollId),

  addDiceLog: (entry) =>
    set((s) => {
      if (entry.roll_id && s.diceLog.some((e) => e.roll_id === entry.roll_id)) return s
      const ts = Date.now()
      const last = s.diceLog[0]
      // Deduplicate: skip if same roller + same total arrived within 500ms
      if (!entry.roll_id && last && last.rolled_by_id === entry.rolled_by_id && last.total === entry.total && ts - last.ts < 500) {
        return s
      }
      return { diceLog: [{ ...entry, ts }, ...s.diceLog].slice(0, 100) }
    }),

  reset: () => set({ cards: [], threads: [], notes: [], connectedUsers: [], diceLog: [], cardHolds: {}, music: null, tableSettings: null }),
}))

export default useTableStore
