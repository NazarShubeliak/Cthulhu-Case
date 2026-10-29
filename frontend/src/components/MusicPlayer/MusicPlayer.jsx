import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { getMusic, setMusic as apiSetMusic } from '../../api/sessions'
import useTableStore from '../../store/tableStore'

// ── YouTube helpers ──

function extractYouTubeId(rawUrl) {
  let url
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') return url.pathname.slice(1) || null
  if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') return url.searchParams.get('v')
    if (url.pathname.startsWith('/embed/')) return url.pathname.split('/embed/')[1]
    if (url.pathname.startsWith('/shorts/')) return url.pathname.split('/shorts/')[1]
  }
  return null
}

let ytApiPromise = null
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT)
    }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(tag)
    }
  })
  return ytApiPromise
}

async function fetchTitle(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`)
    if (!res.ok) throw new Error('oembed failed')
    const data = await res.json()
    return data.title || videoId
  } catch {
    return videoId
  }
}

const thumbnailOf = (videoId) => `https://i.ytimg.com/vi/${videoId}/default.jpg`

// ── Shared playback state ──
// The master owns the music: the playlist, the current track and play/pause
// live on the session and reach every player over the WebSocket. Each player
// only controls their own volume and mute.

const DRIFT_TOLERANCE_S = 2
const AUTOPLAY_CHECK_MS = 2500

// Where the track should be right now, in seconds
function positionOf(music) {
  if (!music) return 0
  if (!music.playing) return music.offset ?? 0
  const sinceUpdate = (music.server_now ?? 0) - (music.updated_at ?? 0)
  const sinceReceived = (Date.now() - (music.receivedAt ?? Date.now())) / 1000
  return (music.offset ?? 0) + Math.max(0, sinceUpdate) + sinceReceived
}

// ── Component ──

export default function MusicPlayer({ sessionId, isMaster, open, onClose }) {
  const { t } = useTranslation()
  const music = useTableStore((s) => s.music)
  const tracks = music?.tracks ?? []
  const activeVideoId = music?.current ?? null
  const shouldPlay = !!music?.playing

  const [isPlaying, setIsPlaying] = useState(false)
  const [blocked, setBlocked] = useState(false)   // the browser refused to autoplay
  const [urlInput, setUrlInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [volume, setVolume] = useState(() => {
    const saved = Number(localStorage.getItem('cthulhu-music-volume'))
    return Number.isFinite(saved) && saved > 0 ? saved : 60
  })
  const [muted, setMuted] = useState(() => localStorage.getItem('cthulhu-music-muted') === '1')

  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const playerReadyRef = useRef(false)
  const loadedVideoRef = useRef(null)
  const musicRef = useRef(music)
  const isMasterRef = useRef(isMaster)
  useEffect(() => { musicRef.current = music }, [music])
  useEffect(() => { isMasterRef.current = isMaster }, [isMaster])

  useEffect(() => {
    getMusic(sessionId)
      .then(({ data }) => useTableStore.getState().setMusic(data))
      .catch(() => {})
  }, [sessionId])

  useEffect(() => {
    localStorage.setItem('cthulhu-music-volume', String(volume))
    localStorage.setItem('cthulhu-music-muted', muted ? '1' : '0')
    if (!playerReadyRef.current) return
    playerRef.current?.setVolume(volume)
    if (muted) playerRef.current?.mute()
    else playerRef.current?.unMute()
  }, [volume, muted])

  // Bring the local YouTube player in line with the shared state
  const syncPlayer = useCallback(() => {
    const player = playerRef.current
    const m = musicRef.current
    if (!playerReadyRef.current || !player) return
    if (!m?.current) {
      if (loadedVideoRef.current) player.stopVideo()
      loadedVideoRef.current = null
      return
    }
    const startSeconds = positionOf(m)
    if (loadedVideoRef.current !== m.current) {
      loadedVideoRef.current = m.current
      if (m.playing) player.loadVideoById({ videoId: m.current, startSeconds })
      else player.cueVideoById({ videoId: m.current, startSeconds })
      return
    }
    if (Math.abs((player.getCurrentTime?.() ?? 0) - startSeconds) > DRIFT_TOLERANCE_S) {
      player.seekTo(startSeconds, true)
    }
    if (m.playing) player.playVideo()
    else player.pauseVideo()
  }, [])

  useEffect(() => {
    musicRef.current = music
    syncPlayer()
  }, [music, syncPlayer])

  // Browsers block sound until the page has been interacted with. If the
  // master pressed play but nothing started, offer a button to start it.
  useEffect(() => {
    if (!shouldPlay || isPlaying) {
      setBlocked(false)
      return
    }
    const timer = setTimeout(() => setBlocked(true), AUTOPLAY_CHECK_MS)
    return () => clearTimeout(timer)
  }, [shouldPlay, isPlaying, activeVideoId])

  // Master: persist a new state; every client (including this one) applies it
  const pushMusic = useCallback(async (changes) => {
    const m = musicRef.current ?? {}
    const next = {
      tracks: m.tracks ?? [],
      current: m.current ?? null,
      playing: !!m.playing,
      offset: playerReadyRef.current && loadedVideoRef.current
        ? (playerRef.current?.getCurrentTime?.() ?? 0)
        : positionOf(m),
      ...changes,
    }
    try {
      const { data } = await apiSetMusic(sessionId, next)
      useTableStore.getState().setMusic(data)
      setError('')
    } catch {
      setError(t('table.musicSaveError'))
    }
  }, [sessionId, t])

  const playByOffset = useCallback((offset) => {
    const list = musicRef.current?.tracks ?? []
    if (list.length === 0) return
    const currentIndex = list.findIndex((tr) => tr.videoId === musicRef.current?.current)
    const nextIndex = ((currentIndex === -1 ? 0 : currentIndex + offset) + list.length) % list.length
    pushMusic({ current: list[nextIndex].videoId, playing: true, offset: 0 })
  }, [pushMusic])

  const playByOffsetRef = useRef(playByOffset)
  useEffect(() => { playByOffsetRef.current = playByOffset }, [playByOffset])

  // The playlist used to live in each browser — hand the master's old one to the session once
  useEffect(() => {
    if (!isMaster || !music || (music.tracks ?? []).length > 0) return
    const legacyKey = `cthulhu-music-${sessionId}`
    let legacy = []
    try { legacy = JSON.parse(localStorage.getItem(legacyKey)) || [] } catch { /* ignore */ }
    localStorage.removeItem(legacyKey)
    if (legacy.length > 0) {
      pushMusic({ tracks: legacy.map(({ videoId, title }) => ({ videoId, title })), current: null, playing: false, offset: 0 })
    }
  }, [isMaster, music, sessionId, pushMusic])

  // Player is created once and lives for the whole table session,
  // independent of whether the panel UI is open — so music keeps playing when closed.
  useEffect(() => {
    let cancelled = false
    loadYouTubeApi().then((YT) => {
      if (cancelled || !containerRef.current || playerRef.current) return
      // YT.Player replaces the given element outright with its own <iframe>.
      // Mount it onto a plain node React never touches, so React's reconciler
      // never gets surprised that "its" element vanished from the DOM.
      const mountNode = document.createElement('div')
      containerRef.current.appendChild(mountNode)
      playerRef.current = new YT.Player(mountNode, {
        height: '0',
        width: '0',
        playerVars: { playsinline: 1 },
        events: {
          onReady: (e) => {
            playerReadyRef.current = true
            e.target.setVolume(volume)
            if (muted) e.target.mute()
            syncPlayer()
          },
          onStateChange: (e) => {
            setIsPlaying(e.data === YT.PlayerState.PLAYING)
            // Only the master advances the playlist — everyone else follows
            if (e.data === YT.PlayerState.ENDED && isMasterRef.current) playByOffsetRef.current(1)
          },
        },
      })
    })
    return () => {
      cancelled = true
      playerReadyRef.current = false
      loadedVideoRef.current = null
      playerRef.current?.destroy?.()
      playerRef.current = null
      // Defensive: destroy() should already remove the iframe it created,
      // but never leave stray nodes inside the React-owned container.
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd(e) {
    e.preventDefault()
    const videoId = extractYouTubeId(urlInput)
    if (!videoId) {
      setError(t('table.musicInvalidUrl'))
      return
    }
    setError('')
    if (tracks.some((tr) => tr.videoId === videoId)) {
      setUrlInput('')
      return
    }
    setAdding(true)
    const title = await fetchTitle(videoId)
    await pushMusic({
      tracks: [...tracks, { videoId, title }],
      // The first track starts playing straight away
      ...(activeVideoId ? {} : { current: videoId, playing: true, offset: 0 }),
    })
    setAdding(false)
    setUrlInput('')
  }

  function handleSelect(track) {
    pushMusic({ current: track.videoId, playing: true, offset: 0 })
  }

  function handlePlayPause() {
    if (!activeVideoId) {
      if (tracks.length > 0) handleSelect(tracks[0])
      return
    }
    pushMusic({ playing: !shouldPlay })
  }

  function handleRemove(videoId) {
    const rest = tracks.filter((tr) => tr.videoId !== videoId)
    pushMusic(videoId === activeVideoId
      ? { tracks: rest, current: null, playing: false, offset: 0 }
      : { tracks: rest })
  }

  function handleUnlock() {
    setBlocked(false)
    loadedVideoRef.current = null  // force a fresh load at the shared position
    syncPlayer()
  }

  const activeTrack = tracks.find((tr) => tr.videoId === activeVideoId) ?? null
  const iconBtn = { background: 'none', border: 'none', color: 'var(--moss-pale)', cursor: 'pointer', fontSize: 16 }

  return (
    <>
      {/* Hidden, always-mounted player — keeps playing while the panel is closed */}
      <div ref={containerRef} style={{ position: 'fixed', top: -9999, left: -9999, width: 0, height: 0, overflow: 'hidden' }} />

      {blocked && !muted && createPortal(
        <button
          onClick={handleUnlock}
          className="btn btn--ghost"
          style={{
            position: 'fixed', right: 20, bottom: 20, zIndex: 450,
            background: 'var(--ink-0)', border: '1px solid var(--ochre)', color: 'var(--ochre)',
            padding: '8px 14px', fontSize: 11, boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          {t('table.musicUnlock')}
        </button>,
        document.body
      )}

      {open && createPortal(
        <div style={{
          position: 'fixed', top: 50, right: 0, bottom: 0, width: 300, zIndex: 400,
          background: 'var(--ink-0)', borderLeft: '1px solid var(--ochre-deep)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderBottom: '1px solid var(--ochre-deep)', flexShrink: 0,
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--moss)' }}>
              {t('table.musicTitle')}
            </span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
          </div>

          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(184,153,104,0.15)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--moss)', letterSpacing: '0.1em', marginBottom: isMaster ? 8 : 0, lineHeight: 1.5 }}>
              {isMaster ? t('table.musicPersonalHint') : t('table.musicPlayerHint')}
            </div>
            {isMaster && (
              <form onSubmit={handleAdd} style={{ display: 'flex', gap: 6 }}>
                <input
                  className="form-input"
                  style={{ flex: 1, fontSize: 11 }}
                  placeholder={t('table.musicUrlPlaceholder')}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <button type="submit" className="btn btn--ghost" style={{ padding: '4px 10px', fontSize: 10 }} disabled={adding || !urlInput.trim()}>
                  {adding ? '…' : t('table.musicAdd')}
                </button>
              </form>
            )}
            {error && <div className="auth-error" style={{ marginTop: 6, fontSize: 10 }}>{error}</div>}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {tracks.length === 0 && (
              <div style={{ padding: '24px 16px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss)', letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.6 }}>
                {isMaster ? t('table.musicEmpty') : t('table.musicEmptyPlayer')}
              </div>
            )}
            {tracks.map((tr) => (
              <div
                key={tr.videoId}
                onClick={isMaster ? () => handleSelect(tr) : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                  cursor: isMaster ? 'pointer' : 'default',
                  background: tr.videoId === activeVideoId ? 'rgba(184,153,104,0.1)' : 'transparent',
                }}
              >
                <img src={thumbnailOf(tr.videoId)} alt="" width={32} height={24} style={{ objectFit: 'cover', flexShrink: 0 }} />
                <span style={{
                  flex: 1, fontFamily: 'var(--font-display)', fontSize: 12,
                  color: tr.videoId === activeVideoId ? 'var(--ochre)' : 'var(--cream)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {tr.title}
                </span>
                {isMaster && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemove(tr.videoId) }}
                    title={t('table.musicRemove')}
                    style={{ background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--ochre-deep)', flexShrink: 0 }}>
            {activeTrack && (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss-pale)',
                marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {shouldPlay ? '▶ ' : '❚❚ '}{activeTrack.title}
              </div>
            )}
            {isMaster && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
                <button onClick={() => playByOffset(-1)} title={t('table.musicPrev')} disabled={tracks.length === 0} style={iconBtn}>
                  ⏮
                </button>
                <button onClick={handlePlayPause} title={shouldPlay ? t('table.musicPause') : t('table.musicPlay')} disabled={tracks.length === 0}
                  style={{
                    background: 'none', border: '1px solid var(--ochre-deep)', color: 'var(--ochre)',
                    cursor: 'pointer', fontSize: 15, width: 32, height: 32, borderRadius: '50%',
                  }}>
                  {shouldPlay ? '❚❚' : '▶'}
                </button>
                <button onClick={() => playByOffset(1)} title={t('table.musicNext')} disabled={tracks.length === 0} style={iconBtn}>
                  ⏭
                </button>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setMuted((v) => !v)}
                title={muted ? t('table.musicUnmute') : t('table.musicMute')}
                style={{ ...iconBtn, fontSize: 13, padding: 0, width: 18 }}
              >
                {muted ? '🔇' : '♪'}
              </button>
              <input
                type="range" min={0} max={100} value={volume}
                onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false) }}
                title={t('table.musicVolume')}
                style={{ flex: 1, opacity: muted ? 0.4 : 1 }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
