import { create } from 'zustand'

const useTableStore = create((set) => ({
  cards: [],
  threads: [],
  notes: [],
  connectedUsers: [],

  setCards: (cards) => set({ cards }),
  setThreads: (threads) => set({ threads }),
  setNotes: (notes) => set({ notes }),

  addCard: (card) => set((s) => ({ cards: [card, ...s.cards] })),
  updateCard: (card) => set((s) => ({ cards: s.cards.map((c) => (c.id === card.id ? card : c)) })),
  moveCard: (cardId, pos_x, pos_y) =>
    set((s) => ({ cards: s.cards.map((c) => (c.id === cardId ? { ...c, pos_x, pos_y } : c)) })),
  removeCard: (cardId) => set((s) => ({ cards: s.cards.filter((c) => c.id !== cardId) })),

  addThread: (thread) => set((s) => ({ threads: [...s.threads, thread] })),
  removeThread: (threadId) => set((s) => ({ threads: s.threads.filter((t) => t.id !== threadId) })),

  addNote: (note) => set((s) => ({ notes: [note, ...s.notes] })),
  updateNote: (note) => set((s) => ({ notes: s.notes.map((n) => (n.id === note.id ? note : n)) })),
  removeNote: (noteId) => set((s) => ({ notes: s.notes.filter((n) => n.id !== noteId) })),

  addConnectedUser: (user) =>
    set((s) => ({
      connectedUsers: s.connectedUsers.find((u) => u.user_id === user.user_id)
        ? s.connectedUsers
        : [...s.connectedUsers, user],
    })),

  reset: () => set({ cards: [], threads: [], notes: [], connectedUsers: [] }),
}))

export default useTableStore
