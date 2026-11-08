import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { Server } from 'socket.io';
import { db, getDatabaseSummary } from './db.js';
import { createToken, getPublicUser, hashPassword, requireAuth, verifyPassword, verifyToken } from './auth.js';

const app = express();
const port = process.env.PORT || 4000;
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST']
  }
});
const boardPresence = new Map();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const payload = verifyToken(token);

  if (!payload) {
    return next(new Error('Unauthorized'));
  }

  const user = db
    .prepare('SELECT id, name, email, avatar_url AS avatarUrl FROM users WHERE id = ?')
    .get(payload.sub);

  if (!user) {
    return next(new Error('Unauthorized'));
  }

  socket.data.user = user;
  return next();
});

function getPresenceList(boardId) {
  return Array.from(boardPresence.get(boardId)?.values() || []).map((presence) => ({
    id: presence.id,
    name: presence.name,
    email: presence.email,
    avatarUrl: presence.avatarUrl || null,
    socketId: presence.socketIds.values().next().value,
    connectionCount: presence.socketIds.size
  }));
}

function updateConnectedUser(user) {
  const affectedBoards = new Set();

  io.sockets.sockets.forEach((socket) => {
    if (socket.data.user?.id !== user.id) return;

    socket.data.user = {
      ...socket.data.user,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || null
    };

    socket.data.joinedBoards?.forEach((boardId) => {
      const presence = boardPresence.get(boardId)?.get(user.id);
      if (presence) {
        presence.name = user.name;
        presence.email = user.email;
        presence.avatarUrl = user.avatarUrl || null;
        affectedBoards.add(boardId);
      }
    });
  });

  affectedBoards.forEach(emitPresence);
}

function emitPresence(boardId) {
  const memberStatuses = db.prepare(`
    SELECT user_id AS userId, last_seen AS lastSeen
    FROM board_members
    WHERE board_id = ?
  `).all(boardId);

  io.to(`board:${boardId}`).emit('board:presence', {
    boardId,
    users: getPresenceList(boardId),
    memberStatuses
  });
}

function removeSocketFromBoardPresence(boardId, socket) {
  const users = boardPresence.get(boardId);
  const userId = socket.data.user?.id;
  const presence = users?.get(userId);

  if (!presence) {
    return;
  }

  presence.socketIds.delete(socket.id);

  if (presence.socketIds.size === 0) {
    users.delete(userId);
    db.prepare(`
      UPDATE board_members
      SET last_seen = CURRENT_TIMESTAMP
      WHERE board_id = ? AND user_id = ?
    `).run(boardId, userId);
  }

  if (users.size === 0) {
    boardPresence.delete(boardId);
  }

  emitPresence(boardId);
}

function removeSocketFromPresence(socket) {
  const joinedBoards = socket.data.joinedBoards || new Set();

  joinedBoards.forEach((boardId) => removeSocketFromBoardPresence(boardId, socket));

  socket.data.joinedBoards = new Set();
}

function revokeBoardAccess(boardId, userId) {
  const roomName = `board:${boardId}`;
  const users = boardPresence.get(boardId);

  io.sockets.sockets.forEach((socket) => {
    if (socket.data.user?.id !== userId || !socket.data.joinedBoards?.has(boardId)) {
      return;
    }

    socket.emit('board:access-revoked', { boardId });
    socket.leave(roomName);
    socket.data.joinedBoards.delete(boardId);
    users?.delete(userId);
  });

  if (users?.size === 0) {
    boardPresence.delete(boardId);
  }

  emitPresence(boardId);
}

function parseJsonList(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeTags(value) {
  const tags = Array.isArray(value)
    ? value
    : String(value || '')
      .split(',')
      .map((tag) => tag.trim());

  return Array.from(new Set(tags.filter(Boolean))).slice(0, 8);
}

function normalizeChecklist(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedStatuses = new Set(['todo', 'in_progress', 'done']);

  return value
    .map((item) => {
      const requestedStatus = String(item.status || '').trim();
      const status = allowedStatuses.has(requestedStatus)
        ? requestedStatus
        : item.done
          ? 'done'
          : 'todo';

      return {
        id: item.id || randomUUID(),
        text: String(item.text || '').trim(),
        assigneeId: String(item.assigneeId || '').trim(),
        status
      };
    })
    .filter((item) => item.text)
    .slice(0, 20);
}

function serializeCard(card) {
  if (!card) {
    return card;
  }

  const checklist = parseJsonList(card.checklist);
  const completedChecklistItems = checklist.filter((item) => item.status === 'done' || item.done).length;

  return {
    ...card,
    priority: card.priority || 'normal',
    tags: parseJsonList(card.tags),
    checklist: normalizeChecklist(checklist),
    completedChecklistItems,
    checklistTotal: checklist.length
  };
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'collab-tool-server',
    database: 'connected'
  });
});

app.get('/api/db/summary', (req, res) => {
  res.json(getDatabaseSummary());
});

app.post('/api/auth/register', (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || password.length < 6) {
    return res.status(400).json({
      message: 'Name, valid email, and password with at least 6 characters are required'
    });
  }

  const user = {
    id: randomUUID(),
    name,
    email,
    passwordHash: hashPassword(password)
  };

  try {
    db.prepare('INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)')
      .run(user.id, user.name, user.email, user.passwordHash);
  } catch (error) {
    const isDuplicateEmail =
      error.code === 'ERR_SQLITE_CONSTRAINT_UNIQUE' ||
      (error.code === 'ERR_SQLITE_ERROR' && error.message?.includes('UNIQUE constraint failed: users.email'));

    if (isDuplicateEmail) {
      return res.status(409).json({ message: 'Email is already registered' });
    }

    throw error;
  }

  const publicUser = getPublicUser(user);

  return res.status(201).json({
    token: createToken(publicUser),
    user: publicUser
  });
});

app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const publicUser = getPublicUser(user);

  return res.json({
    token: createToken(publicUser),
    user: publicUser
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: getPublicUser(req.user) });
});

