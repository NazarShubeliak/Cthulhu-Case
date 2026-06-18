import { create } from 'zustand'

const useTableStore = create((set) => ({
  cards: [],
  threads: [],
  notes: [],
  connectedUsers: [],
  diceLog: [],

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
  removeCard: (cardId) => set((s) => ({ cards: s.cards.filter((c) => c.id !== cardId) })),

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

  addDiceLog: (entry) =>
    set((s) => {
      const ts = Date.now()
      const last = s.diceLog[0]
      // Deduplicate: skip if same roller + same total arrived within 500ms
      if (last && last.rolled_by_id === entry.rolled_by_id && last.total === entry.total && ts - last.ts < 500) {
        return s
      }
      return { diceLog: [{ ...entry, ts }, ...s.diceLog].slice(0, 100) }
    }),

  reset: () => set({ cards: [], threads: [], notes: [], connectedUsers: [], diceLog: [] }),
}))

export default useTableStore
