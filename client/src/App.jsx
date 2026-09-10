import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem('collab-token') || '');
  const [user, setUser] = useState(null);
  const [boards, setBoards] = useState([]);
  const [boardTitle, setBoardTitle] = useState('');
  const [boardsError, setBoardsError] = useState('');
  const [isLoadingBoards, setIsLoadingBoards] = useState(false);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [activeBoard, setActiveBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [boardError, setBoardError] = useState('');
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [cardTitles, setCardTitles] = useState({});
  const [isCreatingCard, setIsCreatingCard] = useState('');
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!token) {
      return;
    }

    fetch(`${apiUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
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
        setBoards([]);
        setSelectedBoardId('');
        setActiveBoard(null);
        setColumns([]);
      });
  }, [token]);

  useEffect(() => {
    if (user && token) {
      loadBoards();
    }
  }, [user, token]);

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

    function handleCardCreated(payload) {
      setColumns((currentColumns) =>
        currentColumns.map((column) => {
          if (column.id !== payload.columnId) {
            return column;
          }

          if (column.cards.some((card) => card.id === payload.card.id)) {
            return column;
          }

          return { ...column, cards: [...column.cards, payload.card] };
        })
      );
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('demo:message', handleMessage);
    socket.on('board:card-created', handleCardCreated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('demo:message', handleMessage);
      socket.off('board:card-created', handleCardCreated);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selectedBoardId || !socketRef.current) {
      return;
    }

    socketRef.current.emit('board:join', selectedBoardId);

    return () => {
      socketRef.current?.emit('board:leave', selectedBoardId);
    };
  }, [selectedBoardId]);

  function updateAuthForm(field, value) {
    setAuthForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function getAuthHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  async function loadBoards() {
    setBoardsError('');
    setIsLoadingBoards(true);

    try {
      const response = await fetch(`${apiUrl}/api/boards`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not load boards');
      }

      setBoards(data.boards);
    } catch (error) {
      setBoardsError(error.message);
    } finally {
      setIsLoadingBoards(false);
    }
  }

  async function openBoard(boardId) {
    setSelectedBoardId(boardId);
    setActiveBoard(null);
    setColumns([]);
    setBoardError('');
    setIsLoadingBoard(true);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${boardId}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not load board');
      }

      setActiveBoard(data.board);
      setColumns(data.columns);
    } catch (error) {
      setBoardError(error.message);
    } finally {
      setIsLoadingBoard(false);
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthError('');
    setIsSubmittingAuth(true);

    const endpoint = authMode === 'register' ? 'register' : 'login';
    const body = authMode === 'register'
      ? authForm
      : { email: authForm.email, password: authForm.password };

    try {
      const response = await fetch(`${apiUrl}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      localStorage.setItem('collab-token', data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthForm({ name: '', email: '', password: '' });
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
    setBoards([]);
    setBoardTitle('');
    setSelectedBoardId('');
    setActiveBoard(null);
    setColumns([]);
    setCardTitles({});
    setMessages([]);
  }

  async function handleCreateBoard(event) {
    event.preventDefault();
    const title = boardTitle.trim();

    if (!title) {
      return;
    }

    setBoardsError('');
    setIsCreatingBoard(true);

    try {
      const response = await fetch(`${apiUrl}/api/boards`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not create board');
      }

      setBoards((currentBoards) => [data.board, ...currentBoards]);
      setBoardTitle('');
      openBoard(data.board.id);
    } catch (error) {
      setBoardsError(error.message);
    } finally {
      setIsCreatingBoard(false);
    }
  }

  async function handleCreateCard(event, columnId) {
    event.preventDefault();
    const title = String(cardTitles[columnId] || '').trim();

    if (!title) {
      return;
    }

    setBoardError('');
    setIsCreatingCard(columnId);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/columns/${columnId}/cards`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not create card');
      }

      setColumns((currentColumns) =>
        currentColumns.map((column) => {
          if (column.id !== columnId || column.cards.some((card) => card.id === data.card.id)) {
            return column;
          }

          return { ...column, cards: [...column.cards, data.card] };
        })
      );
      setCardTitles((currentTitles) => ({ ...currentTitles, [columnId]: '' }));
    } catch (error) {
      setBoardError(error.message);
    } finally {
      setIsCreatingCard('');
    }
  }

  function handleMessageSubmit(event) {
    event.preventDefault();
    const trimmedText = text.trim();

    if (!trimmedText || !socketRef.current) {
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
        <div className="mark">RT</div>
        <div>
          <p className="eyebrow">Real-Time Collaboration Tool</p>
          <h1>{user ? `مرحباً ${user.name}` : 'تسجيل الدخول'}</h1>
          <p className="lede">
            {user
              ? 'افتح لوحة عمل لإدارة الأعمدة والبطاقات، ثم سنضيف السحب والإفلات في الخطوة القادمة.'
              : 'أنشئ حساباً أو سجّل الدخول للانتقال إلى لوحة التحكم.'}
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
        <>
          <section className="dashboard-panel" aria-label="Boards dashboard">
            <div className="session-bar">
              <div>
                <strong>{user.email}</strong>
                <p>الجلسة محفوظة محلياً في المتصفح.</p>
              </div>
              <button type="button" className="secondary-button" onClick={handleLogout}>
                خروج
              </button>
            </div>

            <form onSubmit={handleCreateBoard} className="board-form">
              <label>
                اسم اللوحة
                <input
                  value={boardTitle}
                  onChange={(event) => setBoardTitle(event.target.value)}
                  placeholder="مثلاً: مشروع التخرج"
                />
              </label>
              <button type="submit" disabled={isCreatingBoard}>
                {isCreatingBoard ? 'جاري الإنشاء...' : 'إنشاء لوحة'}
              </button>
            </form>

            {boardsError ? <p className="form-error">{boardsError}</p> : null}

            <div className="boards-list">
              {isLoadingBoards ? (
                <p className="empty-state">جاري تحميل اللوحات...</p>
              ) : boards.length === 0 ? (
                <p className="empty-state">ما عندك أي لوحة عمل بعد، ابدأ بإنشاء واحدة.</p>
              ) : (
                boards.map((board) => (
                  <article key={board.id} className="board-card">
                    <div>
                      <h2>{board.title}</h2>
                      <p>تم إنشاء الأعمدة الافتراضية لهذه اللوحة.</p>
                    </div>
                    <button type="button" className="small-button" onClick={() => openBoard(board.id)}>
                      فتح
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>

          {selectedBoardId ? (
            <section className="board-panel" aria-label="Selected board">
              <div className="board-header">
                <div>
                  <p className="eyebrow">Board</p>
                  <h2>{activeBoard?.title || 'جاري فتح اللوحة...'}</h2>
                </div>
                <button type="button" className="secondary-button" onClick={() => setSelectedBoardId('')}>
                  رجوع
                </button>
              </div>

              {boardError ? <p className="form-error">{boardError}</p> : null}

              {isLoadingBoard ? (
                <p className="empty-state">جاري تحميل اللوحة...</p>
              ) : (
                <div className="kanban-board">
                  {columns.map((column) => (
                    <section key={column.id} className="kanban-column">
                      <header>
                        <h3>{column.title}</h3>
                        <span>{column.cards.length}</span>
                      </header>

                      <div className="card-list">
                        {column.cards.length === 0 ? (
                          <p className="column-empty">لا توجد بطاقات.</p>
                        ) : (
                          column.cards.map((card) => (
                            <article key={card.id} className="task-card">
                              <h4>{card.title}</h4>
                              {card.description ? <p>{card.description}</p> : null}
                            </article>
                          ))
                        )}
                      </div>

                      <form className="card-form" onSubmit={(event) => handleCreateCard(event, column.id)}>
                        <input
                          value={cardTitles[column.id] || ''}
                          onChange={(event) =>
                            setCardTitles((currentTitles) => ({
                              ...currentTitles,
                              [column.id]: event.target.value
                            }))
                          }
                          placeholder="إضافة بطاقة"
                        />
                        <button type="submit" disabled={isCreatingCard === column.id}>
                          {isCreatingCard === column.id ? '...' : 'إضافة'}
                        </button>
                      </form>
                    </section>
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <section className="demo-panel" aria-label="Real-time message demo">
            <div>
              <h2 className="section-title">اختبار التحديث الفوري</h2>
              <p className="section-copy">افتح الصفحة في نافذتين، وأرسل رسالة للتأكد أن الاتصال الحي يعمل.</p>
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
        </>
      )}
    </main>
  );
}

export default App;
