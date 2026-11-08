import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { after, before, test } from 'node:test';
import { io as createSocket } from 'socket.io-client';

const serverDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'collab-tool-test-'));
const databasePath = join(temporaryDirectory, 'permissions.sqlite');
const port = 42000 + (process.pid % 1000);
const baseUrl = `http://127.0.0.1:${port}`;
let serverProcess;
let serverOutput = '';

function waitForPresence(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('board:presence', handlePresence);
      reject(new Error('Timed out waiting for board presence update'));
    }, 5000);

    function handlePresence(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timeout);
      socket.off('board:presence', handlePresence);
      resolve(payload);
    }

    socket.on('board:presence', handlePresence);
  });
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = createSocket(baseUrl, { auth: { token }, forceNew: true });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function joinBoard(socket, boardId) {
  return new Promise((resolve, reject) => {
    socket.emit('board:join', { boardId }, (result) => {
      if (result?.ok) resolve();
      else reject(new Error(result?.message || 'Could not join board'));
    });
  });
}

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

async function attachmentApi(path, { token, method = 'POST', body, name = 'notes.txt', type = 'text/plain' } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'X-File-Name': encodeURIComponent(name),
      'X-File-Type': type
    },
    body
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
      COLLAB_DB_PATH: databasePath,
      FILE_FEATURES_ENABLED: 'true'
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

  const firstManagerSocket = await connectSocket(manager.token);
  const firstPresence = waitForPresence(
    firstManagerSocket,
    (payload) => payload.users.some((item) => item.id === manager.user.id)
  );
  await joinBoard(firstManagerSocket, boardId);
  await firstPresence;

  const duplicatePresence = waitForPresence(
    firstManagerSocket,
    (payload) => payload.users.some(
      (item) => item.id === manager.user.id && item.connectionCount === 2
    )
  );
  const secondManagerSocket = await connectSocket(manager.token);
  await joinBoard(secondManagerSocket, boardId);
  const duplicatePresencePayload = await duplicatePresence;
  assert.equal(
    duplicatePresencePayload.users.filter((item) => item.id === manager.user.id).length,
    1
  );

  const remainingPresence = waitForPresence(
    secondManagerSocket,
    (payload) => payload.users.some(
      (item) => item.id === manager.user.id && item.connectionCount === 1
    )
  );
  firstManagerSocket.disconnect();
  await remainingPresence;
  secondManagerSocket.disconnect();

  let managerLastSeen = null;
  for (let attempt = 0; attempt < 20 && !managerLastSeen; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    const membersAfterDisconnect = await api(`/api/boards/${boardId}/members`, {
      token: owner.token
    });
    managerLastSeen = membersAfterDisconnect.data.members.find(
      (item) => item.id === manager.user.id
    )?.lastSeen;
  }
  assert.ok(managerLastSeen);

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

  const memberCannotUploadAttachment = await attachmentApi(`/api/boards/${boardId}/cards/${cardId}/attachments`, {
    token: member.token,
    body: Buffer.from('member file')
  });
  assert.equal(memberCannotUploadAttachment.status, 403);

  const managerAttachment = await attachmentApi(`/api/boards/${boardId}/cards/${cardId}/attachments`, {
    token: manager.token,
    body: Buffer.from('attachment contents')
  });
  assert.equal(managerAttachment.status, 201);
  assert.equal(managerAttachment.data.attachment.name, 'notes.txt');
  assert.equal(managerAttachment.data.attachmentCount, 1);

  const memberDownload = await fetch(
    `${baseUrl}/api/boards/${boardId}/cards/${cardId}/attachments/${managerAttachment.data.attachment.id}/download`,
    { headers: { Authorization: `Bearer ${member.token}` } }
  );
  assert.equal(memberDownload.status, 200);
  assert.equal(await memberDownload.text(), 'attachment contents');

  const cardWithAttachment = await api(`/api/boards/${boardId}/cards/${cardId}`, { token: owner.token });
  assert.equal(cardWithAttachment.data.card.attachmentCount, 1);
  assert.equal(cardWithAttachment.data.attachments.length, 1);

  const managerDeletesAttachment = await api(
    `/api/boards/${boardId}/cards/${cardId}/attachments/${managerAttachment.data.attachment.id}`,
    { method: 'DELETE', token: manager.token }
  );
  assert.equal(managerDeletesAttachment.status, 200);
  assert.equal(managerDeletesAttachment.data.attachmentCount, 0);

  const memberCannotEditCard = await api(`/api/boards/${boardId}/cards/${cardId}`, {
    method: 'PATCH',
    token: member.token,
    body: { title: 'Changed by member' }
  });
  assert.equal(memberCannotEditCard.status, 403);

  const subtaskId = assignedCard.data.card.checklist[0].id;
  const memberStartsOwnTask = await api(`/api/boards/${boardId}/cards/${cardId}/subtasks/${subtaskId}/status`, {
    method: 'PATCH',
    token: member.token,
    body: { status: 'in_progress' }
  });
  assert.equal(memberStartsOwnTask.status, 200);

  const memberDeliverable = await attachmentApi(
    `/api/boards/${boardId}/cards/${cardId}/subtasks/${subtaskId}/attachments`,
    { token: member.token, body: Buffer.from('completed document'), name: 'result.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  );
  assert.equal(memberDeliverable.status, 201);

  const myTasks = await api('/api/my-tasks', { token: member.token });
  assert.equal(myTasks.status, 200);
  assert.equal(myTasks.data.assignedTasks[0].attachments.length, 1);

  const memberSubmitsForReview = await api(`/api/boards/${boardId}/cards/${cardId}/subtasks/${subtaskId}/status`, {
    method: 'PATCH', token: member.token, body: { status: 'review' }
  });
  assert.equal(memberSubmitsForReview.status, 200);
  assert.equal(memberSubmitsForReview.data.task.status, 'review');

  const memberCannotApproveOwnTask = await api(`/api/boards/${boardId}/cards/${cardId}/subtasks/${subtaskId}/status`, {
    method: 'PATCH', token: member.token, body: { status: 'done' }
  });
  assert.equal(memberCannotApproveOwnTask.status, 403);

  const managerReviewQueue = await api('/api/my-tasks', { token: manager.token });
  assert.equal(managerReviewQueue.status, 200);
  assert.equal(managerReviewQueue.data.reviewTasks.length, 1);

  const managerApprovesTask = await api(`/api/boards/${boardId}/cards/${cardId}/subtasks/${subtaskId}/status`, {
    method: 'PATCH', token: manager.token, body: { status: 'done' }
  });
  assert.equal(managerApprovesTask.status, 200);
  assert.equal(managerApprovesTask.data.task.status, 'done');

  const managerAddsTask = await api(`/api/boards/${boardId}/cards/${cardId}`, {
    method: 'PATCH',
    token: manager.token,
    body: {
      checklist: [
        ...managerApprovesTask.data.card.checklist,
        { text: 'Second task', assigneeId: member.user.id, status: 'todo' }
      ]
    }
  });
  assert.equal(managerAddsTask.status, 200);
  assert.equal(managerAddsTask.data.card.checklist.length, 2);

  const secondSubtaskId = managerAddsTask.data.card.checklist[1].id;
  const memberStartsSecondTask = await api(`/api/boards/${boardId}/cards/${cardId}/subtasks/${secondSubtaskId}/status`, {
    method: 'PATCH', token: member.token, body: { status: 'in_progress' }
  });
  assert.equal(memberStartsSecondTask.status, 200);
  const memberSubmitsSecondTask = await api(`/api/boards/${boardId}/cards/${cardId}/subtasks/${secondSubtaskId}/status`, {
    method: 'PATCH', token: member.token, body: { status: 'review' }
  });
  assert.equal(memberSubmitsSecondTask.status, 200);
  const managerRequestsChanges = await api(`/api/boards/${boardId}/cards/${cardId}/subtasks/${secondSubtaskId}/status`, {
    method: 'PATCH', token: manager.token, body: { status: 'changes_requested', reviewNote: 'Please revise the document' }
  });
  assert.equal(managerRequestsChanges.status, 200);
  assert.equal(managerRequestsChanges.data.task.status, 'changes_requested');
  assert.equal(managerRequestsChanges.data.task.reviewNote, 'Please revise the document');
  const memberResumesChanges = await api(`/api/boards/${boardId}/cards/${cardId}/subtasks/${secondSubtaskId}/status`, {
    method: 'PATCH', token: member.token, body: { status: 'in_progress' }
  });
  assert.equal(memberResumesChanges.status, 200);

  const memberComment = await api(`/api/boards/${boardId}/cards/${cardId}/comments`, {
    method: 'POST',
    token: member.token,
    body: { body: 'Task completed and reviewed' }
  });
  assert.equal(memberComment.status, 201);
  assert.equal(memberComment.data.commentCount, 1);

  const managerCannotEditMemberComment = await api(
    `/api/boards/${boardId}/cards/${cardId}/comments/${memberComment.data.comment.id}`,
    { method: 'PATCH', token: manager.token, body: { body: 'Changed by manager' } }
  );
  assert.equal(managerCannotEditMemberComment.status, 403);

  const memberEditsAndMentionsOwner = await api(
    `/api/boards/${boardId}/cards/${cardId}/comments/${memberComment.data.comment.id}`,
    { method: 'PATCH', token: member.token, body: { body: 'Updated comment for @Owner' } }
  );
  assert.equal(memberEditsAndMentionsOwner.status, 200);
  assert.equal(memberEditsAndMentionsOwner.data.comment.body, 'Updated comment for @Owner');
  assert.ok(memberEditsAndMentionsOwner.data.comment.editedAt);

  const ownerMentionNotifications = await api('/api/notifications', { token: owner.token });
  assert.ok(ownerMentionNotifications.data.notifications.some((item) => item.type === 'comment_mentioned'));

  const managerNotifications = await api('/api/notifications', { token: manager.token });
  assert.equal(managerNotifications.status, 200);
  assert.ok(managerNotifications.data.notifications.some((item) => item.type === 'card_assigned'));
  assert.ok(managerNotifications.data.notifications.some((item) => item.type === 'card_commented'));
  assert.ok(managerNotifications.data.notifications.some((item) => item.type === 'subtask_review_requested'));
  assert.ok(managerNotifications.data.unreadCount >= 3);

  const ownerDeletesMemberComment = await api(
    `/api/boards/${boardId}/cards/${cardId}/comments/${memberComment.data.comment.id}`,
    { method: 'DELETE', token: owner.token }
  );
  assert.equal(ownerDeletesMemberComment.status, 200);
  assert.equal(ownerDeletesMemberComment.data.commentCount, 0);

  const memberNotifications = await api('/api/notifications', { token: member.token });
  assert.equal(memberNotifications.status, 200);
  assert.equal(
    memberNotifications.data.notifications.filter((item) => item.type === 'subtask_assigned').length,
    2
  );

  const managerNotificationId = managerNotifications.data.notifications[0].id;
  const memberCannotReadAnotherUsersNotification = await api(
    `/api/notifications/${managerNotificationId}/read`,
    { method: 'PATCH', token: member.token }
  );
  assert.equal(memberCannotReadAnotherUsersNotification.status, 404);

  const managerReadsNotification = await api(`/api/notifications/${managerNotificationId}/read`, {
    method: 'PATCH',
    token: manager.token
  });
  assert.equal(managerReadsNotification.status, 200);

  const managerReadsAll = await api('/api/notifications/read-all', {
    method: 'PATCH',
    token: manager.token
  });
  assert.equal(managerReadsAll.status, 200);

  const readManagerNotifications = await api('/api/notifications', { token: manager.token });
  assert.equal(readManagerNotifications.data.unreadCount, 0);

  const today = new Date().toISOString().slice(0, 10);
  const dueTodayCard = await api(`/api/boards/${boardId}/cards/${cardId}`, {
    method: 'PATCH',
    token: owner.token,
    body: { dueDate: today }
  });
  assert.equal(dueTodayCard.status, 200);

  const managerDueNotifications = await api('/api/notifications', { token: manager.token });
  assert.equal(managerDueNotifications.data.notifications.filter((item) => item.type === 'due_today').length, 1);

  await api(`/api/boards/${boardId}/cards/${cardId}`, {
    method: 'PATCH',
    token: owner.token,
    body: { dueDate: today }
  });
  const deduplicatedDueNotifications = await api('/api/notifications', { token: manager.token });
  assert.equal(deduplicatedDueNotifications.data.notifications.filter((item) => item.type === 'due_today').length, 1);

  const workspaceWithDeadline = await api('/api/workspace/stats', { token: owner.token });
  assert.equal(workspaceWithDeadline.data.stats.deadlines.dueToday, 1);
  assert.equal(workspaceWithDeadline.data.stats.deadlines.items[0].cardId, cardId);

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

  const updatedProfile = await api('/api/auth/profile', {
    method: 'PATCH',
    token: owner.token,
    body: { name: 'Updated Owner', email: 'updated-owner@test.local' }
  });
  assert.equal(updatedProfile.status, 200);
  assert.equal(updatedProfile.data.user.name, 'Updated Owner');
  assert.equal(updatedProfile.data.user.email, 'updated-owner@test.local');

  const avatarUrl = 'data:image/png;base64,iVBORw0KGgo=';
  const savedAvatar = await api('/api/auth/avatar', {
    method: 'PATCH',
    token: updatedProfile.data.token,
    body: { avatarUrl }
  });
  assert.equal(savedAvatar.status, 200);
  assert.equal(savedAvatar.data.user.avatarUrl, avatarUrl);

  const currentUserWithAvatar = await api('/api/auth/me', {
    token: updatedProfile.data.token
  });
  assert.equal(currentUserWithAvatar.status, 200);
  assert.equal(currentUserWithAvatar.data.user.avatarUrl, avatarUrl);

  const removedAvatar = await api('/api/auth/avatar', {
    method: 'PATCH',
    token: updatedProfile.data.token,
    body: { avatarUrl: null }
  });
  assert.equal(removedAvatar.status, 200);
  assert.equal(removedAvatar.data.user.avatarUrl, null);

  const invalidAvatar = await api('/api/auth/avatar', {
    method: 'PATCH',
    token: updatedProfile.data.token,
    body: { avatarUrl: 'not-an-image' }
  });
  assert.equal(invalidAvatar.status, 400);

  const duplicateProfileEmail = await api('/api/auth/profile', {
    method: 'PATCH',
    token: updatedProfile.data.token,
    body: { name: 'Updated Owner', email: 'member@test.local' }
  });
  assert.equal(duplicateProfileEmail.status, 409);

  const incorrectCurrentPassword = await api('/api/auth/password', {
    method: 'PATCH',
    token: updatedProfile.data.token,
    body: { currentPassword: 'incorrect', newPassword: 'new-password123' }
  });
  assert.equal(incorrectCurrentPassword.status, 400);

  const changedPassword = await api('/api/auth/password', {
    method: 'PATCH',
    token: updatedProfile.data.token,
    body: { currentPassword: 'password123', newPassword: 'new-password123' }
  });
  assert.equal(changedPassword.status, 200);

  const oldPasswordLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'updated-owner@test.local', password: 'password123' }
  });
  assert.equal(oldPasswordLogin.status, 401);

  const newPasswordLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: 'updated-owner@test.local', password: 'new-password123' }
  });
  assert.equal(newPasswordLogin.status, 200);

  const savedPreferences = await api('/api/auth/preferences', {
    method: 'PATCH',
    token: newPasswordLogin.data.token,
    body: { assignments: false, comments: false, dueDates: false }
  });
  assert.equal(savedPreferences.status, 200);
  assert.deepEqual(savedPreferences.data.notificationPreferences, {
    assignments: false,
    comments: false,
    dueDates: false
  });

  const currentUser = await api('/api/auth/me', { token: newPasswordLogin.data.token });
  assert.equal(currentUser.status, 200);
  assert.equal(currentUser.data.user.notificationPreferences.assignments, false);
  assert.equal(currentUser.data.user.notificationPreferences.comments, false);
  assert.equal(currentUser.data.user.notificationPreferences.dueDates, false);
});
