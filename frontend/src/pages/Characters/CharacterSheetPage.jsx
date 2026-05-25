import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCharacter, updateCharacter, updateSkill, rollDice, improveSkills, createEquipmentItem, updateEquipmentItem, deleteEquipmentItem, createMentalScar, deleteMentalScar } from '../../api/characters.js'
import useDebounce from '../../hooks/useDebounce.js'

// ── Stat definitions ─────────────────────────────────────────────────────────

const STAT_DEFS = [
  { key: 'str_stat', abbr: 'STR', tKey: 'stats.str', lat: 'Vis' },
  { key: 'con_stat', abbr: 'CON', tKey: 'stats.con', lat: 'Soma' },
  { key: 'siz_stat', abbr: 'SIZ', tKey: 'stats.siz', lat: 'Statura' },
  { key: 'dex_stat', abbr: 'DEX', tKey: 'stats.dex', lat: 'Manus' },
  { key: 'app_stat', abbr: 'APP', tKey: 'stats.app', lat: 'Forma' },
  { key: 'int_stat', abbr: 'INT', tKey: 'stats.int', lat: 'Mens' },
  { key: 'pow_stat', abbr: 'POW', tKey: 'stats.pow', lat: 'Voluntas' },
  { key: 'edu_stat', abbr: 'EDU', tKey: 'stats.edu', lat: 'Doctrina' },
]

const DICE_TYPES = ['d4', 'd6', 'd8', 'd10', 'd100']

// TIER_LABELS are built per-component using t() to support i18n

// ── Helper: derive frontend stats from raw ───────────────────────────────────

function derivedFromChar(ch) {
  return {
    hp_max: Math.max(1, Math.floor((ch.con_stat + ch.siz_stat) / 10)),
    mp_max: Math.max(1, Math.floor(ch.pow_stat / 5)),
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PaperField({ label, value, onChange, multiline = false, colSpan = 1 }) {
  return (
    <div style={{ gridColumn: `span ${colSpan}` }} className="paper-field">
      <div className="paper-field__label">{label}</div>
      {multiline ? (
        <textarea
          className="paper-field__input"
          style={{
            resize: 'vertical',
            minHeight: 100,
            fontFamily: 'var(--font-body)',
            fontStyle: 'italic',
            fontSize: 15,
            lineHeight: 1.6,
            background: 'rgba(255,255,255,0.25)',
            border: '1px dashed #7a6440',
            padding: '8px 10px',
          }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="paper-field__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

function VitalCounter({ label, current, max, onChange, color }) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0
  return (
    <div className="vital-gauge">
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9.5,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          color: '#7a6440',
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 6,
        }}
      >
        <button
          onClick={() => onChange(Math.max(0, current - 1))}
          style={{
            background: 'none',
            border: '1px solid #7a6440',
            color: '#7a6440',
            width: 22,
            height: 22,
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          −
        </button>
        <input
          type="number"
          value={current}
          min={0}
          max={max}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v)) onChange(Math.min(max, Math.max(0, v)))
          }}
          style={{
            width: 36,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #7a6440',
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: '#2a2418',
            textAlign: 'center',
            outline: 'none',
          }}
        />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: '#7a6440' }}>
          / {max}
        </span>
        <button
          onClick={() => onChange(Math.min(max, current + 1))}
          style={{
            background: 'none',
            border: '1px solid #7a6440',
            color: '#7a6440',
            width: 22,
            height: 22,
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          +
        </button>
      </div>
      <div
        style={{
          marginTop: 8,
          height: 4,
          background: 'rgba(0,0,0,0.1)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${pct}%`,
            background: color,
            opacity: 0.7,
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  )
}

function StatBox({ stat, value, onChange }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  const half = Math.floor(value / 2)
  const fifth = Math.floor(value / 5)

  const commit = () => {
    const v = parseInt(draft, 10)
    if (!isNaN(v) && v >= 1 && v <= 99) {
      onChange(v)
    } else {
      setDraft(String(value))
    }
    setEditing(false)
  }

  return (
    <div className="stat-box" onClick={() => !editing && setEditing(true)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.24em',
              color: '#7a6440',
            }}
          >
            {stat.abbr}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              fontStyle: 'italic',
              color: '#2a2418',
              marginTop: 1,
            }}
          >
            {t(stat.tKey)}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 11,
              color: '#7a6440',
            }}
          >
            {stat.lat}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {editing ? (
            <input
              type="number"
              value={draft}
              autoFocus
              min={1}
              max={99}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: 48,
                background: 'transparent',
                border: '1px solid #7a6440',
                fontFamily: 'var(--font-display)',
                fontSize: 24,
                color: '#2a2418',
                textAlign: 'center',
                outline: 'none',
              }}
            />
          ) : (
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 28,
                lineHeight: 1,
                color: '#2a2418',
              }}
            >
              {value}
            </div>
          )}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.2em',
              color: '#7a6440',
              marginTop: 4,
            }}
          >
            {half} · {fifth}
          </div>
        </div>
      </div>
    </div>
  )
}

