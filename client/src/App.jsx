import React, { useEffect, useRef, useState } from 'react';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { io } from 'socket.io-client';

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function DroppableColumn({ column, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });

  return (
    <section ref={setNodeRef} className={isOver ? 'kanban-column over' : 'kanban-column'}>
      {children}
    </section>
  );
}

function DraggableCard({ card, onOpen }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id
  });
  const style = {
    transform: CSS.Translate.toString(transform)
  };

  return (
    <article
      ref={setNodeRef}
      className={isDragging ? 'task-card dragging' : 'task-card'}
      style={style}
      onClick={() => onOpen(card.id)}
      {...listeners}
      {...attributes}
    >
      <h4>{card.title}</h4>
      {card.dueDate ? <span className="due-date">{card.dueDate}</span> : null}
      {card.description ? <p>{card.description}</p> : null}
    </article>
  );
}

function App() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const socketRef = useRef(null);
  const selectedCardIdRef = useRef('');
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
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite') || '');
  const [inviteInfo, setInviteInfo] = useState(null);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [activeBoard, setActiveBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [presenceUsers, setPresenceUsers] = useState([]);
  const [boardError, setBoardError] = useState('');
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [cardTitles, setCardTitles] = useState({});
  const [isCreatingCard, setIsCreatingCard] = useState('');
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardDetailsForm, setCardDetailsForm] = useState({ title: '', description: '', dueDate: '' });
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [cardDetailsError, setCardDetailsError] = useState('');
  const [isLoadingCardDetails, setIsLoadingCardDetails] = useState(false);
  const [isSavingCardDetails, setIsSavingCardDetails] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
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
    if (!inviteToken) {
      return;
    }

    setInviteError('');

    fetch(`${apiUrl}/api/invites/${inviteToken}`)
      .then((response) =>
        response.json().then((data) => {
          if (!response.ok) {
            throw new Error(data.message || 'Could not load invite');
          }

          return data;
        })
      )
      .then((data) => setInviteInfo(data.invite))
      .catch((error) => setInviteError(error.message));
  }, [inviteToken]);

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

    function handleCardMoved(payload) {
      moveCardInState(payload.card.id, payload.targetColumnId, payload.position, payload.card);
    }

    function handleCardUpdated(payload) {
      mergeCardInState(payload.card);

      if (selectedCardIdRef.current === payload.card.id) {
        setSelectedCard(payload.card);
        setCardDetailsForm({
          title: payload.card.title,
          description: payload.card.description || '',
          dueDate: payload.card.dueDate || ''
        });
      }
    }

    function handleCommentCreated(payload) {
      setComments((currentComments) => {
        if (
          selectedCardIdRef.current !== payload.cardId ||
          currentComments.some((comment) => comment.id === payload.comment.id)
        ) {
          return currentComments;
        }

        return [...currentComments, payload.comment];
      });
    }

    function handlePresence(payload) {
      setPresenceUsers(payload.users || []);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('demo:message', handleMessage);
    socket.on('board:card-created', handleCardCreated);
    socket.on('board:card-moved', handleCardMoved);
    socket.on('board:card-updated', handleCardUpdated);
    socket.on('board:comment-created', handleCommentCreated);
    socket.on('board:presence', handlePresence);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('demo:message', handleMessage);
      socket.off('board:card-created', handleCardCreated);
      socket.off('board:card-moved', handleCardMoved);
      socket.off('board:card-updated', handleCardUpdated);
      socket.off('board:comment-created', handleCommentCreated);
      socket.off('board:presence', handlePresence);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!selectedBoardId || !socketRef.current || !user) {
      return;
    }

    socketRef.current.emit('board:join', {
      boardId: selectedBoardId,
      user
    });

    return () => {
      socketRef.current?.emit('board:leave', selectedBoardId);
      setPresenceUsers([]);
    };
  }, [selectedBoardId, user]);

  useEffect(() => {
    selectedCardIdRef.current = selectedCardId;
  }, [selectedCardId]);

  function updateAuthForm(field, value) {
    setAuthForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  function getAuthHeaders() {
    return { Authorization: `Bearer ${token}` };
  }

  function moveCardInState(cardId, targetColumnId, targetPosition, updatedCard) {
    setColumns((currentColumns) => {
      let movedCard = updatedCard || null;
      const columnsWithoutCard = currentColumns.map((column) => {
        const remainingCards = column.cards.filter((card) => {
          if (card.id === cardId) {
            movedCard = updatedCard || { ...card, columnId: targetColumnId };
            return false;
          }

          return true;
        });

        return { ...column, cards: remainingCards };
      });

      if (!movedCard) {
        return currentColumns;
      }

      return columnsWithoutCard.map((column) => {
        if (column.id !== targetColumnId) {
          return column;
        }

        const nextCards = [...column.cards];
        const insertAt = Math.max(0, Math.min(targetPosition, nextCards.length));
        nextCards.splice(insertAt, 0, { ...movedCard, columnId: targetColumnId });

        return {
          ...column,
          cards: nextCards.map((card, index) => ({ ...card, position: index }))
        };
      });
    });
  }

  function mergeCardInState(updatedCard) {
    setColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        cards: column.cards.map((card) => (card.id === updatedCard.id ? { ...card, ...updatedCard } : card))
      }))
    );
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
    setPresenceUsers([]);
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
      setSelectedCardId('');
      setSelectedCard(null);
      setComments([]);
      setPresenceUsers([]);
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
    setPresenceUsers([]);
    setCardTitles({});
    setSelectedCardId('');
    setSelectedCard(null);
    setComments([]);
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

  async function handleCreateInvite() {
    if (!selectedBoardId) {
      return;
    }

    setInviteError('');
    setInviteNotice('');
    setIsCreatingInvite(true);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/invites`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not create invite');
      }

      const nextInviteLink = `${window.location.origin}${window.location.pathname}?invite=${data.invite.token}`;
      setInviteLink(nextInviteLink);
      setInviteNotice('تم إنشاء رابط الدعوة. صالح لمدة 7 أيام.');
    } catch (error) {
      setInviteError(error.message);
    } finally {
      setIsCreatingInvite(false);
    }
  }

  async function handleCopyInvite() {
    if (!inviteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteNotice('تم نسخ رابط الدعوة.');
    } catch {
      setInviteNotice('انسخ الرابط يدوياً من الحقل.');
    }
  }

  async function handleAcceptInvite() {
    if (!inviteToken || !token) {
      setInviteNotice('سجّل الدخول أولاً ثم اقبل الدعوة.');
      return;
    }

    setInviteError('');
    setInviteNotice('');
    setIsAcceptingInvite(true);

    try {
      const response = await fetch(`${apiUrl}/api/invites/${inviteToken}/accept`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not accept invite');
      }

      setBoards((currentBoards) =>
        currentBoards.some((board) => board.id === data.board.id)
          ? currentBoards
          : [data.board, ...currentBoards]
      );
      setInviteNotice('تم الانضمام للوحة بنجاح.');
      window.history.replaceState({}, '', window.location.pathname);
      setInviteToken('');
      setInviteInfo(null);
      openBoard(data.board.id);
    } catch (error) {
      setInviteError(error.message);
    } finally {
      setIsAcceptingInvite(false);
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

  async function handleDragEnd(event) {
    const { active, over } = event;

    if (!active || !over || !selectedBoardId) {
      return;
    }

    const cardId = active.id;
    const targetColumnId = over.id;
    const sourceColumn = columns.find((column) => column.cards.some((card) => card.id === cardId));
    const targetColumn = columns.find((column) => column.id === targetColumnId);

    if (!sourceColumn || !targetColumn || sourceColumn.id === targetColumnId) {
      return;
    }

    const targetPosition = targetColumn.cards.length;
    moveCardInState(cardId, targetColumnId, targetPosition);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/cards/${cardId}/move`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnId: targetColumnId,
          position: targetPosition
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not move card');
      }
    } catch (error) {
      setBoardError(error.message);
      openBoard(selectedBoardId);
    }
  }

  async function openCard(cardId) {
    setSelectedCardId(cardId);
    setSelectedCard(null);
    setComments([]);
    setCardDetailsError('');
    setIsLoadingCardDetails(true);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/cards/${cardId}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not load card');
      }

      setSelectedCard(data.card);
      setCardDetailsForm({
        title: data.card.title,
        description: data.card.description || '',
        dueDate: data.card.dueDate || ''
      });
      setComments(data.comments);
    } catch (error) {
      setCardDetailsError(error.message);
    } finally {
      setIsLoadingCardDetails(false);
    }
  }

  function closeCard() {
    setSelectedCardId('');
    setSelectedCard(null);
    setComments([]);
    setCommentBody('');
    setCardDetailsError('');
  }

  async function handleSaveCardDetails(event) {
    event.preventDefault();

    if (!selectedCardId) {
      return;
    }

    setCardDetailsError('');
    setIsSavingCardDetails(true);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/cards/${selectedCardId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(cardDetailsForm)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not save card');
      }

      setSelectedCard(data.card);
      mergeCardInState(data.card);
    } catch (error) {
      setCardDetailsError(error.message);
    } finally {
      setIsSavingCardDetails(false);
    }
  }

  async function handleAddComment(event) {
    event.preventDefault();
    const body = commentBody.trim();

    if (!body || !selectedCardId) {
      return;
    }

    setCardDetailsError('');
    setIsAddingComment(true);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/cards/${selectedCardId}/comments`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not add comment');
      }

      setComments((currentComments) =>
        currentComments.some((comment) => comment.id === data.comment.id)
          ? currentComments
          : [...currentComments, data.comment]
      );
      setCommentBody('');
    } catch (error) {
      setCardDetailsError(error.message);
    } finally {
      setIsAddingComment(false);
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

  const activeBoardTitle = activeBoard?.title || 'لوحة الكانبان';

  return (
    <main className={user ? 'workspace-shell' : 'app-shell'}>
      {user ? (
        <>
          <aside className="workspace-sidebar" aria-label="Workspace navigation">
            <div className="brand-block">
              <div className="brand-mark">ت</div>
              <div>
                <strong>تدفق</strong>
                <span>Tadafuq Cloud</span>
              </div>
            </div>

            <div className="workspace-card">
              <span>مساحة العمل</span>
              <strong>{user.name}</strong>
            </div>

            <nav className="side-nav" aria-label="Main navigation">
              <a className="active" href="#boards">لوحات العمل</a>
              <a href="#kanban">لوحة الكانبان</a>
              <a href="#presence">الفريق المتصل</a>
              <a href="#activity">النشاط والتعليقات</a>
            </nav>

            <div className="sidebar-footer">
              <span>Socket.io</span>
              <strong>{isConnected ? 'متصل الآن' : 'غير متصل'}</strong>
            </div>
          </aside>

          <header className="workspace-topbar">
            <div>
              <span>المشاريع البرمجية</span>
              <strong>{activeBoardTitle}</strong>
            </div>
            <div className="topbar-actions">
              <span className={isConnected ? 'live-pill online' : 'live-pill'}>مزامنة فورية</span>
              <button type="button" className="secondary-button">تصفية</button>
              <button type="button" className="secondary-button" onClick={handleCreateInvite} disabled={!selectedBoardId}>
                مشاركة
              </button>
            </div>
          </header>
        </>
      ) : null}

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
        <>
        {inviteToken ? (
          <section className="invite-panel" aria-label="Board invitation">
            <span className="invite-kicker">دعوة لوحة عمل</span>
            <h2>{inviteInfo ? inviteInfo.boardTitle : 'جاري تحميل الدعوة...'}</h2>
            <p>
              {inviteInfo
                ? `${inviteInfo.inviterName} دعاك للانضمام لهذه اللوحة. سجّل الدخول أو أنشئ حساباً ثم اقبل الدعوة.`
                : 'نجهّز تفاصيل الدعوة.'}
            </p>
            {inviteError ? <p className="form-error">{inviteError}</p> : null}
            {inviteNotice ? <p className="form-success">{inviteNotice}</p> : null}
          </section>
        ) : null}

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
        </>
      ) : (
        <>
          {inviteToken ? (
            <section className="invite-panel" aria-label="Board invitation">
              <span className="invite-kicker">دعوة لوحة عمل</span>
              <h2>{inviteInfo ? inviteInfo.boardTitle : 'جاري تحميل الدعوة...'}</h2>
              <p>
                {inviteInfo
                  ? `${inviteInfo.inviterName} دعاك للانضمام لهذه اللوحة.`
                  : 'نجهّز تفاصيل الدعوة.'}
              </p>
              {inviteError ? <p className="form-error">{inviteError}</p> : null}
              {inviteNotice ? <p className="form-success">{inviteNotice}</p> : null}
              <button type="button" onClick={handleAcceptInvite} disabled={isAcceptingInvite || !inviteInfo}>
                {isAcceptingInvite ? 'جاري الانضمام...' : 'قبول الدعوة'}
              </button>
            </section>
          ) : null}

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
              <div className="board-header" id="kanban">
                <div>
                  <p className="eyebrow">Live Kanban Board</p>
                  <h2>{activeBoard?.title || 'جاري فتح اللوحة...'}</h2>
                </div>
                <div className="presence-strip" aria-label="Users currently viewing this board">
                  {presenceUsers.length === 0 ? (
                    <span className="presence-empty">بانتظار أعضاء الفريق</span>
                  ) : (
                    presenceUsers.map((presenceUser) => (
                      <span key={presenceUser.socketId} className="presence-user" title={presenceUser.email}>
                        {presenceUser.name.slice(0, 2)}
                      </span>
                    ))
                  )}
                  {presenceUsers.length > 0 ? (
                    <span className="presence-label">{presenceUsers.length} متصل الآن</span>
                  ) : null}
                </div>
                <button type="button" className="secondary-button" onClick={() => setSelectedBoardId('')}>
                  رجوع
                </button>
              </div>

              {boardError ? <p className="form-error">{boardError}</p> : null}
              {inviteError ? <p className="form-error">{inviteError}</p> : null}
              {inviteNotice ? <p className="form-success">{inviteNotice}</p> : null}

              <section className="share-panel" aria-label="Invite members">
                <div>
                  <span className="invite-kicker">مشاركة اللوحة</span>
                  <h3>دعوة عضو برابط مباشر</h3>
                  <p>أنشئ رابطاً صالحاً لمدة 7 أيام، وأرسله لأي زميل لينضم لهذه اللوحة.</p>
                </div>
                <div className="share-actions">
                  <button type="button" onClick={handleCreateInvite} disabled={isCreatingInvite}>
                    {isCreatingInvite ? 'جاري الإنشاء...' : 'إنشاء رابط دعوة'}
                  </button>
                  {inviteLink ? (
                    <>
                      <input readOnly value={inviteLink} aria-label="Invite link" />
                      <button type="button" className="secondary-button" onClick={handleCopyInvite}>
                        نسخ الرابط
                      </button>
                    </>
                  ) : null}
                </div>
              </section>

              {isLoadingBoard ? (
                <p className="empty-state">جاري تحميل اللوحة...</p>
              ) : (
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                  <div className="kanban-board">
                    {columns.map((column) => (
                      <DroppableColumn key={column.id} column={column}>
                        <header>
                          <h3>{column.title}</h3>
                          <span>{column.cards.length}</span>
                        </header>

                        <div className="card-list">
                          {column.cards.length === 0 ? (
                            <p className="column-empty">اسحب بطاقة إلى هنا.</p>
                          ) : (
                            column.cards.map((card) => (
                              <DraggableCard key={card.id} card={card} onOpen={openCard} />
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
                      </DroppableColumn>
                    ))}
                  </div>
                </DndContext>
              )}

              {selectedCardId ? (
                <aside className="card-details" aria-label="Card details">
                  <div className="card-details-header">
                    <div>
                      <p className="eyebrow">Card</p>
                      <h3>{selectedCard?.title || 'جاري فتح البطاقة...'}</h3>
                    </div>
                    <button type="button" className="secondary-button" onClick={closeCard}>
                      إغلاق
                    </button>
                  </div>

                  {cardDetailsError ? <p className="form-error">{cardDetailsError}</p> : null}

                  {isLoadingCardDetails ? (
                    <p className="empty-state">جاري تحميل تفاصيل البطاقة...</p>
                  ) : selectedCard ? (
                    <>
                      <form className="details-form" onSubmit={handleSaveCardDetails}>
                        <label>
                          عنوان البطاقة
                          <input
                            value={cardDetailsForm.title}
                            onChange={(event) =>
                              setCardDetailsForm((currentForm) => ({
                                ...currentForm,
                                title: event.target.value
                              }))
                            }
                            placeholder="عنوان البطاقة"
                          />
                        </label>
                        <label>
                          الوصف
                          <textarea
                            value={cardDetailsForm.description}
                            onChange={(event) =>
                              setCardDetailsForm((currentForm) => ({
                                ...currentForm,
                                description: event.target.value
                              }))
                            }
                            placeholder="اكتب وصف المهمة"
                            rows="4"
                          />
                        </label>
                        <label>
                          تاريخ الاستحقاق
                          <input
                            type="date"
                            value={cardDetailsForm.dueDate}
                            onChange={(event) =>
                              setCardDetailsForm((currentForm) => ({
                                ...currentForm,
                                dueDate: event.target.value
                              }))
                            }
                          />
                        </label>
                        <button type="submit" disabled={isSavingCardDetails}>
                          {isSavingCardDetails ? 'جاري الحفظ...' : 'حفظ التفاصيل'}
                        </button>
                      </form>

                      <section className="comments-panel" aria-label="Card comments">
                        <h3>التعليقات</h3>
                        <form className="comment-form" onSubmit={handleAddComment}>
                          <textarea
                            value={commentBody}
                            onChange={(event) => setCommentBody(event.target.value)}
                            placeholder="اكتب تعليقاً"
                            rows="3"
                          />
                          <button type="submit" disabled={isAddingComment}>
                            {isAddingComment ? 'جاري الإضافة...' : 'إضافة تعليق'}
                          </button>
                        </form>

                        <div className="comments-list">
                          {comments.length === 0 ? (
                            <p className="column-empty">لا توجد تعليقات بعد.</p>
                          ) : (
                            comments.map((comment) => (
                              <article key={comment.id} className="comment-card">
                                <strong>{comment.authorName}</strong>
                                <p>{comment.body}</p>
                                <time dateTime={comment.createdAt}>
                                  {new Date(comment.createdAt).toLocaleString('ar')}
                                </time>
                              </article>
                            ))
                          )}
                        </div>
                      </section>
                    </>
                  ) : null}
                </aside>
              ) : null}
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
