import { apiRequest } from './client.js';

export const notificationApi = {
  list: (token) => apiRequest('/api/notifications', { token }),
  markRead: (notificationId, token) => apiRequest(`/api/notifications/${notificationId}/read`, {
    method: 'PATCH',
    token
  }),
  markAllRead: (token) => apiRequest('/api/notifications/read-all', {
    method: 'PATCH',
    token
  })
};
