import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { Server } from 'socket.io';
import { getDatabaseSummary } from './db.js';

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
