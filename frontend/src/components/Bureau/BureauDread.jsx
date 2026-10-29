import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './dread.css'

// Background dread for the bureau desk: fog, an eye that watches from the
// bare wood, words scratched into it, a shadow that reaches in from the edge,
// a failing lamp. The eye and the words only ever appear on empty desk (we
// probe with elementFromPoint), so they never cover anything the player
// needs to read. The lower the sanity, the more often things happen.

const rnd = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

// seconds between events, per dread level (1 calm … 3 breaking)
const PACE = {
  eye:     [[40, 90], [20, 45], [8, 20]],
  whisper: [[70, 140], [30, 70], [12, 30]],
  reach:   [[50, 110], [25, 60], [10, 30]],
  flicker: [[60, 120], [30, 70], [12, 35]],
}

function useRandomEvent(active, [min, max], fire) {
  const fireRef = useRef(fire)
  fireRef.current = fire
  useEffect(() => {
    if (!active) return undefined
    let timer
    // the first one comes sooner, so the unease starts early
    const loop = (first) => {
      timer = setTimeout(() => {
        if (!document.hidden) fireRef.current()
        loop(false)
      }, (first ? rnd(min * 0.25, min * 0.6) : rnd(min, max)) * 1000)
    }
    loop(true)
    return () => clearTimeout(timer)
  }, [active, min, max])
}

