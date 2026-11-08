import { apiRequest, apiUrl, ApiError } from './client.js';

async function parseApiResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.message || 'تعذر إكمال الطلب.', response.status, data);
  return data;
}

async function uploadAttachment(boardId, cardId, file, token) {
  const response = await fetch(`${apiUrl}/api/boards/${boardId}/cards/${cardId}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      'X-File-Type': file.type
    },
    body: file
  });
  return parseApiResponse(response);
}

async function downloadAttachment(boardId, cardId, attachment, token) {
  const response = await fetch(`${apiUrl}/api/boards/${boardId}/cards/${cardId}/attachments/${attachment.id}/download`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.message || 'تعذر تنزيل المرفق.', response.status, data);
  }

  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = attachment.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export const boardApi = {
  get: (boardId, token) => apiRequest(`/api/boards/${boardId}`, { token }),
  update: (boardId, title, token) => apiRequest(`/api/boards/${boardId}`, { method: 'PATCH', token, body: { title } }),
  remove: (boardId, token) => apiRequest(`/api/boards/${boardId}`, { method: 'DELETE', token }),
  getMembers: (boardId, token) => apiRequest(`/api/boards/${boardId}/members`, { token }),
  updateMemberRole: (boardId, memberId, role, token) => apiRequest(`/api/boards/${boardId}/members/${memberId}`, { method: 'PATCH', token, body: { role } }),
  removeMember: (boardId, memberId, token) => apiRequest(`/api/boards/${boardId}/members/${memberId}`, { method: 'DELETE', token }),
  getInvites: (boardId, token) => apiRequest(`/api/boards/${boardId}/invites`, { token }),
  createInvite: (boardId, token) => apiRequest(`/api/boards/${boardId}/invites`, { method: 'POST', token }),
  revokeInvite: (boardId, inviteId, token) => apiRequest(`/api/boards/${boardId}/invites/${inviteId}`, { method: 'DELETE', token }),
  createColumn: (boardId, title, token) => apiRequest(`/api/boards/${boardId}/columns`, { method: 'POST', token, body: { title } }),
  updateColumn: (boardId, columnId, title, token) => apiRequest(`/api/boards/${boardId}/columns/${columnId}`, { method: 'PATCH', token, body: { title } }),
  removeColumn: (boardId, columnId, token) => apiRequest(`/api/boards/${boardId}/columns/${columnId}`, { method: 'DELETE', token }),
  createCard: (boardId, columnId, title, token) => apiRequest(`/api/boards/${boardId}/columns/${columnId}/cards`, { method: 'POST', token, body: { title } }),
  moveCard: (boardId, cardId, columnId, position, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}/move`, { method: 'PATCH', token, body: { columnId, position } }),
  getCard: (boardId, cardId, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}`, { token }),
  updateCard: (boardId, cardId, payload, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}`, { method: 'PATCH', token, body: payload }),
  removeCard: (boardId, cardId, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}`, { method: 'DELETE', token }),
  addComment: (boardId, cardId, body, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}/comments`, { method: 'POST', token, body: { body } }),
  updateComment: (boardId, cardId, commentId, body, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}/comments/${commentId}`, { method: 'PATCH', token, body: { body } }),
  removeComment: (boardId, cardId, commentId, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}/comments/${commentId}`, { method: 'DELETE', token }),
  uploadAttachment,
  downloadAttachment,
  removeAttachment: (boardId, cardId, attachmentId, token) => apiRequest(`/api/boards/${boardId}/cards/${cardId}/attachments/${attachmentId}`, { method: 'DELETE', token })
};
