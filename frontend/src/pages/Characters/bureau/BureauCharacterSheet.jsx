import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { rollDice } from '../../../api/characters.js'
import useCharacterSheet from '../../../hooks/useCharacterSheet.js'
import useUIStore from '../../../store/uiStore.js'
import Typewriter from '../../../components/Typewriter/Typewriter.jsx'
import BureauDread from '../../../components/Bureau/BureauDread.jsx'
import { STAT_DEFS, DICE_TYPES } from '../characterDefs.js'
import './bureau.css'

// The character sheet as a case file on an investigator's desk: a printed
// bureau form filled in by hand, a ledger card of skills, a dice tray,
// an inventory slip, a psychiatric note and a typewriter for the backstory.
// Readability comes first — every value is large, high-contrast and directly
// editable; the period dressing never hides a control.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

function parseNum(raw) {
  const n = parseInt(raw, 10)
  return Number.isNaN(n) ? null : n
}

// ── Form pieces ──────────────────────────────────────────────────────────────

function FormLine({ label, value, onChange, wide, numeric }) {
  return (
    <label className={`bu-line ${wide ? 'bu-line--wide' : ''}`}>
      <span className="bu-line__label">{label}</span>
      <input
        className="bu-hand bu-line__input"
        value={value ?? ''}
        inputMode={numeric ? 'numeric' : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function Vital({ label, current, max, onChange, tone, note }) {
  const pct = max > 0 ? clamp((current / max) * 100, 0, 100) : 0
  return (
    <div className={`bu-vital bu-vital--${tone}`}>
      <div className="bu-vital__label">{label}</div>
      <div className="bu-vital__row">
        <input
          className="bu-vital__value"
          value={current}
          inputMode="numeric"
          onChange={(e) => {
            const v = parseNum(e.target.value)
            if (v !== null) onChange(clamp(v, 0, max))
          }}
        />
        <span className="bu-vital__max">/ {max}</span>
      </div>
      <div className="bu-vital__controls">
        <button type="button" className="bu-step" onClick={() => onChange(clamp(current - 1, 0, max))} aria-label="−1">−</button>
        <div className="bu-vital__bar"><span style={{ width: `${pct}%` }} /></div>
        <button type="button" className="bu-step" onClick={() => onChange(clamp(current + 1, 0, max))} aria-label="+1">+</button>
      </div>
      {note && <div className="bu-vital__note">{note}</div>}
    </div>
  )
}

function StatCell({ stat, value, onChange }) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(null)
  const commit = () => {
    const v = parseNum(draft)
    if (v !== null) onChange(clamp(v, 1, 99))
    setDraft(null)
  }
  return (
    <label className="bu-stat">
      <span className="bu-stat__abbr">{stat.abbr}</span>
      <span className="bu-stat__name">{t(stat.tKey)}</span>
      <input
        className="bu-stat__value"
        value={draft ?? value}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span className="bu-stat__parts">{Math.floor(value / 2)} · {Math.floor(value / 5)}</span>
    </label>
  )
}

function DieIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 2.5 21 7.5v9L12 21.5 3 16.5v-9z" />
      <path d="M12 2.5v19M3 7.5l9 5 9-5" opacity="0.55" />
    </svg>
  )
}

