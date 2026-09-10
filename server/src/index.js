import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { Server } from 'socket.io';
import { db, getDatabaseSummary } from './db.js';
import { createToken, getPublicUser, hashPassword, requireAuth, verifyPassword } from './auth.js';

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

app.use(cors());
app.use(express.json());

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
    if (error.code === 'ERR_SQLITE_CONSTRAINT_UNIQUE') {
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

function getBoardForUser(boardId, userId) {
  return db
    .prepare(`
      SELECT boards.id, boards.title, boards.created_at AS createdAt, boards.updated_at AS updatedAt
      FROM boards
      INNER JOIN board_members ON board_members.board_id = boards.id
      WHERE boards.id = ?
        AND board_members.user_id = ?
    `)
    .get(boardId, userId);
}

app.get('/api/boards', requireAuth, (req, res) => {
  const boards = db
    .prepare(`
      SELECT boards.id, boards.title, boards.created_at AS createdAt, boards.updated_at AS updatedAt
      FROM boards
      INNER JOIN board_members ON board_members.board_id = boards.id
      WHERE board_members.user_id = ?
      ORDER BY boards.updated_at DESC
    `)
    .all(req.user.id);

  res.json({ boards });
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

  const createdBoard = db
    .prepare(`
      SELECT id, title, created_at AS createdAt, updated_at AS updatedAt
      FROM boards
      WHERE id = ?
    `)
    .get(board.id);

  res.status(201).json({ board: createdBoard });
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
        cards.due_date AS dueDate,
        cards.position,
        cards.version,
        cards.created_at AS createdAt,
        cards.updated_at AS updatedAt
      FROM cards
      WHERE cards.column_id IN (
        SELECT id FROM board_columns WHERE board_id = ?
      )
        AND cards.deleted_at IS NULL
      ORDER BY cards.position ASC, cards.created_at ASC
    `)
    .all(board.id);

  const columnsWithCards = columns.map((column) => ({
    ...column,
    cards: cards.filter((card) => card.columnId === column.id)
  }));

  res.json({
    board,
    columns: columnsWithCards
  });
});

app.post('/api/boards/:boardId/columns/:columnId/cards', requireAuth, (req, res) => {
  const board = getBoardForUser(req.params.boardId, req.user.id);

  if (!board) {
    return res.status(404).json({ message: 'Board not found' });
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

  const card = db
    .prepare(`
      SELECT
        id,
        column_id AS columnId,
        title,
        description,
        assignee_id AS assigneeId,
        due_date AS dueDate,
        position,
        version,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM cards
      WHERE id = ?
    `)
    .get(cardId);

  io.to(`board:${board.id}`).emit('board:card-created', {
    boardId: board.id,
    columnId: column.id,
    card
  });

  res.status(201).json({ card });
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
      SELECT cards.id, cards.column_id AS columnId
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
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const movedCard = db
    .prepare(`
      SELECT
        id,
        column_id AS columnId,
        title,
        description,
        assignee_id AS assigneeId,
        due_date AS dueDate,
        position,
        version,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM cards
      WHERE id = ?
    `)
    .get(card.id);

  io.to(`board:${board.id}`).emit('board:card-moved', {
    boardId: board.id,
    card: movedCard,
    sourceColumnId: card.columnId,
    targetColumnId: targetColumn.id,
    position: insertAt
  });

  res.json({ card: movedCard });
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.emit('server:welcome', {
    message: 'Connected to real-time server'
  });

  socket.on('board:join', (boardId) => {
    socket.join(`board:${boardId}`);
  });

  socket.on('board:leave', (boardId) => {
    socket.leave(`board:${boardId}`);
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
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
