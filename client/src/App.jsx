import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [authError, setAuthError] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem('collab-token') || '');
  const [user, setUser] = useState(null);
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!token) {
      return;
    }

    fetch(`${apiUrl}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Session expired');
        }

        return response.json();
      })
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('collab-token');
        setToken('');
        setUser(null);
      });
  }, [token]);

  useEffect(() => {
    const socket = io(socketUrl);
    socketRef.current = socket;

    function handleConnect() {
      setIsConnected(true);
    }

    function handleDisconnect() {
      setIsConnected(false);
    }

    function handleMessage(message) {
      setMessages((currentMessages) => [message, ...currentMessages]);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('demo:message', handleMessage);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('demo:message', handleMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  function updateAuthForm(field, value) {
    setAuthForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError('');
    setIsSubmittingAuth(true);

    const endpoint = authMode === 'register' ? 'register' : 'login';
    const body =
      authMode === 'register'
        ? authForm
        : {
            email: authForm.email,
            password: authForm.password
          };

    try {
      const response = await fetch(`${apiUrl}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      localStorage.setItem('collab-token', data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthForm({
        name: '',
        email: '',
        password: ''
      });
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('collab-token');
    setToken('');
    setUser(null);
    setMessages([]);
  }

  function handleMessageSubmit(event) {
    event.preventDefault();

    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    if (!socketRef.current) {
      return;
    }

    socketRef.current.emit('demo:message', {
      author: user?.name || 'Anonymous',
      text: trimmedText
    });

    setText('');
  }

  return (
    <main className="app-shell">
      <section className="intro">
        <div className="mark">
          RT
        </div>
        <div>
          <p className="eyebrow">Real-Time Collaboration Tool</p>
          <h1>{user ? `مرحباً ${user.name}` : 'تسجيل الدخول'}</h1>
          <p className="lede">
            {user
              ? 'حسابك يعمل الآن. جرّب إرسال رسالة من نافذتين للتأكد من التعاون الفوري.'
              : 'أنشئ حساباً أو سجّل الدخول للانتقال لاحقاً إلى لوحة التحكم.'}
          </p>
        </div>
      </section>

      <section className="status-grid" aria-label="Project setup status">
        <article>
          <span className="status-icon" aria-hidden="true">OK</span>
          <div>
            <h2>React جاهز</h2>
            <p>واجهة أولية تعمل عبر Vite.</p>
          </div>
        </article>
        <article>
          <span className="status-icon" aria-hidden="true">API</span>
          <div>
            <h2>Express جاهز</h2>
            <p>API أولي على المسار /api/health.</p>
          </div>
        </article>
        <article>
          <span className="status-icon" aria-hidden="true">{isConnected ? 'ON' : 'OFF'}</span>
          <div>
            <h2>{isConnected ? 'Socket متصل' : 'Socket غير متصل'}</h2>
            <p>{isConnected ? 'التحديثات الفورية تعمل.' : 'تأكد من تشغيل السيرفر.'}</p>
          </div>
        </article>
      </section>

      {!user ? (
        <section className="demo-panel auth-panel" aria-label="Authentication form">
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={authMode === 'login' ? 'tab active' : 'tab'}
              onClick={() => setAuthMode('login')}
            >
              دخول
            </button>
            <button
              type="button"
              className={authMode === 'register' ? 'tab active' : 'tab'}
              onClick={() => setAuthMode('register')}
            >
              حساب جديد
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            {authMode === 'register' ? (
              <label>
                الاسم
                <input
                  value={authForm.name}
                  onChange={(event) => updateAuthForm('name', event.target.value)}
                  placeholder="اكتب اسمك"
                  autoComplete="name"
                />
              </label>
            ) : null}
            <label>
              البريد الإلكتروني
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => updateAuthForm('email', event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
            <label>
              كلمة المرور
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => updateAuthForm('password', event.target.value)}
                placeholder="6 أحرف على الأقل"
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
              />
            </label>
            {authError ? <p className="form-error">{authError}</p> : null}
            <button type="submit" disabled={isSubmittingAuth}>
              {isSubmittingAuth ? 'جاري المعالجة...' : authMode === 'register' ? 'إنشاء الحساب' : 'دخول'}
            </button>
          </form>
        </section>
      ) : (
        <section className="demo-panel" aria-label="Real-time message demo">
          <div className="session-bar">
            <div>
              <strong>{user.email}</strong>
              <p>الجلسة محفوظة محلياً في المتصفح.</p>
            </div>
            <button type="button" className="secondary-button" onClick={handleLogout}>
              خروج
            </button>
          </div>

          <form onSubmit={handleMessageSubmit} className="message-form">
          <label>
            الرسالة
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="اكتب رسالة تجريبية"
            />
          </label>
          <button type="submit" disabled={!isConnected}>
            إرسال
          </button>
          </form>

          <div className="messages">
            {messages.length === 0 ? (
              <p className="empty-state">لا توجد رسائل بعد.</p>
            ) : (
              messages.map((message) => (
                <article key={message.id} className="message">
                  <strong>{message.author}</strong>
                  <p>{message.text}</p>
                  <time dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleTimeString('ar')}
                  </time>
                </article>
              ))
            )}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;
