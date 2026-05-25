import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCharacters, createCharacter } from '../../api/characters.js'

function CharacterCard({ character, onClick }) {
  const { t } = useTranslation()
  const hpPct = Math.min(100, (character.hp_current / character.hp_max) * 100)
  const sanPct = Math.min(100, (character.sanity_current / character.sanity_max) * 100)

  return (
    <div className="char-card" onClick={onClick}>
      <div className="char-card__name">{character.name}</div>
      <div className="char-card__occ">
        {character.occupation || t('chars.unknownOcc')}
        {character.age ? ` · ${character.age} р.` : ''}
      </div>
      <div className="char-card__vitals">
        <div className="char-card__vital-row">
          <span className="char-card__vital-label">{t('chars.health')}</span>
          <div className="stat-bar" style={{ flex: 1 }}>
            <div
              className="stat-bar__fill"
              style={{
                width: `${hpPct}%`,
                background: hpPct < 30 ? 'var(--blood-bright)' : 'var(--ochre)',
              }}
            />
          </div>
          <span className="char-card__vital-nums">
            {character.hp_current}/{character.hp_max}
          </span>
        </div>
        <div className="char-card__vital-row">
          <span className="char-card__vital-label">{t('chars.sanity')}</span>
          <div className="stat-bar" style={{ flex: 1 }}>
            <div
              className="stat-bar__fill"
              style={{
                width: `${sanPct}%`,
                background: sanPct < 40 ? 'var(--blood-bright)' : 'var(--moss-pale)',
              }}
            />
          </div>
          <span className="char-card__vital-nums">
            {character.sanity_current}/{character.sanity_max}
          </span>
        </div>
      </div>
    </div>
  )
}

function NewCharacterModal({ onClose, onCreate }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ name: '', occupation: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError(t('chars.nameError'))
      return
    }
    setLoading(true)
    try {
      const res = await createCharacter(form)
      onCreate(res.data)
      onClose()
    } catch (err) {
      const data = err.response?.data
      if (typeof data === 'object') {
        const msgs = Object.values(data).flat()
        setError(msgs[0] || t('chars.createError'))
      } else {
        setError(t('chars.serverError'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-title">{t('chars.modalTitle')}</div>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="char-name">
              {t('chars.nameLabel')}
            </label>
            <input
              id="char-name"
              className="form-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={t('chars.namePlaceholder')}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="char-occ">
              {t('chars.occLabel')}
            </label>
            <input
              id="char-occ"
              className="form-input"
              value={form.occupation}
              onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
              placeholder={t('chars.occPlaceholder')}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? t('chars.creating') : t('chars.createBtn')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              {t('chars.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CharacterListPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    getCharacters()
      .then((res) => setCharacters(res.data.results ?? res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = (newChar) => {
    navigate(`/characters/${newChar.id}`)
  }

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__eyebrow">
          {t('chars.eyebrow')}
        </div>
        <h1 className="page-header__title">{t('chars.title')}</h1>
        <p className="page-header__sub">{t('chars.sub')}</p>
      </header>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn--primary"
          onClick={() => setShowModal(true)}
        >
          {t('chars.newBtn')}
        </button>
      </div>

      {loading && (
        <div
          style={{
            padding: '60px 0',
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.2em',
            color: 'var(--moss-pale)',
          }}
        >
          {t('chars.loading')}
        </div>
      )}

      {!loading && characters.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__title">{t('chars.empty')}</div>
          <div className="empty-state__sub">{t('chars.emptySub')}</div>
          <button
            className="btn btn--primary"
            onClick={() => setShowModal(true)}
          >
            {t('chars.openFirst')}
          </button>
        </div>
      )}

      {!loading && characters.length > 0 && (
        <div className="char-grid">
          {characters.map((c) => (
            <CharacterCard
              key={c.id}
              character={c}
              onClick={() => navigate(`/characters/${c.id}`)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewCharacterModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
