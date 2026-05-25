import { useEffect } from 'react'
import useUIStore from '../../store/uiStore.js'

export default function CursorLamp() {
  const lamp = useUIStore((s) => s.lamp)

  useEffect(() => {
    const root = document.documentElement
    if (!lamp) {
      root.style.setProperty('--lamp-opacity', '0')
      return
    }
    root.style.setProperty('--lamp-opacity', '1')
    const onMove = (e) => {
      root.style.setProperty('--mx', e.clientX + 'px')
      root.style.setProperty('--my', e.clientY + 'px')
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [lamp])

  return <div className="lamp-layer" aria-hidden="true" />
}
