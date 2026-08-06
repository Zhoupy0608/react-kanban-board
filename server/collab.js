import { randomUUID } from 'crypto';
import { getBoardMeta, getUserByEmail, getUserById, logActivity } from './db.js';

export function ensureOwnerMembership(db, boardId, ownerId) {
  const existing = db
    .prepare(`SELECT id FROM board_members WHERE board_id = ? AND user_id = ?`)
    .get(boardId, ownerId);
  if (existing) return;
  db.prepare(
    `INSERT INTO board_members (id, board_id, user_id, role, created_at)
     VALUES (?, ?, ?, 'owner', ?)`
  ).run(randomUUID(), boardId, ownerId, new Date().toISOString());
}

export function getMember(db, boardId, userId) {
  return (
    db
      .prepare(
        `SELECT id, board_id AS boardId, user_id AS userId, role, created_at AS createdAt
         FROM board_members WHERE board_id = ? AND user_id = ?`
      )
      .get(boardId, userId) || null
  );
}

/** @returns {{ meta: object, role: 'owner'|'editor'|'viewer' } | null} */
export function getBoardAccess(db, boardId, userId) {
  const meta = getBoardMeta(db, boardId);
  if (!meta) return null;
  if (meta.ownerId === userId) return { meta, role: 'owner' };
  const member = getMember(db, boardId, userId);
  if (!member) return null;
  return { meta, role: member.role };
}

export function canReadBoard(access) {
  return Boolean(access);
}

export function canEditBoard(access) {
  return access && (access.role === 'owner' || access.role === 'editor');
}

export function canManageBoard(access) {
  return access && access.role === 'owner';
}

export function listBoardMembers(db, boardId) {
  return db
    .prepare(
      `SELECT m.id, m.board_id AS boardId, m.user_id AS userId, m.role,
              m.created_at AS createdAt, u.name AS userName, u.email AS userEmail
       FROM board_members m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.board_id = ?
       ORDER BY
         CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
         m.created_at ASC`
    )
    .all(boardId);
}

