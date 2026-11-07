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
