import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getCampaigns, createCampaign, deleteCampaign,
  getActs, createAct, deleteAct,
  createScene, updateScene, deleteScene, getScene,
  getNPCs, createNPC, deleteNPC,
  getAssets, createAsset, deleteAsset,
} from '../../api/campaigns.js'

// ─── tiny helpers ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moss-pale)', letterSpacing: '0.2em' }}>
      ...
    </span>
  )
}

function ConfirmDelete({ label, onConfirm, onCancel }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--blood)' }}>
        {t('se.deleteLabel', { label })}
      </span>
      <button className="btn btn--ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={onCancel}>{t('se.no')}</button>
      <button className="btn" style={{ padding: '2px 8px', fontSize: 11, background: 'var(--blood)', color: '#fff', border: 'none' }} onClick={onConfirm}>{t('se.yes')}</button>
    </div>
  )
}

// ─── Left rail: campaign switcher + chapters (Act → Scene) ───────────────────

function ChaptersRail({ campaigns, selectedCampaign, onSelectCampaign, onCreatedCampaign, onDeletedCampaign, selectedScene, onSelectScene }) {
  const { t } = useTranslation()
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [title, setTitle] = useState('')
  const [setting, setSetting] = useState('')
  const [era, setEra] = useState('')
  const [creating, setCreating] = useState(false)
  const [confirmCampaignId, setConfirmCampaignId] = useState(null)

  const [acts, setActs] = useState([])
  const [loadingActs, setLoadingActs] = useState(false)
  const [newActTitle, setNewActTitle] = useState('')
  const [expandedActs, setExpandedActs] = useState({})
  const [newSceneTitles, setNewSceneTitles] = useState({})
  const [confirmAct, setConfirmAct] = useState(null)
  const [confirmScene, setConfirmScene] = useState(null)

  useEffect(() => {
    if (!selectedCampaign) { setActs([]); return }
    setLoadingActs(true)
    getActs(selectedCampaign.id)
      .then(res => {
        const data = res.data.results ?? res.data
        setActs(data)
        if (data.length > 0) setExpandedActs({ [data[0].id]: true })
      })
      .finally(() => setLoadingActs(false))
  }, [selectedCampaign?.id])

  async function handleCreateCampaign(e) {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    try {
      const res = await createCampaign({ title: title.trim(), setting: setting.trim(), era: era.trim() })
      onCreatedCampaign(res.data)
      setTitle(''); setSetting(''); setEra('')
      setShowCampaignForm(false)
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteCampaign(id) {
    await deleteCampaign(id)
    setConfirmCampaignId(null)
    onDeletedCampaign(id)
  }

  async function handleCreateAct(e) {
    e.preventDefault()
    if (!newActTitle.trim()) return
    const order = acts.length
    const res = await createAct(selectedCampaign.id, { title: newActTitle.trim(), order })
    setActs(prev => [...prev, res.data])
    setNewActTitle('')
    setExpandedActs(prev => ({ ...prev, [res.data.id]: true }))
  }

  async function handleDeleteAct(actId) {
    await deleteAct(selectedCampaign.id, actId)
    setActs(prev => prev.filter(a => a.id !== actId))
    setConfirmAct(null)
  }

  async function handleCreateScene(actId) {
    const title = newSceneTitles[actId]?.trim()
    if (!title) return
    const act = acts.find(a => a.id === actId)
    const order = (act?.scenes ?? []).length
    const res = await createScene(selectedCampaign.id, actId, { title, order })
    setActs(prev => prev.map(a =>
      a.id === actId ? { ...a, scenes: [...(a.scenes ?? []), res.data] } : a
    ))
    setNewSceneTitles(prev => ({ ...prev, [actId]: '' }))
  }

  async function handleDeleteScene(actId, sceneId) {
    await deleteScene(selectedCampaign.id, actId, sceneId)
    setActs(prev => prev.map(a =>
      a.id === actId ? { ...a, scenes: (a.scenes ?? []).filter(s => s.id !== sceneId) } : a
    ))
    setConfirmScene(null)
  }

  return (
    <div className="se-rail se-rail--chapters">
      <div className="se-rail__section">
        <div className="se-panel__head">
          <span className="se-panel__title">{t('se.campaigns')}</span>
          <button className="btn btn--ghost" style={{ padding: '2px 10px', fontSize: 11 }} onClick={() => setShowCampaignForm(v => !v)}>
            {showCampaignForm ? '×' : '+'}
          </button>
        </div>

        {showCampaignForm && (
          <form onSubmit={handleCreateCampaign} className="se-inline-form">
            <input className="form-input" placeholder={t('se.campaignName')} value={title} onChange={e => setTitle(e.target.value)} autoFocus />
            <input className="form-input" placeholder={t('se.campaignPlace')} value={setting} onChange={e => setSetting(e.target.value)} />
            <input className="form-input" placeholder={t('se.campaignEra')} value={era} onChange={e => setEra(e.target.value)} />
            <button type="submit" className="btn btn--primary" disabled={creating || !title.trim()}>
              {creating ? t('se.creating') : t('se.create')}
            </button>
          </form>
        )}

        <div className="se-campaign-strip">
          {campaigns.length === 0 && <div className="se-empty">{t('se.noCampaigns')}</div>}
          {campaigns.map(c => (
            <div
              key={c.id}
              className={'se-campaign-chip' + (selectedCampaign?.id === c.id ? ' se-campaign-chip--active' : '')}
              onClick={() => setConfirmCampaignId(null) || onSelectCampaign(c)}
            >
              <span className="se-campaign-chip__title">{c.title}</span>
              {confirmCampaignId === c.id ? (
                <ConfirmDelete label={t('se.deleteCampaign')} onConfirm={() => handleDeleteCampaign(c.id)} onCancel={() => setConfirmCampaignId(null)} />
              ) : (
                <button className="se-del-btn" onClick={e => { e.stopPropagation(); setConfirmCampaignId(c.id) }} title={t('se.deleteLabel', { label: t('se.deleteCampaign') })}>×</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedCampaign && (
        <div className="se-rail__section se-rail__section--chapters">
          <div className="se-panel__head">
            <span className="se-panel__title">{t('se.chapters')}</span>
          </div>

          {loadingActs ? (
            <div style={{ padding: '16px 14px' }}><Spinner /></div>
          ) : (
            <div className="se-list">
              {acts.map(act => (
                <div key={act.id} className="se-act">
                  <div className="se-act__head" onClick={() => setExpandedActs(prev => ({ ...prev, [act.id]: !prev[act.id] }))}>
                    <span className="se-act__arrow">{expandedActs[act.id] ? '▾' : '▸'}</span>
                    <span className="se-act__title">{act.title}</span>
                    {confirmAct === act.id ? (
                      <ConfirmDelete label={t('se.deleteAct')} onConfirm={() => handleDeleteAct(act.id)} onCancel={() => setConfirmAct(null)} />
                    ) : (
                      <button className="se-del-btn" onClick={e => { e.stopPropagation(); setConfirmAct(act.id) }}>×</button>
                    )}
                  </div>

                  {expandedActs[act.id] && (
                    <div className="se-scenes">
                      {(act.scenes ?? []).map(scene => (
                        <div
                          key={scene.id}
                          className={'se-scene' + (selectedScene?.id === scene.id ? ' se-scene--active' : '')}
                          onClick={() => setConfirmScene(null) || onSelectScene({ ...scene, actId: act.id })}
                        >
                          <span className="se-scene__title">{scene.title}</span>
                          {confirmScene === scene.id ? (
                            <ConfirmDelete label={t('se.deleteScene')} onConfirm={() => handleDeleteScene(act.id, scene.id)} onCancel={() => setConfirmScene(null)} />
                          ) : (
                            <button className="se-del-btn" onClick={e => { e.stopPropagation(); setConfirmScene(scene.id) }}>×</button>
                          )}
                        </div>
                      ))}
                      <div className="se-add-scene">
                        <input
                          className="form-input"
                          placeholder={t('se.newScene')}
                          value={newSceneTitles[act.id] ?? ''}
                          onChange={e => setNewSceneTitles(prev => ({ ...prev, [act.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && handleCreateScene(act.id)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleCreateAct} className="se-add-act">
            <input className="form-input" placeholder={t('se.newAct')} value={newActTitle} onChange={e => setNewActTitle(e.target.value)} />
            <button type="submit" className="btn btn--ghost" disabled={!newActTitle.trim()}>{t('se.add')}</button>
          </form>
        </div>
      )}
    </div>
  )
}

// ─── Center: the desk — a single page of lore ─────────────────────────────────

function Desk({ campaign, scene, onSceneUpdated }) {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!scene) return
    setData(null)
    getScene(campaign.id, scene.actId, scene.id).then(res => setData(res.data))
  }, [scene?.id])

  const autoSave = useCallback(async (field, value) => {
    if (!data) return
    setSaving(true)
    try {
      const res = await updateScene(campaign.id, scene.actId, scene.id, { [field]: value })
      setData(prev => ({ ...prev, ...res.data }))
      if (field === 'title') onSceneUpdated(res.data)
    } finally {
      setSaving(false)
    }
  }, [campaign?.id, scene?.id, scene?.actId, data])

  if (!scene) {
    return (
      <div className="se-desk se-desk--empty">
        <div className="empty-state__title">{t('se.selectScene')}</div>
        <div className="empty-state__sub">{t('se.selectSceneSub')}</div>
      </div>
    )
  }

  if (!data) {
    return <div className="se-desk"><Spinner /></div>
  }

  return (
    <div className="se-desk">
      <div className="se-page">
        <div className="se-page__head">
          <input className="se-title-input" defaultValue={data.title} onBlur={e => autoSave('title', e.target.value)} />
          {saving && <Spinner />}
        </div>
        <textarea
          className="se-page__lore"
          defaultValue={data.description}
          placeholder={t('se.sceneDescPlaceholder')}
          onBlur={e => autoSave('description', e.target.value)}
        />
      </div>

      <div className="se-sticky-note">
        <div className="se-section__label se-section__label--private">
          {t('se.masterNotes')} <span className="se-private-badge">{t('se.private')}</span>
        </div>
        <textarea
          className="se-sticky-note__text"
          defaultValue={data.master_notes}
          placeholder={t('se.masterNotesPlaceholder')}
          onBlur={e => autoSave('master_notes', e.target.value)}
        />
      </div>
    </div>
  )
}

// ─── Right rail: folders (documents / notes / photos / dossier / maps) ───────

function AssetFolder({ campaign, assets, onCreated, onDeleted, activeType }) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', image: null })
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  const filtered = assets.filter(a => a.type === activeType)

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setLoading(true)
    try {
      const data = { type: activeType, title: form.title.trim(), content: form.content.trim() }
      if (form.image) data.image = form.image
      const res = await createAsset(campaign.id, data)
      onCreated(res.data)
      setForm({ title: '', content: '', image: null })
      setShowForm(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    await deleteAsset(campaign.id, id)
    setConfirmId(null)
    onDeleted(id)
  }

  return (
    <>
      <div className="se-panel__head">
        <button className="btn btn--ghost" style={{ padding: '2px 10px', fontSize: 11 }} onClick={() => setShowForm(v => !v)}>
          {showForm ? '×' : `+ ${t('se.assetAdd')}`}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="se-inline-form">
          <input className="form-input" placeholder={t('se.assetTitle')} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} autoFocus />
          {(activeType === 'document' || activeType === 'note') && (
            <textarea className="form-input" placeholder={t('se.assetContent')} value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={3} />
          )}
          {(activeType === 'photo' || activeType === 'map') && (
            <input type="file" accept="image/*" className="form-input" onChange={e => setForm(p => ({ ...p, image: e.target.files[0] ?? null }))} />
          )}
          <button type="submit" className="btn btn--primary" disabled={loading || !form.title.trim()}>
            {loading ? '...' : t('se.assetAdd')}
          </button>
        </form>
      )}

      <div className="se-list">
        {filtered.length === 0 && <div className="se-empty">{t('se.noAssets')}</div>}
        {filtered.map(asset => (
          <div key={asset.id} className="se-list__item">
            <div className="se-list__item-main">
              {asset.image && <img src={asset.image} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 2, marginRight: 8, flexShrink: 0 }} />}
              <div>
                <div className="se-list__item-title">{asset.title}</div>
                {asset.content && <div className="se-list__item-meta" style={{ whiteSpace: 'pre-line', maxHeight: 40, overflow: 'hidden' }}>{asset.content}</div>}
              </div>
            </div>
            {confirmId === asset.id ? (
              <ConfirmDelete label={t('se.deleteAsset')} onConfirm={() => handleDelete(asset.id)} onCancel={() => setConfirmId(null)} />
            ) : (
              <button className="se-del-btn" onClick={() => setConfirmId(asset.id)}>×</button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function DossierFolder({ campaign, npcs, onCreated, onDeleted }) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', age: '', occupation: '', appearance: '', status: 'alive', description: '', secret_info: '', portrait_image: null })
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  const STATUS_LABELS = {
    alive: t('se.statusAlive'), dead: t('se.statusDead'),
    missing: t('se.statusMissing'), suspect: t('se.statusSuspect'),
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('name', form.name.trim())
      fd.append('age', form.age.trim())
      fd.append('occupation', form.occupation.trim())
      fd.append('appearance', form.appearance.trim())
      fd.append('status', form.status)
      fd.append('description', form.description.trim())
      fd.append('secret_info', form.secret_info.trim())
      if (form.portrait_image) fd.append('portrait_image', form.portrait_image)
      const res = await createNPC(campaign.id, fd)
      onCreated(res.data)
      setForm({ name: '', age: '', occupation: '', appearance: '', status: 'alive', description: '', secret_info: '', portrait_image: null })
      setShowForm(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    await deleteNPC(campaign.id, id)
    setConfirmId(null)
    onDeleted(id)
  }

  return (
    <>
      <div className="se-panel__head">
        <button className="btn btn--ghost" style={{ padding: '2px 10px', fontSize: 11 }} onClick={() => setShowForm(v => !v)}>
          {showForm ? '×' : `+ ${t('se.dossierAdd')}`}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="se-inline-form">
          <input className="form-input" placeholder={t('se.dossierName')} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="form-input" placeholder={t('se.dossierAge')} value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} style={{ flex: 1 }} />
            <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ flex: 1 }}>
              {Object.entries(STATUS_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <input className="form-input" placeholder={t('se.dossierOccupation')} value={form.occupation} onChange={e => setForm(p => ({ ...p, occupation: e.target.value }))} />
          <textarea className="form-input" placeholder={t('se.dossierAppearance')} value={form.appearance} onChange={e => setForm(p => ({ ...p, appearance: e.target.value }))} rows={2} />
          <textarea className="form-input" placeholder={t('se.npcDesc')} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
          <textarea className="form-input" placeholder={t('se.dossierSecret')} value={form.secret_info} onChange={e => setForm(p => ({ ...p, secret_info: e.target.value }))} rows={2} />
          <input type="file" accept="image/*" className="form-input" onChange={e => setForm(p => ({ ...p, portrait_image: e.target.files[0] ?? null }))} />
          <button type="submit" className="btn btn--primary" disabled={loading || !form.name.trim()}>
            {loading ? '...' : t('se.dossierAdd')}
          </button>
        </form>
      )}

      <div className="se-npc-list">
        {npcs.length === 0 && <div className="se-empty">{t('se.noDossiers')}</div>}
        {npcs.map(npc => (
          <div key={npc.id} className="se-npc">
            {npc.portrait_image && <img src={npc.portrait_image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 2, marginRight: 8, flexShrink: 0 }} />}
            <div className="se-npc__info">
              <div className="se-npc__name">{npc.name} <span className="se-npc__status">{STATUS_LABELS[npc.status]}</span></div>
              {(npc.occupation || npc.age) && (
                <div className="se-npc__desc">{[npc.occupation, npc.age].filter(Boolean).join(' · ')}</div>
              )}
              {npc.appearance && <div className="se-npc__desc">{npc.appearance}</div>}
              {npc.secret_info && (
                <div className="se-npc__secret"><span className="se-private-badge">{t('se.secret')}</span> {npc.secret_info}</div>
              )}
            </div>
            {confirmId === npc.id ? (
              <ConfirmDelete label={t('se.deleteDossier')} onConfirm={() => handleDelete(npc.id)} onCancel={() => setConfirmId(null)} />
            ) : (
              <button className="se-del-btn" onClick={() => setConfirmId(npc.id)} title={t('se.deleteDossier')}>×</button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function FoldersRail({ campaign }) {
  const { t } = useTranslation()
  const FOLDERS = [
    { key: 'document', label: t('se.assetDocument') },
    { key: 'note', label: t('se.assetNote') },
    { key: 'photo', label: t('se.assetPhoto') },
    { key: 'dossier', label: t('se.dossier') },
    { key: 'map', label: t('se.assetMap') },
  ]
  const [active, setActive] = useState('document')
  const [assets, setAssets] = useState([])
  const [npcs, setNpcs] = useState([])

  useEffect(() => {
    if (!campaign) return
    setAssets([]); setNpcs([])
    getAssets(campaign.id).then(res => setAssets(res.data.results ?? res.data)).catch(() => {})
    getNPCs(campaign.id).then(res => setNpcs(res.data.results ?? res.data)).catch(() => {})
  }, [campaign?.id])

  if (!campaign) return null

  return (
    <div className="se-rail se-rail--folders">
      <div className="se-panel__head">
        <span className="se-panel__title">{t('se.assets')}</span>
      </div>

      <div className="se-asset-tabs">
        {FOLDERS.map(f => (
          <button
            key={f.key}
            className={'se-asset-tab' + (active === f.key ? ' se-asset-tab--active' : '')}
            onClick={() => setActive(f.key)}
          >
            {f.label}
            <span className="se-asset-tab__count">
              {f.key === 'dossier' ? npcs.length : assets.filter(a => a.type === f.key).length}
            </span>
          </button>
        ))}
      </div>

      {active === 'dossier' ? (
        <DossierFolder
          campaign={campaign}
          npcs={npcs}
          onCreated={npc => setNpcs(prev => [...prev, npc])}
          onDeleted={id => setNpcs(prev => prev.filter(n => n.id !== id))}
        />
      ) : (
        <AssetFolder
          campaign={campaign}
          assets={assets}
          activeType={active}
          onCreated={asset => setAssets(prev => [...prev, asset])}
          onDeleted={id => setAssets(prev => prev.filter(a => a.id !== id))}
        />
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StoryEditorPage() {
  const { t } = useTranslation()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [selectedScene, setSelectedScene] = useState(null)

  useEffect(() => {
    getCampaigns()
      .then(res => setCampaigns(res.data.results ?? res.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page page--fullwidth">
      <div className="page-header">
        <div className="page-header__eyebrow">{t('se.eyebrow')}</div>
        <h1 className="page-header__title">{t('se.title')}</h1>
        <p className="page-header__sub">{t('se.sub')}</p>
      </div>

      {loading ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--moss-pale)', letterSpacing: '0.2em', padding: '40px 0' }}>
          {t('se.loading')}
        </div>
      ) : (
        <div className="se-workspace">
          <ChaptersRail
            campaigns={campaigns}
            selectedCampaign={selectedCampaign}
            onSelectCampaign={c => { setSelectedCampaign(c); setSelectedScene(null) }}
            onCreatedCampaign={c => { setCampaigns(prev => [c, ...prev]); setSelectedCampaign(c) }}
            onDeletedCampaign={id => {
              setCampaigns(prev => prev.filter(c => c.id !== id))
              if (selectedCampaign?.id === id) { setSelectedCampaign(null); setSelectedScene(null) }
            }}
            selectedScene={selectedScene}
            onSelectScene={setSelectedScene}
          />

          <Desk campaign={selectedCampaign} scene={selectedScene} onSceneUpdated={() => {}} />

          <FoldersRail campaign={selectedCampaign} />
        </div>
      )}
    </div>
  )
}
