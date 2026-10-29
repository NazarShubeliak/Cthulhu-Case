import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'
import useAuthStore from '../store/authStore'
import { getFreshAccessToken } from './client'

const jwt = (expInSeconds) => {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expInSeconds }))
  return `x.${payload}.y`
}

beforeEach(() => {
  vi.restoreAllMocks()
  useAuthStore.getState().clearAuth()
})

describe('getFreshAccessToken — токен для WebSocket', () => {
  it('повертає null, якщо користувач не залогінений', async () => {
    expect(await getFreshAccessToken()).toBeNull()
  })

  it('повертає поточний токен, якщо він ще живий', async () => {
    const token = jwt(600)
    useAuthStore.getState().setAuth({ id: 1 }, token, 'refresh')
    const post = vi.spyOn(axios, 'post')
    expect(await getFreshAccessToken()).toBe(token)
    expect(post).not.toHaveBeenCalled()
  })

  it('оновлює протермінований токен перед підключенням', async () => {
    useAuthStore.getState().setAuth({ id: 1 }, jwt(-10), 'refresh')
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'new-access', refresh: 'new-refresh' } })
    expect(await getFreshAccessToken()).toBe('new-access')
    expect(useAuthStore.getState().accessToken).toBe('new-access')
    expect(useAuthStore.getState().refreshToken).toBe('new-refresh')
  })

  it('force — оновлює навіть живий токен (сервер закрив сокет з 4001)', async () => {
    useAuthStore.getState().setAuth({ id: 1 }, jwt(600), 'refresh')
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access: 'forced' } })
    expect(await getFreshAccessToken({ force: true })).toBe('forced')
  })

  it('друга вкладка вже оновила токен — бере його з localStorage без запиту', async () => {
    useAuthStore.getState().setAuth({ id: 1 }, jwt(-10), 'old-refresh')
    // Інша вкладка (стіл) записала свіжі токени у сховище
    const fresh = jwt(1800)
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { user: { id: 1 }, accessToken: fresh, refreshToken: 'new-refresh' }, version: 0,
    }))
    const post = vi.spyOn(axios, 'post')
    expect(await getFreshAccessToken()).toBe(fresh)
    expect(post).not.toHaveBeenCalled()
    expect(useAuthStore.getState().refreshToken).toBe('new-refresh')
  })

  it('refresh відхилено, бо інша вкладка встигла ротувати — не розлогінює', async () => {
    useAuthStore.getState().setAuth({ id: 1 }, jwt(-10), 'old-refresh')
    vi.spyOn(axios, 'post').mockImplementation(async () => {
      // Поки йшов запит, інша вкладка ротувала токен
      localStorage.setItem('auth-storage', JSON.stringify({
        state: { user: { id: 1 }, accessToken: 'other-tab-access', refreshToken: 'other-tab-refresh' }, version: 0,
      }))
      throw Object.assign(new Error('blacklisted'), { response: { status: 401 } })
    })
    expect(await getFreshAccessToken()).toBe('other-tab-access')
    expect(useAuthStore.getState().refreshToken).toBe('other-tab-refresh')
  })

  it('мережева помилка при оновленні не розлогінює', async () => {
    useAuthStore.getState().setAuth({ id: 1 }, jwt(-10), 'refresh')
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Network Error'))
    await expect(getFreshAccessToken()).rejects.toThrow()
    expect(useAuthStore.getState().refreshToken).toBe('refresh')
  })
})
