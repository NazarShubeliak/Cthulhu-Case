import useUIStore from '../../store/uiStore.js'

export default function GlitchText({ children, className = '' }) {
  const glitchText = useUIStore((s) => s.glitchText)

  if (!glitchText) {
    return <span className={className}>{children}</span>
  }

  const text = typeof children === 'string' ? children : String(children ?? '')
  return (
    <span className={`glitch-text ${className}`}>
      {text.split('').map((c, i) => (
        <span key={i}>{c === ' ' ? ' ' : c}</span>
      ))}
    </span>
  )
}
