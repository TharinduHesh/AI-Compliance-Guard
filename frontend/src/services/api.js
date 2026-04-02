import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  register: async (companyId, companyName, password) => {
    const response = await api.post('/auth/register', {
      company_id: companyId,
      company_name: companyName,
      password,
    })
    return response.data
  },

  login: async (companyId, password) => {
    const response = await api.post('/auth/login', {
      company_id: companyId,
      password,
    })
    return response.data
  },

  getMe: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  },
}

// Compliance API
export const complianceAPI = {
  uploadDocument: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await api.post('/compliance/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  analyzeDocument: async (fileId, frameworks = ['iso27001'], includeCIA = true, includeISO9001 = false) => {
    const response = await api.post('/compliance/analyze', {
      file_id: fileId,
      frameworks,
      include_cia: includeCIA,
      include_iso9001: includeISO9001,
    })
    return response.data
  },

  getFrameworks: async () => {
    const response = await api.get('/compliance/frameworks')
    return response.data
  },
}

// Analysis API
export const analysisAPI = {
  analyzeCIA: async (clauses) => {
    const response = await api.post('/analysis/cia', { clauses })
    return response.data
  },

  predictRisk: async (analysisData) => {
    const response = await api.post('/analysis/risk-prediction', analysisData)
    return response.data
  },

  getCIADefinitions: async () => {
    const response = await api.get('/analysis/cia-definitions')
    return response.data
  },
}

// Admin API
export const adminAPI = {
  getStats: async () => {
    const response = await api.get('/admin/stats')
    return response.data
  },

  cleanupFiles: async () => {
    const response = await api.post('/admin/cleanup')
    return response.data
  },

  getSystemHealth: async () => {
    const response = await api.get('/admin/system-health')
    return response.data
  },

  // User management (admin-only)
  listUsers: async () => {
    const response = await api.get('/admin/users')
    return response.data
  },

  createUser: async (companyId, companyName, password, role = 'user') => {
    const response = await api.post('/admin/users', {
      company_id: companyId,
      company_name: companyName,
      password,
      role,
    })
    return response.data
  },

  deleteUser: async (companyId) => {
    const response = await api.delete(`/admin/users/${encodeURIComponent(companyId)}`)
    return response.data
  },

  listActivities: async (user = null, limit = 100) => {
    const params = { limit }
    if (user) params.user = user
    const response = await api.get('/admin/activities', { params })
    return response.data
  },

  getHistory: async (category = null, user = null, limit = 200) => {
    const params = { limit }
    if (category) params.category = category
    if (user) params.user = user
    const response = await api.get('/admin/history', { params })
    return response.data
  },

  getUserDocuments: async (user = null, limit = 200) => {
    const params = { limit }
    if (user) params.user = user
    const response = await api.get('/admin/user-documents', { params })
    return response.data
  },

  getUserFiles: async (user = null) => {
    const params = {}
    if (user) params.user = user
    const response = await api.get('/admin/user-files', { params })
    return response.data
  },

  downloadUserFile: (userId, storedName) => {
    const token = localStorage.getItem('token')
    return `${API_BASE_URL}/admin/user-files/download?user=${encodeURIComponent(userId)}&filename=${encodeURIComponent(storedName)}&token=${token}`
  },

  getAnalytics: async () => {
    const response = await api.get('/admin/analytics')
    return response.data
  },

  deleteChatTrackerData: async (targetType, value = null, deleteAll = false) => {
    const response = await api.post('/admin/chat-tracker/delete', {
      target_type: targetType,
      value,
      delete_all: deleteAll,
    })
    return response.data
  },

  getAutoDeleteSettings: async () => {
    const response = await api.get('/admin/auto-delete-settings')
    return response.data
  },

  updateAutoDeleteSettings: async (historyPeriod) => {
    const response = await api.put('/admin/auto-delete-settings', {
      history_period: historyPeriod,
    })
    return response.data
  },

  deleteActivityLogs: async (period, actionFilter = null) => {
    const params = { period }
    if (actionFilter) params.action_filter = actionFilter
    const response = await api.delete('/admin/activity-logs', { params })
    return response.data
  },
}

export default api

// Chat API
export const chatAPI = {
  newConversation: async () => {
    const response = await api.post('/chat/new')
    return response.data
  },

  sendMessage: async (conversationId, message) => {
    const response = await api.post('/chat/message', {
      conversation_id: conversationId,
      message,
    })
    return response.data
  },

  uploadDocument: async (conversationId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('conversation_id', conversationId || '')
    const response = await api.post('/chat/upload-document', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  uploadAndAsk: async (conversationId, file, message, frameworks) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('message', message || 'Analyze this document for compliance')
    formData.append('conversation_id', conversationId || '')
    formData.append('frameworks', frameworks || 'iso27001')
    const response = await api.post('/chat/upload-and-ask', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  getConversation: async (conversationId) => {
    const response = await api.get(`/chat/conversation/${conversationId}`)
    return response.data
  },

  deleteConversation: async (conversationId) => {
    const response = await api.delete(`/chat/conversation/${conversationId}`)
    return response.data
  },

  getLLMStatus: async () => {
    const response = await api.get('/chat/llm/status')
    return response.data
  },
}