function SkillLine({ skill, onUpdate, onDelete, onRoll, rolling }) {
  const { t } = useTranslation()
  return (
    <div className={`bu-skill ${skill.checked ? 'is-checked' : ''}`}>
      <button
        type="button"
        className="bu-tick"
        onClick={() => onUpdate({ ...skill, checked: !skill.checked })}
        title={t('sheet.markForImprovement')}
        aria-pressed={skill.checked}
      >
        {skill.checked ? '✓' : ''}
      </button>
      <span className="bu-skill__name">{skill.name}</span>
      <span className="bu-skill__parts">{Math.floor(skill.current_value / 2)} · {Math.floor(skill.current_value / 5)}</span>
      <input
        className="bu-skill__value"
        value={skill.current_value}
        inputMode="numeric"
        onChange={(e) => {
          const v = parseNum(e.target.value)
          if (v !== null) onUpdate({ ...skill, current_value: clamp(v, 0, 100) })
        }}
      />
      <button type="button" className="bu-roll" onClick={() => onRoll(skill)} disabled={rolling} title={t('bureau.rollSkill')}>
        <DieIcon />
      </button>
      <button type="button" className="bu-x" onClick={() => onDelete(skill.id)} title={t('board.delete')}>×</button>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function BureauCharacterSheet() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const effects = useUIStore((s) => s.glitchText)

  const sheet = useCharacterSheet(id, { onNotFound: () => navigate('/characters') })
  const {
    char, loading, saveStatus, handleChange, uploadPortrait,
    handleSkillChange, addSkill, handleDeleteSkill,
    improving, improvementResults, setImprovementResults, improveError, handleImproveSkills,
    equipment, addItem, handleDeleteItem, handleUpdateItemNotes,
    mentalScars, addScar, handleDeleteScar,
  } = sheet

  const [skillFilter, setSkillFilter] = useState('')
  const [newSkill, setNewSkill] = useState('')
  const [newItem, setNewItem] = useState('')
  const [newItemNote, setNewItemNote] = useState('')
  const [newScar, setNewScar] = useState('')
  const [newScarType, setNewScarType] = useState('phobia')

  // Dice tray state — rolled from the tray or straight from a skill line
  const [diceType, setDiceType] = useState('d100')
  const [diceCount, setDiceCount] = useState(1)
  const [visibleToAll, setVisibleToAll] = useState(true)
  const [roll, setRoll] = useState(null)
  const [rolling, setRolling] = useState(false)
  const [rollError, setRollError] = useState('')
  const photoInputRef = useRef(null)

  const TIERS = {
    critical: t('tier.critical'), extreme: t('tier.extreme'), hard: t('tier.hard'),
    regular: t('tier.regular'), failure: t('tier.failure'), fumble: t('tier.fumble'),
  }

  async function doRoll({ skill } = {}) {
    setRollError('')
    setRolling(true)
    try {
      const payload = skill
        ? { dice_type: 'd100', dice_count: 1, visible_to_all: visibleToAll, skill_id: skill.id }
        : { dice_type: diceType, dice_count: diceCount, visible_to_all: visibleToAll }
      const res = await rollDice(id, payload)
      setRoll({ ...res.data, skillName: skill?.name ?? null, skillValue: skill?.current_value ?? null })
    } catch (err) {
      setRollError(err.response?.data?.error || t('bureau.rollError'))
    } finally {
      setRolling(false)
    }
  }

  if (loading) return <div className="bu-desk bu-loading">{t('chars.loading')}</div>
  if (!char) return null

  const sanityRatio = char.sanity_max > 0 ? char.sanity_current / char.sanity_max : 1
  // Low sanity shows on the paper: blots at half, a shaking hand near the end
  const sanityClass = sanityRatio <= 0.2 ? 'is-broken' : sanityRatio <= 0.5 ? 'is-shaken' : ''
  const dread = sanityRatio > 0.7 ? 1 : sanityRatio > 0.35 ? 2 : 3
  const stamp = char.sanity_current <= 0 ? t('bureau.stampInsane')
    : char.hp_current <= 0 ? t('bureau.stampDying')
    : t('bureau.stampSecret')
  const skills = char.skills ?? []
  const filter = skillFilter.trim().toLowerCase()
  const shownSkills = filter ? skills.filter((s) => s.name.toLowerCase().includes(filter)) : skills
  const caseNo = String(char.id).padStart(4, '0')

  return (
    <div className={`bu-desk ${sanityClass} ${effects ? 'with-effects' : ''}`}>
      <BureauDread level={dread} effects={effects} />
      <div className="bu-topline">
        <button type="button" className="bu-back" onClick={() => navigate('/characters')}>← {t('bureau.back')}</button>
        <span className={`bu-save ${saveStatus ? 'is-visible' : ''}`}>
          {saveStatus === 'saving' ? t('sheet.saving') : saveStatus === 'saved' ? t('sheet.saved') : ''}
        </span>
      </div>

      <div className="bu-grid">
        {/* ── Left: case folder with the dossier form, psychiatric note under it ── */}
        <div className="bu-main">
          <section className="bu-folder">
            <div className="bu-folder__tab">{t('bureau.folderTab')} № {caseNo}</div>
            <div className="bu-paper bu-dossier">
              <header className="bu-letterhead">
                <div className="bu-letterhead__seal" aria-hidden="true">✶</div>
                <div>
                  <div className="bu-letterhead__title">{t('bureau.letterhead')}</div>
                  <div className="bu-letterhead__sub">{t('bureau.letterheadSub')}</div>
                </div>
                <div className="bu-letterhead__meta">
                  <div>{t('sheet.form7')}</div>
                  <div>{t('sheet.archiveNo')} {caseNo}-c</div>
                  <div>{t('sheet.updatedAt')} {new Date(char.updated_at).toLocaleDateString()}</div>
                </div>
              </header>

              <div className="bu-stamp" key={stamp}>{stamp}</div>

              <div className="bu-identity">
                <button
                  type="button"
                  className="bu-photo"
                  onClick={() => photoInputRef.current?.click()}
                  title={t('bureau.photoHint')}
                >
                  <span className="bu-photo__clip" aria-hidden="true" />
                  {char.portrait_image
                    ? <img src={char.portrait_image} alt={char.name} />
                    : <span className="bu-photo__empty">{t('bureau.photoHint')}</span>}
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPortrait(f); e.target.value = '' }}
                />
                <div className="bu-fields">
                  <FormLine label={t('sheet.name')} value={char.name} onChange={(v) => handleChange('name', v)} wide />
                  <FormLine label={t('sheet.occupation')} value={char.occupation} onChange={(v) => handleChange('occupation', v)} wide />
                  <FormLine
                    label={t('sheet.age')}
                    value={char.age != null ? String(char.age) : ''}
                    numeric
                    onChange={(v) => handleChange('age', parseNum(v))}
                  />
                  <FormLine label={t('sheet.residence')} value={char.residence} onChange={(v) => handleChange('residence', v)} />
                  <FormLine label={t('sheet.birthplace')} value={char.birthplace} onChange={(v) => handleChange('birthplace', v)} wide />
                </div>
              </div>

              <h2 className="bu-section">{t('bureau.vitals')}</h2>
              <div className="bu-vitals">
                <Vital tone="blood" label={t('sheet.health')} current={char.hp_current} max={char.hp_max} onChange={(v) => handleChange('hp_current', v)} />
                <Vital
                  tone="moss" label={t('sheet.sanity')} current={char.sanity_current} max={char.sanity_max}
                  onChange={(v) => handleChange('sanity_current', v)}
                  note={`${t('bureau.start')} ${char.sanity_starting}`}
                />
                <Vital tone="violet" label={t('sheet.magic')} current={char.mp_current} max={char.mp_max} onChange={(v) => handleChange('mp_current', v)} />
                <Vital tone="ochre" label={t('sheet.luck')} current={char.luck_current} max={char.luck_max} onChange={(v) => handleChange('luck_current', v)} />
              </div>

              <h2 className="bu-section">{t('sheet.characteristics')}</h2>
              <div className="bu-stats">
                {STAT_DEFS.map((s) => (
                  <StatCell key={s.key} stat={s} value={char[s.key]} onChange={(v) => handleChange(s.key, v)} />
                ))}
              </div>

              <div className="bu-signatures">
                <div><span className="bu-hand">{char.name || '—'}</span><small>{t('sheet.sigInvestigator')}</small></div>
                <div><span /><small>{t('sheet.sigKeeper')}</small></div>
              </div>
            </div>
          </section>

          <section className="bu-paper bu-medical">
            <h2 className="bu-section bu-section--flush">{t('bureau.medical')}</h2>
            <div className="bu-medical__list">
              {mentalScars.length === 0 && <span className="bu-medical__none">{t('bureau.medicalNone')}</span>}
              {mentalScars.map((scar) => (
                <span key={scar.id} className={`bu-scar bu-scar--${scar.scar_type}`}>
                  <small>{scar.scar_type === 'phobia' ? t('sheet.phobia') : t('sheet.mania')}:</small> {scar.name}
                  <button type="button" className="bu-x" onClick={() => handleDeleteScar(scar.id)} title={t('board.delete')}>×</button>
                </span>
              ))}
            </div>
            <form
              className="bu-add"
              onSubmit={async (e) => { e.preventDefault(); if (await addScar(newScar, newScarType)) setNewScar('') }}
            >
              <input value={newScar} onChange={(e) => setNewScar(e.target.value)} placeholder={t('sheet.scarPlaceholder')} />
              <button type="button" className="bu-add__type" onClick={() => setNewScarType((v) => (v === 'phobia' ? 'mania' : 'phobia'))}>
                {newScarType === 'phobia' ? t('sheet.phobia') : t('sheet.mania')}
              </button>
              <button type="submit" disabled={!newScar.trim()}>+</button>
            </form>
          </section>
        </div>

        {/* ── Right: dice tray, skills ledger, inventory ── */}
        <div className="bu-side">
          <section className="bu-tray">
            <div className="bu-tray__head">
              <span className="bu-tray__title">{t('bureau.diceTray')}</span>
              <label className="bu-tray__public">
                <input type="checkbox" checked={visibleToAll} onChange={(e) => setVisibleToAll(e.target.checked)} />
                {t('sheet.publicRoll')}
              </label>
            </div>
            <div className="bu-tray__controls">
              <div className="bu-tray__dice">
                {DICE_TYPES.map((d) => (
                  <button key={d} type="button" className={`bu-die ${diceType === d ? 'is-on' : ''}`} onClick={() => setDiceType(d)}>{d}</button>
                ))}
              </div>
              <label className="bu-tray__count">
                ×
                <input
                  value={diceCount}
                  inputMode="numeric"
                  onChange={(e) => setDiceCount(clamp(parseNum(e.target.value) ?? 1, 1, 20))}
                />
              </label>
              <button type="button" className="bu-tray__roll" onClick={() => doRoll()} disabled={rolling}>
                {rolling ? '…' : t('sheet.rollBtn')}
              </button>
            </div>
            <div className="bu-tray__felt">
              {roll ? (
                <>
                  {roll.skillName && <div className="bu-tray__skill">{roll.skillName} · {roll.skillValue}%</div>}
                  <div className="bu-tray__total" key={roll.id ?? `${roll.total}-${roll.results.join()}`}>{roll.total}</div>
                  <div className="bu-tray__detail">
                    {roll.dice_count}{roll.dice_type}{roll.results.length > 1 ? ` (${roll.results.join(' + ')})` : ''}
                  </div>
                  {roll.tier && <div className={`bu-tier bu-tier--${roll.tier}`}>{TIERS[roll.tier] ?? roll.tier}</div>}
                </>
              ) : (
                <div className="bu-tray__hint">{t('bureau.diceHint')}</div>
              )}
              {rollError && <div className="bu-error">{rollError}</div>}
            </div>
          </section>

          <section className="bu-paper bu-ledger">
            <div className="bu-ledger__head">
              <h2 className="bu-section bu-section--flush">{t('bureau.skillsTitle')}</h2>
              <input
                className="bu-ledger__filter"
                value={skillFilter}
                onChange={(e) => setSkillFilter(e.target.value)}
                placeholder={t('bureau.filter')}
              />
            </div>
            <div className="bu-ledger__list">
              {shownSkills.map((skill) => (
                <SkillLine
                  key={skill.id}
                  skill={skill}
                  onUpdate={handleSkillChange}
                  onDelete={handleDeleteSkill}
                  onRoll={(s) => doRoll({ skill: s })}
                  rolling={rolling}
                />
              ))}
            </div>
            <form
              className="bu-add"
              onSubmit={async (e) => { e.preventDefault(); if (await addSkill(newSkill)) setNewSkill('') }}
            >
              <input className="bu-hand" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder={t('sheet.skillPlaceholder')} />
              <button type="submit" disabled={!newSkill.trim()}>+</button>
            </form>
            {skills.some((s) => s.checked) && (
              <button type="button" className="bu-improve" onClick={handleImproveSkills} disabled={improving}>
                {improving ? '…' : t('bureau.improve')}
              </button>
            )}
            {improveError && <div className="bu-error">{improveError}</div>}
            {improvementResults && (
              <div className="bu-improved">
                <div className="bu-improved__head">
                  <span>{t('sheet.improveTitle')}</span>
                  <button type="button" className="bu-x" onClick={() => setImprovementResults(null)}>×</button>
                </div>
                {improvementResults.map((r) => (
                  <div key={r.skill_id} className="bu-improved__row">
                    <span>{r.name}</span>
                    <span>{t('sheet.rollLabel')} {r.roll}</span>
                    <span className="bu-hand">{r.improved ? `${r.old_value} → ${r.new_value}` : t('sheet.noChange')}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bu-paper bu-slip">
            <h2 className="bu-section bu-section--flush">{t('bureau.inventory')}</h2>
            <ol className="bu-slip__list">
              {equipment.map((item) => (
                <li key={item.id}>
                  <span className="bu-slip__name">{item.name}</span>
                  <input
                    className="bu-slip__note"
                    value={item.notes}
                    onChange={(e) => handleUpdateItemNotes(item.id, e.target.value)}
                    placeholder={t('sheet.note')}
                  />
                  <button type="button" className="bu-x" onClick={() => handleDeleteItem(item.id)} title={t('board.delete')}>×</button>
                </li>
              ))}
            </ol>
            <form
              className="bu-add"
              onSubmit={async (e) => {
                e.preventDefault()
                if (await addItem(newItem, newItemNote)) { setNewItem(''); setNewItemNote('') }
              }}
            >
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={t('sheet.itemPlaceholder')} />
              <input className="bu-add__short" value={newItemNote} onChange={(e) => setNewItemNote(e.target.value)} placeholder={t('sheet.note')} />
              <button type="submit" disabled={!newItem.trim()}>+</button>
            </form>
          </section>
        </div>
      </div>

      <section className="bu-backstory">
        <Typewriter
          label={t('sheet.backstory')}
          value={char.backstory}
          onChange={(v) => handleChange('backstory', v)}
          placeholder={t('bureau.backstoryPlaceholder')}
        />
      </section>
    </div>
  )
}
