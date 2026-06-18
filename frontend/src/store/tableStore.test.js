import { describe, it, expect, beforeEach } from 'vitest'
import useTableStore from './tableStore'


const card = (id, extra = {}) => ({ id, title: `Картка ${id}`, pos_x: 0, pos_y: 0, ...extra })
const thread = (id, from, to) => ({ id, card_from: from, card_to: to })
const note = (id, extra = {}) => ({ id, content: `Нотатка ${id}`, ...extra })

beforeEach(() => {
  useTableStore.getState().reset()
})

describe('tableStore — cards', () => {
  it('addCard — додає картку', () => {
    useTableStore.getState().addCard(card(1))
    expect(useTableStore.getState().cards).toHaveLength(1)
  })

  it('addCard — ігнорує дублікати', () => {
    useTableStore.getState().addCard(card(1))
    useTableStore.getState().addCard(card(1))
    expect(useTableStore.getState().cards).toHaveLength(1)
  })

  it('moveCard — оновлює позицію', () => {
    useTableStore.getState().addCard(card(1))
    useTableStore.getState().moveCard(1, 200, 300)
    const c = useTableStore.getState().cards[0]
    expect(c.pos_x).toBe(200)
    expect(c.pos_y).toBe(300)
  })

  it('updateCard — merge оновлення', () => {
    useTableStore.getState().addCard(card(1, { title: 'Старий' }))
    useTableStore.getState().updateCard({ id: 1, title: 'Новий' })
    expect(useTableStore.getState().cards[0].title).toBe('Новий')
  })

  it('removeCard — видаляє за id', () => {
    useTableStore.getState().addCard(card(1))
    useTableStore.getState().addCard(card(2))
    useTableStore.getState().removeCard(1)
    expect(useTableStore.getState().cards).toHaveLength(1)
    expect(useTableStore.getState().cards[0].id).toBe(2)
  })
})

describe('tableStore — threads', () => {
  it('addThread — додає нитку', () => {
    useTableStore.getState().addThread(thread(10, 1, 2))
    expect(useTableStore.getState().threads).toHaveLength(1)
  })

  it('addThread — ігнорує дублікати', () => {
    useTableStore.getState().addThread(thread(10, 1, 2))
    useTableStore.getState().addThread(thread(10, 1, 2))
    expect(useTableStore.getState().threads).toHaveLength(1)
  })

  it('removeThread — видаляє нитку', () => {
    useTableStore.getState().addThread(thread(10, 1, 2))
    useTableStore.getState().removeThread(10)
    expect(useTableStore.getState().threads).toHaveLength(0)
  })
})

describe('tableStore — notes', () => {
  it('addNote — додає нотатку', () => {
    useTableStore.getState().addNote(note(1))
    expect(useTableStore.getState().notes).toHaveLength(1)
  })

  it('updateNote — оновлює вміст', () => {
    useTableStore.getState().addNote(note(1, { content: 'Стара' }))
    useTableStore.getState().updateNote({ id: 1, content: 'Нова' })
    expect(useTableStore.getState().notes[0].content).toBe('Нова')
  })

  it('removeNote — видаляє нотатку', () => {
    useTableStore.getState().addNote(note(1))
    useTableStore.getState().removeNote(1)
    expect(useTableStore.getState().notes).toHaveLength(0)
  })
})

describe('tableStore — reset', () => {
  it('reset — очищує всі колекції', () => {
    useTableStore.getState().addCard(card(1))
    useTableStore.getState().addThread(thread(10, 1, 2))
    useTableStore.getState().addNote(note(1))
    useTableStore.getState().reset()
    const state = useTableStore.getState()
    expect(state.cards).toHaveLength(0)
    expect(state.threads).toHaveLength(0)
    expect(state.notes).toHaveLength(0)
  })
})

const diceEntry = (extra = {}) => ({
  rolled_by: 'alice',
  rolled_by_id: 1,
  dice_type: 'd100',
  count: 1,
  results: [42],
  total: 42,
  tier: 'regular',
  ...extra,
})

describe('tableStore — diceLog', () => {
  it('addDiceLog — додає запис', () => {
    useTableStore.getState().addDiceLog(diceEntry())
    expect(useTableStore.getState().diceLog).toHaveLength(1)
    expect(useTableStore.getState().diceLog[0].total).toBe(42)
  })

  it('addDiceLog — різні гравці не дедуплікуються', () => {
    useTableStore.getState().addDiceLog(diceEntry({ rolled_by_id: 1, total: 42 }))
    useTableStore.getState().addDiceLog(diceEntry({ rolled_by_id: 2, total: 42 }))
    expect(useTableStore.getState().diceLog).toHaveLength(2)
  })

  it('addDiceLog — однаковий кидок від того самого гравця за < 500мс ігнорується (BUG-1)', () => {
    const entry = diceEntry({ rolled_by_id: 1, total: 55 })
    useTableStore.getState().addDiceLog(entry)
    // другий виклик одразу — вважається дублікатом
    useTableStore.getState().addDiceLog(entry)
    expect(useTableStore.getState().diceLog).toHaveLength(1)
  })

  it('addDiceLog — різні значення від того самого гравця не дедуплікуються', () => {
    useTableStore.getState().addDiceLog(diceEntry({ rolled_by_id: 1, total: 30 }))
    useTableStore.getState().addDiceLog(diceEntry({ rolled_by_id: 1, total: 70 }))
    expect(useTableStore.getState().diceLog).toHaveLength(2)
  })

  it('addDiceLog — зберігає максимум 100 записів', () => {
    for (let i = 0; i < 110; i++) {
      useTableStore.getState().addDiceLog(diceEntry({ rolled_by_id: i, total: i + 1 }))
    }
    expect(useTableStore.getState().diceLog).toHaveLength(100)
  })
})