app.patch('/api/auth/profile', requireAuth, (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();

  if (!name || !email || !email.includes('@')) {
    return res.status(400).json({ message: 'Valid name and email are required' });
  }

  try {
    db.prepare(`
      UPDATE users SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(name, email, req.user.id);
  } catch (error) {
    if (error.message?.includes('UNIQUE constraint failed: users.email')) {
      return res.status(409).json({ message: 'Email is already registered' });
    }
    throw error;
  }

  const user = db.prepare(`
    SELECT id, name, email, avatar_url AS avatarUrl, created_at AS createdAt,
      notify_assignments AS notifyAssignments,
      notify_comments AS notifyComments
    FROM users WHERE id = ?
  `).get(req.user.id);
  const publicUser = getPublicUser(user);
  updateConnectedUser(publicUser);
  res.json({ user: publicUser, token: createToken(publicUser) });
});

app.patch('/api/auth/avatar', requireAuth, (req, res) => {
  const avatarUrl = req.body.avatarUrl == null ? null : String(req.body.avatarUrl);
  const avatarPattern = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

  if (avatarUrl) {
    const match = avatarUrl.match(avatarPattern);
    const decodedSize = match ? Buffer.byteLength(match[1], 'base64') : 0;

    if (!match) {
      return res.status(400).json({ message: 'Avatar must be a JPEG, PNG, or WebP image' });
    }

    if (decodedSize > 350 * 1024) {
      return res.status(400).json({ message: 'Avatar image is too large' });
    }
  }

  db.prepare(`
    UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(avatarUrl, req.user.id);

  const user = db.prepare(`
    SELECT id, name, email, avatar_url AS avatarUrl, created_at AS createdAt,
      notify_assignments AS notifyAssignments,
      notify_comments AS notifyComments
    FROM users WHERE id = ?
  `).get(req.user.id);
  const publicUser = getPublicUser(user);
  updateConnectedUser(publicUser);
  res.json({ user: publicUser });
});

app.patch('/api/auth/password', requireAuth, (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  const user = db.prepare('SELECT password_hash AS passwordHash FROM users WHERE id = ?')
    .get(req.user.id);

  if (!verifyPassword(currentPassword, user.passwordHash)) {
    return res.status(400).json({ message: 'Current password is incorrect' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must contain at least 6 characters' });
  }

  db.prepare(`
    UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(hashPassword(newPassword), req.user.id);
  res.json({ ok: true });
});

app.patch('/api/auth/preferences', requireAuth, (req, res) => {
  const assignments = req.body.assignments !== false;
  const comments = req.body.comments !== false;
  db.prepare(`
    UPDATE users
    SET notify_assignments = ?, notify_comments = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(assignments ? 1 : 0, comments ? 1 : 0, req.user.id);

  res.json({ notificationPreferences: { assignments, comments } });
});

app.get('/api/notifications', requireAuth, (req, res) => {
  const notifications = db.prepare(`
    SELECT
      notifications.id,
      notifications.user_id AS userId,
      notifications.board_id AS boardId,
      notifications.type,
      notifications.entity_type AS entityType,
      notifications.entity_id AS entityId,
      notifications.message,
      notifications.is_read AS isRead,
      notifications.created_at AS createdAt,
      users.name AS actorName,
      users.avatar_url AS actorAvatarUrl,
      boards.title AS boardTitle
    FROM notifications
    LEFT JOIN users ON users.id = notifications.actor_id
    INNER JOIN boards ON boards.id = notifications.board_id
    WHERE notifications.user_id = ?
    ORDER BY notifications.created_at DESC, notifications.rowid DESC
    LIMIT 50
  `).all(req.user.id);
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  res.json({ notifications, unreadCount });
});

app.patch('/api/notifications/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0')
    .run(req.user.id);
  res.json({ ok: true });
});

app.patch('/api/notifications/:notificationId/read', requireAuth, (req, res) => {
  const result = db.prepare(`
    UPDATE notifications
    SET is_read = 1
    WHERE id = ? AND user_id = ?
  `).run(req.params.notificationId, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ message: 'Notification not found' });
  }

  res.json({ notificationId: req.params.notificationId });
});

function getBoardForUser(boardId, userId) {
  return db
    .prepare(`
      SELECT
        boards.id,
        boards.owner_id AS ownerId,
        boards.title,
        board_members.role,
        boards.created_at AS createdAt,
        boards.updated_at AS updatedAt
      FROM boards
      INNER JOIN board_members ON board_members.board_id = boards.id
      WHERE boards.id = ?
        AND board_members.user_id = ?
    `)
    .get(boardId, userId);
}

function isOwner(board) {
  return board?.role === 'owner';
}

function isBoardManager(board) {
  return board?.role === 'manager';
}

function isCardManager(card, userId) {
  return card?.assigneeId === userId;
}

function requireOwner(board, res) {
  if (isOwner(board)) {
    return true;
  }

  res.status(403).json({ message: 'Only the board owner can do this action' });
  return false;
}

function logActivity(boardId, userId, action, entityType, entityId, metadata = {}) {
  db.prepare(`
    INSERT INTO activity_logs (id, board_id, user_id, action, entity_type, entity_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), boardId, userId, action, entityType, entityId, JSON.stringify(metadata));
}

function createNotification({ userId, boardId, actorId, type, entityType, entityId, message }) {
  if (!userId || userId === actorId) {
    return null;
  }

  const preferences = db.prepare(`
    SELECT notify_assignments AS assignments, notify_comments AS comments
    FROM users WHERE id = ?
  `).get(userId);
  const isCommentNotification = type === 'card_commented';

  if (!preferences || (isCommentNotification ? !preferences.comments : !preferences.assignments)) {
    return null;
  }

  const notificationId = randomUUID();
  db.prepare(`
    INSERT INTO notifications (
      id, user_id, board_id, actor_id, type, entity_type, entity_id, message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(notificationId, userId, boardId, actorId, type, entityType, entityId, message);

  const notification = db.prepare(`
    SELECT
      notifications.id,
      notifications.user_id AS userId,
      notifications.board_id AS boardId,
      notifications.type,
      notifications.entity_type AS entityType,
      notifications.entity_id AS entityId,
      notifications.message,
      notifications.is_read AS isRead,
      notifications.created_at AS createdAt,
      users.name AS actorName,
      users.avatar_url AS actorAvatarUrl,
      boards.title AS boardTitle
    FROM notifications
    LEFT JOIN users ON users.id = notifications.actor_id
    INNER JOIN boards ON boards.id = notifications.board_id
    WHERE notifications.id = ?
  `).get(notificationId);

  io.to(`user:${userId}`).emit('notification:created', { notification });
  return notification;
}

function isCompletionColumnTitle(title) {
  const normalizedTitle = String(title || '').trim().toLowerCase();
  return ['done', 'complete', 'completed', 'مكتملة', 'تم', 'منجزة'].some((word) => normalizedTitle.includes(word));
}

function getWorkspaceStats(userId) {
  const boards = db
    .prepare(`
      SELECT boards.id, boards.title, board_members.role, boards.updated_at AS updatedAt
      FROM boards
      INNER JOIN board_members ON board_members.board_id = boards.id
      WHERE board_members.user_id = ?
    `)
    .all(userId);

  if (boards.length === 0) {
    return {
      boards: { total: 0, owned: 0, shared: 0 },
      cards: { total: 0, completed: 0, completedThisWeek: 0 },
      checklist: { total: 0, completed: 0 },
      velocity: 0,
      storage: { usedPercent: 0, usedLabel: '0 GB', limitLabel: '20 GB' }
    };
  }

  const boardIds = new Set(boards.map((board) => board.id));
  const cards = db
    .prepare(`
      SELECT cards.id, cards.checklist, cards.updated_at AS updatedAt, board_columns.title AS columnTitle
      FROM cards
      INNER JOIN board_columns ON board_columns.id = cards.column_id
      INNER JOIN board_members ON board_members.board_id = board_columns.board_id
      WHERE board_members.user_id = ?
        AND cards.deleted_at IS NULL
    `)
    .all(userId);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const completedCards = cards.filter((card) => isCompletionColumnTitle(card.columnTitle));
  const completedThisWeek = completedCards.filter((card) => new Date(card.updatedAt).getTime() >= weekAgo).length;
  const checklist = cards.flatMap((card) => parseJsonList(card.checklist));
  const completedChecklist = checklist.filter((item) => item.status === 'done' || item.done).length;
  const completionUnits = cards.length + checklist.length;
  const completedUnits = completedCards.length + completedChecklist;

  return {
    boards: {
      total: boards.length,
      owned: boards.filter((board) => board.role === 'owner').length,
      shared: boards.filter((board) => board.role !== 'owner').length
    },
    cards: {
      total: cards.length,
      completed: completedCards.length,
      completedThisWeek
    },
    checklist: {
      total: checklist.length,
      completed: completedChecklist
    },
    velocity: completionUnits ? Math.round((completedUnits / completionUnits) * 1000) / 10 : 0,
    storage: {
      usedPercent: Math.min(78, Math.max(0, Math.round((cards.length + boardIds.size) * 3))),
      usedLabel: `${Math.min(15.6, Math.round((cards.length + boardIds.size) * 0.18 * 10) / 10)} GB`,
      limitLabel: '20 GB'
    }
  };
}

function canUpdateOwnSubtaskStatuses(previousChecklist, nextChecklist, userId) {
  if (previousChecklist.length !== nextChecklist.length) {
    return false;
  }

  const previousItems = new Map(previousChecklist.map((item) => [item.id, item]));

  return nextChecklist.every((nextItem) => {
    const previousItem = previousItems.get(nextItem.id);

    if (!previousItem) {
      return false;
    }

    const sameText = previousItem.text === nextItem.text;
    const sameAssignee = (previousItem.assigneeId || '') === (nextItem.assigneeId || '');

    if (!sameText || !sameAssignee) {
      return false;
    }

    if (previousItem.status === nextItem.status) {
      return true;
    }

    return nextItem.assigneeId === userId;
  });
}

function getCardForBoard(cardId, boardId) {
  const card = db
    .prepare(`
      SELECT
        cards.id,
        cards.column_id AS columnId,
        cards.title,
        cards.description,
        cards.assignee_id AS assigneeId,
        assignee.name AS assigneeName,
        assignee.avatar_url AS assigneeAvatarUrl,
        cards.due_date AS dueDate,
        cards.priority,
        cards.tags,
        cards.checklist,
        cards.position,
        cards.version,
        cards.created_at AS createdAt,
        cards.updated_at AS updatedAt
      FROM cards
      INNER JOIN board_columns ON board_columns.id = cards.column_id
      LEFT JOIN users AS assignee ON assignee.id = cards.assignee_id
      WHERE cards.id = ?
        AND board_columns.board_id = ?
        AND cards.deleted_at IS NULL
    `)
    .get(cardId, boardId);

  return serializeCard(card);
}

function getBoardMembers(boardId) {
  return db
    .prepare(`
      SELECT
        users.id,
        users.name,
        users.email,
        users.avatar_url AS avatarUrl,
        board_members.role,
        board_members.joined_at AS joinedAt,
        board_members.last_seen AS lastSeen
      FROM board_members
      INNER JOIN users ON users.id = board_members.user_id
      WHERE board_members.board_id = ?
      ORDER BY
        CASE board_members.role
          WHEN 'owner' THEN 0
          WHEN 'manager' THEN 1
          ELSE 2
        END,
        users.name ASC
    `)
    .all(boardId);
}

function getCommentsForCard(cardId) {
  return db
    .prepare(`
      SELECT
        comments.id,
        comments.card_id AS cardId,
        comments.user_id AS userId,
        users.name AS authorName,
        users.avatar_url AS authorAvatarUrl,
        comments.body,
        comments.created_at AS createdAt,
        comments.updated_at AS updatedAt
      FROM comments
      INNER JOIN users ON users.id = comments.user_id
      WHERE comments.card_id = ?
      ORDER BY comments.created_at ASC
    `)
    .all(cardId);
}

function getActivityForCard(cardId, boardId) {
  return db
    .prepare(`
      SELECT
        activity_logs.id,
        activity_logs.action,
        activity_logs.entity_type AS entityType,
        activity_logs.entity_id AS entityId,
        activity_logs.metadata,
        activity_logs.created_at AS createdAt,
        users.name AS actorName,
        users.email AS actorEmail,
        users.avatar_url AS actorAvatarUrl
      FROM activity_logs
      LEFT JOIN users ON users.id = activity_logs.user_id
      WHERE activity_logs.board_id = ?
        AND activity_logs.entity_type = 'card'
        AND activity_logs.entity_id = ?
      ORDER BY activity_logs.created_at DESC, activity_logs.rowid DESC
      LIMIT 50
    `)
    .all(boardId, cardId)
    .map((activity) => ({
      ...activity,
      metadata: JSON.parse(activity.metadata || '{}')
    }));
}

function getBoardOverviewStats(boardId) {
  const cards = db
    .prepare(`
      SELECT cards.checklist, board_columns.title AS columnTitle
      FROM cards
      INNER JOIN board_columns ON board_columns.id = cards.column_id
      WHERE board_columns.board_id = ?
        AND cards.deleted_at IS NULL
    `)
    .all(boardId);
  const members = getBoardMembers(boardId);
  const completedCards = cards.filter((card) => isCompletionColumnTitle(card.columnTitle)).length;
  const checklist = cards.flatMap((card) => parseJsonList(card.checklist));
  const completedSubtasks = checklist.filter((item) => item.status === 'done' || item.done).length;
  const totalWorkItems = cards.length + checklist.length;
  const completedWorkItems = completedCards + completedSubtasks;

  return {
    cardsTotal: cards.length,
    cardsCompleted: completedCards,
    subtasksTotal: checklist.length,
    subtasksCompleted: completedSubtasks,
    progress: totalWorkItems
      ? Math.round((completedWorkItems / totalWorkItems) * 1000) / 10
      : 0,
    memberCount: members.length,
    memberPreview: members.slice(0, 3).map((member) => ({
      id: member.id,
      name: member.name,
      avatarUrl: member.avatarUrl || null
    }))
  };
}

app.get('/api/boards', requireAuth, (req, res) => {
  const boards = db
    .prepare(`
      SELECT
        boards.id,
        boards.title,
        board_members.role,
        boards.created_at AS createdAt,
        boards.updated_at AS updatedAt
      FROM boards
      INNER JOIN board_members ON board_members.board_id = boards.id
      WHERE board_members.user_id = ?
      ORDER BY boards.updated_at DESC
    `)
    .all(req.user.id)
    .map((board) => ({
      ...board,
      stats: getBoardOverviewStats(board.id)
    }));

  res.json({ boards });
});

app.get('/api/workspace/stats', requireAuth, (req, res) => {
  res.json({ stats: getWorkspaceStats(req.user.id) });
});

app.get('/api/workspace/activity', requireAuth, (req, res) => {
  const loggedActivity = db
    .prepare(`
      SELECT
        activity_logs.id,
        activity_logs.action,
        activity_logs.entity_type AS entityType,
        activity_logs.entity_id AS entityId,
        activity_logs.metadata,
        activity_logs.created_at AS createdAt,
        boards.title AS boardTitle,
        users.name AS actorName,
        users.avatar_url AS actorAvatarUrl
      FROM activity_logs
      INNER JOIN board_members ON board_members.board_id = activity_logs.board_id
      INNER JOIN boards ON boards.id = activity_logs.board_id
      LEFT JOIN users ON users.id = activity_logs.user_id
      WHERE board_members.user_id = ?
      ORDER BY activity_logs.created_at DESC
      LIMIT 12
    `)
    .all(req.user.id)
    .map((item) => ({ ...item, metadata: JSON.parse(item.metadata || '{}') }));

  if (loggedActivity.length > 0) {
    return res.json({ activity: loggedActivity });
  }

  const fallbackActivity = db
    .prepare(`
      SELECT
        comments.id,
        'commented' AS action,
        'comment' AS entityType,
        comments.card_id AS entityId,
        comments.created_at AS createdAt,
        boards.title AS boardTitle,
        users.name AS actorName,
        users.avatar_url AS actorAvatarUrl,
        cards.title AS cardTitle
      FROM comments
      INNER JOIN cards ON cards.id = comments.card_id
      INNER JOIN board_columns ON board_columns.id = cards.column_id
      INNER JOIN boards ON boards.id = board_columns.board_id
      INNER JOIN board_members ON board_members.board_id = boards.id
      INNER JOIN users ON users.id = comments.user_id
      WHERE board_members.user_id = ?
      ORDER BY comments.created_at DESC
      LIMIT 12
    `)
    .all(req.user.id)
    .map((item) => ({ ...item, metadata: { cardTitle: item.cardTitle } }));

  res.json({ activity: fallbackActivity });
});

app.post('/api/boards', requireAuth, (req, res) => {
  const title = String(req.body.title || '').trim();

  if (!title) {
    return res.status(400).json({ message: 'Board title is required' });
  }

  const board = {
    id: randomUUID(),
    title
  };
  const defaultColumns = ['To Do', 'In Progress', 'Done'];

  try {
    db.exec('BEGIN');
    db.prepare('INSERT INTO boards (id, owner_id, title) VALUES (?, ?, ?)')
      .run(board.id, req.user.id, board.title);
    db.prepare('INSERT INTO board_members (board_id, user_id, role) VALUES (?, ?, ?)')
      .run(board.id, req.user.id, 'owner');
    logActivity(board.id, req.user.id, 'created', 'board', board.id, { title: board.title });

    const insertColumn = db.prepare(
      'INSERT INTO board_columns (id, board_id, title, position) VALUES (?, ?, ?, ?)'
    );

    defaultColumns.forEach((columnTitle, index) => {
      insertColumn.run(randomUUID(), board.id, columnTitle, index);
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const createdBoard = getBoardForUser(board.id, req.user.id);

  res.status(201).json({ board: createdBoard });
});

app.patch('/api/boards/:boardId', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  if (!requireOwner(board, res)) {
    return;
  }

  const title = String(req.body.title || '').trim();

  if (!title) {
    return res.status(400).json({ message: 'Board title is required' });
  }

  db.prepare('UPDATE boards SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(title, board.id);
  logActivity(board.id, req.user.id, 'updated', 'board', board.id, { title });

  const updatedBoard = getBoardForUser(board.id, req.user.id);

  io.to(`board:${board.id}`).emit('board:updated', {
    board: updatedBoard
  });

  res.json({ board: updatedBoard });
});

app.delete('/api/boards/:boardId', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  if (!requireOwner(board, res)) {
    return;
  }

  db.prepare('DELETE FROM boards WHERE id = ?').run(board.id);

  io.to(`board:${board.id}`).emit('board:deleted', {
    boardId: board.id
  });

  res.json({ boardId: board.id });
});

app.post('/api/boards/:boardId/invites', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  if (!requireOwner(board, res)) {
    return;
  }

  const inviteId = randomUUID();
  const token = randomUUID().replaceAll('-', '');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO board_invites (id, board_id, token, created_by, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(inviteId, board.id, token, req.user.id, expiresAt);

  res.status(201).json({
    invite: {
      id: inviteId,
      boardId: board.id,
      token,
      expiresAt
    }
  });
});

app.get('/api/boards/:boardId/invites', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  if (!requireOwner(board, res)) {
    return;
  }

  const invites = db
    .prepare(`
      SELECT
        id,
        board_id AS boardId,
        token,
        expires_at AS expiresAt,
        created_at AS createdAt
      FROM board_invites
      WHERE board_id = ?
        AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC
    `)
    .all(board.id);

  return res.json({ invites });
});

app.delete('/api/boards/:boardId/invites/:inviteId', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  if (!requireOwner(board, res)) {
    return;
  }

  const result = db
    .prepare('DELETE FROM board_invites WHERE id = ? AND board_id = ?')
    .run(req.params.inviteId, board.id);

  if (result.changes === 0) {
    return res.status(404).json({ message: 'Invite not found' });
  }

  return res.json({ inviteId: req.params.inviteId });
});

app.get('/api/invites/:token', (req, res) => {
  const invite = db
    .prepare(`
      SELECT
        board_invites.id,
        board_invites.board_id AS boardId,
        board_invites.token,
        board_invites.expires_at AS expiresAt,
        boards.title AS boardTitle,
        users.name AS inviterName
      FROM board_invites
      INNER JOIN boards ON boards.id = board_invites.board_id
      INNER JOIN users ON users.id = board_invites.created_by
      WHERE board_invites.token = ?
    `)
    .get(req.params.token);

  if (!invite) {
    return res.status(404).json({ message: 'Invite not found' });
  }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return res.status(410).json({ message: 'Invite has expired' });
  }

  res.json({ invite });
});

app.post('/api/invites/:token/accept', requireAuth, (req, res) => {
  const invite = db
    .prepare(`
      SELECT board_invites.board_id AS boardId, board_invites.expires_at AS expiresAt
      FROM board_invites
      WHERE board_invites.token = ?
    `)
    .get(req.params.token);

  if (!invite) {
    return res.status(404).json({ message: 'Invite not found' });
  }

  if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
    return res.status(410).json({ message: 'Invite has expired' });
  }

  db.prepare(`
    INSERT OR IGNORE INTO board_members (board_id, user_id, role)
    VALUES (?, ?, ?)
  `).run(invite.boardId, req.user.id, 'member');
  logActivity(invite.boardId, req.user.id, 'joined', 'board', invite.boardId);

  const board = getBoardForUser(invite.boardId, req.user.id);

  res.json({ board });
});

app.get('/api/boards/:boardId', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  const columns = db
    .prepare(`
      SELECT id, title, position, created_at AS createdAt, updated_at AS updatedAt
      FROM board_columns
      WHERE board_id = ?
      ORDER BY position ASC
    `)
    .all(board.id);

  const cards = db
    .prepare(`
      SELECT
        cards.id,
        cards.column_id AS columnId,
        cards.title,
        cards.description,
        cards.assignee_id AS assigneeId,
        assignee.name AS assigneeName,
        assignee.avatar_url AS assigneeAvatarUrl,
        cards.due_date AS dueDate,
        cards.priority,
        cards.tags,
        cards.checklist,
        cards.position,
        cards.version,
        cards.created_at AS createdAt,
        cards.updated_at AS updatedAt
      FROM cards
      LEFT JOIN users AS assignee ON assignee.id = cards.assignee_id
      WHERE cards.column_id IN (
        SELECT id FROM board_columns WHERE board_id = ?
      )
        AND cards.deleted_at IS NULL
      ORDER BY cards.position ASC, cards.created_at ASC
    `)
    .all(board.id);

  const columnsWithCards = columns.map((column) => ({
    ...column,
    cards: cards.filter((card) => card.columnId === column.id).map(serializeCard)
  }));

  res.json({
    board,
    columns: columnsWithCards
  });
});

