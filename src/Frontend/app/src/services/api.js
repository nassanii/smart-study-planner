import { apiClient } from './api_client';

export const authApi = {
  register: (payload) => apiClient.post('/auth/register', payload, { skipAuth: true }).then(r => r.data),
  login: (payload) => apiClient.post('/auth/login', payload, { skipAuth: true }).then(r => r.data),
  logout: (refreshToken) => apiClient.post('/auth/logout', { refreshToken }).then(r => r.data),
  me: () => apiClient.get('/auth/me').then(r => r.data),
  changePassword: (payload) => apiClient.post('/auth/change-password', payload).then(r => r.data),
};

export const usersApi = {
  me: () => apiClient.get('/users/me').then(r => r.data),
  update: (payload) => apiClient.put('/users/me', payload).then(r => r.data),
  onboard: (payload) => apiClient.post('/users/me/onboarding', payload).then(r => r.data),
};

export const subjectsApi = {
  list: () => apiClient.get('/subjects').then(r => r.data),
  create: (payload) => apiClient.post('/subjects', payload).then(r => r.data),
  update: (id, payload) => apiClient.put(`/subjects/${id}`, payload).then(r => r.data),
  remove: (id) => apiClient.delete(`/subjects/${id}`).then(r => r.data),
};

export const tasksApi = {
  list: (filter = 'all') => apiClient.get('/tasks', { params: { filter } }).then(r => r.data),
  create: (payload) => apiClient.post('/tasks', payload).then(r => r.data),
  update: (id, payload) => apiClient.put(`/tasks/${id}`, payload).then(r => r.data),
  difficulty: (id, rating) => apiClient.patch(`/tasks/${id}/difficulty`, { difficultyRating: rating }).then(r => r.data),
  complete: (id, actualMinutes) => apiClient.post(`/tasks/${id}/complete`, { actualMinutes }).then(r => r.data),
  snooze: (id, reason) => apiClient.post(`/tasks/${id}/snooze`, { reason }).then(r => r.data),
  remove: (id) => apiClient.delete(`/tasks/${id}`).then(r => r.data),
};

export const focusApi = {
  list: (params = {}) => apiClient.get('/focus-sessions', { params }).then(r => r.data),
  start: (payload) => apiClient.post('/focus-sessions', payload).then(r => r.data),
  complete: (id, payload) => apiClient.patch(`/focus-sessions/${id}/complete`, payload).then(r => r.data),
};

export const slotsApi = {
  list: (date) => apiClient.get('/available-slots', { params: date ? { date } : {} }).then(r => r.data),
  create: (payload) => apiClient.post('/available-slots', payload).then(r => r.data),
  update: (id, payload) => apiClient.put(`/available-slots/${id}`, payload).then(r => r.data),
  remove: (id) => apiClient.delete(`/available-slots/${id}`).then(r => r.data),
};

export const behavioralLogsApi = {
  today: () => apiClient.get('/behavioral-logs/today').then(r => r.data),
  range: (from, to) => apiClient.get('/behavioral-logs', { params: { from, to } }).then(r => r.data),
};

export const scheduleApi = {
  generate: (date) => apiClient.post('/schedule/generate', date ? { date } : {}).then(r => r.data),
  today: () => apiClient.get('/schedule/today').then(r => r.data).catch(err => { if (err.response?.status === 404) return null; throw err; }),
  history: (limit = 10) => apiClient.get('/schedule/history', { params: { limit } }).then(r => r.data),
};

export const analyticsApi = {
  insights: () => apiClient.get('/analytics/insights').then(r => r.data),
  performance: () => apiClient.get('/analytics/performance').then(r => r.data).catch(err => { if (err.response?.status === 404) return null; throw err; }),
};
