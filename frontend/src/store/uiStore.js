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
      brightness: 0,   // 0 = dark (default), 1 = medium, 2 = lighter
      fontSize: 'md',  // 'sm' | 'md' | 'lg'

      setLamp: (v) => set({ lamp: v }),
      setGrain: (v) => set({ grain: v }),
      setGlitchText: (v) => set({ glitchText: v }),
      setShowLatin: (v) => set({ showLatin: v }),
      setLang: (v) => set({ lang: v }),
      setBrightness: (v) => set({ brightness: v }),
      setFontSize: (v) => set({ fontSize: v }),
    }),
    { name: 'cthulhu-ui-prefs' }
  )
)

export default useUIStore