app.get('/api/boards/:boardId/members', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  res.json({ members: getBoardMembers(board.id) });
});

app.patch('/api/boards/:boardId/members/:memberId', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  if (!requireOwner(board, res)) {
    return;
  }

  if (req.params.memberId === board.ownerId) {
    return res.status(400).json({ message: 'The board owner role cannot be changed' });
  }

  const role = String(req.body.role || '').trim();
  const allowedRoles = new Set(['manager', 'member']);

  if (!allowedRoles.has(role)) {
    return res.status(400).json({ message: 'Role must be manager or member' });
  }

  const member = db
    .prepare('SELECT user_id AS userId FROM board_members WHERE board_id = ? AND user_id = ?')
    .get(board.id, req.params.memberId);

  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }

  db.prepare('UPDATE board_members SET role = ? WHERE board_id = ? AND user_id = ?')
    .run(role, board.id, req.params.memberId);

  if (role === 'member') {
    db.prepare(`
      UPDATE cards
      SET assignee_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE assignee_id = ?
        AND column_id IN (SELECT id FROM board_columns WHERE board_id = ?)
    `).run(req.params.memberId, board.id);
  }

  db.prepare('UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(board.id);
  logActivity(board.id, req.user.id, 'updated_role', 'member', req.params.memberId, { role });

  const updatedMember = getBoardMembers(board.id).find((item) => item.id === req.params.memberId);

  io.to(`board:${board.id}`).emit('board:member-updated', {
    boardId: board.id,
    member: updatedMember
  });

  res.json({ member: updatedMember });
});

