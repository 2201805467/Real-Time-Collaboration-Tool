import { apiRequest } from './client.js';

export function getBoards(token) {
  return apiRequest('/api/boards', { token });
}

export function getWorkspaceStats(token) {
  return apiRequest('/api/workspace/stats', { token });
}

export function getWorkspaceActivity(token) {
  return apiRequest('/api/workspace/activity', { token });
}

export function getInvite(inviteToken) {
  return apiRequest(`/api/invites/${inviteToken}`);
}

export function acceptInvite(inviteToken, token) {
  return apiRequest(`/api/invites/${inviteToken}/accept`, { method: 'POST', token });
}

export function createBoard(title, token) {
  return apiRequest('/api/boards', { method: 'POST', token, body: { title } });
}
