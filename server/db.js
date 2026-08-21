import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { LATEST_SCHEMA_VERSION } from './migrations/index.js';
import {
  emailLookupSql,
  openDatabase as openDatabaseImpl,
} from './db/index.js';
import {
  getCachedBoardFull,
  invalidateBoardCache,
  setCachedBoardFull,
} from './cache.js';

export const SCHEMA_VERSION = LATEST_SCHEMA_VERSION;

const DEMO_EMAIL = 'demo@mykanban.dev';
const DEMO_PASSWORD = 'demo1234';

export function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return [...new Set(tags.map((t) => String(t).trim()).filter(Boolean))];
  }
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return normalizeTags(parsed);
    } catch {
      return normalizeTags(tags.split(/[,，]/));
    }
  }
  return [];
}

export function normalizeDueDate(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

const PRIORITY_VALUES = new Set(['low', 'normal', 'high']);

/** @returns {'low'|'normal'|'high'} */
export function normalizePriority(value) {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (PRIORITY_VALUES.has(raw)) return raw;
  if (/^(高|紧急|urgent|p0|p1)$/i.test(raw)) return 'high';
  if (/^(低|low|p3)$/i.test(raw)) return 'low';
  if (/^(中|一般|medium|中等|p2)$/i.test(raw)) return 'normal';
  return 'normal';
}

/** @returns {{ id: string, text: string, done: boolean }[]} */
export function normalizeChecklist(value) {
  let list = value;
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((item, i) => {
      const text = String(item?.text ?? item?.title ?? '').trim();
      if (!text) return null;
      return {
        id: String(item?.id || `chk-${i}-${text.slice(0, 12)}`),
        text,
        done: Boolean(item?.done),
      };
    })
    .filter(Boolean)
    .slice(0, 40);
}

function sampleLanes() {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);

  return [
    {
      id: 'lane-todo',
      title: '待处理',
      cards: [
        {
          id: 'c-code',
          text: '完善 JWT 鉴权',
          description: '注册登录与资源归属隔离',
          tags: ['开发', '紧急'],
          dueDate: yesterday,
        },
        {
          id: 'c-clean',
          text: '整理项目 README',
          description: '补充演示账号与 API 说明',
          tags: ['文档'],
          dueDate: today,
        },
        {
          id: 'c-bread',
          text: '买面包',
          description: '超市里有新鲜面包',
          tags: ['生活', '购物'],
          dueDate: '',
        },
      ],
    },
    {
      id: 'lane-doing',
      title: '进行中',
      cards: [
        {
          id: 'c-blog',
          text: '写技术博客',
          description: '记录乐观更新与串行同步队列',
          tags: ['写作', '开发'],
          dueDate: soon,
        },
      ],
    },
    {
      id: 'lane-done',
      title: '已完成',
      cards: [
        {
          id: 'c-milk',
          text: '买牛奶',
          description: '2 加仑牛奶',
          tags: ['购物'],
          dueDate: '',
        },
      ],
    },
    { id: 'lane-backlog', title: '新任务', cards: [] },
  ];
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    created_at: row.created_at,
    tokenVersion: Number(row.token_version) || 0,
    ...(row.password_hash != null ? { password_hash: row.password_hash } : {}),
  };
}

