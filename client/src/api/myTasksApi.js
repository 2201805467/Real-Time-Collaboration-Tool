import { apiRequest, apiUrl, ApiError } from './client.js';

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.message || 'تعذر إكمال الطلب.', response.status, data);
  return data;
}

async function uploadAttachment(task, file, token) {
  const response = await fetch(`${apiUrl}/api/boards/${task.boardId}/cards/${task.cardId}/subtasks/${task.id}/attachments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      'X-File-Type': file.type
    },
    body: file
  });
  return parseResponse(response);
}

async function downloadAttachment(task, attachment, token) {
  const response = await fetch(`${apiUrl}/api/boards/${task.boardId}/cards/${task.cardId}/subtasks/${task.id}/attachments/${attachment.id}/download`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(data.message || 'تعذر تنزيل الملف.', response.status, data);
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

export const myTasksApi = {
  getAll: (token) => apiRequest('/api/my-tasks', { token }),
  updateStatus: (task, status, reviewNote, token) => apiRequest(
    `/api/boards/${task.boardId}/cards/${task.cardId}/subtasks/${task.id}/status`,
    { method: 'PATCH', token, body: { status, reviewNote } }
  ),
  uploadAttachment,
  downloadAttachment,
  removeAttachment: (task, attachmentId, token) => apiRequest(
    `/api/boards/${task.boardId}/cards/${task.cardId}/subtasks/${task.id}/attachments/${attachmentId}`,
    { method: 'DELETE', token }
  )
};
