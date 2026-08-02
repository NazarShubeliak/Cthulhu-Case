import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

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

// ── Component ──
// Playback is entirely local to this browser tab: playlist and player state
// are per-player (localStorage), never synced over the session WebSocket.

export default function MusicPlayer({ sessionId, open, onClose }) {
  const { t } = useTranslation()
  const storageKey = `cthulhu-music-${sessionId}`

  const [tracks, setTracks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || [] } catch { return [] }
  })
  const [activeVideoId, setActiveVideoId] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [volume, setVolume] = useState(() => {
    const saved = Number(localStorage.getItem('cthulhu-music-volume'))
    return Number.isFinite(saved) && saved > 0 ? saved : 60
  })

  const containerRef = useRef(null)
  const playerRef = useRef(null)
  const playerReadyRef = useRef(false)
  const tracksRef = useRef(tracks)
  const activeVideoIdRef = useRef(activeVideoId)

  useEffect(() => { tracksRef.current = tracks }, [tracks])
  useEffect(() => { activeVideoIdRef.current = activeVideoId }, [activeVideoId])

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(tracks))
  }, [tracks, storageKey])

  useEffect(() => {
    localStorage.setItem('cthulhu-music-volume', String(volume))
    if (playerReadyRef.current) playerRef.current?.setVolume(volume)
  }, [volume])

  const playByOffset = useCallback((offset) => {
    const list = tracksRef.current
    if (list.length === 0) return
    const currentIndex = list.findIndex((tr) => tr.videoId === activeVideoIdRef.current)
    const nextIndex = ((currentIndex === -1 ? 0 : currentIndex + offset) + list.length) % list.length
    const next = list[nextIndex]
    setActiveVideoId(next.videoId)
    if (playerReadyRef.current) playerRef.current?.loadVideoById(next.videoId)
  }, [])

  const playByOffsetRef = useRef(playByOffset)
  useEffect(() => { playByOffsetRef.current = playByOffset }, [playByOffset])

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
          },
          onStateChange: (e) => {
            setIsPlaying(e.data === YT.PlayerState.PLAYING)
            if (e.data === YT.PlayerState.ENDED) playByOffsetRef.current(1)
          },
        },
      })
    })
    return () => {
      cancelled = true
      playerReadyRef.current = false
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
    setAdding(true)
    const title = await fetchTitle(videoId)
    setAdding(false)
    setUrlInput('')
    setTracks((prev) => {
      if (prev.some((tr) => tr.videoId === videoId)) return prev
      return [...prev, { videoId, title, thumbnail: `https://i.ytimg.com/vi/${videoId}/default.jpg` }]
    })
    if (!activeVideoIdRef.current) {
      setActiveVideoId(videoId)
      if (playerReadyRef.current) playerRef.current?.loadVideoById(videoId)
    }
  }

  function handleSelect(track) {
    setActiveVideoId(track.videoId)
    if (playerReadyRef.current) playerRef.current?.loadVideoById(track.videoId)
  }

  function handlePlayPause() {
    if (!playerReadyRef.current) return
    if (!activeVideoIdRef.current && tracksRef.current.length > 0) {
      handleSelect(tracksRef.current[0])
      return
    }
    if (isPlaying) playerRef.current.pauseVideo()
    else playerRef.current.playVideo()
  }

  function handleRemove(videoId) {
    setTracks((prev) => prev.filter((tr) => tr.videoId !== videoId))
    if (activeVideoIdRef.current === videoId) {
      playerRef.current?.stopVideo?.()
      setActiveVideoId(null)
      setIsPlaying(false)
    }
  }

  const activeTrack = tracks.find((tr) => tr.videoId === activeVideoId) ?? null

  return (
    <>
      {/* Hidden, always-mounted player — keeps playing while the panel is closed */}
      <div ref={containerRef} style={{ position: 'fixed', top: -9999, left: -9999, width: 0, height: 0, overflow: 'hidden' }} />

      {open && (
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
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--moss)', letterSpacing: '0.1em', marginBottom: 8, lineHeight: 1.5 }}>
              {t('table.musicPersonalHint')}
            </div>
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
            {error && <div className="auth-error" style={{ marginTop: 6, fontSize: 10 }}>{error}</div>}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {tracks.length === 0 && (
              <div style={{ padding: '24px 16px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss)', letterSpacing: '0.1em', textAlign: 'center', lineHeight: 1.6 }}>
                {t('table.musicEmpty')}
              </div>
            )}
            {tracks.map((tr) => (
              <div
                key={tr.videoId}
                onClick={() => handleSelect(tr)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer',
                  background: tr.videoId === activeVideoId ? 'rgba(184,153,104,0.1)' : 'transparent',
                }}
              >
                <img src={tr.thumbnail} alt="" width={32} height={24} style={{ objectFit: 'cover', flexShrink: 0 }} />
                <span style={{
                  flex: 1, fontFamily: 'var(--font-display)', fontSize: 12,
                  color: tr.videoId === activeVideoId ? 'var(--ochre)' : 'var(--cream)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {tr.title}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(tr.videoId) }}
                  title={t('table.musicRemove')}
                  style={{ background: 'none', border: 'none', color: 'var(--moss)', cursor: 'pointer', fontSize: 13, lineHeight: 1, flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--ochre-deep)', flexShrink: 0 }}>
            {activeTrack && (
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss-pale)',
                marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {activeTrack.title}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 10 }}>
              <button onClick={() => playByOffset(-1)} title={t('table.musicPrev')} disabled={tracks.length === 0}
                style={{ background: 'none', border: 'none', color: 'var(--moss-pale)', cursor: 'pointer', fontSize: 16 }}>
                ⏮
              </button>
              <button onClick={handlePlayPause} title={isPlaying ? t('table.musicPause') : t('table.musicPlay')} disabled={tracks.length === 0}
                style={{
                  background: 'none', border: '1px solid var(--ochre-deep)', color: 'var(--ochre)',
                  cursor: 'pointer', fontSize: 15, width: 32, height: 32, borderRadius: '50%',
                }}>
                {isPlaying ? '❚❚' : '▶'}
              </button>
              <button onClick={() => playByOffset(1)} title={t('table.musicNext')} disabled={tracks.length === 0}
                style={{ background: 'none', border: 'none', color: 'var(--moss-pale)', cursor: 'pointer', fontSize: 16 }}>
                ⏭
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--moss)' }}>♪</span>
              <input
                type="range" min={0} max={100} value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                title={t('table.musicVolume')}
                style={{ flex: 1 }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
