import client from './client.js'

export const register = (data) => client.post('/auth/register/', data)

export const login = (data) => client.post('/auth/login/', data)

export const logout = (refreshToken) =>
  client.post('/auth/logout/', { refresh: refreshToken })

export const getMe = () => client.get('/auth/me/')

export const changePassword = (data) => client.post('/auth/change-password/', data)

export const updateMe = (data) => {
  const formData = new FormData()
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value)
    }
  })
  return client.patch('/auth/me/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}
