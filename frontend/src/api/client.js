import axios from 'axios'
import useAuthStore from '../store/authStore.js'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
})

client.interceptors.request.use((config) => {
  // Read directly from persisted localStorage so we don't need React context
  const stored = localStorage.getItem('auth-storage')
  if (stored) {
    try {
      const { state } = JSON.parse(stored)
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`
      }
    } catch {
      // ignore parse errors
    }
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default client
