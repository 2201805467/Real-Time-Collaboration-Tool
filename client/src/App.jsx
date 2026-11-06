import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { io } from 'socket.io-client';
import {
  Calendar,
  Check,
  CircleCheck,
  ClipboardCheck,
  FolderOpen,
  Flag,
  FolderKanban,
  Gauge,
  Grid2X2,
  KanbanSquare,
  LifeBuoy,
  Link,
  ListChecks,
  LogOut,
  MessageSquare,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Plus,
  Radar,
  Save,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Trash2,
  UserRound,
  UsersRound,
  Wifi,
  Zap
} from 'lucide-react';

const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000';
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    await response.text();
    throw new Error(
      response.ok
        ? 'استلم التطبيق رداً غير صالح من السيرفر.'
        : `تعذر الوصول إلى API الصحيح (HTTP ${response.status}). تأكد أن السيرفر يعمل على المنفذ 4000.`
    );
  }

  return response.json();
}

const priorityStyles = {
  urgent: 'bg-error-container text-on-error-container',
  medium: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  normal: 'bg-surface-container text-on-surface-variant'
};

const columnDotStyles = ['bg-outline', 'bg-primary-container animate-pulse', 'bg-tertiary-container', 'bg-secondary'];
const tagStyles = [
  'bg-primary-fixed text-on-primary-fixed-variant',
  'bg-secondary-container text-on-secondary-container',
  'bg-surface-container-highest text-on-surface',
  'bg-tertiary-fixed text-on-tertiary-fixed-variant'
];

const emptyWorkspaceStats = {
  boards: { total: 0, owned: 0, shared: 0 },
  cards: { total: 0, completed: 0, completedThisWeek: 0 },
  checklist: { total: 0, completed: 0 },
  velocity: 0,
  storage: { usedPercent: 0, usedLabel: '0 GB', limitLabel: '20 GB' }
};

function getChecklistProgress(card) {
  if (!card.checklistTotal) {
    return 0;
  }

  return Math.round((card.completedChecklistItems / card.checklistTotal) * 100);
}

const priorityLabels = {
  urgent: 'عاجل',
  medium: 'متوسط',
  normal: 'عادي'
};

const roleLabels = {
  owner: 'مالك',
  manager: 'مسؤول',
  member: 'عضو'
};

function DroppableColumn({ column, index, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={`kanban-column flex flex-col rounded-2xl bg-surface-container-low/80 p-space-md shadow-stitch transition-all ${
        isOver ? 'over ring-2 ring-primary-container bg-primary-fixed' : ''
      }`}
      data-column-tone={index % columnDotStyles.length}
    >
      {children}
    </section>
  );
}

