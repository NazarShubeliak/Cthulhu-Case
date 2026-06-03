import { describe, it, expect, beforeEach } from 'vitest'
import useAuthStore from './authStore'


const mockUser = { id: 1, username: 'alice', role: 'player' }

beforeEach(() => {
  useAuthStore.getState().clearAuth()
  localStorage.clear()
})

describe('authStore', () => {
  it('початковий стан — порожній', () => {
    const { user, accessToken, refreshToken } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(accessToken).toBeNull()
    expect(refreshToken).toBeNull()
  })

  it('setAuth — зберігає користувача і токени', () => {
    useAuthStore.getState().setAuth(mockUser, 'access_tok', 'refresh_tok')
    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.accessToken).toBe('access_tok')
    expect(state.refreshToken).toBe('refresh_tok')
  })

  it('clearAuth — скидає всі дані', () => {
    useAuthStore.getState().setAuth(mockUser, 'tok', 'ref')
    useAuthStore.getState().clearAuth()
    const { user, accessToken, refreshToken } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(accessToken).toBeNull()
    expect(refreshToken).toBeNull()
  })

  it('setUser — оновлює тільки user', () => {
    useAuthStore.getState().setAuth(mockUser, 'tok', 'ref')
    useAuthStore.getState().setUser({ ...mockUser, bio: 'Дослідник' })
    const state = useAuthStore.getState()
    expect(state.user.bio).toBe('Дослідник')
    expect(state.accessToken).toBe('tok')
  })

  it('дані персистуються в localStorage', () => {
    useAuthStore.getState().setAuth(mockUser, 'access_tok', 'refresh_tok')
    const stored = JSON.parse(localStorage.getItem('auth-storage') || '{}')
    expect(stored.state?.accessToken).toBe('access_tok')
  })
})
