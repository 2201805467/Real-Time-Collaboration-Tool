import { useEffect, useState } from 'react';
import { authenticate, getCurrentUser } from '../api/authApi.js';

const tokenKey = 'collab-token';

export default function useAuthSession() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) || '');
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  useEffect(() => {
    let active = true;

    if (!token) {
      setUser(null);
      return undefined;
    }

    getCurrentUser(token)
      .then((data) => {
        if (active) {
          setUser(data.user);
        }
      })
      .catch(() => {
        if (active) {
          localStorage.removeItem(tokenKey);
          setToken('');
          setUser(null);
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function submitAuth(mode, form) {
    setAuthError('');
    setIsSubmittingAuth(true);

    try {
      const data = await authenticate(mode, form);
      localStorage.setItem(tokenKey, data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (error) {
      const message = error.message === 'Email is already registered'
        ? 'هذا البريد الإلكتروني مسجل مسبقاً. استخدم تسجيل الدخول أو بريداً آخر.'
        : error.message;
      setAuthError(message);
      throw error;
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  function logout() {
    localStorage.removeItem(tokenKey);
    setToken('');
    setUser(null);
    setAuthError('');
  }

  function expireSession(message = 'انتهت الجلسة. سجل الدخول من جديد.') {
    logout();
    setAuthError(message);
  }

  return {
    token,
    user,
    authError,
    isSubmittingAuth,
    setAuthError,
    submitAuth,
    logout,
    expireSession
  };
}
