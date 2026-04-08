const API_BASE = 'http://localhost:5000/api';

// Get token from localStorage
const getToken = () => localStorage.getItem('token');

// Helper for authenticated requests
const fetchWithAuth = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API Error');
  }

  return response.json();
};

// --- AUTH APIs ---
export const authAPI = {
  register: async (email, name, password, role = 'student') =>
    fetchWithAuth('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password, role })
    }),

  login: async (email, password) =>
    fetchWithAuth('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })
};

// --- DOCUMENT APIs ---
export const documentAPI = {
  upload: async (formData) =>
    fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData
    }).then(r => r.json()),

  getAll: async () =>
    fetchWithAuth('/documents'),

  getById: async (id) =>
    fetchWithAuth(`/documents/${id}`),

  download: async (id) =>
    fetchWithAuth(`/documents/${id}/download`, { method: 'POST' }),

  delete: async (id) =>
    fetchWithAuth(`/documents/${id}`, { method: 'DELETE' }),

  preview: async (id) =>
    `${API_BASE}/documents/${id}/preview`
};

// --- FEEDBACK APIs ---
export const feedbackAPI = {
  submit: async (resourceId, resourceType, rating, feedback) =>
    fetchWithAuth('/feedback', {
      method: 'POST',
      body: JSON.stringify({ resourceId, resourceType, rating, feedback })
    }),

  getByResource: async (resourceId) =>
    fetchWithAuth(`/feedback/${resourceId}`)
};

// --- CHAT APIs ---
export const chatAPI = {
  getAll: async () =>
    fetchWithAuth('/chats'),

  create: async (name, type, password) =>
    fetchWithAuth('/chats', {
      method: 'POST',
      body: JSON.stringify({ name, type, password })
    }),

  getMessages: async (chatId) =>
    fetchWithAuth(`/chats/${chatId}/messages`)
};

// --- ACTIVITY TRACKING APIs ---
export const activityAPI = {
  logActivity: async (section, action, duration, resourceId, metadata) =>
    fetchWithAuth('/activity/log', {
      method: 'POST',
      body: JSON.stringify({ section, action, duration, resourceId, metadata })
    }),

  getSummary: async () =>
    fetchWithAuth('/activity/summary'),

  getSuggestions: async () =>
    fetchWithAuth('/activity/suggestions'),

  updateInterests: async (topics) =>
    fetchWithAuth('/activity/interests', {
      method: 'POST',
      body: JSON.stringify({ topics })
    }),

  getActivityLog: async () =>
    fetchWithAuth('/activity/log')
};

// --- ADMIN APIs ---
export const adminAPI = {
  getStats: async () =>
    fetchWithAuth('/admin/stats'),

  banUser: async (userId) =>
    fetchWithAuth(`/admin/users/${userId}/ban`, { method: 'POST' }),

  approveDocument: async (docId) =>
    fetchWithAuth(`/admin/documents/${docId}/approve`, { method: 'POST' }),

  rejectDocument: async (docId) =>
    fetchWithAuth(`/admin/documents/${docId}/reject`, { method: 'POST' })
};

// --- SOCKET.IO ---
import io from 'socket.io-client';
export const socket = io('http://localhost:5000');
