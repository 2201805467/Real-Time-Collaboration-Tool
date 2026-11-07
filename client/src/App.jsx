import React, { useEffect, useMemo, useState } from 'react';
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import WorkspaceChrome from './components/WorkspaceChrome.jsx';
import ShareBoardDialog from './components/ShareBoardDialog.jsx';
import TeamPage from './pages/TeamPage.jsx';
import WorkspaceOverviewPage from './pages/WorkspaceOverviewPage.jsx';
import KanbanPage from './pages/KanbanPage.jsx';
import TaskDetailsPage from './pages/TaskDetailsPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { boardApi } from './api/boardApi.js';
import { acceptInvite, createBoard, getInvite } from './api/workspaceApi.js';
import useAuthSession from './hooks/useAuthSession.js';
import useActiveBoard from './hooks/useActiveBoard.js';
import useBoardSocket from './hooks/useBoardSocket.js';
import useNotifications from './hooks/useNotifications.js';
import useTheme from './hooks/useTheme.js';
import useWorkspaceData from './hooks/useWorkspaceData.js';

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

function getWorkspaceRoute(pathname) {
  if (pathname === '/settings') {
    return { boardId: '', cardId: '', section: 'settings' };
  }

  const taskRoute = matchPath('/boards/:boardId/tasks/:cardId', pathname);

  if (taskRoute) {
    return {
      boardId: taskRoute.params.boardId,
      cardId: taskRoute.params.cardId,
      section: 'task'
    };
  }

  const boardRoute = matchPath('/boards/:boardId/:section', pathname);

  if (boardRoute && ['kanban', 'team', 'tasks'].includes(boardRoute.params.section)) {
    return {
      boardId: boardRoute.params.boardId,
      cardId: '',
      section: boardRoute.params.section === 'tasks' ? 'task' : boardRoute.params.section
    };
  }

  return { boardId: '', cardId: '', section: 'overview' };
}

