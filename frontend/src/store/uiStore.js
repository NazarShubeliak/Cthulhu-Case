import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useUIStore = create(
  persist(
    (set) => ({
      lamp: true,
      grain: true,
      glitchText: true,
      showLatin: true,
      lang: 'en',
      theme: 'dark',   // 'dark' (default) | 'light' (aged newspaper)
      fontSize: 'md',  // 'sm' | 'md' | 'lg'
      sidebarHidden: false,

      setLamp: (v) => set({ lamp: v }),
      setGrain: (v) => set({ grain: v }),
      setGlitchText: (v) => set({ glitchText: v }),
      setShowLatin: (v) => set({ showLatin: v }),
      setLang: (v) => set({ lang: v }),
      setTheme: (v) => set({ theme: v }),
      setFontSize: (v) => set({ fontSize: v }),
      toggleSidebar: () => set((s) => ({ sidebarHidden: !s.sidebarHidden })),
    }),
    { name: 'cthulhu-ui-prefs' }
  )
)

export default useUIStore