app.delete('/api/boards/:boardId/members/:memberId', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  if (!requireOwner(board, res)) {
    return;
  }

  if (req.params.memberId === board.ownerId) {
    return res.status(400).json({ message: 'The board owner cannot be removed' });
  }

  const member = db
    .prepare('SELECT user_id AS userId FROM board_members WHERE board_id = ? AND user_id = ?')
    .get(board.id, req.params.memberId);

  if (!member) {
    return res.status(404).json({ message: 'Member not found' });
  }

  db.prepare('DELETE FROM board_members WHERE board_id = ? AND user_id = ?')
    .run(board.id, req.params.memberId);
  db.prepare('UPDATE cards SET assignee_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE assignee_id = ? AND column_id IN (SELECT id FROM board_columns WHERE board_id = ?)')
    .run(req.params.memberId, board.id);

  const cardsWithSubtasks = db
    .prepare(`
      SELECT id, checklist
      FROM cards
      WHERE column_id IN (SELECT id FROM board_columns WHERE board_id = ?)
        AND deleted_at IS NULL
    `)
    .all(board.id);
  const updateChecklist = db.prepare('UPDATE cards SET checklist = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');

  cardsWithSubtasks.forEach((card) => {
    const checklist = normalizeChecklist(parseJsonList(card.checklist));
    const nextChecklist = checklist.map((item) =>
      item.assigneeId === req.params.memberId ? { ...item, assigneeId: '' } : item
    );

    if (JSON.stringify(checklist) !== JSON.stringify(nextChecklist)) {
      updateChecklist.run(JSON.stringify(nextChecklist), card.id);
    }
  });

  db.prepare('UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(board.id);

  revokeBoardAccess(board.id, req.params.memberId);

  io.to(`board:${board.id}`).emit('board:member-removed', {
    boardId: board.id,
    memberId: req.params.memberId
  });

  res.json({ memberId: req.params.memberId });
});