function App() {
  const { isDarkMode, toggleTheme } = useTheme();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const location = useLocation();
  const navigate = useNavigate();
  const workspaceRoute = useMemo(() => getWorkspaceRoute(location.pathname), [location.pathname]);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const {
    token,
    user,
    authError,
    isSubmittingAuth,
    setAuthError,
    submitAuth,
    saveProfile,
    savePassword,
    saveNotificationPreferences,
    logout,
    expireSession
  } = useAuthSession();
  const {
    boards,
    setBoards,
    boardsError,
    setBoardsError,
    isLoadingBoards,
    workspaceStats,
    workspaceActivity,
    loadWorkspaceOverview,
    resetWorkspace
  } = useWorkspaceData(token, user);
  const {
    notifications,
    unreadNotificationsCount,
    isLoadingNotifications,
    notificationsError,
    receiveNotification,
    markNotificationRead,
    markAllNotificationsRead
  } = useNotifications(token, user);
  const [boardTitle, setBoardTitle] = useState('');
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [inviteToken, setInviteToken] = useState(() => new URLSearchParams(window.location.search).get('invite') || '');
  const [inviteInfo, setInviteInfo] = useState(null);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [boardInvites, setBoardInvites] = useState([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [revokingInviteId, setRevokingInviteId] = useState('');
  const {
    selectedBoardId,
    setSelectedBoardId,
    activeBoard,
    setActiveBoard,
    columns,
    setColumns,
    boardMembers,
    setBoardMembers,
    selectedCardId,
    setSelectedCardId,
    selectedCard,
    setSelectedCard,
    comments,
    setComments,
    cardActivity,
    setCardActivity,
    moveCardInState,
    mergeCardInState,
    removeCardFromState,
    mergeCardActivity,
    resetActiveBoard
  } = useActiveBoard();
  const [savingBoardId, setSavingBoardId] = useState('');
  const [deletingBoardId, setDeletingBoardId] = useState('');
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [columnDrafts, setColumnDrafts] = useState({});
  const [boardError, setBoardError] = useState('');
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [savingColumnId, setSavingColumnId] = useState('');
  const [deletingColumnId, setDeletingColumnId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [removingMemberId, setRemovingMemberId] = useState('');
  const [updatingMemberRoleId, setUpdatingMemberRoleId] = useState('');
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [teamRoleFilter, setTeamRoleFilter] = useState('all');
  const [activeSidebarSection, setActiveSidebarSection] = useState('overview');
  const [cardTitles, setCardTitles] = useState({});
  const [isCreatingCard, setIsCreatingCard] = useState('');
  const [isDeletingCard, setIsDeletingCard] = useState(false);
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
  const [commentBody, setCommentBody] = useState('');
  const [cardDetailsError, setCardDetailsError] = useState('');
  const [isLoadingCardDetails, setIsLoadingCardDetails] = useState(false);
  const [isSavingCardDetails, setIsSavingCardDetails] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (!workspaceRoute.boardId) {
      if (selectedBoardId) {
        closeBoard(false);
      }
      setActiveSidebarSection(workspaceRoute.section);
      return;
    }

    if (workspaceRoute.boardId !== selectedBoardId) {
      openBoard(workspaceRoute.boardId, false, workspaceRoute.section);
      return;
    }

    setActiveSidebarSection(workspaceRoute.section);

    if (
      workspaceRoute.section === 'task' &&
      workspaceRoute.cardId &&
      workspaceRoute.cardId !== selectedCardId
    ) {
      openCard(workspaceRoute.cardId, false);
    }
  }, [user, workspaceRoute, selectedBoardId, selectedCardId]);

  useEffect(() => {
    if (!inviteToken) {
      return;
    }

    setInviteError('');

    getInvite(inviteToken)
      .then((data) => setInviteInfo(data.invite))
      .catch((error) => setInviteError(error.message));
  }, [inviteToken]);

  function handleUnauthorizedSocket() {
        expireSession('انتهت الجلسة أو أنها غير صالحة. سجل الدخول من جديد.');
        resetWorkspace();
        closeBoard(false);
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

      if (selectedBoardId === payload.boardId) {
        closeBoard();
      }
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

      if (selectedCardId === payload.card.id) {
        mergeCardActivity(payload.activity);
      }
    }

    function handleCardUpdated(payload) {
      mergeCardInState(payload.card);

      if (selectedCardId === payload.card.id) {
        mergeCardActivity(payload.activity);
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
      if (selectedCardId === payload.cardId) {
        mergeCardActivity(payload.activity);
      }

      setComments((currentComments) => {
        if (
          selectedCardId !== payload.cardId ||
          currentComments.some((comment) => comment.id === payload.comment.id)
        ) {
          return currentComments;
        }

        return [...currentComments, payload.comment];
      });
    }

    function handleCardDeleted(payload) {
      removeCardFromState(payload.cardId);

      if (selectedCardId === payload.cardId) {
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

      if (user?.id === payload.memberId) {
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

    function handleAccessRevoked(payload) {
      setBoards((currentBoards) => currentBoards.filter((board) => board.id !== payload.boardId));
      closeBoard();
      setBoardsError('تمت إزالة عضويتك من هذه اللوحة.');
    }

    function handlePresenceUpdated(payload) {
      const lastSeenByUser = new Map(
        (payload.memberStatuses || []).map((member) => [member.userId, member.lastSeen])
      );
      setBoardMembers((currentMembers) => currentMembers.map((member) =>
        lastSeenByUser.has(member.id)
          ? { ...member, lastSeen: lastSeenByUser.get(member.id) }
          : member
      ));
    }

    function handleNotificationCreated(payload) {
      receiveNotification(payload.notification);
    }

  const { isConnected, presenceUsers, setPresenceUsers } = useBoardSocket({
    token,
    user,
    boardId: selectedBoardId,
    handlers: {
      'board:updated': handleBoardUpdated,
      'board:deleted': handleBoardDeleted,
      'board:column-created': handleColumnCreated,
      'board:column-updated': handleColumnUpdated,
      'board:column-deleted': handleColumnDeleted,
      'board:card-created': handleCardCreated,
      'board:card-moved': handleCardMoved,
      'board:card-updated': handleCardUpdated,
      'board:card-deleted': handleCardDeleted,
      'board:member-removed': handleMemberRemoved,
      'board:member-updated': handleMemberUpdated,
      'board:comment-created': handleCommentCreated,
      'board:access-revoked': handleAccessRevoked,
      'board:presence': handlePresenceUpdated,
      'notification:created': handleNotificationCreated
    },
    onUnauthorized: handleUnauthorizedSocket,
    onJoinError: (message) => setBoardError(
      message || 'تعذر الانضمام إلى التحديثات الفورية لهذه اللوحة.'
    )
  });

  function updateAuthForm(field, value) {
    setAuthForm((currentForm) => ({ ...currentForm, [field]: value }));
  }

  async function handleOpenNotification(notification) {
    if (!notification) return;

    if (!notification.isRead) {
      await markNotificationRead(notification.id);
    }

    if (notification.entityType === 'card' && notification.boardId && notification.entityId) {
      navigate(`/boards/${encodeURIComponent(notification.boardId)}/tasks/${encodeURIComponent(notification.entityId)}`);
    }
  }

  async function loadBoardMembers(boardId) {
    try {
      const data = await boardApi.getMembers(boardId, token);
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
      await boardApi.removeMember(selectedBoardId, memberId, token);
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
      const data = await boardApi.updateMemberRole(selectedBoardId, memberId, role, token);
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

  async function openBoard(boardId, updateRoute = true, section = 'kanban') {
    if (updateRoute) {
      navigate(`/boards/${encodeURIComponent(boardId)}/${section === 'task' ? 'tasks' : section}`);
    }

    setSelectedBoardId(boardId);
    setActiveBoard(null);
    setColumns([]);
    setPresenceUsers([]);
    setBoardError('');
    setIsLoadingBoard(true);

    try {
      const data = await boardApi.get(boardId, token);
      setActiveBoard(data.board);
      setColumns(data.columns);
      loadBoardMembers(boardId);
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
      setActiveSidebarSection(section);
    } catch (error) {
      setBoardError(error.message);
    } finally {
      setIsLoadingBoard(false);
    }
  }

  function closeBoard(updateRoute = true) {
    resetActiveBoard();
    setNewColumnTitle('');
    setColumnDrafts({});
    setSearchQuery('');
    setPriorityFilter('all');
    setTagFilter('all');
    setAssigneeFilter('all');
    setActiveSidebarSection('overview');
    setPresenceUsers([]);
    setCardTitles({});
    setIsShareDialogOpen(false);
    setBoardInvites([]);
    closeCard(false);

    if (updateRoute) {
      navigate('/');
    }
  }

  function navigateToSection(section) {
    if (section === 'overview') {
      closeBoard();
      return;
    }

    if (section === 'settings') {
      if (selectedBoardId) closeBoard(false);
      setActiveSidebarSection('settings');
      navigate('/settings');
      return;
    }

    if (!selectedBoardId) {
      return;
    }

    if (section === 'share') {
      handleOpenShareDialog();
      return;
    }

    const pathSection = section === 'task' ? 'tasks' : section;
    const cardSuffix = section === 'task' && selectedCardId ? `/${encodeURIComponent(selectedCardId)}` : '';
    navigate(`/boards/${encodeURIComponent(selectedBoardId)}/${pathSection}${cardSuffix}`);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();

    try {
      await submitAuth(authMode, authForm);
      setAuthForm({ name: '', email: '', password: '' });
    } catch {}
  }

  function handleLogout() {
    logout();
    resetWorkspace();
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
      const data = await createBoard(title, token);
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
      const data = await boardApi.createInvite(selectedBoardId, token);
      const nextInviteLink = `${window.location.origin}/?invite=${encodeURIComponent(data.invite.token)}`;
      setInviteLink(nextInviteLink);
      setBoardInvites((currentInvites) => [
        { ...data.invite, createdAt: new Date().toISOString() },
        ...currentInvites.filter((invite) => invite.id !== data.invite.id)
      ]);
      setInviteNotice('تم إنشاء رابط الدعوة. صالح لمدة 7 أيام.');
    } catch (error) {
      setInviteError(error.message);
    } finally {
      setIsCreatingInvite(false);
    }
  }

  async function handleOpenShareDialog() {
    if (!selectedBoardId || activeBoard?.role !== 'owner') {
      return;
    }

    setIsShareDialogOpen(true);
    setInviteError('');
    setInviteNotice('');
    setIsLoadingInvites(true);

    try {
      const data = await boardApi.getInvites(selectedBoardId, token);
      setBoardInvites(data.invites || []);
    } catch (error) {
      setInviteError(error.message);
    } finally {
      setIsLoadingInvites(false);
    }
  }

  async function handleRevokeInvite(inviteId) {
    if (!selectedBoardId || !window.confirm('هل تريد إلغاء رابط الدعوة؟ لن يتمكن أحد من استخدامه بعد الآن.')) {
      return;
    }

    setInviteError('');
    setInviteNotice('');
    setRevokingInviteId(inviteId);

    try {
      await boardApi.revokeInvite(selectedBoardId, inviteId, token);
      setBoardInvites((currentInvites) => currentInvites.filter((invite) => invite.id !== inviteId));
      setInviteNotice('تم إلغاء رابط الدعوة.');
    } catch (error) {
      setInviteError(error.message);
    } finally {
      setRevokingInviteId('');
    }
  }

  async function handleRenameBoard(boardId, title) {
    const nextTitle = String(title || '').trim();

    if (!boardId || !nextTitle) {
      return false;
    }

    setBoardsError('');
    setSavingBoardId(boardId);

    try {
      const data = await boardApi.update(boardId, nextTitle, token);
      setBoards((currentBoards) =>
        currentBoards.map((board) =>
          board.id === data.board.id ? { ...board, ...data.board } : board
        )
      );
      setActiveBoard((currentBoard) =>
        currentBoard?.id === data.board.id ? { ...currentBoard, ...data.board } : currentBoard
      );
      await loadWorkspaceOverview();
      return true;
    } catch (error) {
      setBoardsError(error.message);
      return false;
    } finally {
      setSavingBoardId('');
    }
  }

  async function handleDeleteBoard(boardId, boardTitleToDelete) {
    if (
      !boardId ||
      !window.confirm(`هل تريد حذف مشروع «${boardTitleToDelete}» نهائياً؟ لا يمكن التراجع عن ذلك.`)
    ) {
      return;
    }

    setBoardsError('');
    setDeletingBoardId(boardId);

    try {
      await boardApi.remove(boardId, token);
      setBoards((currentBoards) => currentBoards.filter((board) => board.id !== boardId));
      await loadWorkspaceOverview();

      if (selectedBoardId === boardId) {
        closeBoard();
      }
    } catch (error) {
      setBoardsError(error.message);
    } finally {
      setDeletingBoardId('');
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
      const data = await boardApi.createColumn(selectedBoardId, title, token);
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
      const data = await boardApi.updateColumn(selectedBoardId, columnId, title, token);
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
      await boardApi.removeColumn(selectedBoardId, columnId, token);
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

  async function handleCopyInvite(linkToCopy = inviteLink) {
    const copyValue = typeof linkToCopy === 'string' ? linkToCopy : inviteLink;

    if (!copyValue) {
      return;
    }

    try {
      await navigator.clipboard.writeText(copyValue);
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
      const data = await acceptInvite(inviteToken, token);
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
      const data = await boardApi.createCard(selectedBoardId, columnId, title, token);
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
      await boardApi.moveCard(selectedBoardId, cardId, targetColumnId, targetPosition, token);
      loadWorkspaceOverview();
    } catch (error) {
      setBoardError(error.message);
      openBoard(selectedBoardId);
    }
  }

  async function openCard(cardId, updateRoute = true) {
    if (updateRoute) {
      navigate(`/boards/${encodeURIComponent(selectedBoardId)}/tasks/${encodeURIComponent(cardId)}`);
    }

    setSelectedCardId(cardId);
    setSelectedCard(null);
    setComments([]);
    setCardActivity([]);
    setCardDetailsError('');
    setActiveSidebarSection('task');
    setIsLoadingCardDetails(true);

    try {
      const data = await boardApi.getCard(selectedBoardId, cardId, token);
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
      setCardActivity(data.activity || []);
    } catch (error) {
      setCardDetailsError(error.message);
    } finally {
      setIsLoadingCardDetails(false);
    }
  }

  function closeCard(updateRoute = true) {
    setSelectedCardId('');
    setSelectedCard(null);
    setComments([]);
    setCardActivity([]);
    setCommentBody('');
    setCardDetailsError('');
    setActiveSidebarSection(selectedBoardId ? 'kanban' : 'overview');

    if (updateRoute && selectedBoardId) {
      navigate(`/boards/${encodeURIComponent(selectedBoardId)}/kanban`);
    }
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
      const data = await boardApi.updateCard(selectedBoardId, selectedCardId, payload, token);

      setSelectedCard(data.card);
      mergeCardInState(data.card);
      setCardActivity(data.activity || []);
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
      await boardApi.removeCard(selectedBoardId, selectedCardId, token);
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
      const data = await boardApi.addComment(selectedBoardId, selectedCardId, body, token);
      setComments((currentComments) =>
        currentComments.some((comment) => comment.id === data.comment.id)
          ? currentComments
          : [...currentComments, data.comment]
      );
      setCardActivity(data.activity || []);
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
  const activeBoardTitle = activeSidebarSection === 'settings'
    ? 'الإعدادات العامة'
    : activeBoard?.title || 'لوحة الكانبان';

  return (
    <main className={user ? 'workspace-shell' : 'app-shell'}>
      {user ? (
        <WorkspaceChrome
          boards={boards}
          selectedBoardId={selectedBoardId}
          activeSection={activeSidebarSection}
          activeBoardTitle={activeBoardTitle}
          boardMembersCount={boardMembers.length}
          workspaceStats={workspaceStats}
          isConnected={isConnected}
          presenceUsers={presenceUsers}
          userIsBoardOwner={userIsBoardOwner}
          isDarkMode={isDarkMode}
          notifications={notifications}
          unreadNotificationsCount={unreadNotificationsCount}
          isLoadingNotifications={isLoadingNotifications}
          notificationsError={notificationsError}
          onBoardChange={(boardId) => (boardId ? openBoard(boardId) : closeBoard())}
          onNavigate={navigateToSection}
          onOpenNotification={handleOpenNotification}
          onMarkAllNotificationsRead={markAllNotificationsRead}
          onToggleTheme={toggleTheme}
        />
      ) : null}

      {user && selectedBoardId && isShareDialogOpen ? (
        <ShareBoardDialog
          boardTitle={activeBoardTitle}
          invites={boardInvites}
          isLoading={isLoadingInvites}
          isCreating={isCreatingInvite}
          revokingInviteId={revokingInviteId}
          error={inviteError}
          notice={inviteNotice}
          onClose={() => setIsShareDialogOpen(false)}
          onCreate={handleCreateInvite}
          onCopy={handleCopyInvite}
          onRevoke={handleRevokeInvite}
        />
      ) : null}

      {(!user || (!selectedBoardId && activeSidebarSection === 'overview')) ? (
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

          {!selectedBoardId && activeSidebarSection === 'overview' ? (
            <WorkspaceOverviewPage
              workspaceStats={workspaceStats}
              presenceUsers={presenceUsers}
              isConnected={isConnected}
              isLoadingBoards={isLoadingBoards}
              boards={boards}
              boardTitle={boardTitle}
              isCreatingBoard={isCreatingBoard}
              boardsError={boardsError}
              roleLabels={roleLabels}
              workspaceActivity={workspaceActivity}
              user={user}
              savingBoardId={savingBoardId}
              deletingBoardId={deletingBoardId}
              onBoardTitleChange={setBoardTitle}
              onCreateBoard={handleCreateBoard}
              onOpenBoard={openBoard}
              onRenameBoard={handleRenameBoard}
              onDeleteBoard={handleDeleteBoard}
              onNavigate={navigateToSection}
              onLogout={handleLogout}
            />
          ) : null}

          {!selectedBoardId && activeSidebarSection === 'settings' ? (
            <SettingsPage
              user={user}
              isDarkMode={isDarkMode}
              onToggleTheme={toggleTheme}
              onSaveProfile={saveProfile}
              onSavePassword={savePassword}
              onSaveNotificationPreferences={saveNotificationPreferences}
            />
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
                <TeamPage
                  userIsBoardOwner={userIsBoardOwner}
                  isCreatingInvite={isCreatingInvite}
                  inviteLink={inviteLink}
                  boardMembers={boardMembers}
                  roleCounts={roleCounts}
                  presenceUsers={presenceUsers}
                  teamRoleFilter={teamRoleFilter}
                  teamSearchQuery={teamSearchQuery}
                  filteredBoardMembers={filteredBoardMembers}
                  onlineMemberIds={onlineMemberIds}
                  onlineMemberEmails={onlineMemberEmails}
                  activeBoardTitle={activeBoardTitle}
                  roleLabels={roleLabels}
                  updatingMemberRoleId={updatingMemberRoleId}
                  removingMemberId={removingMemberId}
                  onCreateInvite={handleCreateInvite}
                  onCopyInvite={handleCopyInvite}
                  onRoleFilterChange={setTeamRoleFilter}
                  onSearchChange={setTeamSearchQuery}
                  onUpdateMemberRole={handleUpdateMemberRole}
                  onRemoveMember={handleRemoveMember}
                />
              ) : null}

              {activeSidebarSection === 'kanban' ? (
                <KanbanPage
                  sensors={sensors}
                  searchQuery={searchQuery}
                  priorityFilter={priorityFilter}
                  tagFilter={tagFilter}
                  assigneeFilter={assigneeFilter}
                  allTags={allTags}
                  boardMembers={boardMembers}
                  filteredCardsCount={filteredCardsCount}
                  totalCardsCount={totalCardsCount}
                  hasActiveFilters={hasActiveFilters}
                  isLoadingBoard={isLoadingBoard}
                  userIsBoardOwner={userIsBoardOwner}
                  newColumnTitle={newColumnTitle}
                  isCreatingColumn={isCreatingColumn}
                  filteredColumns={filteredColumns}
                  columnDrafts={columnDrafts}
                  savingColumnId={savingColumnId}
                  deletingColumnId={deletingColumnId}
                  cardTitles={cardTitles}
                  isCreatingCard={isCreatingCard}
                  user={user}
                  onSearchChange={setSearchQuery}
                  onPriorityFilterChange={setPriorityFilter}
                  onTagFilterChange={setTagFilter}
                  onAssigneeFilterChange={setAssigneeFilter}
                  onClearFilters={() => {
                    setSearchQuery('');
                    setPriorityFilter('all');
                    setTagFilter('all');
                    setAssigneeFilter('all');
                  }}
                  onNewColumnTitleChange={setNewColumnTitle}
                  onCreateColumn={handleCreateColumn}
                  onColumnDraftChange={(columnId, value) =>
                    setColumnDrafts((currentDrafts) => ({ ...currentDrafts, [columnId]: value }))
                  }
                  onUpdateColumn={handleUpdateColumn}
                  onDeleteColumn={handleDeleteColumn}
                  onOpenCard={openCard}
                  onCardTitleChange={(columnId, value) =>
                    setCardTitles((currentTitles) => ({ ...currentTitles, [columnId]: value }))
                  }
                  onCreateCard={handleCreateCard}
                  onDragEnd={handleDragEnd}
                />
              ) : null}

              {activeSidebarSection === 'task' ? (
                <TaskDetailsPage
                  selectedCardId={selectedCardId}
                  selectedCard={selectedCard}
                  priorityLabels={priorityLabels}
                  cardDetailsForm={cardDetailsForm}
                  boardMembers={boardMembers}
                  managerMembers={managerMembers}
                  canEditSelectedCardDetails={canEditSelectedCardDetails}
                  canEditSelectedSubtasks={canEditSelectedSubtasks}
                  canDeleteSelectedCard={canDeleteSelectedCard}
                  canSaveSelectedCard={canSaveSelectedCard}
                  isDeletingCard={isDeletingCard}
                  isLoadingCardDetails={isLoadingCardDetails}
                  isSavingCardDetails={isSavingCardDetails}
                  cardDetailsError={cardDetailsError}
                  comments={comments}
                  cardActivity={cardActivity}
                  commentBody={commentBody}
                  isAddingComment={isAddingComment}
                  user={user}
                  setCardDetailsForm={setCardDetailsForm}
                  setCommentBody={setCommentBody}
                  handleDeleteCard={handleDeleteCard}
                  closeCard={closeCard}
                  addTag={addTag}
                  removeTag={removeTag}
                  addChecklistItem={addChecklistItem}
                  updateChecklistItem={updateChecklistItem}
                  removeChecklistItem={removeChecklistItem}
                  handleSaveCardDetails={handleSaveCardDetails}
                  handleAddComment={handleAddComment}
                  navigateToSection={navigateToSection}
                />
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}

export default App;
