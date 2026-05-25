import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useUIStore = create(
  persist(
    (set) => ({
      lamp: true,
      grain: true,
      glitchText: true,
      showLatin: true,
      lang: 'uk',

      setLamp: (v) => set({ lamp: v }),
      setGrain: (v) => set({ grain: v }),
      setGlitchText: (v) => set({ glitchText: v }),
      setShowLatin: (v) => set({ showLatin: v }),
      setLang: (v) => set({ lang: v }),
    }),
    { name: 'cthulhu-ui-prefs' }
  )
)

export default useUIStore
