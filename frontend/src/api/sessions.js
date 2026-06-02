import api from './client.js'

export const getSessions = () => api.get('/sessions/')
export const getSession = (id) => api.get(`/sessions/${id}/`)
export const createSession = (data) => api.post('/sessions/', data)
export const joinSession = (id) => api.post(`/sessions/${id}/join/`)
export const leaveSession = (id) => api.post(`/sessions/${id}/leave/`)
export const deleteSession = (id) => api.delete(`/sessions/${id}/`)
export const joinByCode = (code) => api.post('/sessions/join-by-code/', { code })
export const startSession = (id) => api.post(`/sessions/${id}/start/`)
export const closeSession = (id) => api.post(`/sessions/${id}/close/`)
export const rollDice = (id, data) => api.post(`/sessions/${id}/roll/`, data)

export const getCards = (sessionId) => api.get(`/sessions/${sessionId}/cards/`)
export const createCard = (sessionId, data) => {
  if (data.image instanceof File) {
    const form = new FormData()
    Object.entries(data).forEach(([k, v]) => {
      if (v === undefined || v === null) return
      form.append(k === 'image' ? 'image_upload' : k, v)
    })
    return api.post(`/sessions/${sessionId}/cards/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  }
  return api.post(`/sessions/${sessionId}/cards/`, data)
}
export const updateCard = (sessionId, cardId, data) => api.patch(`/sessions/${sessionId}/cards/${cardId}/`, data)
export const deleteCard = (sessionId, cardId) => api.delete(`/sessions/${sessionId}/cards/${cardId}/`)
export const publishCard = (sessionId, cardId) => api.post(`/sessions/${sessionId}/cards/${cardId}/publish/`)
export const pinCard = (sessionId, cardId) => api.post(`/sessions/${sessionId}/cards/${cardId}/pin/`)

export const moveCard = (sessionId, cardId, pos_x, pos_y) =>
  api.patch(`/sessions/${sessionId}/cards/${cardId}/`, { pos_x, pos_y })

export const getThreads = (sessionId) => api.get(`/sessions/${sessionId}/threads/`)
export const createThread = (sessionId, data) => api.post(`/sessions/${sessionId}/threads/`, data)
export const deleteThread = (sessionId, threadId) => api.delete(`/sessions/${sessionId}/threads/${threadId}/`)

export const setSessionCharacter = (sessionId, characterId) =>
  api.post(`/sessions/${sessionId}/set-character/`, characterId ? { character_id: characterId } : {})
export const getMySessionCharacter = (sessionId) => api.get(`/sessions/${sessionId}/my-character/`)

export const loadCampaign = (sessionId, campaignId) =>
  api.post(`/sessions/${sessionId}/load-campaign/`, { campaign_id: campaignId })

export const saveDrawingStrokes = (sessionId, cardId, strokes) =>
  api.patch(`/sessions/${sessionId}/cards/${cardId}/drawing/`, { strokes })
export const clearDrawing = (sessionId, cardId) =>
  api.patch(`/sessions/${sessionId}/cards/${cardId}/drawing/`, { clear: true })

export const getNotes = (sessionId) => api.get(`/sessions/${sessionId}/notes/`)
export const createNote = (sessionId, data) => api.post(`/sessions/${sessionId}/notes/`, data)
export const updateNote = (sessionId, noteId, data) => api.patch(`/sessions/${sessionId}/notes/${noteId}/`, data)
export const deleteNote = (sessionId, noteId) => api.delete(`/sessions/${sessionId}/notes/${noteId}/`)
