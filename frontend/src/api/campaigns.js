import api from './client.js'

// Campaigns
export const getCampaigns = () => api.get('/campaigns/')
export const getCampaign = (id) => api.get(`/campaigns/${id}/`)
export const createCampaign = (data) => api.post('/campaigns/', data)
export const updateCampaign = (id, data) => api.patch(`/campaigns/${id}/`, data)
export const deleteCampaign = (id) => api.delete(`/campaigns/${id}/`)

// Acts
export const getActs = (campaignId) => api.get(`/campaigns/${campaignId}/acts/`)
export const createAct = (campaignId, data) => api.post(`/campaigns/${campaignId}/acts/`, data)
export const updateAct = (campaignId, actId, data) => api.patch(`/campaigns/${campaignId}/acts/${actId}/`, data)
export const deleteAct = (campaignId, actId) => api.delete(`/campaigns/${campaignId}/acts/${actId}/`)

// Scenes
export const getScenes = (campaignId, actId) => api.get(`/campaigns/${campaignId}/acts/${actId}/scenes/`)
export const getScene = (campaignId, actId, sceneId) => api.get(`/campaigns/${campaignId}/acts/${actId}/scenes/${sceneId}/`)
export const createScene = (campaignId, actId, data) => api.post(`/campaigns/${campaignId}/acts/${actId}/scenes/`, data)
export const updateScene = (campaignId, actId, sceneId, data) => api.patch(`/campaigns/${campaignId}/acts/${actId}/scenes/${sceneId}/`, data)
export const deleteScene = (campaignId, actId, sceneId) => api.delete(`/campaigns/${campaignId}/acts/${actId}/scenes/${sceneId}/`)

// NPCs
export const getNPCs = (campaignId) => api.get(`/campaigns/${campaignId}/npcs/`)
export const createNPC = (campaignId, data) => api.post(`/campaigns/${campaignId}/npcs/`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
export const updateNPC = (campaignId, npcId, data) => {
  if (data.portrait_image instanceof File) {
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) formData.append(key, value)
    })
    return api.patch(`/campaigns/${campaignId}/npcs/${npcId}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
  return api.patch(`/campaigns/${campaignId}/npcs/${npcId}/`, data)
}
export const deleteNPC = (campaignId, npcId) => api.delete(`/campaigns/${campaignId}/npcs/${npcId}/`)

// Campaign Assets
export const getAssets = (campaignId) => api.get(`/campaigns/${campaignId}/assets/`)
export const createAsset = (campaignId, data) => {
  if (data.image instanceof File) {
    const fd = new FormData()
    Object.entries(data).forEach(([k, v]) => { if (v !== undefined && v !== null) fd.append(k, v) })
    return api.post(`/campaigns/${campaignId}/assets/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  }
  return api.post(`/campaigns/${campaignId}/assets/`, data)
}
export const updateAsset = (campaignId, assetId, data) => api.patch(`/campaigns/${campaignId}/assets/${assetId}/`, data)
export const deleteAsset = (campaignId, assetId) => api.delete(`/campaigns/${campaignId}/assets/${assetId}/`)

// Scene cards
export const getSceneCards = (campaignId, actId, sceneId) =>
  api.get(`/campaigns/${campaignId}/acts/${actId}/scenes/${sceneId}/cards/`)
export const addSceneCard = (campaignId, actId, sceneId, data) =>
  api.post(`/campaigns/${campaignId}/acts/${actId}/scenes/${sceneId}/cards/`, data)
export const sendSceneCard = (campaignId, actId, sceneId, cardId, data) =>
  api.post(`/campaigns/${campaignId}/acts/${actId}/scenes/${sceneId}/cards/${cardId}/send/`, data)
export const deleteSceneCard = (campaignId, actId, sceneId, cardId) =>
  api.delete(`/campaigns/${campaignId}/acts/${actId}/scenes/${sceneId}/cards/${cardId}/`)
