import { apiRequest } from './client.js';

export const boardApi = {
  get: (boardId, token) => apiRequest(`/api/boards/${boardId}`, { token }),
  update: (boardId, title, token) => apiRequest(`/api/boards/${boardId}`, { method: 'PATCH', token, body: { title } }),
  remove: (boardId, token) => apiRequest(`/api/boards/${boardId}`, { method: 'DELETE', token }),
  getMembers: (boardId, token) => apiRequest(`/api/boards/${boardId}/members`, { token }),
  updateMemberRole: (boardId, memberId, role, token) => apiRequest(`/api/boards/${boardId}/members/${memberId}`, { method: 'PATCH', token, body: { role } }),
  removeMember: (boardId, memberId, token) => apiRequest(`/api/boards/${boardId}/members/${memberId}`, { method: 'DELETE', token }),
  createInvite: (boardId, token) => apiRequest(`/api/boards/${boardId}/invites`, { method: 'POST', token }),
  createColumn: (boardId, title, token) => apiRequest(`/api/boards/${boardId}/columns`, { method: 'POST', token, body: { title } }),
  updateColumn: (boardId, columnId, title, token) => apiRequest(`/api/boards/${boardId}/columns/${columnId}`, { method: 'PATCH', token, body: { title } }),
  removeColumn: (boardId, columnId, token) => apiRequest(`/api/boards/${boardId}/columns/${columnId}`, { method: 'DELETE', token }),
  createCard: (boardId, columnId, title, token) => apiRequest(`/api/boards/${boardId}/columns/${columnId}/cards`, { method: 'POST', token, body: { title } }),
  moveCard: (boardId, cardId, columnId, position, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}/move`, { method: 'PATCH', token, body: { columnId, position } }),
  getCard: (boardId, cardId, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}`, { token }),
  updateCard: (boardId, cardId, payload, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}`, { method: 'PATCH', token, body: payload }),
  removeCard: (boardId, cardId, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}`, { method: 'DELETE', token }),
  addComment: (boardId, cardId, body, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}/comments`, { method: 'POST', token, body: { body } })
};
