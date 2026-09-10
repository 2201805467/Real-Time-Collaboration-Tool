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

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.emit('server:welcome', {
    message: 'Connected to real-time server'
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
