import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './typewriter.css'

// A typewriter page for long free text. The real editor is a plain textarea
// (selection, deleting, pasting, undo all work as usual); the visible letters
// are an overlay with slightly uneven ink, and in "machine" mode the paper
// slides so the typing point stays put under the type guide — like a carriage.

const MODE_KEY = 'cthulhu-typewriter-mode'
const SOUND_KEY = 'cthulhu-typewriter-sound'
const LINE_CHARS = 64          // paper width in characters
const BELL_AT = LINE_CHARS - 6 // the margin bell rings this close to the edge

function readPref(key, fallback) {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value) } catch { /* private mode */ }
}

// Deterministic per-letter wobble: the same text always looks the same
function inkOf(i, code) {
  const h = Math.sin(i * 12.9898 + code * 78.233) * 43758.5453
  const r = h - Math.floor(h)
  return { opacity: 0.68 + r * 0.32, top: (r - 0.5) * 1.1 }
}

// One paragraph of inked letters. Memoized by text, so a keystroke only
// re-renders the paragraph being typed in.
const InkParagraph = memo(function InkParagraph({ text, start, caretAt, caretRef }) {
  const out = []
  for (let i = 0; i < text.length; i++) {
    if (caretAt === i) out.push(<span key="caret" ref={caretRef} className="tw-caret-mark" />)
    const ch = text[i]
    if (ch === ' ') {
      out.push(' ')
      continue
    }
    const { opacity, top } = inkOf(start + i, ch.charCodeAt(0))
    out.push(<span key={i} style={{ opacity, top }}>{ch}</span>)
  }
  if (caretAt === text.length) out.push(<span key="caret" ref={caretRef} className="tw-caret-mark" />)
  return <>{out}{'\n'}</>
})

// ── Sounds (WebAudio, synthesized — no files) ──

let audioCtx = null
function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    audioCtx = new AC()
  }
  return audioCtx
}

