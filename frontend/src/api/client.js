import axios from 'axios'
import useAuthStore from '../store/authStore.js'

const client = axios.create({
  baseURL: '/api',
})

client.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  const lang = localStorage.getItem('i18nextLng') || 'uk'
  config.headers['Accept-Language'] = lang
  return config
})

// Shared promise while a refresh is in flight — prevents N concurrent refreshes
let refreshPromise = null

function logout() {
  useAuthStore.getState().clearAuth()
  window.location.href = '/login'
}

// Exchanges the refresh token for a new access token and stores it.
// Logs the user out when the refresh token itself is gone or rejected.
export async function refreshAccessToken() {
  const { refreshToken } = useAuthStore.getState()
  if (!refreshToken) {
    logout()
    throw new Error('No refresh token')
  }
  if (!refreshPromise) {
    // Raw axios so this request does NOT go through our interceptor
    refreshPromise = axios
      .post('/api/auth/token/refresh/', { refresh: refreshToken })
      .then(({ data }) => {
        const { user, setAuth } = useAuthStore.getState()
        setAuth(user, data.access, data.refresh ?? refreshToken)
        return data.access
      })
      .catch((err) => {
        // A network hiccup is not a reason to log out — only a rejected token is
        if (err.response?.status === 401 || err.response?.status === 400) logout()
        throw err
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

function tokenExpiresAt(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.exp * 1000
  } catch {
    return 0
  }
}

// An access token that will still be valid for at least a minute —
// the WebSocket can't retry through the 401 interceptor, so it asks up front.
export async function getFreshAccessToken({ force = false } = {}) {
  const { accessToken } = useAuthStore.getState()
  if (!accessToken) return null
  if (!force && tokenExpiresAt(accessToken) - Date.now() > 60_000) return accessToken
  return refreshAccessToken()
}

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }
    original._retry = true

    try {
      const access = await refreshAccessToken()
      original.headers.Authorization = `Bearer ${access}`
      return client(original)
    } catch {
      return Promise.reject(error)
    }
  },
)

export default client
