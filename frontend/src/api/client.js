import axios from 'axios'
import useAuthStore from '../store/authStore.js'

const client = axios.create({
  baseURL: '/api',
})

client.interceptors.request.use((config) => {
  const stored = localStorage.getItem('auth-storage')
  if (stored) {
    try {
      const { state } = JSON.parse(stored)
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`
      }
    } catch {}
  }
  return config
})

// Shared promise while a refresh is in flight — prevents N concurrent refreshes
let refreshPromise = null

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }
    original._retry = true

    const stored = localStorage.getItem('auth-storage')
    let refreshToken = null
    try {
      const { state } = JSON.parse(stored)
      refreshToken = state?.refreshToken
    } catch {}

    if (!refreshToken) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    try {
      // Use raw axios so this request does NOT go through our interceptor
      if (!refreshPromise) {
        refreshPromise = axios
          .post('/api/auth/token/refresh/', { refresh: refreshToken })
          .finally(() => { refreshPromise = null })
      }
      const { data } = await refreshPromise

      const { user, setAuth } = useAuthStore.getState()
      setAuth(user, data.access, data.refresh ?? refreshToken)

      original.headers.Authorization = `Bearer ${data.access}`
      return client(original)
    } catch {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(error)
    }
  },
)

export default client
