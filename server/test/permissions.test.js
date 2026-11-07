import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';

const serverDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'collab-tool-test-'));
const databasePath = join(temporaryDirectory, 'permissions.sqlite');
const port = 42000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;
let serverProcess;
let serverOutput = '';

async function waitForServer() {
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Test server stopped before startup:\n${serverOutput}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out while starting the test server:\n${serverOutput}`);
}

async function api(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function register(name, email) {
  const result = await api('/api/auth/register', {
    method: 'POST',
    body: { name, email, password: 'password123' }
  });
  assert.equal(result.status, 201);
  return result.data;
}

before(async () => {
  serverProcess = spawn(process.execPath, ['src/index.js'], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      COLLAB_DB_PATH: databasePath
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.stdout.on('data', (chunk) => { serverOutput += chunk; });
  serverProcess.stderr.on('data', (chunk) => { serverOutput += chunk; });
  await waitForServer();
});

after(async () => {
  if (serverProcess?.exitCode === null) {
    const exited = new Promise((resolve) => serverProcess.once('exit', resolve));
    serverProcess.kill();
    await exited;
  }
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('owner, manager, and member permissions follow the project hierarchy', async () => {
  const owner = await register('Owner', 'owner@test.local');
  const manager = await register('Manager', 'manager@test.local');
  const member = await register('Member', 'member@test.local');

  const createdBoard = await api('/api/boards', {
    method: 'POST',
    token: owner.token,
    body: { title: 'Permissions board' }
  });
  assert.equal(createdBoard.status, 201);
  const boardId = createdBoard.data.board.id;

  const invite = await api(`/api/boards/${boardId}/invites`, {
    method: 'POST',
    token: owner.token
  });
  assert.equal(invite.status, 201);
  const inviteToken = invite.data.invite.token;

  for (const account of [manager, member]) {
    const accepted = await api(`/api/invites/${inviteToken}/accept`, {
      method: 'POST',
      token: account.token
    });
    assert.equal(accepted.status, 200);
  }

  const memberCannotListInvites = await api(`/api/boards/${boardId}/invites`, {
    token: member.token
  });
  assert.equal(memberCannotListInvites.status, 403);

  const ownerInvites = await api(`/api/boards/${boardId}/invites`, {
    token: owner.token
  });
  assert.equal(ownerInvites.status, 200);
  assert.equal(ownerInvites.data.invites.length, 1);

  const memberCannotRevokeInvite = await api(
    `/api/boards/${boardId}/invites/${invite.data.invite.id}`,
    { method: 'DELETE', token: member.token }
  );
  assert.equal(memberCannotRevokeInvite.status, 403);

  const ownerRevokesInvite = await api(
    `/api/boards/${boardId}/invites/${invite.data.invite.id}`,
    { method: 'DELETE', token: owner.token }
  );
  assert.equal(ownerRevokesInvite.status, 200);

  const revokedInviteIsInvalid = await api(`/api/invites/${inviteToken}`);
  assert.equal(revokedInviteIsInvalid.status, 404);

  const memberCannotRenameBoard = await api(`/api/boards/${boardId}`, {
    method: 'PATCH',
    token: member.token,
    body: { title: 'Unauthorized title' }
  });
  assert.equal(memberCannotRenameBoard.status, 403);

  const memberCannotDeleteBoard = await api(`/api/boards/${boardId}`, {
    method: 'DELETE',
    token: member.token
  });
  assert.equal(memberCannotDeleteBoard.status, 403);

  const promoted = await api(`/api/boards/${boardId}/members/${manager.user.id}`, {
    method: 'PATCH',
    token: owner.token,
    body: { role: 'manager' }
  });
  assert.equal(promoted.status, 200);
  assert.equal(promoted.data.member.role, 'manager');

  const managerCannotRenameBoard = await api(`/api/boards/${boardId}`, {
    method: 'PATCH',
    token: manager.token,
    body: { title: 'Manager title' }
  });
  assert.equal(managerCannotRenameBoard.status, 403);

  const board = await api(`/api/boards/${boardId}`, { token: owner.token });
  assert.equal(board.status, 200);
  const firstColumnId = board.data.columns[0].id;

  const managerCannotCreateCard = await api(
    `/api/boards/${boardId}/columns/${firstColumnId}/cards`,
    { method: 'POST', token: manager.token, body: { title: 'Forbidden card' } }
  );
  assert.equal(managerCannotCreateCard.status, 403);

  const createdCard = await api(`/api/boards/${boardId}/columns/${firstColumnId}/cards`, {
    method: 'POST',
    token: owner.token,
    body: { title: 'Owner card' }
  });
  assert.equal(createdCard.status, 201);
  const cardId = createdCard.data.card.id;

  const assignedCard = await api(`/api/boards/${boardId}/cards/${cardId}`, {
    method: 'PATCH',
    token: owner.token,
    body: {
      assigneeId: manager.user.id,
      checklist: [{ text: 'Member task', assigneeId: member.user.id, status: 'todo' }]
    }
  });
  assert.equal(assignedCard.status, 200);

  const memberCannotEditCard = await api(`/api/boards/${boardId}/cards/${cardId}`, {
    method: 'PATCH',
    token: member.token,
    body: { title: 'Changed by member' }
  });
  assert.equal(memberCannotEditCard.status, 403);

  const completedChecklist = assignedCard.data.card.checklist.map((item) => ({
    ...item,
    status: 'done'
  }));
  const memberCompletesOwnTask = await api(`/api/boards/${boardId}/cards/${cardId}`, {
    method: 'PATCH',
    token: member.token,
    body: { checklist: completedChecklist }
  });
  assert.equal(memberCompletesOwnTask.status, 200);
  assert.equal(memberCompletesOwnTask.data.card.checklist[0].status, 'done');

  const managerAddsTask = await api(`/api/boards/${boardId}/cards/${cardId}`, {
    method: 'PATCH',
    token: manager.token,
    body: {
      checklist: [
        ...memberCompletesOwnTask.data.card.checklist,
        { text: 'Second task', assigneeId: member.user.id, status: 'todo' }
      ]
    }
  });
  assert.equal(managerAddsTask.status, 200);
  assert.equal(managerAddsTask.data.card.checklist.length, 2);

  const memberComment = await api(`/api/boards/${boardId}/cards/${cardId}/comments`, {
    method: 'POST',
    token: member.token,
    body: { body: 'Task completed and reviewed' }
  });
  assert.equal(memberComment.status, 201);

  const movedCard = await api(`/api/boards/${boardId}/cards/${cardId}/move`, {
    method: 'PATCH',
    token: owner.token,
    body: { columnId: board.data.columns[1].id, position: 0 }
  });
  assert.equal(movedCard.status, 200);

  const cardDetails = await api(`/api/boards/${boardId}/cards/${cardId}`, {
    token: owner.token
  });
  assert.equal(cardDetails.status, 200);
  assert.ok(cardDetails.data.activity.some((item) => item.action === 'created' && item.actorName === 'Owner'));
  assert.ok(cardDetails.data.activity.some((item) => item.action === 'updated'));
  assert.ok(cardDetails.data.activity.some((item) => item.action === 'commented' && item.actorName === 'Member'));
  assert.ok(cardDetails.data.activity.some(
    (item) => item.action === 'moved' && item.metadata.columnTitle === 'In Progress'
  ));

  const boardSummaries = await api('/api/boards', { token: owner.token });
  assert.equal(boardSummaries.status, 200);
  const boardSummary = boardSummaries.data.boards.find((item) => item.id === boardId);
  assert.ok(boardSummary);
  assert.equal(boardSummary.stats.cardsTotal, 1);
  assert.equal(boardSummary.stats.cardsCompleted, 0);
  assert.equal(boardSummary.stats.subtasksTotal, 2);
  assert.equal(boardSummary.stats.subtasksCompleted, 1);
  assert.equal(boardSummary.stats.progress, 33.3);
  assert.equal(boardSummary.stats.memberCount, 3);
  assert.equal(boardSummary.stats.memberPreview.length, 3);
});