function DraggableCard({ card, onOpen, canMove }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: !canMove
  });
  const style = {
    transform: CSS.Translate.toString(transform)
  };
  const progress = getChecklistProgress(card);

  return (
    <article
      ref={setNodeRef}
      className={`task-card group rounded-xl bg-surface-container-lowest p-space-md shadow-stitch transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card ${
        canMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${isDragging ? 'dragging opacity-75 shadow-card' : ''}`}
      style={style}
      onClick={() => onOpen(card.id)}
      {...(canMove ? listeners : {})}
      {...attributes}
    >
      <div className="flex items-start justify-between gap-space-sm">
        {card.tags?.[0] ? (
          <span className={`max-w-[62%] truncate rounded-full px-2 py-0.5 text-label-sm font-semibold ${tagStyles[0]}`}>
            {card.tags[0]}
          </span>
        ) : (
          <span className="rounded-full bg-surface-container px-2 py-0.5 text-label-sm font-semibold text-on-surface-variant">
            General
          </span>
        )}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm font-semibold ${
            priorityStyles[card.priority] || priorityStyles.normal
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {priorityLabels[card.priority] || priorityLabels.normal}
        </span>
      </div>

      <h4 className="text-headline-sm font-semibold leading-6 text-on-surface transition-colors group-hover:text-primary">
        {card.title}
      </h4>

      {card.description ? <p className="line-clamp-2 text-body-sm leading-5 text-on-surface-variant">{card.description}</p> : null}

      {card.checklistTotal ? (
        <div className="grid gap-1 rounded-lg bg-surface-container-low p-2">
          <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1">
              <ListChecks size={15} aria-hidden="true" />
              <span>Checklist</span>
            </span>
            <span className="font-code font-semibold text-on-surface">
              {card.completedChecklistItems}/{card.checklistTotal}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-high">
            <span className="block h-full rounded-full bg-primary-container" style={{ width: `${progress}%` }} />
          </div>
        </div>
      ) : null}

      {card.tags?.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {card.tags.slice(1, 4).map((tag, index) => (
            <span key={tag} className={`rounded-full px-2 py-0.5 text-label-sm font-semibold ${tagStyles[(index + 1) % tagStyles.length]}`}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-space-sm pt-space-xs">
        {card.assigneeName ? (
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full bg-tertiary-container text-[10px] font-semibold text-on-tertiary ring-2 ring-surface-container-lowest"
            title={card.assigneeName}
          >
            {card.assigneeName.slice(0, 2)}
          </span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-highest text-[10px] font-semibold text-on-surface-variant ring-2 ring-surface-container-lowest">
            --
          </span>
        )}
        <div className="flex items-center gap-3 text-label-sm text-on-surface-variant">
          {card.checklistTotal ? (
            <span className="inline-flex items-center gap-1">
              <CircleCheck size={15} aria-hidden="true" />
              <span>{progress}%</span>
            </span>
          ) : null}
          {card.dueDate ? (
            <span className="inline-flex items-center gap-1">
              <Calendar size={15} aria-hidden="true" />
              <span>{card.dueDate}</span>
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function App() {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const socketRef = useRef(null);
  const selectedCardIdRef = useRef('');
  const userRef = useRef(null);
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
  const [editingBoardTitle, setEditingBoardTitle] = useState('');
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [columnDrafts, setColumnDrafts] = useState({});
  const [presenceUsers, setPresenceUsers] = useState([]);
  const [boardError, setBoardError] = useState('');
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [isSavingBoard, setIsSavingBoard] = useState(false);
  const [isDeletingBoard, setIsDeletingBoard] = useState(false);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [savingColumnId, setSavingColumnId] = useState('');
  const [deletingColumnId, setDeletingColumnId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [boardMembers, setBoardMembers] = useState([]);
  const [removingMemberId, setRemovingMemberId] = useState('');
  const [updatingMemberRoleId, setUpdatingMemberRoleId] = useState('');
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamRoleFilter, setTeamRoleFilter] = useState('all');
  const [activeSidebarSection, setActiveSidebarSection] = useState('overview');
  const [cardTitles, setCardTitles] = useState({});
  const [isCreatingCard, setIsCreatingCard] = useState('');
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardDetailsForm, setCardDetailsForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    assigneeId: '',
    priority: 'normal',
    tags: [],
    tagDraft: '',
    checklist: []
  });
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [cardDetailsError, setCardDetailsError] = useState('');
  const [isLoadingCardDetails, setIsLoadingCardDetails] = useState(false);
  const [isSavingCardDetails, setIsSavingCardDetails] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [workspaceStats, setWorkspaceStats] = useState(emptyWorkspaceStats);
  const [workspaceActivity, setWorkspaceActivity] = useState([]);

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
    if (!user) {
      return undefined;
    }

    function syncBoardFromHash() {
      const hash = window.location.hash;
      if (hash && !hash.startsWith('#board=')) {
        return;
      }

      const boardIdFromHash = hash.startsWith('#board=')
        ? decodeURIComponent(hash.replace('#board=', ''))
        : '';

      if (boardIdFromHash && boardIdFromHash !== selectedBoardId) {
        openBoard(boardIdFromHash, false);
      }

      if (!boardIdFromHash && selectedBoardId) {
        closeBoard(false);
      }
    }

    syncBoardFromHash();
    window.addEventListener('hashchange', syncBoardFromHash);

    return () => window.removeEventListener('hashchange', syncBoardFromHash);
  }, [user, selectedBoardId]);

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
    if (!token) {
      setIsConnected(false);
      return undefined;
    }

    const socket = io(socketUrl, {
      auth: { token }
    });
    socketRef.current = socket;

    function handleConnect() {
      setIsConnected(true);
    }

    function handleDisconnect() {
      setIsConnected(false);
    }

    function handleConnectError(error) {
      setIsConnected(false);

      if (error.message === 'Unauthorized') {
        localStorage.removeItem('collab-token');
        setToken('');
        setUser(null);
        setBoards([]);
        closeBoard(false);
        setAuthError('انتهت الجلسة أو أنها غير صالحة. سجل الدخول من جديد.');
      }
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

    function handleBoardUpdated(payload) {
      setBoards((currentBoards) =>
        currentBoards.map((board) =>
          board.id === payload.board.id
            ? { ...board, title: payload.board.title, updatedAt: payload.board.updatedAt }
            : board
        )
      );
      setActiveBoard((currentBoard) =>
        currentBoard?.id === payload.board.id
          ? { ...currentBoard, title: payload.board.title, updatedAt: payload.board.updatedAt }
          : currentBoard
      );
    }

    function handleBoardDeleted(payload) {
      setBoards((currentBoards) => currentBoards.filter((board) => board.id !== payload.boardId));
      setSelectedBoardId((currentBoardId) => {
        if (currentBoardId !== payload.boardId) {
          return currentBoardId;
        }

        closeBoard(false);
        return '';
      });
    }

    function handleColumnCreated(payload) {
      setColumns((currentColumns) => {
        if (currentColumns.some((column) => column.id === payload.column.id)) {
          return currentColumns;
        }

        return [...currentColumns, { ...payload.column, cards: [] }];
      });
      setColumnDrafts((currentDrafts) => ({
        ...currentDrafts,
        [payload.column.id]: payload.column.title
      }));
    }

    function handleColumnUpdated(payload) {
      setColumns((currentColumns) =>
        currentColumns.map((column) =>
          column.id === payload.column.id ? { ...column, title: payload.column.title } : column
        )
      );
      setColumnDrafts((currentDrafts) => ({
        ...currentDrafts,
        [payload.column.id]: payload.column.title
      }));
    }

    function handleColumnDeleted(payload) {
      setColumns((currentColumns) => currentColumns.filter((column) => column.id !== payload.columnId));
      setColumnDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[payload.columnId];
        return nextDrafts;
      });
      setCardTitles((currentTitles) => {
        const nextTitles = { ...currentTitles };
        delete nextTitles[payload.columnId];
        return nextTitles;
      });
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
          dueDate: payload.card.dueDate || '',
          assigneeId: payload.card.assigneeId || '',
          priority: payload.card.priority || 'normal',
          tags: payload.card.tags || [],
          tagDraft: '',
          checklist: payload.card.checklist || []
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

    function handleCardDeleted(payload) {
      removeCardFromState(payload.cardId);

      if (selectedCardIdRef.current === payload.cardId) {
        closeCard();
      }
    }

    function handleMemberRemoved(payload) {
      setBoardMembers((currentMembers) => currentMembers.filter((member) => member.id !== payload.memberId));
      setColumns((currentColumns) =>
        currentColumns.map((column) => ({
          ...column,
          cards: column.cards.map((card) =>
            card.assigneeId === payload.memberId
              ? {
                ...card,
                assigneeId: '',
                assigneeName: '',
                checklist: card.checklist?.map((item) =>
                  item.assigneeId === payload.memberId ? { ...item, assigneeId: '' } : item
                )
              }
              : {
                ...card,
                checklist: card.checklist?.map((item) =>
                  item.assigneeId === payload.memberId ? { ...item, assigneeId: '' } : item
                )
              }
          )
        }))
      );
      setSelectedCard((currentCard) =>
        currentCard
          ? {
            ...currentCard,
            assigneeId: currentCard.assigneeId === payload.memberId ? '' : currentCard.assigneeId,
            assigneeName: currentCard.assigneeId === payload.memberId ? '' : currentCard.assigneeName,
            checklist: currentCard.checklist?.map((item) =>
              item.assigneeId === payload.memberId ? { ...item, assigneeId: '' } : item
            )
          }
          : currentCard
      );
      setCardDetailsForm((currentForm) => ({
        ...currentForm,
        assigneeId: currentForm.assigneeId === payload.memberId ? '' : currentForm.assigneeId,
        checklist: currentForm.checklist.map((item) =>
          item.assigneeId === payload.memberId ? { ...item, assigneeId: '' } : item
        )
      }));

      if (userRef.current?.id === payload.memberId) {
        closeBoard();
      }
    }

    function handleMemberUpdated(payload) {
      setBoardMembers((currentMembers) =>
        currentMembers.map((member) => (member.id === payload.member.id ? payload.member : member))
      );

      if (payload.member.role === 'member') {
        setColumns((currentColumns) =>
          currentColumns.map((column) => ({
            ...column,
            cards: column.cards.map((card) =>
              card.assigneeId === payload.member.id ? { ...card, assigneeId: '', assigneeName: '' } : card
            )
          }))
        );
        setSelectedCard((currentCard) =>
          currentCard?.assigneeId === payload.member.id ? { ...currentCard, assigneeId: '', assigneeName: '' } : currentCard
        );
        setCardDetailsForm((currentForm) => ({
          ...currentForm,
          assigneeId: currentForm.assigneeId === payload.member.id ? '' : currentForm.assigneeId
        }));
      }
    }

    function handlePresence(payload) {
      setPresenceUsers(payload.users || []);
    }

    function handleAccessRevoked(payload) {
      setBoards((currentBoards) => currentBoards.filter((board) => board.id !== payload.boardId));
      closeBoard();
      setBoardsError('تمت إزالة عضويتك من هذه اللوحة.');
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('board:updated', handleBoardUpdated);
    socket.on('board:deleted', handleBoardDeleted);
    socket.on('board:column-created', handleColumnCreated);
    socket.on('board:column-updated', handleColumnUpdated);
    socket.on('board:column-deleted', handleColumnDeleted);
    socket.on('board:card-created', handleCardCreated);
    socket.on('board:card-moved', handleCardMoved);
    socket.on('board:card-updated', handleCardUpdated);
    socket.on('board:card-deleted', handleCardDeleted);
    socket.on('board:member-removed', handleMemberRemoved);
    socket.on('board:member-updated', handleMemberUpdated);
    socket.on('board:comment-created', handleCommentCreated);
    socket.on('board:presence', handlePresence);
    socket.on('board:access-revoked', handleAccessRevoked);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('board:updated', handleBoardUpdated);
      socket.off('board:deleted', handleBoardDeleted);
      socket.off('board:column-created', handleColumnCreated);
      socket.off('board:column-updated', handleColumnUpdated);
      socket.off('board:column-deleted', handleColumnDeleted);
      socket.off('board:card-created', handleCardCreated);
      socket.off('board:card-moved', handleCardMoved);
      socket.off('board:card-updated', handleCardUpdated);
      socket.off('board:card-deleted', handleCardDeleted);
      socket.off('board:member-removed', handleMemberRemoved);
      socket.off('board:member-updated', handleMemberUpdated);
      socket.off('board:comment-created', handleCommentCreated);
      socket.off('board:presence', handlePresence);
      socket.off('board:access-revoked', handleAccessRevoked);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!selectedBoardId || !socket || !user || !isConnected) {
      return undefined;
    }

    socket.emit('board:join', { boardId: selectedBoardId }, (result) => {
      if (!result?.ok) {
        setBoardError(result?.message || 'تعذر الانضمام إلى التحديثات الفورية لهذه اللوحة.');
      }
    });

    return () => {
      if (socket.connected) {
        socket.emit('board:leave', selectedBoardId);
      }
      setPresenceUsers([]);
    };
  }, [selectedBoardId, user, isConnected]);

  useEffect(() => {
    selectedCardIdRef.current = selectedCardId;
  }, [selectedCardId]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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

  function removeCardFromState(cardId) {
    setColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        cards: column.cards
          .filter((card) => card.id !== cardId)
          .map((card, index) => ({ ...card, position: index }))
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
      loadWorkspaceOverview();
    } catch (error) {
      setBoardsError(error.message);
    } finally {
      setIsLoadingBoards(false);
    }
  }

  async function loadWorkspaceOverview() {
    try {
      const [statsResponse, activityResponse] = await Promise.all([
        fetch(`${apiUrl}/api/workspace/stats`, { headers: getAuthHeaders() }),
        fetch(`${apiUrl}/api/workspace/activity`, { headers: getAuthHeaders() })
      ]);
      const [statsData, activityData] = await Promise.all([
        statsResponse.json(),
        activityResponse.json()
      ]);

      if (statsResponse.ok) {
        setWorkspaceStats(statsData.stats || emptyWorkspaceStats);
      }

      if (activityResponse.ok) {
        setWorkspaceActivity(activityData.activity || []);
      }
    } catch {
      setWorkspaceStats(emptyWorkspaceStats);
      setWorkspaceActivity([]);
    }
  }

  async function loadBoardMembers(boardId) {
    try {
      const response = await fetch(`${apiUrl}/api/boards/${boardId}/members`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not load board members');
      }

      setBoardMembers(data.members);
    } catch (error) {
      setBoardError(error.message);
      setBoardMembers([]);
    }
  }

  async function handleRemoveMember(memberId) {
    if (!selectedBoardId || !window.confirm('هل تريد إزالة هذا العضو من اللوحة؟')) {
      return;
    }

    setBoardError('');
    setRemovingMemberId(memberId);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/members/${memberId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not remove member');
      }

      setBoardMembers((currentMembers) => currentMembers.filter((member) => member.id !== memberId));
      setColumns((currentColumns) =>
        currentColumns.map((column) => ({
          ...column,
          cards: column.cards.map((card) =>
            card.assigneeId === memberId
              ? {
                ...card,
                assigneeId: '',
                assigneeName: '',
                checklist: card.checklist?.map((item) =>
                  item.assigneeId === memberId ? { ...item, assigneeId: '' } : item
                )
              }
              : {
                ...card,
                checklist: card.checklist?.map((item) =>
                  item.assigneeId === memberId ? { ...item, assigneeId: '' } : item
                )
              }
          )
        }))
      );
      setSelectedCard((currentCard) =>
        currentCard
          ? {
            ...currentCard,
            assigneeId: currentCard.assigneeId === memberId ? '' : currentCard.assigneeId,
            assigneeName: currentCard.assigneeId === memberId ? '' : currentCard.assigneeName,
            checklist: currentCard.checklist?.map((item) =>
              item.assigneeId === memberId ? { ...item, assigneeId: '' } : item
            )
          }
          : currentCard
      );
      setCardDetailsForm((currentForm) => ({
        ...currentForm,
        assigneeId: currentForm.assigneeId === memberId ? '' : currentForm.assigneeId,
        checklist: currentForm.checklist.map((item) =>
          item.assigneeId === memberId ? { ...item, assigneeId: '' } : item
        )
      }));
      setAssigneeFilter((currentFilter) => (currentFilter === memberId ? 'all' : currentFilter));
    } catch (error) {
      setBoardError(error.message);
    } finally {
      setRemovingMemberId('');
    }
  }

  async function handleUpdateMemberRole(memberId, role) {
    if (!selectedBoardId) {
      return;
    }

    setBoardError('');
    setUpdatingMemberRoleId(memberId);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not update member role');
      }

      setBoardMembers((currentMembers) =>
        currentMembers.map((member) => (member.id === data.member.id ? data.member : member))
      );
      loadWorkspaceOverview();
    } catch (error) {
      setBoardError(error.message);
    } finally {
      setUpdatingMemberRoleId('');
    }
  }

  async function openBoard(boardId, updateHash = true) {
    if (updateHash) {
      window.location.hash = `board=${encodeURIComponent(boardId)}`;
    }

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
      loadBoardMembers(boardId);
      setEditingBoardTitle(data.board.title);
      setColumnDrafts(
        Object.fromEntries(data.columns.map((column) => [column.id, column.title]))
      );
      setSelectedCardId('');
      setSelectedCard(null);
      setComments([]);
      setPresenceUsers([]);
      setSearchQuery('');
      setPriorityFilter('all');
      setTagFilter('all');
      setAssigneeFilter('all');
      setActiveSidebarSection('kanban');
    } catch (error) {
      setBoardError(error.message);
    } finally {
      setIsLoadingBoard(false);
    }
  }

  function closeBoard(updateHash = true) {
    setSelectedBoardId('');
    setActiveBoard(null);
    setColumns([]);
    setEditingBoardTitle('');
    setNewColumnTitle('');
    setColumnDrafts({});
    setSearchQuery('');
    setPriorityFilter('all');
    setTagFilter('all');
    setAssigneeFilter('all');
    setBoardMembers([]);
    setActiveSidebarSection('overview');
    setPresenceUsers([]);
    setCardTitles({});
    closeCard();

    if (updateHash && window.location.hash.startsWith('#board=')) {
      window.history.pushState('', document.title, window.location.pathname + window.location.search);
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
      const data = await readJsonResponse(response);

      if (!response.ok) {
        const message = data.message === 'Email is already registered'
          ? 'هذا البريد الإلكتروني مسجل مسبقاً. استخدم تسجيل الدخول أو بريداً آخر.'
          : data.message || 'تعذر إكمال المصادقة.';
        throw new Error(message);
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
    closeBoard();
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
      loadWorkspaceOverview();
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

  async function handleUpdateBoard(event) {
    event.preventDefault();
    const title = editingBoardTitle.trim();

    if (!selectedBoardId || !title) {
      return;
    }

    setBoardError('');
    setIsSavingBoard(true);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not update board');
      }

      setActiveBoard(data.board);
      setBoards((currentBoards) =>
        currentBoards.map((board) => (board.id === data.board.id ? { ...board, ...data.board } : board))
      );
      loadWorkspaceOverview();
    } catch (error) {
      setBoardError(error.message);
    } finally {
      setIsSavingBoard(false);
    }
  }

  async function handleDeleteBoard() {
    if (!selectedBoardId || !window.confirm('هل تريد حذف هذه اللوحة نهائياً؟')) {
      return;
    }

    setBoardError('');
    setIsDeletingBoard(true);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not delete board');
      }

      setBoards((currentBoards) => currentBoards.filter((board) => board.id !== selectedBoardId));
      loadWorkspaceOverview();
      closeBoard();
    } catch (error) {
      setBoardError(error.message);
    } finally {
      setIsDeletingBoard(false);
    }
  }

  async function handleCreateColumn(event) {
    event.preventDefault();
    const title = newColumnTitle.trim();

    if (!selectedBoardId || !title) {
      return;
    }

    setBoardError('');
    setIsCreatingColumn(true);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/columns`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not create column');
      }

      setColumns((currentColumns) =>
        currentColumns.some((column) => column.id === data.column.id)
          ? currentColumns
          : [...currentColumns, { ...data.column, cards: [] }]
      );
      setColumnDrafts((currentDrafts) => ({ ...currentDrafts, [data.column.id]: data.column.title }));
      setNewColumnTitle('');
    } catch (error) {
      setBoardError(error.message);
    } finally {
      setIsCreatingColumn(false);
    }
  }

  async function handleUpdateColumn(event, columnId) {
    event.preventDefault();
    const title = String(columnDrafts[columnId] || '').trim();

    if (!selectedBoardId || !title) {
      return;
    }

    setBoardError('');
    setSavingColumnId(columnId);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/columns/${columnId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not update column');
      }

      setColumns((currentColumns) =>
        currentColumns.map((column) =>
          column.id === data.column.id ? { ...column, title: data.column.title } : column
        )
      );
    } catch (error) {
      setBoardError(error.message);
    } finally {
      setSavingColumnId('');
    }
  }

  async function handleDeleteColumn(columnId) {
    if (!selectedBoardId || !window.confirm('هل تريد حذف هذا العمود وكل بطاقاته؟')) {
      return;
    }

    setBoardError('');
    setDeletingColumnId(columnId);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/columns/${columnId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not delete column');
      }

      setColumns((currentColumns) => currentColumns.filter((column) => column.id !== columnId));
      setColumnDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[columnId];
        return nextDrafts;
      });
      setCardTitles((currentTitles) => {
        const nextTitles = { ...currentTitles };
        delete nextTitles[columnId];
        return nextTitles;
      });
      closeCard();
    } catch (error) {
      setBoardError(error.message);
    } finally {
      setDeletingColumnId('');
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
      loadWorkspaceOverview();
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
    const sourceCard = sourceColumn?.cards.find((card) => card.id === cardId);

    if (!sourceColumn || !targetColumn || sourceColumn.id === targetColumnId) {
      return;
    }

    if (!userIsBoardOwner && sourceCard?.assigneeId !== user?.id) {
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
      loadWorkspaceOverview();
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
    setActiveSidebarSection('task');
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
        dueDate: data.card.dueDate || '',
        assigneeId: data.card.assigneeId || '',
        priority: data.card.priority || 'normal',
        tags: data.card.tags || [],
        tagDraft: '',
        checklist: data.card.checklist || []
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
    setActiveSidebarSection(selectedBoardId ? 'kanban' : 'overview');
  }

  function addChecklistItem() {
    setCardDetailsForm((currentForm) => ({
      ...currentForm,
      checklist: [
        ...currentForm.checklist,
        {
          id: crypto.randomUUID(),
          text: '',
          assigneeId: '',
          status: 'todo'
        }
      ]
    }));
  }

  function updateChecklistItem(itemId, updates) {
    setCardDetailsForm((currentForm) => ({
      ...currentForm,
      checklist: currentForm.checklist.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    }));
  }

  function removeChecklistItem(itemId) {
    setCardDetailsForm((currentForm) => ({
      ...currentForm,
      checklist: currentForm.checklist.filter((item) => item.id !== itemId)
    }));
  }

  function addTag() {
    const tag = cardDetailsForm.tagDraft.trim();

    if (!tag) {
      return;
    }

    setCardDetailsForm((currentForm) => {
      if (currentForm.tags.includes(tag)) {
        return { ...currentForm, tagDraft: '' };
      }

      return {
        ...currentForm,
        tags: [...currentForm.tags, tag].slice(0, 8),
        tagDraft: ''
      };
    });
  }

  function removeTag(tagToRemove) {
    setCardDetailsForm((currentForm) => ({
      ...currentForm,
      tags: currentForm.tags.filter((tag) => tag !== tagToRemove)
    }));
  }

  async function handleSaveCardDetails(event) {
    event.preventDefault();

    if (!selectedCardId) {
      return;
    }

    setCardDetailsError('');
    setIsSavingCardDetails(true);

    try {
      const payload = {
        title: cardDetailsForm.title,
        description: cardDetailsForm.description,
        dueDate: cardDetailsForm.dueDate,
        assigneeId: cardDetailsForm.assigneeId,
        priority: cardDetailsForm.priority,
        tags: cardDetailsForm.tags,
        checklist: cardDetailsForm.checklist
      };
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/cards/${selectedCardId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not save card');
      }

      setSelectedCard(data.card);
      mergeCardInState(data.card);
      loadWorkspaceOverview();
    } catch (error) {
      setCardDetailsError(error.message);
    } finally {
      setIsSavingCardDetails(false);
    }
  }

  async function handleDeleteCard() {
    if (!selectedBoardId || !selectedCardId || !window.confirm('هل تريد حذف هذه البطاقة؟')) {
      return;
    }

    setCardDetailsError('');
    setIsDeletingCard(true);

    try {
      const response = await fetch(`${apiUrl}/api/boards/${selectedBoardId}/cards/${selectedCardId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not delete card');
      }

      removeCardFromState(selectedCardId);
      loadWorkspaceOverview();
      closeCard();
    } catch (error) {
      setCardDetailsError(error.message);
    } finally {
      setIsDeletingCard(false);
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
      loadWorkspaceOverview();
      setCommentBody('');
    } catch (error) {
      setCardDetailsError(error.message);
    } finally {
      setIsAddingComment(false);
    }
  }

  const allTags = useMemo(() => {
    const tags = columns.flatMap((column) => column.cards.flatMap((card) => card.tags || []));
    return Array.from(new Set(tags)).sort((firstTag, secondTag) => firstTag.localeCompare(secondTag));
  }, [columns]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredColumns = useMemo(
    () =>
      columns.map((column) => ({
        ...column,
        cards: column.cards.filter((card) => {
          const matchesSearch = normalizedSearchQuery
            ? `${card.title} ${card.description || ''}`.toLowerCase().includes(normalizedSearchQuery)
            : true;
          const matchesPriority = priorityFilter === 'all' || card.priority === priorityFilter;
          const matchesTag = tagFilter === 'all' || (card.tags || []).includes(tagFilter);
          const matchesAssignee = assigneeFilter === 'all' || (card.assigneeId || '') === assigneeFilter;

          return matchesSearch && matchesPriority && matchesTag && matchesAssignee;
        })
      })),
    [columns, normalizedSearchQuery, priorityFilter, tagFilter, assigneeFilter]
  );
  const filteredCardsCount = filteredColumns.reduce((total, column) => total + column.cards.length, 0);
  const totalCardsCount = columns.reduce((total, column) => total + column.cards.length, 0);
  const hasActiveFilters =
    Boolean(normalizedSearchQuery) || priorityFilter !== 'all' || tagFilter !== 'all' || assigneeFilter !== 'all';
  const userIsBoardOwner = activeBoard?.role === 'owner';
  const managerMembers = boardMembers.filter((member) => member.role === 'owner' || member.role === 'manager');
  const onlineMemberIds = new Set(presenceUsers.map((presenceUser) => presenceUser.id).filter(Boolean));
  const onlineMemberEmails = new Set(presenceUsers.map((presenceUser) => presenceUser.email).filter(Boolean));
  const roleCounts = boardMembers.reduce(
    (counts, member) => ({
      ...counts,
      [member.role]: (counts[member.role] || 0) + 1
    }),
    { owner: 0, manager: 0, member: 0 }
  );
  const normalizedTeamSearch = teamSearchQuery.trim().toLowerCase();
  const filteredBoardMembers = boardMembers.filter((member) => {
    const matchesRole = teamRoleFilter === 'all' || member.role === teamRoleFilter;
    const matchesSearch =
      !normalizedTeamSearch ||
      member.name.toLowerCase().includes(normalizedTeamSearch) ||
      member.email.toLowerCase().includes(normalizedTeamSearch) ||
      (roleLabels[member.role] || roleLabels.member).toLowerCase().includes(normalizedTeamSearch);

    return matchesRole && matchesSearch;
  });
  const userIsSelectedCardManager = selectedCard?.assigneeId === user?.id;
  const canEditSelectedCardDetails = userIsBoardOwner;
  const canEditSelectedSubtasks = userIsBoardOwner || userIsSelectedCardManager;
  const canDeleteSelectedCard = userIsBoardOwner;
  const canSaveSelectedCard = Boolean(selectedCard) && (
    canEditSelectedCardDetails ||
    canEditSelectedSubtasks ||
    selectedCard.checklist?.some((item) => item.assigneeId === user?.id)
  );
  const activeBoardTitle = activeBoard?.title || 'لوحة الكانبان';

  return (
    <main className={user ? 'workspace-shell' : 'app-shell'}>
      {user ? (
        <>
          <aside className="workspace-sidebar" aria-label="Workspace navigation">
            <div className="brand-block">
              <div className="brand-mark secondary">ت</div>
              <div>
                <strong>تدفق</strong>
                <span>Tadafuq Cloud</span>
              </div>
            </div>

            <div className="workspace-switcher">
              <button type="button" className="switcher-arrows" aria-label="تبديل المشروع">
                ↕
              </button>
              <label>
                المشروع
                <select
                  value={selectedBoardId || ''}
                  onChange={(event) => {
                    if (event.target.value) {
                      openBoard(event.target.value);
                    } else {
                      closeBoard();
                    }
                  }}
                >
                  <option value="">نظرة عامة على المشاريع</option>
                  {boards.map((board) => (
                    <option key={board.id} value={board.id}>
                      {board.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="brand-mark">ت</div>
            </div>

            <nav className="side-nav" aria-label="Main navigation">
              <span className="nav-section-title">أقسام المشروع</span>
              <button type="button" className={activeSidebarSection === 'overview' ? 'active' : ''} onClick={() => closeBoard()}>
                <FolderKanban className="nav-icon" size={20} aria-hidden="true" />
                نظرة عامة والمشاريع
              </button>
              <button
                type="button"
                className={activeSidebarSection === 'kanban' ? 'active' : ''}
                onClick={() => {
                  setActiveSidebarSection('kanban');
                }}
                disabled={!selectedBoardId}
              >
                <KanbanSquare className="nav-icon" size={20} aria-hidden="true" />
                لوحة الكانبان
              </button>
              <button
                type="button"
                className={activeSidebarSection === 'team' ? 'active' : ''}
                onClick={() => {
                  setActiveSidebarSection('team');
                }}
                disabled={!selectedBoardId}
              >
                <UsersRound className="nav-icon" size={20} aria-hidden="true" />
                إدارة الفريق والصلاحيات
                {boardMembers.length ? <span className="nav-badge">{boardMembers.length}</span> : null}
              </button>
              <button
                type="button"
                className={activeSidebarSection === 'task' ? 'active' : ''}
                onClick={() => {
                  setActiveSidebarSection('task');
                }}
                disabled={!selectedBoardId}
              >
                <ClipboardCheck className="nav-icon" size={20} aria-hidden="true" />
                تفاصيل المهمة والنشاط
              </button>
            </nav>

            <div className="sidebar-footer">
              <div className="storage-card">
                <div>
                  <span>المساحة السحابية</span>
                  <strong>{workspaceStats.storage.usedPercent}%</strong>
                </div>
                <div className="storage-track">
                  <span style={{ width: `${workspaceStats.storage.usedPercent}%` }} />
                </div>
                <small>{workspaceStats.storage.usedLabel} / {workspaceStats.storage.limitLabel}</small>
              </div>
              <button type="button">
                <Settings className="nav-icon" size={20} aria-hidden="true" />
                الإعدادات العامة
              </button>
              <button type="button">
                <LifeBuoy className="nav-icon" size={20} aria-hidden="true" />
                الدعم الفني والتوثيق
              </button>
              <button type="button" className="dark-toggle">
                <Moon className="nav-icon" size={20} aria-hidden="true" />
                الوضع المظلم
                <span className="toggle-track"><span /></span>
              </button>
              <div className="socket-status">
                <span>Socket.io</span>
                <strong>{isConnected ? 'متصل الآن' : 'غير متصل'}</strong>
              </div>
            </div>
          </aside>

          <header className="workspace-topbar">
            <div>
              <span>المشاريع البرمجية</span>
              <strong>{activeBoardTitle}</strong>
            </div>
            <div className="topbar-actions">
              <span className={isConnected ? 'live-pill online' : 'live-pill'}>مزامنة فورية</span>
              <div className="topbar-presence" title="الأعضاء المتصلون">
                <div className="topbar-avatars">
                  {presenceUsers.slice(0, 3).map((presenceUser) => (
                    <span key={presenceUser.socketId}>{presenceUser.name.slice(0, 1)}</span>
                  ))}
                  {presenceUsers.length > 3 ? <span>+{presenceUsers.length - 3}</span> : null}
                </div>
                <span className="online-caption">متصل الآن</span>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setActiveSidebarSection('kanban')}
              >
                تصفية
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleCreateInvite}
                disabled={!selectedBoardId || !userIsBoardOwner}
              >
                مشاركة
              </button>
            </div>
          </header>
        </>
      ) : null}

      {(!user || !selectedBoardId) ? (
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
      ) : null}

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

          {!selectedBoardId ? (
          <section className="dashboard-panel workspace-hub" aria-label="مركز مساحات العمل والمشاريع">
            <div className="workspace-hub-head">
              <div>
                <div className="hub-kicker">
                  <span>مساحة عمل رقمية موحدة</span>
                  <span className="hub-code">ORG-FLOW</span>
                </div>
                <h2>مركز مساحات العمل والمشاريع</h2>
                <p>إدارة وتتبع سير عمليات التطوير وتفاعل الفرق في الزمن الفعلي.</p>
              </div>
              <div className="hub-actions">
                <button type="button" className="secondary-button">
                  <SlidersHorizontal size={18} aria-hidden="true" />
                  تخصيص المساحات
                </button>
                <button type="button" onClick={() => document.querySelector('.board-form input')?.focus()}>
                  <Plus size={18} aria-hidden="true" />
                  مشروع جديد
                </button>
              </div>
            </div>

            <div className="hub-metrics" aria-label="Workspace metrics">
              <article>
                <span><FolderOpen size={18} aria-hidden="true" /></span>
                <p>المشاريع النشطة</p>
                <strong>{workspaceStats.boards.total}</strong>
                <small>{workspaceStats.boards.total === 1 ? 'لوحة واحدة متاحة' : `${workspaceStats.boards.total} لوحة متاحة`}</small>
              </article>
              <article>
                <span><CircleCheck size={18} aria-hidden="true" /></span>
                <p>المهام المنجزة هذا الأسبوع</p>
                <strong>{workspaceStats.cards.completedThisWeek}</strong>
                <small>{workspaceStats.cards.completed} بطاقة مكتملة من أصل {workspaceStats.cards.total}</small>
              </article>
              <article>
                <span><UsersRound size={18} aria-hidden="true" /></span>
                <p>الأعضاء المتصلون الآن</p>
                <strong>{presenceUsers.length}</strong>
                <small>{isConnected ? 'الاتصال اللحظي يعمل الآن.' : 'الاتصال اللحظي غير متصل حاليا.'}</small>
              </article>
              <article>
                <span><Gauge size={18} aria-hidden="true" /></span>
                <p>معدل سرعة الإنجاز</p>
                <strong>{workspaceStats.velocity}%</strong>
                <small>{workspaceStats.checklist.completed}/{workspaceStats.checklist.total} مهمة فرعية مكتملة</small>
              </article>
            </div>

            <div className="hub-command-bar">
              <div className="hub-tabs" aria-label="Workspace filters">
                <button type="button" className="active">
                  جميع المساحات
                  <span>{workspaceStats.boards.total}</span>
                </button>
                <button type="button">
                  أملكها
                  <span>{workspaceStats.boards.owned}</span>
                </button>
                <button type="button">
                  مشتركة
                  <span>{workspaceStats.boards.shared}</span>
                </button>
              </div>
              <div className="hub-search">
                <Search size={18} aria-hidden="true" />
                <input placeholder="البحث عن لوحة أو مشروع..." aria-label="Search boards" />
                <Grid2X2 size={18} aria-hidden="true" />
              </div>
            </div>

            <div className="hub-layout">
              <section className="hub-projects" aria-label="Projects">
                <div className="hub-section-title">
                  <div>
                    <h3>لوحات العمل النشطة</h3>
                    <p>{isLoadingBoards ? 'جاري تحميل اللوحات...' : `${boards.length} لوحة معروضة`}</p>
                  </div>
                  <span><Zap size={14} aria-hidden="true" /> التحديث التلقائي نشط</span>
                </div>

                <form onSubmit={handleCreateBoard} className="board-form hub-create-card">
                  <label>
                    اسم المشروع
                    <input
                      value={boardTitle}
                      onChange={(event) => setBoardTitle(event.target.value)}
                      placeholder="مثلا: مشروع التخرج"
                    />
                  </label>
                  <button type="submit" disabled={isCreatingBoard}>
                    <Plus size={18} aria-hidden="true" />
                    {isCreatingBoard ? 'جاري الإنشاء...' : 'إنشاء لوحة'}
                  </button>
                </form>

                {boardsError ? <p className="form-error">{boardsError}</p> : null}

                <div className="boards-list hub-board-grid">
                  {isLoadingBoards ? (
                    <p className="empty-state">جاري تحميل اللوحات...</p>
                  ) : boards.length === 0 ? (
                    <p className="empty-state">لا توجد لوحات مشاريع بعد. أنشئ أول لوحة لبدء التعاون.</p>
                  ) : (
                    boards.map((board, index) => (
                      <article key={board.id} className="board-card hub-board-card">
                        <span className="hub-board-accent" />
                        <div className="hub-board-topline">
                          <span className="hub-board-icon">{board.title.slice(0, 1).toUpperCase()}</span>
                          <span className={`role-badge ${board.role}`}>
                            {roleLabels[board.role] || roleLabels.member}
                          </span>
                        </div>
                        <div>
                          <div className="hub-board-tags">
                            <span>UI System</span>
                            <span>{roleLabels[board.role] || roleLabels.member}</span>
                          </div>
                          <h2>{board.title}</h2>
                          <p>افتح لوحة الكانبان، أدِر الأعمدة والبطاقات، وتعاون لحظيا مع الفريق.</p>
                        </div>
                        <div className="hub-board-progress">
                          <div>
                            <span>الإنجاز العام للمرحلة</span>
                            <strong>{workspaceStats.velocity}%</strong>
                          </div>
                          <div><span style={{ width: `${Math.min(100, workspaceStats.velocity)}%` }} /></div>
                        </div>
                        <div className="hub-board-footer">
                          <span>{index + 1 < 10 ? `0${index + 1}` : index + 1}</span>
                          <div className="hub-mini-avatars" aria-hidden="true">
                            <span>س</span>
                            <span>ع</span>
                            <span>+</span>
                          </div>
                          <button type="button" className="small-button" onClick={() => openBoard(board.id)}>
                            فتح المشروع
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>

              <aside className="hub-side-panel" aria-label="Workspace activity">
                <section className="hub-quick-actions">
                  <div className="hub-section-title compact">
                    <div>
                      <h3>إجراءات فورية سريعة</h3>
                      <p>اختصارات لإدارة مساحة العمل</p>
                    </div>
                    <Zap size={18} aria-hidden="true" />
                  </div>
                  <div className="hub-action-grid">
                    <button type="button" onClick={() => document.querySelector('.board-form input')?.focus()}>
                      <Plus size={18} aria-hidden="true" />
                      <strong>مشروع جديد</strong>
                      <span>إنشاء لوحة</span>
                    </button>
                    <button type="button" onClick={() => setActiveSidebarSection('team')} disabled={!selectedBoardId}>
                      <UsersRound size={18} aria-hidden="true" />
                      <strong>دعوة أعضاء</strong>
                      <span>إدارة الفريق</span>
                    </button>
                    <button type="button">
                      <SlidersHorizontal size={18} aria-hidden="true" />
                      <strong>أتمتة المهام</strong>
                      <span>Webhook</span>
                    </button>
                    <button type="button">
                      <Share2 size={18} aria-hidden="true" />
                      <strong>تقرير</strong>
                      <span>PDF / Sprint</span>
                    </button>
                  </div>
                </section>
                <section className="hub-live-feed">
                  <div className="hub-section-title compact">
                    <div>
                      <h3>نشاط الفريق الحي</h3>
                      <p>آخر التحديثات داخل مساحة العمل</p>
                    </div>
                    <span className="live-pill online">مباشر</span>
                  </div>
                  <div className="hub-feed-list">
                    {workspaceActivity.length === 0 ? (
                      <p className="empty-state">لا يوجد نشاط بعد. ابدأ بإنشاء أو تحديث بطاقة.</p>
                    ) : (
                      workspaceActivity.slice(0, 5).map((activity) => (
                        <article key={activity.id}>
                          <span className="hub-feed-avatar">{(activity.actorName || 'ن').slice(0, 1)}</span>
                          <p>
                            <strong>{activity.actorName || 'النظام'}</strong>
                            {' '}
                            {activity.action === 'created' ? 'أنشأ' : activity.action === 'updated' ? 'حدّث' : activity.action === 'moved' ? 'نقل' : activity.action === 'deleted' ? 'حذف' : activity.action === 'commented' ? 'علّق على' : 'غيّر'}
                            {' '}
                            {activity.entityType === 'card' ? 'بطاقة' : activity.entityType === 'board' ? 'لوحة' : activity.entityType}
                            {' '}
                            في {activity.boardTitle}.
                          </p>
                        </article>
                      ))
                    )}
                  </div>                </section>
                <section className="session-bar hub-session-card">
                  <div>
                    <strong>{user.email}</strong>
                    <p>الجلسة محفوظة محليا في هذا المتصفح.</p>
                  </div>
                  <button type="button" className="secondary-button" onClick={handleLogout}>
                    <LogOut size={18} aria-hidden="true" />
                    خروج
                  </button>
                </section>
                <section className="hub-activity-card">
                  <h3>آخر نشاط في مساحة العمل</h3>
                  <p>{boards.length ? 'افتح مشروعا لعرض نشاط اللوحة والتعليقات المباشرة.' : 'أنشئ لوحة لبدء ظهور النشاط هنا.'}</p>
                </section>
                <section className="hub-storage-card">
                  <div>
                    <span>المساحة السحابية</span>
                    <strong>78%</strong>
                  </div>
                  <div className="storage-track"><span style={{ width: `${workspaceStats.storage.usedPercent}%` }} /></div>
                  <small>15.6 جيجابايت / 20 جيجابايت</small>
                </section>
              </aside>
            </div>
          </section>
          ) : null}

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
                <button type="button" className="secondary-button" onClick={() => closeBoard()}>
                  رجوع
                </button>
              </div>

              {boardError ? <p className="form-error">{boardError}</p> : null}
              {inviteError ? <p className="form-error">{inviteError}</p> : null}
              {inviteNotice ? <p className="form-success">{inviteNotice}</p> : null}

              {activeSidebarSection === 'team' ? (
              <section className="team-permissions-page" id="team" aria-label="إدارة الفريق والصلاحيات">
                <div className="team-hero">
                  <div>
                    <span className="invite-kicker">التواجد الحي والأدوار</span>
                    <h3>إدارة الفريق والأعضاء المتصلين</h3>
                    <p>
                      تحكم في أدوار أعضاء اللوحة، راقب المتصلين الآن، ووزع صلاحيات العمل بين المالك والمسؤولين والأعضاء.
                    </p>
                  </div>
                  <div className="team-actions">
                    <button type="button" className="secondary-button">
                      <Wifi size={17} />
                      تصدير سجل التواجد
                    </button>
                    <button type="button" className="secondary-button">
                      <ShieldCheck size={17} />
                      مصفوفة الأدوار
                    </button>
                    {userIsBoardOwner ? (
                      <button type="button" onClick={handleCreateInvite} disabled={isCreatingInvite}>
                        <UsersRound size={18} />
                        {isCreatingInvite ? 'جاري إنشاء الدعوة...' : 'دعوة عضو جديد +'}
                      </button>
                    ) : null}
                  </div>
                </div>

                {userIsBoardOwner && inviteLink ? (
                  <div className="team-invite-link">
                    <label>
                      رابط الدعوة
                      <input readOnly value={inviteLink} aria-label="رابط الدعوة" />
                    </label>
                    <button type="button" className="secondary-button" onClick={handleCopyInvite}>
                      <Link size={16} />
                      نسخ الرابط
                    </button>
                  </div>
                ) : null}

                <div className="team-metrics">
                  <article className="team-metric-card">
                    <UsersRound size={26} />
                    <span>إجمالي الفريق</span>
                    <strong>{boardMembers.length}</strong>
                    <small>{roleCounts.owner} مالك، {roleCounts.manager} مسؤول، {roleCounts.member} عضو</small>
                  </article>
                  <article className="team-metric-card live">
                    <Zap size={26} />
                    <span>نشط الآن</span>
                    <strong>{presenceUsers.length}</strong>
                    <small>مزامنة مباشرة عبر Socket.io</small>
                  </article>
                  <article className="team-metric-card">
                    <ShieldCheck size={26} />
                    <span>المسؤولون</span>
                    <strong>{roleCounts.manager}</strong>
                    <small>يمكنهم إضافة مهام داخل البطاقات</small>
                  </article>
                  <article className="team-metric-card muted">
                    <Moon size={26} />
                    <span>غير متصل</span>
                    <strong>{Math.max(boardMembers.length - presenceUsers.length, 0)}</strong>
                    <small>تظهر حالتهم عند العودة للوحة</small>
                  </article>
                </div>

                <section className="team-radar" aria-label="رادار الحضور المباشر">
                  <div className="team-radar-header">
                    <div className="team-radar-icon"><Radar size={20} /></div>
                    <div>
                      <h4>رادار الحضور التشاركي المباشر</h4>
                      <p>كل عضو متصل يظهر هنا فوراً، ويتم تحديث العدد مع فتح اللوحة في أكثر من نافذة.</p>
                    </div>
                    <span><span className="live-dot" /> WebSocket Live</span>
                  </div>
                  <div className="team-radar-grid">
                    <article>
                      <strong>مالك اللوحة</strong>
                      <span>{roleCounts.owner} عضو</span>
                      <p>ينشئ البطاقات، يدير الأعضاء، ويحدد المسؤولين.</p>
                    </article>
                    <article>
                      <strong>المسؤولون</strong>
                      <span>{roleCounts.manager} عضو</span>
                      <p>ينشئون المهام الفرعية داخل البطاقات المسندة لهم ويوكلونها للأعضاء.</p>
                    </article>
                    <article>
                      <strong>الأعضاء</strong>
                      <span>{roleCounts.member} عضو</span>
                      <p>ينفذون المهام المسندة لهم ويحدثون حالة الإنجاز.</p>
                    </article>
                  </div>
                </section>

                <div className="team-toolbar">
                  <div className="team-tabs" role="tablist" aria-label="فلترة أعضاء الفريق">
                    <button type="button" className={teamRoleFilter === 'all' ? 'active' : ''} onClick={() => setTeamRoleFilter('all')}>
                      الكل ({boardMembers.length})
                    </button>
                    <button type="button" className={teamRoleFilter === 'owner' ? 'active' : ''} onClick={() => setTeamRoleFilter('owner')}>
                      المالك ({roleCounts.owner})
                    </button>
                    <button type="button" className={teamRoleFilter === 'manager' ? 'active' : ''} onClick={() => setTeamRoleFilter('manager')}>
                      المسؤولون ({roleCounts.manager})
                    </button>
                    <button type="button" className={teamRoleFilter === 'member' ? 'active' : ''} onClick={() => setTeamRoleFilter('member')}>
                      الأعضاء ({roleCounts.member})
                    </button>
                  </div>
                  <label className="team-search">
                    <Search size={18} />
                    <input
                      value={teamSearchQuery}
                      onChange={(event) => setTeamSearchQuery(event.target.value)}
                      placeholder="بحث بالاسم، البريد، أو الدور..."
                    />
                  </label>
                </div>

                <div className="team-table">
                  <div className="team-table-head">
                    <span>العضو والمعلومات</span>
                    <span>الحالة اللحظية</span>
                    <span>الدور والصلاحيات</span>
                    <span>اللوحة الحالية</span>
                    <span>إجراءات</span>
                  </div>
                  {filteredBoardMembers.length === 0 ? (
                    <p className="team-empty">لا توجد نتائج مطابقة للبحث الحالي.</p>
                  ) : (
                    filteredBoardMembers.map((member) => {
                      const isOnline = onlineMemberIds.has(member.id) || onlineMemberEmails.has(member.email);

                      return (
                        <article key={member.id} className="team-row">
                          <div className="team-member-profile">
                            <span className="member-avatar">{member.name.slice(0, 2)}</span>
                            <div>
                              <strong>{member.name}</strong>
                              <small>{member.email}</small>
                            </div>
                          </div>
                          <span className={isOnline ? 'member-status online' : 'member-status'}>
                            <span className="live-dot" />
                            {isOnline ? 'متصل الآن ويعمل على اللوحة' : 'غير متصل حالياً'}
                          </span>
                          <div className="team-role-control">
                            <span className={`role-badge ${member.role}`}>
                              {roleLabels[member.role] || roleLabels.member}
                            </span>
                            {userIsBoardOwner && member.role !== 'owner' ? (
                              <select
                                className="role-select"
                                value={member.role}
                                onChange={(event) => handleUpdateMemberRole(member.id, event.target.value)}
                                disabled={updatingMemberRoleId === member.id}
                                aria-label="تغيير دور العضو"
                              >
                                <option value="member">عضو</option>
                                <option value="manager">مسؤول</option>
                              </select>
                            ) : null}
                          </div>
                          <div className="team-current-board">
                            <KanbanSquare size={16} />
                            <span>{activeBoardTitle}</span>
                            <small>{isOnline ? 'نشط في هذه اللحظة' : 'آخر ظهور غير متاح'}</small>
                          </div>
                          <div className="team-row-actions">
                            <button type="button" className="icon-button" aria-label="تنبيه العضو">
                              <MessageSquare size={16} />
                            </button>
                            {userIsBoardOwner && member.role !== 'owner' ? (
                              <button
                                type="button"
                                className="danger-button small-button"
                                onClick={() => handleRemoveMember(member.id)}
                                disabled={removingMemberId === member.id}
                              >
                                {removingMemberId === member.id ? '...' : 'إزالة'}
                              </button>
                            ) : (
                              <button type="button" className="icon-button" aria-label="خيارات العضو">
                                <MoreVertical size={16} />
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
              ) : null}

              {activeSidebarSection === 'kanban' ? (
              <>
              <section
                className="filter-panel rounded-xl bg-surface-container-lowest p-space-md shadow-stitch"
                id="filters"
                aria-label="Card filters"
              >
                <label>
                  البحث
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="ابحث في العنوان أو الوصف"
                  />
                </label>
                <label>
                  الأولوية
                  <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                    <option value="all">كل الأولويات</option>
                    <option value="urgent">عاجل</option>
                    <option value="medium">متوسط</option>
                    <option value="normal">عادي</option>
                  </select>
                </label>
                <label>
                  التصنيف
                  <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
                    <option value="all">كل التصنيفات</option>
                    {allTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  المسؤول
                  <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
                    <option value="all">كل المسؤولين</option>
                    <option value="">بدون مسؤول</option>
                    {boardMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="filter-summary">
                  <span className="rounded-full bg-surface-container px-3 py-2 font-code text-code-sm text-on-surface">
                    {filteredCardsCount}/{totalCardsCount}
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setSearchQuery('');
                      setPriorityFilter('all');
                      setTagFilter('all');
                      setAssigneeFilter('all');
                    }}
                    disabled={!hasActiveFilters}
                  >
                    مسح
                  </button>
                </div>
              </section>

              {isLoadingBoard ? (
                <p className="empty-state">جاري تحميل اللوحة...</p>
              ) : (
                <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
                  {userIsBoardOwner ? (
                  <form className="add-column-form rounded-xl bg-surface-container-lowest p-space-md shadow-stitch" onSubmit={handleCreateColumn}>
                    <input
                      value={newColumnTitle}
                      onChange={(event) => setNewColumnTitle(event.target.value)}
                      placeholder="إضافة عمود جديد"
                    />
                    <button type="submit" className="inline-flex items-center justify-center gap-2" disabled={isCreatingColumn || !newColumnTitle.trim()}>
                      <Plus size={18} aria-hidden="true" />
                      {isCreatingColumn ? '...' : 'إضافة عمود'}
                    </button>
                  </form>
                  ) : null}

                  <div className="kanban-board grid grid-cols-1 gap-space-lg md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {filteredColumns.map((column, columnIndex) => (
                      <DroppableColumn key={column.id} column={column} index={columnIndex}>
                        <header className="column-header flex items-start justify-between gap-space-sm pb-space-sm">
                          <form className="column-title-form min-w-0 flex-1" onSubmit={(event) => handleUpdateColumn(event, column.id)}>
                            <div className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${columnDotStyles[columnIndex % columnDotStyles.length]}`} />
                              <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-label-sm font-bold text-on-surface-variant">
                                {column.cards.length}
                              </span>
                            </div>
                            <input
                              value={columnDrafts[column.id] ?? column.title}
                              onChange={(event) =>
                                setColumnDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [column.id]: event.target.value
                                }))
                              }
                              aria-label="Column title"
                              className="rounded-lg border-0 bg-transparent px-0 text-headline-sm font-semibold text-on-surface focus:outline-none focus:ring-0"
                              disabled={!userIsBoardOwner}
                            />
                            <button
                              type="submit"
                              className="small-button inline-flex items-center justify-center rounded-lg bg-surface-container-lowest px-2 text-primary shadow-stitch"
                              disabled={!userIsBoardOwner || savingColumnId === column.id || !String(columnDrafts[column.id] || '').trim()}
                            >
                              {savingColumnId === column.id ? '...' : 'حفظ'}
                            </button>
                          </form>
                          <div className="column-meta flex items-center gap-1 text-on-surface-variant">
                            <button type="button" className="icon-plain-button" aria-label="Column options">
                              <MoreHorizontal size={18} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="icon-danger-button"
                              onClick={() => handleDeleteColumn(column.id)}
                              disabled={!userIsBoardOwner || deletingColumnId === column.id}
                              title="حذف العمود"
                              aria-label="Delete column"
                            >
                              <Trash2 size={18} aria-hidden="true" />
                            </button>
                          </div>
                        </header>

                        <div className="card-list">
                          {column.cards.length === 0 ? (
                            <p className="column-empty">
                              {hasActiveFilters ? 'لا توجد بطاقات مطابقة.' : 'اسحب بطاقة إلى هنا.'}
                            </p>
                          ) : (
                            column.cards.map((card) => (
                              <DraggableCard
                                key={card.id}
                                card={card}
                                onOpen={openCard}
                                canMove={userIsBoardOwner || card.assigneeId === user?.id}
                              />
                            ))
                          )}
                        </div>

                        {userIsBoardOwner ? (
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
                          <button
                            type="submit"
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container-lowest py-2 text-on-surface-variant shadow-stitch hover:bg-surface-container-high hover:text-on-surface"
                            disabled={isCreatingCard === column.id}
                          >
                            <Plus size={18} aria-hidden="true" />
                            {isCreatingCard === column.id ? '...' : 'إضافة'}
                          </button>
                        </form>
                        ) : null}
                      </DroppableColumn>
                    ))}
                  </div>
                </DndContext>
              )}
              </>
              ) : null}

              {activeSidebarSection === 'task' ? (
              selectedCardId ? (
                <aside className="card-details task-details-page" aria-label="Card details">
                  <div className="card-details-header task-details-topbar">
                    <div>
                      <p className="eyebrow">Card</p>
                      <h3>{selectedCard?.title || 'جاري فتح البطاقة...'}</h3>
                    </div>
                    <div className="details-actions">
                      <button
                        type="button"
                        className="danger-button"
                        onClick={handleDeleteCard}
                        disabled={!canDeleteSelectedCard || isDeletingCard || isLoadingCardDetails}
                      >
                        {isDeletingCard ? 'جاري الحذف...' : 'حذف'}
                      </button>
                      <button type="button" className="secondary-button" onClick={closeCard}>
                        إغلاق
                      </button>
                    </div>
                  </div>

                  {cardDetailsError ? <p className="form-error">{cardDetailsError}</p> : null}

                  {isLoadingCardDetails ? (
                    <p className="empty-state">جاري تحميل تفاصيل البطاقة...</p>
                  ) : selectedCard ? (
                    <>
                      <section className="task-detail-hero" aria-label="Task summary">
                        <div className="task-chip-row">
                          <span className="task-code">TASK-{String(selectedCard.id || '').slice(0, 4).toUpperCase()}</span>
                          <span className={`task-priority-chip ${cardDetailsForm.priority || selectedCard.priority || 'normal'}`}>
                            <Flag size={15} aria-hidden="true" />
                            {priorityLabels[cardDetailsForm.priority || selectedCard.priority] || priorityLabels.normal}
                          </span>
                          {cardDetailsForm.tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="task-tag-chip">#{tag}</span>
                          ))}
                        </div>
                        <div className="task-property-grid">
                          <div>
                            <span><UserRound size={16} aria-hidden="true" /> Assignee</span>
                            <strong>{boardMembers.find((member) => member.id === cardDetailsForm.assigneeId)?.name || 'Unassigned'}</strong>
                          </div>
                          <div>
                            <span><Calendar size={16} aria-hidden="true" /> Due date</span>
                            <strong>{cardDetailsForm.dueDate || 'No due date'}</strong>
                          </div>
                          <div>
                            <span><ListChecks size={16} aria-hidden="true" /> Subtasks</span>
                            <strong>
                              {cardDetailsForm.checklist.filter((item) => item.status === 'done' || item.done).length}/{cardDetailsForm.checklist.length}
                            </strong>
                          </div>
                        </div>
                      </section>
                      <div className="task-details-grid">
                        <form className="details-form task-main-pane" onSubmit={handleSaveCardDetails}>
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
                            disabled={!canEditSelectedCardDetails}
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
                            disabled={!canEditSelectedCardDetails}
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
                            disabled={!canEditSelectedCardDetails}
                          />
                        </label>
                        <label>
                          المسؤول
                          <select
                            value={cardDetailsForm.assigneeId}
                            onChange={(event) =>
                              setCardDetailsForm((currentForm) => ({
                                ...currentForm,
                                assigneeId: event.target.value
                              }))
                            }
                            disabled={!canEditSelectedCardDetails}
                          >
                            <option value="">بدون مسؤول</option>
                            {managerMembers.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          الأولوية
                          <select
                            value={cardDetailsForm.priority}
                            onChange={(event) =>
                              setCardDetailsForm((currentForm) => ({
                                ...currentForm,
                                priority: event.target.value
                              }))
                            }
                            disabled={!canEditSelectedCardDetails}
                          >
                            <option value="urgent">عاجل</option>
                            <option value="medium">متوسط</option>
                            <option value="normal">عادي</option>
                          </select>
                        </label>
                        <section className="tags-editor" aria-label="Tags">
                          <div className="tags-editor-header">
                            <h4>التصنيفات</h4>
                            <span>{cardDetailsForm.tags.length}/8</span>
                          </div>
                          <div className="tag-input-row">
                            <input
                              value={cardDetailsForm.tagDraft}
                              onChange={(event) =>
                                setCardDetailsForm((currentForm) => ({
                                  ...currentForm,
                                  tagDraft: event.target.value
                                }))
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  addTag();
                                }
                              }}
                              placeholder="مثلاً: Frontend"
                              disabled={!canEditSelectedCardDetails}
                            />
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={addTag}
                              disabled={!canEditSelectedCardDetails || !cardDetailsForm.tagDraft.trim() || cardDetailsForm.tags.length >= 8}
                            >
                              إضافة
                            </button>
                          </div>
                          {cardDetailsForm.tags.length === 0 ? (
                            <p className="column-empty">لا توجد تصنيفات بعد.</p>
                          ) : (
                            <div className="editable-tag-list">
                              {cardDetailsForm.tags.map((tag) => (
                                <span key={tag}>
                                  {tag}
                                  <button
                                    type="button"
                                    onClick={() => removeTag(tag)}
                                    aria-label={`Remove ${tag}`}
                                    disabled={!canEditSelectedCardDetails}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </section>
                        <section className="checklist-editor" aria-label="Checklist">
                          <div className="checklist-header">
                            <h4>قائمة المهام الفرعية</h4>
                            <button
                              type="button"
                              className="secondary-button small-button"
                              onClick={addChecklistItem}
                              disabled={!canEditSelectedSubtasks}
                            >
                              إضافة مهمة
                            </button>
                          </div>
                          {cardDetailsForm.checklist.length === 0 ? (
                            <p className="column-empty">لا توجد مهام فرعية بعد.</p>
                          ) : (
                            <div className="checklist-items">
                              {cardDetailsForm.checklist.map((item) => (
                                <div key={item.id} className="checklist-item">
                                  <input
                                    value={item.text}
                                    onChange={(event) => updateChecklistItem(item.id, { text: event.target.value })}
                                    placeholder="اكتب مهمة فرعية"
                                    disabled={!canEditSelectedSubtasks}
                                  />
                                  <select
                                    value={item.assigneeId || ''}
                                    onChange={(event) => updateChecklistItem(item.id, { assigneeId: event.target.value })}
                                    aria-label="Subtask assignee"
                                    disabled={!canEditSelectedSubtasks}
                                  >
                                    <option value="">بدون عضو</option>
                                    {boardMembers.map((member) => (
                                      <option key={member.id} value={member.id}>
                                        {member.name}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={item.status || (item.done ? 'done' : 'todo')}
                                    onChange={(event) => updateChecklistItem(item.id, { status: event.target.value })}
                                    aria-label="Subtask status"
                                    disabled={!canEditSelectedSubtasks && item.assigneeId !== user?.id}
                                  >
                                    <option value="todo">لم تبدأ</option>
                                    <option value="in_progress">قيد التنفيذ</option>
                                    <option value="done">تم الانتهاء</option>
                                  </select>
                                  <button
                                    type="button"
                                    className="icon-danger-button"
                                    onClick={() => removeChecklistItem(item.id)}
                                    aria-label="Remove checklist item"
                                    disabled={!canEditSelectedSubtasks}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                        <button type="submit" disabled={isSavingCardDetails || !canSaveSelectedCard}>
                          {isSavingCardDetails ? 'جاري الحفظ...' : 'حفظ التفاصيل'}
                        </button>
                        </form>

                        <aside className="task-activity-pane">
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
                        </aside>
                      </div>
                    </>
                  ) : null}
                </aside>
              ) : (
                <section className="card-details task-details-empty" aria-label="Task details placeholder">
                  <div className="card-details-header">
                    <div>
                      <p className="eyebrow">Task Activity</p>
                      <h3>Select a card from the Kanban board</h3>
                    </div>
                    <button type="button" className="secondary-button" onClick={() => setActiveSidebarSection('kanban')}>
                      Open Kanban
                    </button>
                  </div>
                  <p className="empty-state">Card details, subtasks, comments, and activity will appear here after you select a card.</p>
                </section>
              )
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

export default App;
