import client from './client.js'

export const getCharacters = () => client.get('/characters/')

export const getCharacter = (id) => client.get(`/characters/${id}/`)

export const createCharacter = (data) => client.post('/characters/', data)

export const updateCharacter = (id, data) =>
  client.patch(`/characters/${id}/`, data)

export const deleteCharacter = (id) => client.delete(`/characters/${id}/`)

export const rollDice = (id, data) => client.post(`/characters/${id}/roll/`, data)
