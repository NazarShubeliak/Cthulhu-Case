import client from './client.js'

export const getCharacters = () => client.get('/characters/')

export const getCharacter = (id) => client.get(`/characters/${id}/`)

export const createCharacter = (data) => {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value)
    }
  })
  return client.post('/characters/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const updateCharacter = (id, data) => {
  if (data.portrait_image instanceof File) {
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value)
      }
    })
    return client.patch(`/characters/${id}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }
  return client.patch(`/characters/${id}/`, data)
}

export const deleteCharacter = (id) => client.delete(`/characters/${id}/`)

export const rollDice = (id, data) => client.post(`/characters/${id}/roll/`, data)

export const updateSkill = (characterId, skillId, data) =>
  client.patch(`/characters/${characterId}/skills/${skillId}/`, data)