function noiseBurst(duration, freq, gain) {
  const ac = ctx()
  if (!ac) return
  const len = Math.floor(ac.sampleRate * duration)
  const buffer = ac.createBuffer(1, len, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  const g = ac.createGain()
  g.gain.value = gain
  src.connect(filter).connect(g).connect(ac.destination)
  src.start()
}

function bell() {
  const ac = ctx()
  if (!ac) return
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.frequency.value = 2093
  g.gain.setValueAtTime(0.12, ac.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.9)
  osc.connect(g).connect(ac.destination)
  osc.start()
  osc.stop(ac.currentTime + 0.9)
}

const sounds = {
  key: () => noiseBurst(0.035, 2400 + Math.random() * 800, 0.5),
  space: () => noiseBurst(0.03, 900, 0.35),
  ret: () => noiseBurst(0.28, 600, 0.3),
  bell,
}

// ── Component ──

export default function Typewriter({ value, onChange, placeholder, label }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState(() => readPref(MODE_KEY, 'machine'))
  const [sound, setSound] = useState(() => readPref(SOUND_KEY, 'off') === 'on')
  const [caret, setCaret] = useState(value?.length ?? 0)
  const [offset, setOffset] = useState({ x: 0, y: 0, line: 0, isReturn: false })
  const [strike, setStrike] = useState(0)

  const windowRef = useRef(null)
  const inkRef = useRef(null)
  const inputRef = useRef(null)
  const caretRef = useRef(null)
  const bellRungRef = useRef(-1)
  const machine = mode === 'machine'

  useEffect(() => { writePref(MODE_KEY, mode) }, [mode])
  useEffect(() => { writePref(SOUND_KEY, sound ? 'on' : 'off') }, [sound])

  const text = value ?? ''
  const paragraphs = text.split('\n')

  const syncCaret = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    // Mid-drag selections would make the paper chase the mouse — follow the caret end
    setCaret(el.selectionDirection === 'backward' ? el.selectionStart : el.selectionEnd)
  }, [])

  // The textarea grows with its content; the window, not the textarea, scrolls
  useLayoutEffect(() => {
    const input = inputRef.current
    const ink = inkRef.current
    if (input && ink) input.style.height = `${ink.offsetHeight}px`
  })

  // Slide the paper so the caret sits under the type guide
  useLayoutEffect(() => {
    const mark = caretRef.current
    const win = windowRef.current
    if (!machine || !mark || !win) return
    const x = win.clientWidth / 2 - mark.offsetLeft
    const y = win.clientHeight * 0.72 - mark.offsetTop
    // A carriage return (caret moved to another line) slides slower than a keystroke
    setOffset((prev) => (prev.x === x && prev.y === y
      ? prev
      : { x, y, line: mark.offsetTop, isReturn: mark.offsetTop !== prev.line }))
  }, [caret, text, machine])

  function handleKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const isChar = e.key.length === 1
    if (isChar) setStrike((n) => n + 1)
    if (!sound) return
    if (e.key === 'Enter') sounds.ret()
    else if (e.key === ' ') sounds.space()
    else if (isChar || e.key === 'Backspace') sounds.key()
  }

  function handleChange(e) {
    onChange(e.target.value)
    const pos = e.target.selectionEnd
    setCaret(pos)
    if (!sound) return
    // Margin bell, once per line, as the carriage nears the right edge
    const lineStart = e.target.value.lastIndexOf('\n', pos - 1) + 1
    const column = (pos - lineStart) % LINE_CHARS
    const lineId = lineStart * 1000 + Math.floor((pos - lineStart) / LINE_CHARS)
    if (column >= BELL_AT && bellRungRef.current !== lineId) {
      bellRungRef.current = lineId
      sounds.bell()
    }
  }

  // Index of the paragraph the caret is in, and the caret's offset within it
  let caretPara = 0
  let caretInPara = caret
  for (let i = 0, start = 0; i < paragraphs.length; i++) {
    const end = start + paragraphs[i].length
    if (caret <= end) { caretPara = i; caretInPara = caret - start; break }
    start = end + 1
  }

  let start = 0
  const inked = paragraphs.map((p, i) => {
    const node = (
      <InkParagraph
        key={i}
        text={p}
        start={start}
        caretAt={i === caretPara ? caretInPara : -1}
        caretRef={i === caretPara ? caretRef : null}
      />
    )
    start += p.length + 1
    return node
  })

  return (
    <div className={`tw ${machine ? 'tw--machine' : 'tw--sheet'}`}>
      <div className="tw-head">
        <div className="tw-plate">
          <span className="tw-plate__brand">Arkham Nº 5</span>
          {label && <span className="tw-plate__label">{label}</span>}
        </div>
        <div className="tw-controls">
          <button type="button" className={`tw-switch ${machine ? 'is-on' : ''}`} onClick={() => setMode(machine ? 'sheet' : 'machine')}>
            {machine ? t('typewriter.modeMachine') : t('typewriter.modeSheet')}
          </button>
          <button type="button" className={`tw-switch ${sound ? 'is-on' : ''}`} onClick={() => setSound((v) => !v)} title={t('typewriter.soundHint')}>
            {sound ? t('typewriter.soundOn') : t('typewriter.soundOff')}
          </button>
        </div>
      </div>

      <div className="tw-window" ref={windowRef} onClick={() => inputRef.current?.focus()}>
        {machine && <div className="tw-platen" />}
        <div
          className={`tw-paper ${offset.isReturn ? 'is-return' : ''}`}
          style={machine ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
        >
          <div className="tw-ink" ref={inkRef} aria-hidden="true">
            {text ? inked : <span className="tw-placeholder">{placeholder}<span ref={caretRef} className="tw-caret-mark" /></span>}
          </div>
          <textarea
            ref={inputRef}
            className="tw-input"
            value={text}
            spellCheck={false}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onKeyUp={syncCaret}
            onMouseUp={syncCaret}
            onFocus={syncCaret}
            onSelect={(e) => { if (e.target.selectionStart === e.target.selectionEnd) syncCaret() }}
          />
        </div>
        {machine && (
          <div className="tw-guide">
            {strike > 0 && <span key={strike} className="tw-typebar" />}
          </div>
        )}
      </div>
    </div>
  )
}