function SkillRow({ skill, onUpdate }) {
  const half = Math.floor(skill.current_value / 2)
  const fifth = Math.floor(skill.current_value / 5)

  return (
    <div className="skill-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          checked={skill.checked}
          onChange={(e) => onUpdate({ ...skill, checked: e.target.checked })}
          style={{ accentColor: 'var(--ochre)', cursor: 'pointer' }}
          title="Позначити для підвищення"
        />
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 15,
            color: 'var(--cream)',
          }}
        >
          {skill.name}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'var(--moss-pale)',
        }}
      >
        {half}·{fifth}
      </div>
      <input
        type="number"
        value={skill.current_value}
        min={0}
        max={100}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10)
          if (!isNaN(v)) onUpdate({ ...skill, current_value: Math.min(100, Math.max(0, v)) })
        }}
        style={{
          width: 42,
          background: 'transparent',
          border: '1px solid var(--ochre-deep)',
          color: 'var(--ochre-bright)',
          textAlign: 'center',
          padding: '4px 0',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          outline: 'none',
        }}
      />
    </div>
  )
}

function DicePanel({ characterId, skills }) {
  const { t } = useTranslation()
  const TIER_LABELS = {
    critical: t('tier.critical'),
    extreme:  t('tier.extreme'),
    hard:     t('tier.hard'),
    regular:  t('tier.regular'),
    failure:  t('tier.failure'),
    fumble:   t('tier.fumble'),
  }
  const [diceType, setDiceType] = useState('d100')
  const [diceCount, setDiceCount] = useState(1)
  const [selectedSkillId, setSelectedSkillId] = useState('')
  const [visibleToAll, setVisibleToAll] = useState(true)
  const [result, setResult] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [error, setError] = useState('')

  const handleRoll = async () => {
    setError('')
    setRolling(true)
    try {
      const payload = {
        dice_type: diceType,
        dice_count: diceCount,
        visible_to_all: visibleToAll,
      }
      if (selectedSkillId) payload.skill_id = parseInt(selectedSkillId, 10)
      const res = await rollDice(characterId, payload)
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Помилка кидка.')
    } finally {
      setRolling(false)
    }
  }

  return (
    <div className="dice-panel">
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: 'var(--moss-pale)',
          marginBottom: 14,
        }}
      >
        {t('table.diceLog')} · Dice Roller
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {DICE_TYPES.map((d) => (
          <button
            key={d}
            onClick={() => setDiceType(d)}
            className={diceType === d ? 'btn btn--primary' : 'btn btn--ghost'}
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            {d}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="eyebrow" style={{ fontSize: 9 }}>Кількість:</span>
          <input
            type="number"
            value={diceCount}
            min={1}
            max={20}
            onChange={(e) => setDiceCount(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
            style={{
              width: 42,
              background: 'var(--ink-2)',
              border: '1px solid var(--ochre-deep)',
              color: 'var(--cream)',
              padding: '4px 6px',
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              outline: 'none',
              textAlign: 'center',
            }}
          />
        </div>

        {diceType === 'd100' && skills.length > 0 && (
          <div style={{ flex: 1 }}>
            <select
              value={selectedSkillId}
              onChange={(e) => setSelectedSkillId(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--ink-2)',
                border: '1px solid var(--ochre-deep)',
                color: 'var(--cream)',
                padding: '5px 8px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                outline: 'none',
              }}
            >
              <option value="">— навичка —</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.current_value}%)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={visibleToAll}
            onChange={(e) => setVisibleToAll(e.target.checked)}
            style={{ accentColor: 'var(--ochre)' }}
          />
          <span className="eyebrow" style={{ fontSize: 9, cursor: 'pointer' }}>
            Публічний кидок
          </span>
        </label>
        <button
          className="btn btn--primary"
          onClick={handleRoll}
          disabled={rolling}
          style={{ marginLeft: 'auto', padding: '6px 18px' }}
        >
          {rolling ? '...' : 'Кинути'}
        </button>
      </div>

      {error && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--blood-bright)',
            marginBottom: 8,
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div
          style={{
            borderTop: '1px solid var(--ochre-deep)',
            paddingTop: 14,
            textAlign: 'center',
          }}
        >
          <div className="dice-result">{result.total}</div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--moss-pale)',
              letterSpacing: '0.18em',
              marginBottom: 8,
            }}
          >
            {result.dice_count}{result.dice_type}
            {result.results.length > 1 && (
              <span style={{ color: 'var(--ochre-dim)' }}>
                {' '}({result.results.join(' + ')})
              </span>
            )}
          </div>
          {result.tier && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className={`dice-tier dice-tier--${result.tier}`}>
                {TIER_LABELS[result.tier] ?? result.tier}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CharacterSheetPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [char, setChar] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('') // 'saving' | 'saved' | ''
  const pendingRef = useRef({})
  const [improving, setImproving] = useState(false)
  const [improvementResults, setImprovementResults] = useState(null)
  const [equipment, setEquipment] = useState([])
  const [newItemName, setNewItemName] = useState('')
  const [newItemNotes, setNewItemNotes] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [mentalScars, setMentalScars] = useState([])
  const [newScarName, setNewScarName] = useState('')
  const [newScarType, setNewScarType] = useState('phobia')
  const [addingScar, setAddingScar] = useState(false)

  // Load character
  useEffect(() => {
    getCharacter(id)
      .then((res) => {
        setChar(res.data)
        setEquipment(res.data.equipment ?? [])
        setMentalScars(res.data.mental_scars ?? [])
      })
      .catch(() => navigate('/characters'))
      .finally(() => setLoading(false))
  }, [id])

  // Debounced auto-save
  const doSave = useCallback(
    async (patch) => {
      setSaveStatus('saving')
      try {
        const res = await updateCharacter(id, patch)
        setChar(res.data)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus(''), 2000)
      } catch {
        setSaveStatus('')
      }
    },
    [id],
  )

  const debouncedSave = useDebounce(doSave, 800)

  // Field change handler — merges into state and schedules save
  const handleChange = (field, value) => {
    setChar((prev) => {
      const next = { ...prev, [field]: value }
      // Derive frontend hp/mp max for display
      if (['con_stat', 'siz_stat', 'pow_stat'].includes(field)) {
        const derived = derivedFromChar(next)
        Object.assign(next, derived)
      }
      pendingRef.current = { ...pendingRef.current, [field]: value }
      debouncedSave(pendingRef.current)
      return next
    })
  }

  const handleSkillChange = (updatedSkill) => {
    setChar((prev) => ({
      ...prev,
      skills: prev.skills.map((s) => (s.id === updatedSkill.id ? updatedSkill : s)),
    }))
    updateSkill(id, updatedSkill.id, {
      current_value: updatedSkill.current_value,
      checked: updatedSkill.checked,
    }).catch(() => {})
  }

  const handleImproveSkills = async () => {
    setImproving(true)
    try {
      const res = await improveSkills(id)
      const results = res.data.results
      setChar((prev) => ({
        ...prev,
        skills: prev.skills.map((s) => {
          const r = results.find((r) => r.skill_id === s.id)
          return r ? { ...s, current_value: r.new_value, checked: false } : s
        }),
      }))
      setImprovementResults(results)
    } catch (err) {
      console.error('improve-skills error:', err?.response?.status, err?.response?.data)
      alert('Помилка: ' + (err?.response?.data?.error ?? err?.message ?? 'невідома'))
    } finally {
      setImproving(false)
    }
  }

  const handleAddItem = async (e) => {
    e.preventDefault()
    if (!newItemName.trim()) return
    setAddingItem(true)
    try {
      const res = await createEquipmentItem(id, {
        name: newItemName.trim(),
        notes: newItemNotes.trim(),
        order: equipment.length,
      })
      setEquipment((prev) => [...prev, res.data])
      setNewItemName('')
      setNewItemNotes('')
    } catch {
      // ignore
    } finally {
      setAddingItem(false)
    }
  }

  const handleDeleteItem = async (itemId) => {
    setEquipment((prev) => prev.filter((i) => i.id !== itemId))
    deleteEquipmentItem(id, itemId).catch(() => {})
  }

  const handleUpdateItemNotes = (itemId, notes) => {
    setEquipment((prev) => prev.map((i) => i.id === itemId ? { ...i, notes } : i))
    updateEquipmentItem(id, itemId, { notes }).catch(() => {})
  }

  const handleAddScar = async (e) => {
    e.preventDefault()
    if (!newScarName.trim()) return
    setAddingScar(true)
    try {
      const res = await createMentalScar(id, { name: newScarName.trim(), scar_type: newScarType })
      setMentalScars((prev) => [...prev, res.data])
      setNewScarName('')
    } catch {
      // ignore
    } finally {
      setAddingScar(false)
    }
  }

  const handleDeleteScar = (scarId) => {
    setMentalScars((prev) => prev.filter((s) => s.id !== scarId))
    deleteMentalScar(id, scarId).catch(() => {})
  }

  if (loading) {
    return (
      <div
        style={{
          padding: 60,
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          color: 'var(--moss-pale)',
          letterSpacing: '0.2em',
        }}
      >
        {t('chars.loading')}
      </div>
    )
  }

  if (!char) return null

  return (
    <div className="page" style={{ maxWidth: 1300 }}>
      <header className="page-header">
        <div className="page-header__eyebrow">
          № ii · картка дослідника · investigator dossier
        </div>
        <h1 className="page-header__title">
          Дослідник:{' '}
          <em style={{ color: 'var(--ochre-bright)', fontStyle: 'italic' }}>
            {char.name || '—'}
          </em>
        </h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <p className="page-header__sub">
            Заповнюйте поля, наче складаєте офіційне досьє для Міскатонікської ради
            опікунів.
          </p>
          {saveStatus === 'saving' && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                color: 'var(--ochre-dim)',
              }}
            >
              зберігається...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                color: 'var(--moss-pale)',
              }}
            >
              збережено
            </span>
          )}
        </div>
      </header>

      <div className="sheet-grid">
        {/* ──────────── LEFT: Paper dossier ──────────── */}
        <div
          className="card card--paper"
          style={{ padding: '44px 48px', position: 'relative' }}
        >
          <div className="stamp" style={{ top: 32, right: 32 }}>
            конфіденційно
          </div>

          {/* Dossier header */}
          <div
            style={{
              borderBottom: '2px double #7a6440',
              paddingBottom: 16,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: '#7a6440',
                marginBottom: 4,
              }}
            >
              Університет Міскатонік · реєстраційна картка дослідника
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 32,
                fontStyle: 'italic',
                color: '#2a2418',
                lineHeight: 1.1,
              }}
            >
              форма 7 — досьє слідчого
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 8,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                color: '#7a6440',
              }}
            >
              <span>№ архіву {String(char.id).padStart(4, '0')}-c</span>
              <span>оновлено: {new Date(char.updated_at).toLocaleDateString('uk-UA')}</span>
            </div>
          </div>

          {/* Identity fields */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px 28px',
              marginBottom: 32,
            }}
          >
            <PaperField
              label={t('sheet.name')}
              value={char.name}
              onChange={(v) => handleChange('name', v)}
            />
            <PaperField
              label={t('sheet.occupation')}
              value={char.occupation}
              onChange={(v) => handleChange('occupation', v)}
            />
            <PaperField
              label={t('sheet.age')}
              value={char.age != null ? String(char.age) : ''}
              onChange={(v) => {
                const n = parseInt(v, 10)
                handleChange('age', isNaN(n) ? null : n)
              }}
            />
            <PaperField
              label={t('sheet.residence')}
              value={char.residence}
              onChange={(v) => handleChange('residence', v)}
            />
            <PaperField
              label={t('sheet.birthplace')}
              value={char.birthplace}
              onChange={(v) => handleChange('birthplace', v)}
              colSpan={2}
            />
          </div>

          {/* Core stats on paper */}
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                marginBottom: 14,
                paddingBottom: 8,
                borderBottom: '1px solid #7a6440',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontStyle: 'italic',
                  color: '#2a2418',
                }}
              >
                {t('sheet.characteristics')}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9.5,
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  color: '#7a6440',
                }}
              >
                {t('sheet.characteristics')}
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '16px 18px',
              }}
            >
              {STAT_DEFS.map((s) => (
                <StatBox
                  key={s.key}
                  stat={s}
                  value={char[s.key]}
                  onChange={(v) => handleChange(s.key, v)}
                />
              ))}
            </div>
          </div>

          {/* Vital gauges */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              marginBottom: 28,
            }}
          >
            <VitalCounter
              label={t('sheet.health')}
              current={char.hp_current}
              max={char.hp_max}
              onChange={(v) => handleChange('hp_current', v)}
              color="#7a2a25"
            />
            <VitalCounter
              label={t('sheet.sanity')}
              current={char.sanity_current}
              max={char.sanity_max}
              onChange={(v) => handleChange('sanity_current', v)}
              color="#3b5a45"
            />
            <VitalCounter
              label={t('sheet.magic')}
              current={char.mp_current}
              max={char.mp_max}
              onChange={(v) => handleChange('mp_current', v)}
              color="#5d3f6e"
            />
            <VitalCounter
              label={t('sheet.luck')}
              current={char.luck_current}
              max={char.luck_max}
              onChange={(v) => handleChange('luck_current', v)}
              color="#7a6440"
            />
          </div>

          {/* Backstory */}
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontStyle: 'italic',
                color: '#2a2418',
                marginBottom: 4,
              }}
            >
              {t('sheet.backstory')}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: '#7a6440',
                marginBottom: 12,
              }}
            >
              біографія / зачіпки / страхи
            </div>
            <PaperField
              label=""
              value={char.backstory}
              onChange={(v) => handleChange('backstory', v)}
              multiline
              colSpan={1}
            />
          </div>

          {/* Signature */}
          <div
            style={{
              marginTop: 36,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 30,
            }}
          >
            <div
              style={{
                borderBottom: '1px solid #2a2418',
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 20,
                paddingBottom: 4,
                color: '#2a2418',
              }}
            >
              <em>{char.name || '—'}</em>
            </div>
            <div
              style={{
                borderBottom: '1px solid #2a2418',
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 20,
                paddingBottom: 4,
                color: '#7a6440',
              }}
            >
              підпис хранителя
            </div>
          </div>
          <div
            style={{
              marginTop: 6,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 30,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: '#7a6440',
            }}
          >
            <span>підпис дослідника</span>
            <span>підпис хранителя</span>
          </div>
        </div>

        {/* ──────────── RIGHT: Stats + Skills + Dice ──────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Skills */}
          <div className="card" style={{ padding: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                marginBottom: 16,
              }}
            >
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>{t('sheet.skills')}</div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 20,
                    fontStyle: 'italic',
                  }}
                >
                  Те, що дослідник вміє
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--ochre-dim)',
                  }}
                >
                  {char.skills?.length ?? 0} навичок
                </div>
                {(char.skills ?? []).some((s) => s.checked) && (
                  <button
                    className="btn btn--primary"
                    style={{ padding: '4px 12px', fontSize: 11 }}
                    onClick={handleImproveSkills}
                    disabled={improving}
                  >
                    {improving ? '...' : `${t('sheet.skills')} ↑`}
                  </button>
                )}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 400,
                overflowY: 'auto',
              }}
            >
              {(char.skills ?? []).map((skill) => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  onUpdate={handleSkillChange}
                />
              ))}
            </div>

            {improvementResults && (
              <div
                style={{
                  marginTop: 16,
                  border: '1px solid var(--ochre-deep)',
                  background: 'var(--ink-2)',
                  padding: '14px 16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--moss)' }}>
                    Результати підвищення
                  </span>
                  <button
                    className="btn btn--ghost"
                    style={{ padding: '2px 8px', fontSize: 9 }}
                    onClick={() => setImprovementResults(null)}
                  >
                    ✕
                  </button>
                </div>
                {improvementResults.map((r) => (
                  <div
                    key={r.skill_id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '5px 0',
                      borderBottom: '1px solid var(--ochre-deep)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                    }}
                  >
                    <span style={{ color: 'var(--cream)', fontStyle: 'italic', fontFamily: 'var(--font-display)', fontSize: 13 }}>
                      {r.name}
                    </span>
                    <span style={{ color: 'var(--moss-pale)', fontSize: 10 }}>
                      кидок: {r.roll}
                    </span>
                    {r.improved ? (
                      <span style={{ color: 'var(--ochre-bright)' }}>
                        {r.old_value} → {r.new_value} <span style={{ color: 'var(--moss)' }}>(+{r.improvement})</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--moss)' }}>без змін</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dice panel */}
          <DicePanel characterId={id} skills={char.skills ?? []} />

          {/* Equipment */}
          <div className="card corners" style={{ padding: 24, marginTop: 8 }}>
            <span className="corner-tr" /><span className="corner-bl" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: 6 }}>{t('sheet.equipment')}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic' }}>
                  У саквояжі та в кишенях
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ochre-dim)' }}>
                {equipment.length} предм.
              </span>
            </div>

            {equipment.length > 0 && (
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
                {equipment.map((item, i) => (
                  <li
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 0',
                      borderBottom: i < equipment.length - 1 ? '1px dotted var(--ochre-deep)' : 'none',
                    }}
                  >
                    <span style={{ flex: 1, fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 15, color: 'var(--cream-soft)' }}>
                      {item.name}
                    </span>
                    <input
                      value={item.notes}
                      onChange={(e) => handleUpdateItemNotes(item.id, e.target.value)}
                      placeholder="нотатка"
                      style={{
                        width: 90,
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid var(--ochre-deep)',
                        color: 'var(--ochre-dim)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.1em',
                        outline: 'none',
                        textAlign: 'right',
                        padding: '2px 0',
                      }}
                    />
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--moss)', fontSize: 13, padding: '0 2px', lineHeight: 1 }}
                      title="Видалити"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddItem} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder={t('sheet.itemPlaceholder')}
                style={{
                  flex: 1,
                  background: 'var(--ink-2)',
                  border: '1px solid var(--ochre-deep)',
                  color: 'var(--cream)',
                  padding: '6px 10px',
                  fontFamily: 'var(--font-body)',
                  fontStyle: 'italic',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <input
                value={newItemNotes}
                onChange={(e) => setNewItemNotes(e.target.value)}
                placeholder="нотатка"
                style={{
                  width: 90,
                  background: 'var(--ink-2)',
                  border: '1px solid var(--ochre-deep)',
                  color: 'var(--cream)',
                  padding: '6px 8px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  outline: 'none',
                }}
              />
              <button className="btn btn--primary" style={{ padding: '6px 14px', fontSize: 12 }} disabled={addingItem}>
                +
              </button>
            </form>
          </div>

          {/* Mental Scars */}
          <div className="card corners" style={{ padding: 24, marginTop: 8, borderColor: '#5a2a25' }}>
            <span className="corner-tr" /><span className="corner-bl" />
            <div className="eyebrow" style={{ marginBottom: 6, color: '#c47a72' }}>{t('sheet.mentalScars')}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontStyle: 'italic', marginBottom: 16 }}>
              {t('sheet.phobias')}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: mentalScars.length > 0 ? 16 : 0 }}>
              {mentalScars.map((scar) => (
                <span
                  key={scar.id}
                  className={scar.scar_type === 'phobia' ? 'chip chip--danger' : 'chip chip--cool'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'default' }}
                >
                  {scar.name}
                  <button
                    onClick={() => handleDeleteScar(scar.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 11, padding: 0, lineHeight: 1, opacity: 0.7 }}
                    title="Видалити"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={handleAddScar} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={newScarName}
                onChange={(e) => setNewScarName(e.target.value)}
                placeholder={t('sheet.scarPlaceholder')}
                style={{
                  flex: 1,
                  background: 'var(--ink-2)',
                  border: '1px solid #5a2a25',
                  color: 'var(--cream)',
                  padding: '6px 10px',
                  fontFamily: 'var(--font-body)',
                  fontStyle: 'italic',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setNewScarType((t) => t === 'phobia' ? 'mania' : 'phobia')}
                className={newScarType === 'phobia' ? 'chip chip--danger' : 'chip chip--cool'}
                style={{ cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' }}
              >
                {newScarType === 'phobia' ? t('sheet.phobia') : t('sheet.mania')}
              </button>
              <button className="btn btn--primary" style={{ padding: '6px 14px', fontSize: 12, background: '#7a2a25', borderColor: '#5a2a25' }} disabled={addingScar}>
                +
              </button>
            </form>
          </div>

          {/* Back button */}
          <button
            className="btn btn--ghost"
            onClick={() => navigate('/characters')}
            style={{ alignSelf: 'flex-start' }}
          >
            ← {t('chars.title')}
          </button>
        </div>
      </div>
    </div>
  )
}