function mapDraft(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function replaceBoardContentAsync(tx, boardId, lanes) {
  const laneRows = await tx.all('SELECT id FROM lanes WHERE board_id = ?', boardId);
  const laneIds = laneRows.map((r) => r.id);

  if (laneIds.length > 0) {
    const placeholders = laneIds.map(() => '?').join(',');
    await tx.run(`DELETE FROM cards WHERE lane_id IN (${placeholders})`, ...laneIds);
  }
  await tx.run('DELETE FROM lanes WHERE board_id = ?', boardId);

  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
    const lane = lanes[laneIndex];
    const laneId = lane.id || randomUUID();
    await tx.run(
      'INSERT INTO lanes (id, board_id, title, position) VALUES (?, ?, ?, ?)',
      laneId,
      boardId,
      lane.title ?? '未命名',
      laneIndex
    );
    for (let cardIndex = 0; cardIndex < (lane.cards || []).length; cardIndex += 1) {
      const card = lane.cards[cardIndex];
      await tx.run(
        `INSERT INTO cards (id, lane_id, text, description, tags, due_date, checklist, priority, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        card.id || randomUUID(),
        laneId,
        card.text ?? '',
        card.description ?? '',
        JSON.stringify(normalizeTags(card.tags)),
        normalizeDueDate(card.dueDate),
        JSON.stringify(normalizeChecklist(card.checklist)),
        normalizePriority(card.priority),
        cardIndex
      );
    }
  }

  const now = new Date().toISOString();
  await tx.run(
    `UPDATE boards
     SET updated_at = ?,
         content_version = COALESCE(content_version, 1) + 1
     WHERE id = ?`,
    now,
    boardId
  );
}

async function buildBoardFull(db, boardId) {
  const meta = await getBoardMeta(db, boardId);
  if (!meta) return null;

  const lanes = await db.all(
    'SELECT id, title FROM lanes WHERE board_id = ? ORDER BY position ASC',
    boardId
  );

  const commentCounts = await db.all(
    `SELECT card_id AS cardId, COUNT(*) AS cnt
     FROM card_comments
     WHERE board_id = ?
     GROUP BY card_id`,
    boardId
  );
  const countByCard = Object.fromEntries(
    commentCounts.map((row) => [row.cardId, Number(row.cnt) || 0])
  );

  const laneResults = [];
  for (const lane of lanes) {
    const cards = await db.all(
      `SELECT id, text, description, tags, due_date, checklist, priority
       FROM cards WHERE lane_id = ? ORDER BY position ASC`,
      lane.id
    );
    laneResults.push({
      id: lane.id,
      title: lane.title,
      cards: cards.map((card) => ({
        id: card.id,
        text: card.text,
        description: card.description ?? '',
        tags: normalizeTags(card.tags),
        dueDate: normalizeDueDate(card.due_date),
        checklist: normalizeChecklist(card.checklist),
        priority: normalizePriority(card.priority),
        commentCount: countByCard[card.id] || 0,
      })),
    });
  }

  return { ...meta, lanes: laneResults };
}

async function seedDemo(db) {
  const row = await db.get('SELECT COUNT(*) AS c FROM users');
  if (Number(row?.c) > 0) return;

  const userId = randomUUID();
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const now = new Date().toISOString();

  await db.run(
    'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    userId,
    DEMO_EMAIL,
    'Demo User',
    passwordHash,
    now
  );

  const boardId = randomUUID();
  await db.run(
    `INSERT INTO boards (id, owner_id, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    boardId,
    userId,
    '个人工作台',
    '演示看板：拖拽、筛选与多视图',
    now,
    now
  );

  await saveBoardFull(db, boardId, sampleLanes(), { force: true, skipCache: true });
  await db.run(
    `INSERT INTO board_members (id, board_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)`,
    randomUUID(),
    boardId,
    userId,
    now
  );

  const board2 = randomUUID();
  await db.run(
    `INSERT INTO boards (id, owner_id, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    board2,
    userId,
    '学习计划',
    '第二块示例看板',
    now,
    now
  );

  await saveBoardFull(
    db,
    board2,
    [
      {
        id: 'learn-todo',
        title: '待学',
        cards: [
          {
            id: 'learn-1',
            text: 'Express 中间件',
            description: '',
            tags: ['后端'],
            dueDate: '',
          },
        ],
      },
      { id: 'learn-done', title: '已掌握', cards: [] },
    ],
    { force: true, skipCache: true }
  );
  await db.run(
    `INSERT INTO board_members (id, board_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)`,
    randomUUID(),
    board2,
    userId,
    now
  );

  await db.run(
    'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    randomUUID(),
    'collab@mykanban.dev',
    'Collab User',
    bcrypt.hashSync(DEMO_PASSWORD, 10),
    now
  );

  await logActivity(db, {
    boardId,
    userId,
    action: 'board.seeded',
    summary: '已初始化演示看板',
  });

  console.log(`演示账号已写入: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`协作演示账号: collab@mykanban.dev / ${DEMO_PASSWORD}`);
}

async function ensureCollabDemoUser(db) {
  const email = 'collab@mykanban.dev';
  if (await getUserByEmail(db, email)) return;
  const id = randomUUID();
  await db.run(
    'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
    id,
    email,
    'Collab User',
    bcrypt.hashSync(DEMO_PASSWORD, 10),
    new Date().toISOString()
  );
  console.log(`协作演示账号已写入: ${email} / ${DEMO_PASSWORD}`);
}

export async function openDb(options = {}) {
  const db = await openDatabaseImpl(options);
  await seedDemo(db);
  await ensureCollabDemoUser(db);
  return db;
}

export async function createUser(db, { email, name, passwordHash }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO users (id, email, name, password_hash, created_at, token_version)
     VALUES (?, ?, ?, ?, ?, 0)`,
    id,
    email.trim().toLowerCase(),
    name.trim(),
    passwordHash,
    now
  );
  return getUserById(db, id);
}

export async function getUserById(db, id) {
  const row = await db.get(
    'SELECT id, email, name, created_at, token_version FROM users WHERE id = ?',
    id
  );
  return mapUser(row);
}

export async function getUserByEmail(db, email) {
  const row = await db.get(emailLookupSql(), String(email || '').trim());
  return mapUser(row);
}

export async function bumpTokenVersion(db, userId) {
  await db.run(
    'UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?',
    userId
  );
  return getUserById(db, userId);
}

export async function updateUserProfile(db, userId, { name, email }) {
  const nextName = String(name || '').trim();
  const nextEmail = String(email || '').trim().toLowerCase();
  const existing = await getUserByEmail(db, nextEmail);
  if (existing && existing.id !== userId) {
    const err = new Error('该邮箱已被占用');
    err.code = 'EMAIL_TAKEN';
    throw err;
  }
  await db.run('UPDATE users SET name = ?, email = ? WHERE id = ?', nextName, nextEmail, userId);
  return getUserById(db, userId);
}

export async function listBoards(db, userId) {
  const rows = await db.all(
    `SELECT
       b.id,
       b.owner_id AS ownerId,
       b.title,
       b.description,
       b.created_at AS createdAt,
       b.updated_at AS updatedAt,
       COALESCE(b.content_version, 1) AS contentVersion,
       CASE
         WHEN b.owner_id = ? THEN 'owner'
         ELSE (
           SELECT m.role FROM board_members m
           WHERE m.board_id = b.id AND m.user_id = ?
           LIMIT 1
         )
       END AS role,
       (SELECT COUNT(*) FROM lanes l WHERE l.board_id = b.id) AS laneCount,
       (
         SELECT COUNT(*)
         FROM cards c
         INNER JOIN lanes l ON l.id = c.lane_id
         WHERE l.board_id = b.id
       ) AS cardCount
     FROM boards b
     WHERE b.owner_id = ?
        OR EXISTS (
          SELECT 1 FROM board_members m
          WHERE m.board_id = b.id AND m.user_id = ?
        )
     ORDER BY b.updated_at DESC`,
    userId,
    userId,
    userId,
    userId
  );

  return rows.map((row) => ({
    ...row,
    laneCount: Number(row.laneCount) || 0,
    cardCount: Number(row.cardCount) || 0,
  }));
}

export async function getBoardMeta(db, boardId) {
  return (
    (await db.get(
      `SELECT id, owner_id AS ownerId, title, description,
              created_at AS createdAt, updated_at AS updatedAt,
              COALESCE(content_version, 1) AS contentVersion
       FROM boards WHERE id = ?`,
      boardId
    )) || null
  );
}

export async function createBoard(db, { ownerId, title, description = '' }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO boards (id, owner_id, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    ownerId,
    title.trim(),
    description.trim(),
    now,
    now
  );

  await db.run(
    `INSERT INTO board_members (id, board_id, user_id, role, created_at)
     VALUES (?, ?, ?, 'owner', ?)`,
    randomUUID(),
    id,
    ownerId,
    now
  );

  await saveBoardFull(
    db,
    id,
    [
      { id: randomUUID(), title: '待处理', cards: [] },
      { id: randomUUID(), title: '进行中', cards: [] },
      { id: randomUUID(), title: '已完成', cards: [] },
    ],
    { force: true, skipCache: true }
  );

  return getBoardMeta(db, id);
}

export async function updateBoardMeta(db, boardId, patch) {
  const current = await getBoardMeta(db, boardId);
  if (!current) return null;
  const title = patch.title !== undefined ? String(patch.title).trim() : current.title;
  const description =
    patch.description !== undefined ? String(patch.description).trim() : current.description;
  const now = new Date().toISOString();
  await db.run(
    'UPDATE boards SET title = ?, description = ?, updated_at = ? WHERE id = ?',
    title,
    description,
    now,
    boardId
  );
  await invalidateBoardCache(boardId);
  return getBoardMeta(db, boardId);
}

export async function deleteBoard(db, boardId) {
  const result = await db.run('DELETE FROM boards WHERE id = ?', boardId);
  await invalidateBoardCache(boardId);
  return result.changes > 0;
}

export async function getBoardFull(db, boardId, { useCache = true } = {}) {
  if (useCache) {
    const cached = await getCachedBoardFull(boardId);
    if (cached) return cached;
  }

  const full = await buildBoardFull(db, boardId);
  if (full && useCache) {
    await setCachedBoardFull(boardId, full);
  }
  return full;
}

export async function saveBoardFull(db, boardId, lanes, options = {}) {
  if (!Array.isArray(lanes)) {
    throw new Error('看板数据必须是数组');
  }

  const { expectedVersion = null, force = false, skipCache = false } = options;
  const meta = await getBoardMeta(db, boardId);
  if (!meta) {
    const err = new Error('看板不存在');
    err.status = 404;
    throw err;
  }

  const currentVersion = Number(meta.contentVersion) || 1;
  if (!force && expectedVersion != null && Number(expectedVersion) !== currentVersion) {
    const err = new Error('看板内容已被其他人更新，请先拉取最新版本');
    err.status = 409;
    err.code = 'VERSION_CONFLICT';
    err.current = await getBoardFull(db, boardId, { useCache: false });
    err.expectedVersion = Number(expectedVersion);
    err.currentVersion = currentVersion;
    throw err;
  }

  await db.transaction(async (tx) => {
    await replaceBoardContentAsync(tx, boardId, lanes);
  });

  if (!skipCache) {
    await invalidateBoardCache(boardId);
  }
  return getBoardFull(db, boardId, { useCache: false });
}

export async function logActivity(db, { boardId, userId, action, summary }) {
  const id = randomUUID();
  await db.run(
    `INSERT INTO activity_events (id, board_id, user_id, action, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    boardId,
    userId || null,
    action,
    summary,
    new Date().toISOString()
  );
  return id;
}

export async function listActivity(db, boardId, limit = 40) {
  // mysql2 prepare 不支持 LIMIT ?；limit 已钳制为整数后再拼入
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  return db.all(
    `SELECT e.id, e.board_id AS boardId, e.user_id AS userId, e.action, e.summary,
            e.created_at AS createdAt, u.name AS userName
     FROM activity_events e
     LEFT JOIN users u ON u.id = e.user_id
     WHERE e.board_id = ?
     ORDER BY e.created_at DESC
     LIMIT ${safeLimit}`,
    boardId
  );
}

export async function listBoardDrafts(db, userId) {
  const rows = await db.all(
    `SELECT id, user_id, title, description, created_at, updated_at
     FROM board_drafts
     WHERE user_id = ?
     ORDER BY updated_at DESC`,
    userId
  );
  return rows.map(mapDraft);
}

export async function getBoardDraft(db, draftId, userId) {
  const row = await db.get(
    `SELECT id, user_id, title, description, created_at, updated_at
     FROM board_drafts
     WHERE id = ? AND user_id = ?`,
    draftId,
    userId
  );
  return mapDraft(row);
}

export async function createBoardDraft(db, { userId, title, description = '' }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const safeTitle = String(title || '').trim() || '未命名草稿';
  const safeDesc = String(description || '').trim();
  await db.run(
    `INSERT INTO board_drafts (id, user_id, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    safeTitle,
    safeDesc,
    now,
    now
  );
  return getBoardDraft(db, id, userId);
}

export async function updateBoardDraft(db, draftId, userId, patch) {
  const current = await getBoardDraft(db, draftId, userId);
  if (!current) return null;
  const title =
    patch.title !== undefined ? String(patch.title).trim() || '未命名草稿' : current.title;
  const description =
    patch.description !== undefined ? String(patch.description).trim() : current.description;
  const now = new Date().toISOString();
  await db.run(
    'UPDATE board_drafts SET title = ?, description = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    title,
    description,
    now,
    draftId,
    userId
  );
  return getBoardDraft(db, draftId, userId);
}

export async function deleteBoardDraft(db, draftId, userId) {
  const result = await db.run('DELETE FROM board_drafts WHERE id = ? AND user_id = ?', draftId, userId);
  return result.changes > 0;
}

export async function publishBoardDraft(db, draftId, userId) {
  const draft = await getBoardDraft(db, draftId, userId);
  if (!draft) return null;
  const board = await createBoard(db, {
    ownerId: userId,
    title: draft.title,
    description: draft.description,
  });
  await deleteBoardDraft(db, draftId, userId);
  return { board, draft };
}

export const DEMO_CREDENTIALS = {
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
};
