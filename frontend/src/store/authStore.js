import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'auth-storage' },
  ),
)

// Refresh tokens are rotated and the old one is blacklisted, so a tab that
// keeps its own in-memory copy gets logged out the moment another tab (e.g. the
// table's WebSocket) refreshes. Adopt whatever another tab writes — new tokens
// or a logout.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'auth-storage') useAuthStore.persist.rehydrate()
  })
}

export default useAuthStore