app.post('/api/boards/:boardId/columns', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  if (!requireOwner(board, res)) {
    return;
  }

  const title = String(req.body.title || '').trim();

  if (!title) {
    return res.status(400).json({ message: 'Column title is required' });
  }

  const position =
    db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS position FROM board_columns WHERE board_id = ?')
      .get(board.id).position || 0;
  const columnId = randomUUID();

  db.prepare('INSERT INTO board_columns (id, board_id, title, position) VALUES (?, ?, ?, ?)')
    .run(columnId, board.id, title, position);
  db.prepare('UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(board.id);

  const column = db
    .prepare(`
      SELECT id, title, position, created_at AS createdAt, updated_at AS updatedAt
      FROM board_columns
      WHERE id = ?
    `)
    .get(columnId);
  const columnWithCards = { ...column, cards: [] };

  io.to(`board:${board.id}`).emit('board:column-created', {
    boardId: board.id,
    column: columnWithCards
  });

  res.status(201).json({ column: columnWithCards });
});

app.patch('/api/boards/:boardId/columns/:columnId', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  if (!requireOwner(board, res)) {
    return;
  }

  const column = db
    .prepare('SELECT id FROM board_columns WHERE id = ? AND board_id = ?')
    .get(req.params.columnId, board.id);

  if (!column) {
    return res.status(404).json({ message: 'Column not found' });
  }

  const title = String(req.body.title || '').trim();

  if (!title) {
    return res.status(400).json({ message: 'Column title is required' });
  }

  db.prepare('UPDATE board_columns SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(title, column.id);
  db.prepare('UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(board.id);

  const updatedColumn = db
    .prepare(`
      SELECT id, title, position, created_at AS createdAt, updated_at AS updatedAt
      FROM board_columns
      WHERE id = ?
    `)
    .get(column.id);

  io.to(`board:${board.id}`).emit('board:column-updated', {
    boardId: board.id,
    column: updatedColumn
  });

  res.json({ column: updatedColumn });
});

app.delete('/api/boards/:boardId/columns/:columnId', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  if (!requireOwner(board, res)) {
    return;
  }

  const column = db
    .prepare('SELECT id FROM board_columns WHERE id = ? AND board_id = ?')
    .get(req.params.columnId, board.id);

  if (!column) {
    return res.status(404).json({ message: 'Column not found' });
  }

  db.prepare('DELETE FROM board_columns WHERE id = ?').run(column.id);
  db.prepare('UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(board.id);

  const remainingColumns = db
    .prepare('SELECT id FROM board_columns WHERE board_id = ? ORDER BY position ASC')
    .all(board.id);
  const updatePosition = db.prepare('UPDATE board_columns SET position = ? WHERE id = ?');
  remainingColumns.forEach((remainingColumn, index) => {
    updatePosition.run(index, remainingColumn.id);
  });

  io.to(`board:${board.id}`).emit('board:column-deleted', {
    boardId: board.id,
    columnId: column.id
  });

  res.json({ columnId: column.id });
});

app.post('/api/boards/:boardId/columns/:columnId/cards', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  if (!requireOwner(board, res)) {
    return;
  }

  const column = db
    .prepare('SELECT id FROM board_columns WHERE id = ? AND board_id = ?')
    .get(req.params.columnId, board.id);

  if (!column) {
    return res.status(404).json({ message: 'Column not found' });
  }

  const title = String(req.body.title || '').trim();

  if (!title) {
    return res.status(400).json({ message: 'Card title is required' });
  }

  const nextPosition =
    db
      .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS position FROM cards WHERE column_id = ?')
      .get(column.id).position || 0;
  const cardId = randomUUID();

  db.prepare('INSERT INTO cards (id, column_id, title, position) VALUES (?, ?, ?, ?)')
    .run(cardId, column.id, title, nextPosition);
  db.prepare('UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(board.id);
  logActivity(board.id, req.user.id, 'created', 'card', cardId, { title });

  const card = db
    .prepare(`
      SELECT
        cards.id,
        cards.column_id AS columnId,
        cards.title,
        cards.description,
        cards.assignee_id AS assigneeId,
        assignee.name AS assigneeName,
        assignee.avatar_url AS assigneeAvatarUrl,
        cards.due_date AS dueDate,
        cards.priority,
        cards.tags,
        cards.checklist,
        cards.position,
        cards.version,
        cards.created_at AS createdAt,
        cards.updated_at AS updatedAt
      FROM cards
      LEFT JOIN users AS assignee ON assignee.id = cards.assignee_id
      WHERE cards.id = ?
    `)
    .get(cardId);
  const serializedCard = serializeCard(card);

  io.to(`board:${board.id}`).emit('board:card-created', {
    boardId: board.id,
    columnId: column.id,
    card: serializedCard
  });

  res.status(201).json({ card: serializedCard });
});

app.patch('/api/boards/:boardId/cards/:cardId/move', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  const targetColumnId = String(req.body.columnId || '');
  const requestedPosition = Number(req.body.position);
  const targetColumn = db
    .prepare('SELECT id FROM board_columns WHERE id = ? AND board_id = ?')
    .get(targetColumnId, board.id);

  if (!targetColumn || Number.isNaN(requestedPosition)) {
    return res.status(400).json({ message: 'Valid target column and position are required' });
  }

  const card = db
    .prepare(`
      SELECT cards.id, cards.column_id AS columnId, cards.assignee_id AS assigneeId
      FROM cards
      INNER JOIN board_columns ON board_columns.id = cards.column_id
      WHERE cards.id = ?
        AND board_columns.board_id = ?
        AND cards.deleted_at IS NULL
    `)
    .get(req.params.cardId, board.id);

  if (!card) {
    return res.status(404).json({ message: 'Card not found' });
  }

  if (!isOwner(board) && !isCardManager(card, req.user.id)) {
    return res.status(403).json({ message: 'Only the owner or card manager can move this card' });
  }

  const siblingCards = db
    .prepare(`
      SELECT id
      FROM cards
      WHERE column_id = ?
        AND id != ?
        AND deleted_at IS NULL
      ORDER BY position ASC, created_at ASC
    `)
    .all(targetColumn.id, card.id);
  const insertAt = Math.max(0, Math.min(requestedPosition, siblingCards.length));
  const orderedCardIds = siblingCards.map((siblingCard) => siblingCard.id);

  orderedCardIds.splice(insertAt, 0, card.id);

  try {
    db.exec('BEGIN');
    db.prepare(`
      UPDATE cards
      SET column_id = ?, position = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(targetColumn.id, insertAt, card.id);

    const updatePosition = db.prepare('UPDATE cards SET position = ? WHERE id = ?');
    orderedCardIds.forEach((cardId, index) => {
      updatePosition.run(index, cardId);
    });

    if (card.columnId !== targetColumn.id) {
      const sourceCards = db
        .prepare(`
          SELECT id
          FROM cards
          WHERE column_id = ?
            AND deleted_at IS NULL
          ORDER BY position ASC, created_at ASC
        `)
        .all(card.columnId);
      sourceCards.forEach((sourceCard, index) => {
        updatePosition.run(index, sourceCard.id);
      });
    }

    db.prepare('UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(board.id);
    const targetColumnTitle = db
      .prepare('SELECT title FROM board_columns WHERE id = ?')
      .get(targetColumn.id)?.title;
    logActivity(board.id, req.user.id, 'moved', 'card', card.id, {
      columnId: targetColumn.id,
      columnTitle: targetColumnTitle
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const movedCard = db
    .prepare(`
      SELECT
        cards.id,
        cards.column_id AS columnId,
        cards.title,
        cards.description,
        cards.assignee_id AS assigneeId,
        assignee.name AS assigneeName,
        assignee.avatar_url AS assigneeAvatarUrl,
        cards.due_date AS dueDate,
        cards.priority,
        cards.tags,
        cards.checklist,
        cards.position,
        cards.version,
        cards.created_at AS createdAt,
        cards.updated_at AS updatedAt
      FROM cards
      LEFT JOIN users AS assignee ON assignee.id = cards.assignee_id
      WHERE cards.id = ?
    `)
    .get(card.id);
  const serializedMovedCard = serializeCard(movedCard);
  const activity = getActivityForCard(card.id, board.id);

  io.to(`board:${board.id}`).emit('board:card-moved', {
    boardId: board.id,
    card: serializedMovedCard,
    sourceColumnId: card.columnId,
    targetColumnId: targetColumn.id,
    position: insertAt,
    activity: activity[0]
  });

  res.json({ card: serializedMovedCard, activity });
});

app.get('/api/boards/:boardId/cards/:cardId', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  const card = getCardForBoard(req.params.cardId, board.id);

  if (!card) {
    return res.status(404).json({ message: 'Card not found' });
  }

  res.json({
    card,
    comments: getCommentsForCard(card.id),
    activity: getActivityForCard(card.id, board.id)
  });
});

app.patch('/api/boards/:boardId/cards/:cardId', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  const existingCard = getCardForBoard(req.params.cardId, board.id);

  if (!existingCard) {
    return res.status(404).json({ message: 'Card not found' });
  }

  const title = String(req.body.title ?? existingCard.title).trim();
  const description = String(req.body.description ?? existingCard.description ?? '').trim();
  const dueDateInput = String(req.body.dueDate ?? existingCard.dueDate ?? '').trim();
  const dueDate = dueDateInput || null;
  const allowedPriorities = new Set(['urgent', 'medium', 'normal']);
  const requestedPriority = String(req.body.priority ?? existingCard.priority ?? 'normal');
  const priority = allowedPriorities.has(requestedPriority) ? requestedPriority : 'normal';
  const tags = normalizeTags(req.body.tags ?? existingCard.tags);
  const checklist = normalizeChecklist(req.body.checklist ?? existingCard.checklist);
  const requestedAssigneeId = String(req.body.assigneeId ?? existingCard.assigneeId ?? '').trim();
  const assigneeId = requestedAssigneeId || null;
  const userIsOwner = isOwner(board);
  const userIsManager = isCardManager(existingCard, req.user.id);

  if (!title) {
    return res.status(400).json({ message: 'Card title is required' });
  }

  if (assigneeId) {
    const assignee = db
      .prepare('SELECT user_id AS userId, role FROM board_members WHERE board_id = ? AND user_id = ?')
      .get(board.id, assigneeId);

    if (!assignee) {
      return res.status(400).json({ message: 'Assignee must be a board member' });
    }

    if (!['owner', 'manager'].includes(assignee.role)) {
      return res.status(400).json({ message: 'Card manager must be an owner or manager' });
    }
  }

  const memberIds = new Set(getBoardMembers(board.id).map((member) => member.id));
  const hasInvalidSubtaskAssignee = checklist.some((item) => item.assigneeId && !memberIds.has(item.assigneeId));

  if (hasInvalidSubtaskAssignee) {
    return res.status(400).json({ message: 'Subtask assignees must be board members' });
  }

  const ownerControlledFieldsChanged =
    title !== existingCard.title ||
    description !== (existingCard.description || '') ||
    dueDate !== (existingCard.dueDate || null) ||
    assigneeId !== (existingCard.assigneeId || null) ||
    priority !== (existingCard.priority || 'normal') ||
    JSON.stringify(tags) !== JSON.stringify(existingCard.tags || []);

  if (!userIsOwner && ownerControlledFieldsChanged) {
    return res.status(403).json({ message: 'Only the board owner can edit card details or assign the card manager' });
  }

  if (!userIsOwner && !userIsManager && !canUpdateOwnSubtaskStatuses(existingCard.checklist || [], checklist, req.user.id)) {
    return res.status(403).json({ message: 'Members can only update the status of subtasks assigned to them' });
  }

  const previousChecklistById = new Map(
    (existingCard.checklist || []).map((item) => [item.id, item])
  );
  const newlyAssignedSubtasks = checklist.filter((item) => {
    if (!item.assigneeId) return false;
    return previousChecklistById.get(item.id)?.assigneeId !== item.assigneeId;
  });
  const cardManagerChanged = assigneeId && assigneeId !== (existingCard.assigneeId || null);

  db.prepare(`
    UPDATE cards
    SET
      title = ?,
      description = ?,
      due_date = ?,
      assignee_id = ?,
      priority = ?,
      tags = ?,
      checklist = ?,
      version = version + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, description, dueDate, assigneeId, priority, JSON.stringify(tags), JSON.stringify(checklist), existingCard.id);
  db.prepare('UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(board.id);
  logActivity(board.id, req.user.id, 'updated', 'card', existingCard.id, { title, priority });

  if (cardManagerChanged) {
    createNotification({
      userId: assigneeId,
      boardId: board.id,
      actorId: req.user.id,
      type: 'card_assigned',
      entityType: 'card',
      entityId: existingCard.id,
      message: `${req.user.name} أسند إليك مسؤولية البطاقة «${title}»`
    });
  }

  newlyAssignedSubtasks.forEach((item) => {
    createNotification({
      userId: item.assigneeId,
      boardId: board.id,
      actorId: req.user.id,
      type: 'subtask_assigned',
      entityType: 'card',
      entityId: existingCard.id,
      message: `${req.user.name} أسند إليك المهمة «${item.text || 'مهمة فرعية'}» في بطاقة «${title}»`
    });
  });

  const card = getCardForBoard(existingCard.id, board.id);
  const activity = getActivityForCard(card.id, board.id);

  io.to(`board:${board.id}`).emit('board:card-updated', {
    boardId: board.id,
    card,
    activity: activity[0]
  });

  res.json({ card, activity });
});

app.post('/api/boards/:boardId/cards/:cardId/comments', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  const card = getCardForBoard(req.params.cardId, board.id);

  if (!card) {
    return res.status(404).json({ message: 'Card not found' });
  }

  const body = String(req.body.body || '').trim();

  if (!body) {
    return res.status(400).json({ message: 'Comment body is required' });
  }

  const commentId = randomUUID();

  db.prepare('INSERT INTO comments (id, card_id, user_id, body) VALUES (?, ?, ?, ?)')
    .run(commentId, card.id, req.user.id, body);
  db.prepare('UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(board.id);
  logActivity(board.id, req.user.id, 'commented', 'card', card.id, { title: card.title });

  const commentRecipients = new Set([
    card.assigneeId,
    ...(card.checklist || []).map((item) => item.assigneeId)
  ]);
  commentRecipients.delete(null);
  commentRecipients.delete('');
  commentRecipients.delete(req.user.id);
  commentRecipients.forEach((userId) => {
    createNotification({
      userId,
      boardId: board.id,
      actorId: req.user.id,
      type: 'card_commented',
      entityType: 'card',
      entityId: card.id,
      message: `${req.user.name} أضاف تعليقاً على البطاقة «${card.title}»`
    });
  });

  const comment = getCommentsForCard(card.id).find((item) => item.id === commentId);
  const activity = getActivityForCard(card.id, board.id);

  io.to(`board:${board.id}`).emit('board:comment-created', {
    boardId: board.id,
    cardId: card.id,
    comment,
    activity: activity[0]
  });

  res.status(201).json({ comment, activity });
});

app.delete('/api/boards/:boardId/cards/:cardId', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
  }

  const card = getCardForBoard(req.params.cardId, board.id);

  if (!card) {
    return res.status(404).json({ message: 'Card not found' });
  }

  if (!requireOwner(board, res)) {
    return;
  }

  db.prepare(`
    UPDATE cards
    SET deleted_at = CURRENT_TIMESTAMP, version = version + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(card.id);
  db.prepare('UPDATE boards SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(board.id);
  logActivity(board.id, req.user.id, 'deleted', 'card', card.id, { title: card.title });

  const sourceCards = db
    .prepare(`
      SELECT id
      FROM cards
      WHERE column_id = ?
        AND deleted_at IS NULL
      ORDER BY position ASC, created_at ASC
    `)
    .all(card.columnId);
  const updatePosition = db.prepare('UPDATE cards SET position = ? WHERE id = ?');
  sourceCards.forEach((sourceCard, index) => {
    updatePosition.run(index, sourceCard.id);
  });

  io.to(`board:${board.id}`).emit('board:card-deleted', {
    boardId: board.id,
    cardId: card.id,
    columnId: card.columnId
  });

  res.json({ cardId: card.id });
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socket.join(`user:${socket.data.user.id}`);

  socket.emit('server:welcome', {
    message: 'Connected to real-time server'
  });

  socket.data.joinedBoards = new Set();

  socket.on('board:join', (payload, acknowledge) => {
    const boardId = typeof payload === 'string' ? payload : payload?.boardId;
    const user = socket.data.user;

    if (!boardId) {
      acknowledge?.({ ok: false, message: 'Board ID is required' });
      return;
    }

    const board = getBoardForUser(boardId, user.id);

    if (!board) {
      acknowledge?.({ ok: false, message: 'You are not a member of this board' });
      return;
    }

    socket.join(`board:${boardId}`);
    socket.data.joinedBoards.add(boardId);

    if (!boardPresence.has(boardId)) {
      boardPresence.set(boardId, new Map());
    }

    const boardUsers = boardPresence.get(boardId);
    const existingPresence = boardUsers.get(user.id);

    if (existingPresence) {
      existingPresence.socketIds.add(socket.id);
    } else {
      boardUsers.set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl || null,
        socketIds: new Set([socket.id])
      });
    }

    emitPresence(boardId);
    acknowledge?.({ ok: true });
  });

  socket.on('board:leave', (boardId) => {
    socket.leave(`board:${boardId}`);
    socket.data.joinedBoards.delete(boardId);

    removeSocketFromBoardPresence(boardId, socket);
  });

  socket.on('demo:message', (payload) => {
    const message = {
      id: randomUUID(),
      text: payload.text,
      author: payload.author || 'Anonymous',
      createdAt: new Date().toISOString()
    };

    io.emit('demo:message', message);
  });

  socket.on('disconnect', () => {
    removeSocketFromPresence(socket);
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({ message: 'Internal server error' });
});

httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