function Eye({ x, y, onDone }) {
  const ref = useRef(null)
  const iris = useRef(null)
  const [shut, setShut] = useState(false)

  useEffect(() => {
    const move = (e) => {
      const r = ref.current?.getBoundingClientRect()
      if (!r) return
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const d = Math.hypot(dx, dy) || 1
      // it does not like being looked at
      if (d < 160) setShut(true)
      iris.current?.setAttribute('transform', `translate(${(dx / d) * 14} ${(dy / d) * 6})`)
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])

  return (
    <div ref={ref} className={`bu-eye${shut ? ' is-shut' : ''}`} style={{ left: x, top: y }} onAnimationEnd={onDone}>
      <svg viewBox="0 0 120 60">
        <path className="bu-eye__white" d="M4 30 Q60 -14 116 30 Q60 74 4 30 Z" />
        <g ref={iris}>
          <circle className="bu-eye__iris" cx="60" cy="30" r="15" />
          <ellipse className="bu-eye__pupil" cx="60" cy="30" rx="2.6" ry="12" />
        </g>
      </svg>
    </div>
  )
}

function Reach({ side, at, onDone }) {
  return (
    <div className={`bu-reach bu-reach--${side}`} style={side === 'bottom' ? { left: at } : { top: at }}>
      <div className="bu-reach__arm" onAnimationEnd={(e) => e.animationName === 'bu-reach' && onDone()}>
        <svg viewBox="0 0 260 420">
          <g className="bu-reach__writhe">
            <path d="M70 420 C60 330 110 290 95 210 C82 140 130 110 120 40 C118 25 112 20 108 30 C112 100 62 130 70 210 C78 290 30 330 40 420 Z" />
            <path d="M150 420 C160 360 120 320 140 260 C158 205 120 170 150 120 C155 112 148 108 144 116 C112 165 135 210 118 262 C100 320 128 365 118 420 Z" />
            <path d="M210 420 C215 370 250 340 235 290 C225 255 245 230 240 205 C238 198 232 198 232 206 C230 235 205 255 212 292 C220 335 185 370 185 420 Z" />
          </g>
        </svg>
      </div>
    </div>
  )
}

export default function BureauDread({ level, effects }) {
  const { t } = useTranslation()
  const low = useRef(null)
  const high = useRef(null)
  const [eye, setEye] = useState(null)
  const [whisper, setWhisper] = useState(null)
  const [reach, setReach] = useState(null)
  const [flicker, setFlicker] = useState(0)
  const [calm] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  const active = effects && !calm

  // Both layers are position:fixed over the visible part of the desk, so the
  // shadows stay on screen while the page scrolls and never spill onto the nav.
  // Scrolling only moves them with a transform (no repaint); the size — which
  // forces a full repaint of the wood — changes only with the window.
  useEffect(() => {
    const desk = low.current.parentElement
    let frame = 0
    let last = ''
    const place = () => {
      frame = 0
      const d = desk.getBoundingClientRect()
      const left = Math.max(d.left, 0)
      const box = `${left}|${Math.min(d.right, window.innerWidth) - left}|${window.innerHeight}`
      const shift = `translateY(${Math.max(d.top, 0)}px)`
      for (const el of [low.current, high.current]) {
        if (box !== last) {
          const [l, w, h] = box.split('|')
          Object.assign(el.style, { left: `${l}px`, width: `${Math.max(0, w)}px`, height: `${h}px` })
        }
        if (el.style.transform !== shift) el.style.transform = shift
      }
      last = box
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(place) }
    place()
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    const ro = new ResizeObserver(schedule)
    ro.observe(desk)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      ro.disconnect()
    }
  }, [])

  // A spot of bare desk big enough for w×h, in layer coordinates
  const freeSpot = (w, h) => {
    const desk = low.current.parentElement
    const L = low.current.getBoundingClientRect()
    const bottom = Math.min(L.bottom, window.innerHeight)
    if (L.width < w + 20 || bottom - L.top < h + 20) return null
    // bare wood = nothing between the point and the desk paints a background
    const bare = (el) => {
      if (el && [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) return false
      for (let n = el; n; n = n.parentElement) {
        if (n === desk) return true
        if (n.matches('input, textarea, button, a, img, svg, canvas')) return false
        const cs = getComputedStyle(n)
        if (cs.backgroundImage !== 'none' || !/^rgba\(.*,\s*0\)$|^transparent$/.test(cs.backgroundColor)) return false
      }
      return false
    }
    for (let i = 0; i < 30; i++) {
      const x = rnd(L.left + 10, L.right - w - 10)
      const y = rnd(L.top + 10, bottom - h - 10)
      const probes = [[0, 0], [w, 0], [0, h], [w, h], [w / 2, h / 2]]
      if (probes.every(([dx, dy]) => bare(document.elementFromPoint(x + dx, y + dy)))) {
        return { x: x - L.left, y: y - L.top }
      }
    }
    return null
  }

  const pace = (kind) => PACE[kind][level - 1]

  // one of each at a time: a new event waits until the previous one is gone
  useRandomEvent(active, pace('eye'), () => {
    const spot = !eye && freeSpot(70, 36)
    if (spot) setEye({ ...spot, key: Date.now() })
  })
  useRandomEvent(active, pace('whisper'), () => {
    if (whisper) return
    const lines = t('bureau.whispers', { returnObjects: true })
    if (!Array.isArray(lines)) return
    const spot = freeSpot(300, 40)
    if (spot) setWhisper({ ...spot, text: pick(lines), tilt: rnd(-6, 6), key: Date.now() })
  })
  useRandomEvent(active, pace('reach'), () => {
    if (reach) return
    const side = pick(['left', 'right', 'bottom'])
    setReach({ side, at: `${Math.round(rnd(15, 70))}%`, key: Date.now() })
  })
  useRandomEvent(active, pace('flicker'), () => setFlicker((f) => f || Date.now()))

  return (
    <>
      <div className={`bu-dread${active ? ' is-active' : ''}`} ref={low} aria-hidden="true">
        <div className={`bu-dread__fog${active ? ' is-moving' : ''}`} />
        {eye && <Eye key={eye.key} x={eye.x} y={eye.y} onDone={() => setEye(null)} />}
        {whisper && (
          <div
            key={whisper.key}
            className="bu-whisper"
            style={{ left: whisper.x, top: whisper.y, transform: `rotate(${whisper.tilt}deg)` }}
            onAnimationEnd={() => setWhisper(null)}
          >
            {whisper.text}
          </div>
        )}
      </div>
      <div className="bu-dread bu-dread--over" ref={high} aria-hidden="true">
        {reach && <Reach key={reach.key} side={reach.side} at={reach.at} onDone={() => setReach(null)} />}
        {flicker > 0 && <div key={flicker} className="bu-dread__flicker" onAnimationEnd={() => setFlicker(0)} />}
      </div>
    </>
  )
}
