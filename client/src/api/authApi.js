import { apiRequest } from './client.js';

export function getCurrentUser(token) {
  return apiRequest('/api/auth/me', { token });
}

export function authenticate(mode, form) {
  const endpoint = mode === 'register' ? 'register' : 'login';
  const body = mode === 'register'
    ? form
    : { email: form.email, password: form.password };

  return apiRequest(`/api/auth/${endpoint}`, {
    method: 'POST',
    body
  });
}

export function updateProfile(profile, token) {
  return apiRequest('/api/auth/profile', { method: 'PATCH', token, body: profile });
}

export function changePassword(passwords, token) {
  return apiRequest('/api/auth/password', { method: 'PATCH', token, body: passwords });
}

export function updateNotificationPreferences(preferences, token) {
  return apiRequest('/api/auth/preferences', { method: 'PATCH', token, body: preferences });
}
