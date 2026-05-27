import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import useAuthStore from '../../store/authStore.js'
import {
  getCampaigns, createCampaign, updateCampaign, deleteCampaign,
  getActs, createAct, updateAct, deleteAct,
  createScene, updateScene, deleteScene, getScene,
  createNPC, deleteNPC,
  getAssets, createAsset, deleteAsset,
} from '../../api/campaigns.js'

// ─── tiny helpers ────────────────────────────────────────────────────────────

function useDebounce(fn, delay) {
  const [timer, setTimer] = useState(null)
  return useCallback((...args) => {
    clearTimeout(timer)
    setTimer(setTimeout(() => fn(...args), delay))
  }, [fn, delay, timer])
}

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

// ─── Campaign list panel ──────────────────────────────────────────────────────

function CampaignPanel({ campaigns, selected, onSelect, onCreated, onDeleted }) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [setting, setSetting] = useState('')
  const [era, setEra] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  async function handleCreate(e) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true)
    try {
      const res = await createCampaign({ title: title.trim(), setting: setting.trim(), era: era.trim() })
      onCreated(res.data)
      setTitle('')
      setSetting('')
      setEra('')
      setShowForm(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    await deleteCampaign(id)
    setConfirmId(null)
    onDeleted(id)
  }

  return (
    <div className="se-panel se-panel--campaigns">
      <div className="se-panel__head">
        <span className="se-panel__title">{t('se.campaigns')}</span>
        <button className="btn btn--ghost" style={{ padding: '2px 10px', fontSize: 11 }} onClick={() => setShowForm(v => !v)}>
          {showForm ? '×' : '+'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="se-inline-form">
          <input
            className="form-input"
            placeholder={t('se.campaignName')}
            value={title}
            onChange={e => setTitle(e.target.value)}
            autoFocus
          />
          <input
            className="form-input"
            placeholder={t('se.campaignPlace')}
            value={setting}
            onChange={e => setSetting(e.target.value)}
          />
          <input
            className="form-input"
            placeholder={t('se.campaignEra')}
            value={era}
            onChange={e => setEra(e.target.value)}
          />
          <button type="submit" className="btn btn--primary" disabled={loading || !title.trim()}>
            {loading ? t('se.creating') : t('se.create')}
          </button>
        </form>
      )}

      <div className="se-list">
        {campaigns.length === 0 && (
          <div className="se-empty">{t('se.noCampaigns')}</div>
        )}
        {campaigns.map(c => (
          <div
            key={c.id}
            className={'se-list__item' + (selected?.id === c.id ? ' se-list__item--active' : '')}
            onClick={() => setConfirmId(null) || onSelect(c)}
          >
            <div className="se-list__item-main">
              <div className="se-list__item-title">{c.title}</div>
              {(c.setting || c.era) && (
                <div className="se-list__item-meta">{[c.setting, c.era].filter(Boolean).join(' · ')}</div>
              )}
            </div>
            {confirmId === c.id ? (
              <ConfirmDelete
                label={t('se.deleteCampaign')}
                onConfirm={() => handleDelete(c.id)}
                onCancel={() => setConfirmId(null)}
              />
            ) : (
              <button
                className="se-del-btn"
                onClick={e => { e.stopPropagation(); setConfirmId(c.id) }}
                title={t('se.deleteLabel', { label: t('se.deleteCampaign') })}
              >×</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Acts + Scenes tree ───────────────────────────────────────────────────────

function ActTree({ campaign, selectedScene, onSelectScene }) {
  const { t } = useTranslation()
  const [acts, setActs] = useState([])
  const [loading, setLoading] = useState(true)
  const [newActTitle, setNewActTitle] = useState('')
  const [expandedActs, setExpandedActs] = useState({})
  const [newSceneTitles, setNewSceneTitles] = useState({})
  const [confirmAct, setConfirmAct] = useState(null)
  const [confirmScene, setConfirmScene] = useState(null)

  useEffect(() => {
    if (!campaign) return
    setLoading(true)
    getActs(campaign.id)
      .then(res => {
        const data = res.data.results ?? res.data
        setActs(data)
        if (data.length > 0) setExpandedActs({ [data[0].id]: true })
      })
      .finally(() => setLoading(false))
  }, [campaign?.id])

  async function handleCreateAct(e) {
    e.preventDefault()
    if (!newActTitle.trim()) return
    const order = acts.length
    const res = await createAct(campaign.id, { title: newActTitle.trim(), order })
    setActs(prev => [...prev, res.data])
    setNewActTitle('')
    setExpandedActs(prev => ({ ...prev, [res.data.id]: true }))
  }

  async function handleDeleteAct(actId) {
    await deleteAct(campaign.id, actId)
    setActs(prev => prev.filter(a => a.id !== actId))
    setConfirmAct(null)
  }

  async function handleCreateScene(actId) {
    const title = newSceneTitles[actId]?.trim()
    if (!title) return
    const act = acts.find(a => a.id === actId)
    const order = (act?.scenes ?? []).length
    const res = await createScene(campaign.id, actId, { title, order })
    setActs(prev => prev.map(a =>
      a.id === actId ? { ...a, scenes: [...(a.scenes ?? []), res.data] } : a
    ))
    setNewSceneTitles(prev => ({ ...prev, [actId]: '' }))
  }

  async function handleDeleteScene(actId, sceneId) {
    await deleteScene(campaign.id, actId, sceneId)
    setActs(prev => prev.map(a =>
      a.id === actId ? { ...a, scenes: (a.scenes ?? []).filter(s => s.id !== sceneId) } : a
    ))
    setConfirmScene(null)
  }

  if (!campaign) return null
  if (loading) return <div className="se-panel se-panel--tree"><Spinner /></div>

  return (
    <div className="se-panel se-panel--tree">
      <div className="se-panel__head">
        <span className="se-panel__title">{campaign.title}</span>
      </div>

      <div className="se-list">
        {acts.map(act => (
          <div key={act.id} className="se-act">
            <div className="se-act__head" onClick={() => setExpandedActs(prev => ({ ...prev, [act.id]: !prev[act.id] }))}>
              <span className="se-act__arrow">{expandedActs[act.id] ? '▾' : '▸'}</span>
              <span className="se-act__title">{act.title}</span>
              {confirmAct === act.id ? (
                <ConfirmDelete
                  label={t('se.deleteAct')}
                  onConfirm={() => handleDeleteAct(act.id)}
                  onCancel={() => setConfirmAct(null)}
                />
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
                      <ConfirmDelete
                        label={t('se.deleteScene')}
                        onConfirm={() => handleDeleteScene(act.id, scene.id)}
                        onCancel={() => setConfirmScene(null)}
                      />
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

      <form onSubmit={handleCreateAct} className="se-add-act">
        <input
          className="form-input"
          placeholder={t('se.newAct')}
          value={newActTitle}
          onChange={e => setNewActTitle(e.target.value)}
        />
        <button type="submit" className="btn btn--ghost" disabled={!newActTitle.trim()}>
          {t('se.add')}
        </button>
      </form>
    </div>
  )
}

// ─── Scene detail panel ───────────────────────────────────────────────────────

function SceneDetail({ campaign, scene, onUpdated }) {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [saving, setSaving] = useState(false)
  const [npcForm, setNpcForm] = useState({ show: false, name: '', description: '', secret_info: '' })

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
      if (field === 'title') onUpdated(res.data)
    } finally {
      setSaving(false)
    }
  }, [campaign?.id, scene?.id, scene?.actId, data])

  async function handleAddNPC(e) {
    e.preventDefault()
    if (!npcForm.name.trim()) return
    const fd = new FormData()
    fd.append('name', npcForm.name.trim())
    fd.append('description', npcForm.description.trim())
    fd.append('secret_info', npcForm.secret_info.trim())
    fd.append('scene_ids', scene.id)
    const res = await createNPC(campaign.id, fd)
    setData(prev => ({ ...prev, npcs: [...(prev.npcs ?? []), res.data] }))
    setNpcForm({ show: false, name: '', description: '', secret_info: '' })
  }

  async function handleDeleteNPC(npcId) {
    await deleteNPC(campaign.id, npcId)
    setData(prev => ({ ...prev, npcs: (prev.npcs ?? []).filter(n => n.id !== npcId) }))
  }

  if (!scene) {
    return (
      <div className="se-panel se-panel--detail se-detail-empty">
        <div className="empty-state__title">{t('se.selectScene')}</div>
        <div className="empty-state__sub">{t('se.selectSceneSub')}</div>
      </div>
    )
  }

  if (!data) {
    return <div className="se-panel se-panel--detail"><Spinner /></div>
  }

  return (
    <div className="se-panel se-panel--detail">
      <div className="se-panel__head">
        <input
          className="se-title-input"
          defaultValue={data.title}
          onBlur={e => autoSave('title', e.target.value)}
        />
        {saving && <Spinner />}
      </div>

      <div className="se-detail-body">

        {/* Description */}
        <div className="se-section">
          <div className="se-section__label">{t('se.sceneDesc')}</div>
          <textarea
            className="se-textarea"
            defaultValue={data.description}
            rows={6}
            placeholder={t('se.sceneDescPlaceholder')}
            onBlur={e => autoSave('description', e.target.value)}
          />
        </div>

        {/* Master notes */}
        <div className="se-section">
          <div className="se-section__label se-section__label--private">
            {t('se.masterNotes')} <span className="se-private-badge">{t('se.private')}</span>
          </div>
          <textarea
            className="se-textarea se-textarea--private"
            defaultValue={data.master_notes}
            rows={4}
            placeholder={t('se.masterNotesPlaceholder')}
            onBlur={e => autoSave('master_notes', e.target.value)}
          />
        </div>

        {/* NPCs */}
        <div className="se-section">
          <div className="se-section__label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{t('se.npcsInScene')}</span>
            <button className="btn btn--ghost" style={{ padding: '2px 10px', fontSize: 11 }}
              onClick={() => setNpcForm(p => ({ ...p, show: !p.show }))}>
              {npcForm.show ? '×' : t('se.addNPCBtn2')}
            </button>
          </div>

          {npcForm.show && (
            <form onSubmit={handleAddNPC} className="se-inline-form">
              <input
                className="form-input"
                placeholder={t('se.npcName')}
                value={npcForm.name}
                onChange={e => setNpcForm(p => ({ ...p, name: e.target.value }))}
                autoFocus
              />
              <textarea
                className="form-input"
                placeholder={t('se.npcDesc')}
                value={npcForm.description}
                onChange={e => setNpcForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
              />
              <textarea
                className="form-input"
                placeholder={t('se.npcSecret')}
                value={npcForm.secret_info}
                onChange={e => setNpcForm(p => ({ ...p, secret_info: e.target.value }))}
                rows={2}
              />
              <button type="submit" className="btn btn--primary" disabled={!npcForm.name.trim()}>
                {t('se.addNPCBtn')}
              </button>
            </form>
          )}

          <div className="se-npc-list">
            {(data.npcs ?? []).length === 0 && (
              <div className="se-empty">{t('se.noNPCs')}</div>
            )}
            {(data.npcs ?? []).map(npc => (
              <div key={npc.id} className="se-npc">
                <div className="se-npc__info">
                  <div className="se-npc__name">{npc.name}</div>
                  {npc.description && (
                    <div className="se-npc__desc">{npc.description}</div>
                  )}
                  {npc.secret_info && (
                    <div className="se-npc__secret">
                      <span className="se-private-badge">{t('se.secret')}</span> {npc.secret_info}
                    </div>
                  )}
                </div>
                <button
                  className="se-del-btn"
                  onClick={() => handleDeleteNPC(npc.id)}
                  title={t('se.deleteNPC')}
                >×</button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─── Asset panel ─────────────────────────────────────────────────────────────

function AssetPanel({ campaign }) {
  const { t } = useTranslation()

  const ASSET_TYPES = [
    { key: 'npc',      label: t('se.assetNPC') },
    { key: 'document', label: t('se.assetDocument') },
    { key: 'photo',    label: t('se.assetPhoto') },
    { key: 'note',     label: t('se.assetNote') },
  ]

  const [assets, setAssets] = useState([])
  const [activeType, setActiveType] = useState('npc')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', image: null })
  const [loading, setLoading] = useState(false)
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => {
    if (!campaign) return
    setAssets([])
    getAssets(campaign.id).then(res => setAssets(res.data.results ?? res.data)).catch(() => {})
  }, [campaign?.id])

  const filtered = assets.filter(a => a.type === activeType)

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setLoading(true)
    try {
      const data = { type: activeType, title: form.title.trim(), content: form.content.trim() }
      if (form.image) data.image = form.image
      const res = await createAsset(campaign.id, data)
      setAssets(prev => [...prev, res.data])
      setForm({ title: '', content: '', image: null })
      setShowForm(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    await deleteAsset(campaign.id, id)
    setAssets(prev => prev.filter(a => a.id !== id))
    setConfirmId(null)
  }

  if (!campaign) return null

  const currentTypeLabel = ASSET_TYPES.find(tp => tp.key === activeType)?.label ?? activeType

  return (
    <div className="se-panel se-panel--assets">
      <div className="se-panel__head">
        <span className="se-panel__title">{t('se.assets')}</span>
        <button
          className="btn btn--ghost"
          style={{ padding: '2px 10px', fontSize: 11 }}
          onClick={() => setShowForm(v => !v)}
        >
          {showForm ? '×' : '+'}
        </button>
      </div>

      <div className="se-asset-tabs">
        {ASSET_TYPES.map(tp => (
          <button
            key={tp.key}
            className={'se-asset-tab' + (activeType === tp.key ? ' se-asset-tab--active' : '')}
            onClick={() => { setActiveType(tp.key); setShowForm(false) }}
          >
            {tp.label}
            <span className="se-asset-tab__count">
              {assets.filter(a => a.type === tp.key).length}
            </span>
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="se-inline-form">
          <input
            className="form-input"
            placeholder={`${currentTypeLabel}`}
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            autoFocus
          />
          {(activeType === 'document' || activeType === 'note') && (
            <textarea
              className="form-input"
              placeholder={t('se.assetContent')}
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              rows={3}
            />
          )}
          {(activeType === 'photo' || activeType === 'npc') && (
            <input
              type="file"
              accept="image/*"
              className="form-input"
              onChange={e => setForm(p => ({ ...p, image: e.target.files[0] ?? null }))}
            />
          )}
          <button type="submit" className="btn btn--primary" disabled={loading || !form.title.trim()}>
            {loading ? '...' : t('se.assetAdd')}
          </button>
        </form>
      )}

      <div className="se-list">
        {filtered.length === 0 && (
          <div className="se-empty">
            {t('se.noAssets')} {currentTypeLabel.toLowerCase()}
          </div>
        )}
        {filtered.map(asset => (
          <div key={asset.id} className="se-list__item">
            <div className="se-list__item-main">
              {asset.image && (
                <img
                  src={asset.image}
                  alt=""
                  style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 2, marginRight: 8, flexShrink: 0 }}
                />
              )}
              <div>
                <div className="se-list__item-title">{asset.title}</div>
                {asset.content && (
                  <div className="se-list__item-meta" style={{ whiteSpace: 'pre-line', maxHeight: 40, overflow: 'hidden' }}>
                    {asset.content}
                  </div>
                )}
              </div>
            </div>
            {confirmId === asset.id ? (
              <ConfirmDelete
                label={t('se.deleteAsset')}
                onConfirm={() => handleDelete(asset.id)}
                onCancel={() => setConfirmId(null)}
              />
            ) : (
              <button className="se-del-btn" onClick={() => setConfirmId(asset.id)}>×</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StoryEditorPage() {
  const { t } = useTranslation()
  const user = useAuthStore(s => s.user)
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [selectedScene, setSelectedScene] = useState(null)

  useEffect(() => {
    getCampaigns()
      .then(res => {
        const data = res.data.results ?? res.data
        setCampaigns(data)
      })
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
          <CampaignPanel
            campaigns={campaigns}
            selected={selectedCampaign}
            onSelect={c => { setSelectedCampaign(c); setSelectedScene(null) }}
            onCreated={c => { setCampaigns(prev => [c, ...prev]); setSelectedCampaign(c) }}
            onDeleted={id => {
              setCampaigns(prev => prev.filter(c => c.id !== id))
              if (selectedCampaign?.id === id) { setSelectedCampaign(null); setSelectedScene(null) }
            }}
          />

          <ActTree
            campaign={selectedCampaign}
            selectedScene={selectedScene}
            onSelectScene={setSelectedScene}
          />

          <SceneDetail
            campaign={selectedCampaign}
            scene={selectedScene}
            onUpdated={updated => {}}
          />

          <AssetPanel campaign={selectedCampaign} />
        </div>
      )}
    </div>
  )
}