export function addBoardMember(db, { boardId, email, role = 'editor', invitedBy }) {
  const user = getUserByEmail(db, email);
  if (!user) {
    const err = new Error('该邮箱尚未注册，请对方先注册账号');
    err.status = 404;
    throw err;
  }

  const meta = getBoardMeta(db, boardId);
  if (!meta) {
    const err = new Error('看板不存在');
    err.status = 404;
    throw err;
  }
  if (user.id === meta.ownerId || getMember(db, boardId, user.id)) {
    const err = new Error('该用户已是看板成员');
    err.status = 409;
    throw err;
  }

  const safeRole = role === 'viewer' ? 'viewer' : 'editor';
  const id = randomUUID();
  db.prepare(
    `INSERT INTO board_members (id, board_id, user_id, role, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, boardId, user.id, safeRole, new Date().toISOString());

  logActivity(db, {
    boardId,
    userId: invitedBy,
    action: 'member.added',
    summary: `邀请了 ${user.name}（${safeRole}）`,
  });

  createNotification(db, {
    userId: user.id,
    type: 'board.invite',
    title: '看板邀请',
    body: `你被加入看板「${meta.title}」`,
    boardId,
    actorId: invitedBy,
  });

  return listBoardMembers(db, boardId).find((m) => m.id === id);
}

export function updateBoardMemberRole(db, { boardId, userId, role }) {
  const member = getMember(db, boardId, userId);
  if (!member) return null;
  if (member.role === 'owner') {
    const err = new Error('不能修改所有者角色');
    err.status = 400;
    throw err;
  }
  const safeRole = role === 'viewer' ? 'viewer' : 'editor';
  db.prepare(`UPDATE board_members SET role = ? WHERE board_id = ? AND user_id = ?`).run(
    safeRole,
    boardId,
    userId
  );
  return getMember(db, boardId, userId);
}

export function removeBoardMember(db, { boardId, userId, removedBy }) {
  const member = getMember(db, boardId, userId);
  if (!member) return false;
  if (member.role === 'owner') {
    const err = new Error('不能移除所有者');
    err.status = 400;
    throw err;
  }
  db.prepare(`DELETE FROM board_members WHERE board_id = ? AND user_id = ?`).run(
    boardId,
    userId
  );
  const user = getUserById(db, userId);
  logActivity(db, {
    boardId,
    userId: removedBy,
    action: 'member.removed',
    summary: `移除了成员 ${user?.name || userId}`,
  });
  return true;
}

export function findCardOnBoard(db, boardId, cardId) {
  return (
    db
      .prepare(
        `SELECT c.id, c.text, l.board_id AS boardId
         FROM cards c
         INNER JOIN lanes l ON l.id = c.lane_id
         WHERE c.id = ? AND l.board_id = ?`
      )
      .get(cardId, boardId) || null
  );
}

export function listComments(db, boardId, cardId) {
  return db
    .prepare(
      `SELECT c.id, c.board_id AS boardId, c.card_id AS cardId, c.user_id AS userId,
              c.body, c.created_at AS createdAt, u.name AS userName, u.email AS userEmail
       FROM card_comments c
       INNER JOIN users u ON u.id = c.user_id
       WHERE c.board_id = ? AND c.card_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(boardId, cardId);
}

export function countComments(db, boardId, cardId) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM card_comments WHERE board_id = ? AND card_id = ?`
    )
    .get(boardId, cardId);
  return Number(row?.cnt) || 0;
}

function parseMentions(body) {
  const matches = String(body || '').match(/@([^\s@，,。.!！?？]+)/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).trim()).filter(Boolean))];
}

export function createComment(db, { boardId, cardId, userId, body }) {
  const text = String(body || '').trim();
  if (!text) {
    const err = new Error('评论不能为空');
    err.status = 400;
    throw err;
  }
  const card = findCardOnBoard(db, boardId, cardId);
  if (!card) {
    const err = new Error('卡片不存在');
    err.status = 404;
    throw err;
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO card_comments (id, board_id, card_id, user_id, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, boardId, cardId, userId, text, now);

  const author = getUserById(db, userId);
  logActivity(db, {
    boardId,
    userId,
    action: 'comment.created',
    summary: `${author?.name || '用户'} 评论了「${card.text}」`,
  });

  const mentionTokens = parseMentions(text);
  const members = listBoardMembers(db, boardId);
  for (const token of mentionTokens) {
    const lower = token.toLowerCase();
    const target = members.find(
      (m) =>
        m.userName.toLowerCase() === lower ||
        m.userEmail.toLowerCase() === lower ||
        m.userEmail.toLowerCase().startsWith(`${lower}@`)
    );
    if (!target || target.userId === userId) continue;
    createNotification(db, {
      userId: target.userId,
      type: 'mention',
      title: '有人提到了你',
      body: `${author?.name || '同事'} 在「${card.text}」中提到了你：${text.slice(0, 80)}`,
      boardId,
      cardId,
      actorId: userId,
    });
  }

  return listComments(db, boardId, cardId).find((c) => c.id === id);
}

export function deleteComment(db, { commentId, userId, isOwner }) {
  const row = db
    .prepare(
      `SELECT id, user_id AS userId, board_id AS boardId, card_id AS cardId
       FROM card_comments WHERE id = ?`
    )
    .get(commentId);
  if (!row) return null;
  if (row.userId !== userId && !isOwner) {
    const err = new Error('无权删除该评论');
    err.status = 403;
    throw err;
  }
  db.prepare(`DELETE FROM card_comments WHERE id = ?`).run(commentId);
  return { cardId: row.cardId };
}

export function createNotification(db, { userId, type, title, body, boardId, cardId, actorId }) {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO notifications
      (id, user_id, type, title, body, board_id, card_id, actor_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    id,
    userId,
    type,
    title,
    body,
    boardId || null,
    cardId || null,
    actorId || null,
    new Date().toISOString()
  );
  return id;
}

export function listNotifications(db, userId, { unreadOnly = false, limit = 40 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const sql = unreadOnly
    ? `SELECT n.id, n.type, n.title, n.body, n.board_id AS boardId, n.card_id AS cardId,
              n.actor_id AS actorId, n.is_read AS isRead, n.created_at AS createdAt,
              u.name AS actorName, b.title AS boardTitle
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       LEFT JOIN boards b ON b.id = n.board_id
       WHERE n.user_id = ? AND n.is_read = 0
       ORDER BY n.created_at DESC LIMIT ?`
    : `SELECT n.id, n.type, n.title, n.body, n.board_id AS boardId, n.card_id AS cardId,
              n.actor_id AS actorId, n.is_read AS isRead, n.created_at AS createdAt,
              u.name AS actorName, b.title AS boardTitle
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       LEFT JOIN boards b ON b.id = n.board_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC LIMIT ?`;
  return db
    .prepare(sql)
    .all(userId, safeLimit)
    .map((n) => ({ ...n, isRead: Boolean(n.isRead) }));
}

export function countUnreadNotifications(db, userId) {
  const row = db
    .prepare(`SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0`)
    .get(userId);
  return Number(row?.c) || 0;
}

export function markNotificationRead(db, userId, notificationId) {
  const result = db
    .prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`)
    .run(notificationId, userId);
  return result.changes > 0;
}

export function markAllNotificationsRead(db, userId) {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`).run(
    userId
  );
}

export function deleteNotification(db, userId, notificationId) {
  const result = db
    .prepare(`DELETE FROM notifications WHERE id = ? AND user_id = ?`)
    .run(notificationId, userId);
  return result.changes > 0;
}
