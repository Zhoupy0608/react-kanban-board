import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import {
  LATEST_SCHEMA_VERSION,
  assertMigratable,
  dropAllUserTables,
  getSchemaVersion,
  migrateUp,
} from './migrations/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SCHEMA_VERSION = LATEST_SCHEMA_VERSION;

const DEMO_EMAIL = 'demo@mykanban.dev';
const DEMO_PASSWORD = 'demo1234';

function defaultDataDir() {
  return process.env.DATA_DIR || path.join(__dirname, '..', 'data');
}

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

function seedDemo(db) {
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount > 0) return;

  const userId = randomUUID();
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, DEMO_EMAIL, 'Demo User', passwordHash, now);

  const boardId = randomUUID();
  db.prepare(
    `INSERT INTO boards (id, owner_id, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(boardId, userId, '个人工作台', '演示看板：拖拽、筛选与多视图', now, now);

  saveBoardFull(db, boardId, sampleLanes());
  db.prepare(
    `INSERT INTO board_members (id, board_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)`
  ).run(randomUUID(), boardId, userId, now);

  const board2 = randomUUID();
  db.prepare(
    `INSERT INTO boards (id, owner_id, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(board2, userId, '学习计划', '第二块示例看板', now, now);

  saveBoardFull(db, board2, [
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
  ]);
  db.prepare(
    `INSERT INTO board_members (id, board_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)`
  ).run(randomUUID(), board2, userId, now);

  // 协作演示账号
  const collabId = randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(
    collabId,
    'collab@mykanban.dev',
    'Collab User',
    bcrypt.hashSync(DEMO_PASSWORD, 10),
    now
  );

  logActivity(db, {
    boardId,
    userId,
    action: 'board.seeded',
    summary: '已初始化演示看板',
  });

  console.log(`演示账号已写入: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`协作演示账号: collab@mykanban.dev / ${DEMO_PASSWORD}`);
}

export function openDb(options = {}) {
  const dataDir = options.dataDir || defaultDataDir();
  const dbPath = options.dbPath || path.join(dataDir, 'kanban.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  const allowLegacyReset =
    options.allowLegacyReset === true ||
    process.env.ALLOW_LEGACY_DB_RESET === '1';

  const check = assertMigratable(db, { allowLegacyReset });
  if (check.legacy && allowLegacyReset) {
    console.warn('ALLOW_LEGACY_DB_RESET=1：正在清空无版本旧库并重建…');
    dropAllUserTables(db);
  }

  const result = migrateUp(db);
  if (result.ran.length === 0) {
    // already latest
  } else if (result.from === 0) {
    console.log(`已初始化 schema → v${result.to}`);
  } else {
    console.log(`schema 已从 v${result.from} 升级到 v${result.to}（保留业务数据）`);
  }

  seedDemo(db);
  ensureCollabDemoUser(db);
  console.log(`SQLite 已连接: ${dbPath} (schema v${getSchemaVersion(db)})`);
  return db;
}

function ensureCollabDemoUser(db) {
  const email = 'collab@mykanban.dev';
  if (getUserByEmail(db, email)) return;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, email, 'Collab User', bcrypt.hashSync(DEMO_PASSWORD, 10), new Date().toISOString());
  console.log(`协作演示账号已写入: ${email} / ${DEMO_PASSWORD}`);
}

export function createUser(db, { email, name, passwordHash }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, created_at, token_version)
     VALUES (?, ?, ?, ?, ?, 0)`
  ).run(id, email.trim().toLowerCase(), name.trim(), passwordHash, now);
  return getUserById(db, id);
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

export function getUserById(db, id) {
  const row = db
    .prepare(
      `SELECT id, email, name, created_at, token_version FROM users WHERE id = ?`
    )
    .get(id);
  return mapUser(row);
}

export function getUserByEmail(db, email) {
  const row = db
    .prepare(
      `SELECT id, email, name, password_hash, created_at, token_version
       FROM users WHERE email = ? COLLATE NOCASE`
    )
    .get(String(email || '').trim());
  return mapUser(row);
}

export function bumpTokenVersion(db, userId) {
  db.prepare(
    `UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?`
  ).run(userId);
  return getUserById(db, userId);
}

export function listBoards(db, userId) {
  return db
    .prepare(
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
       ORDER BY b.updated_at DESC`
    )
    .all(userId, userId, userId, userId)
    .map((row) => ({
      ...row,
      laneCount: Number(row.laneCount) || 0,
      cardCount: Number(row.cardCount) || 0,
    }));
}

export function getBoardMeta(db, boardId) {
  return (
    db
      .prepare(
        `SELECT id, owner_id AS ownerId, title, description,
                created_at AS createdAt, updated_at AS updatedAt,
                COALESCE(content_version, 1) AS contentVersion
         FROM boards WHERE id = ?`
      )
      .get(boardId) || null
  );
}

export function createBoard(db, { ownerId, title, description = '' }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO boards (id, owner_id, title, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, ownerId, title.trim(), description.trim(), now, now);

  db.prepare(
    `INSERT INTO board_members (id, board_id, user_id, role, created_at)
     VALUES (?, ?, ?, 'owner', ?)`
  ).run(randomUUID(), id, ownerId, now);

  // 默认空列结构，便于立刻进入工作区
  saveBoardFull(db, id, [
    { id: randomUUID(), title: '待处理', cards: [] },
    { id: randomUUID(), title: '进行中', cards: [] },
    { id: randomUUID(), title: '已完成', cards: [] },
  ]);

  return getBoardMeta(db, id);
}

export function updateBoardMeta(db, boardId, patch) {
  const current = getBoardMeta(db, boardId);
  if (!current) return null;
  const title = patch.title !== undefined ? String(patch.title).trim() : current.title;
  const description =
    patch.description !== undefined
      ? String(patch.description).trim()
      : current.description;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE boards SET title = ?, description = ?, updated_at = ? WHERE id = ?`
  ).run(title, description, now, boardId);
  return getBoardMeta(db, boardId);
}

export function deleteBoard(db, boardId) {
  const result = db.prepare('DELETE FROM boards WHERE id = ?').run(boardId);
  return result.changes > 0;
}

export function getBoardFull(db, boardId) {
  const meta = getBoardMeta(db, boardId);
  if (!meta) return null;

  const lanes = db
    .prepare(
      `SELECT id, title FROM lanes WHERE board_id = ? ORDER BY position ASC`
    )
    .all(boardId);

  const cardsStmt = db.prepare(
    `SELECT id, text, description, tags, due_date, checklist, priority FROM cards WHERE lane_id = ? ORDER BY position ASC`
  );

  const commentCounts = db
    .prepare(
      `SELECT card_id AS cardId, COUNT(*) AS cnt
       FROM card_comments
       WHERE board_id = ?
       GROUP BY card_id`
    )
    .all(boardId);
  const countByCard = Object.fromEntries(
    commentCounts.map((row) => [row.cardId, Number(row.cnt) || 0])
  );

  return {
    ...meta,
    lanes: lanes.map((lane) => ({
      id: lane.id,
      title: lane.title,
      cards: cardsStmt.all(lane.id).map((card) => ({
        id: card.id,
        text: card.text,
        description: card.description ?? '',
        tags: normalizeTags(card.tags),
        dueDate: normalizeDueDate(card.due_date),
        checklist: normalizeChecklist(card.checklist),
        priority: normalizePriority(card.priority),
        commentCount: countByCard[card.id] || 0,
      })),
    })),
  };
}

export function saveBoardFull(db, boardId, lanes, options = {}) {
  if (!Array.isArray(lanes)) {
    throw new Error('看板数据必须是数组');
  }

  const { expectedVersion = null, force = false } = options;
  const meta = getBoardMeta(db, boardId);
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
    err.current = getBoardFull(db, boardId);
    err.expectedVersion = Number(expectedVersion);
    err.currentVersion = currentVersion;
    throw err;
  }

  const insertLane = db.prepare(
    `INSERT INTO lanes (id, board_id, title, position) VALUES (?, ?, ?, ?)`
  );
  const insertCard = db.prepare(
    `INSERT INTO cards (id, lane_id, text, description, tags, due_date, checklist, priority, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const replace = db.transaction((laneList) => {
    const laneIds = db
      .prepare('SELECT id FROM lanes WHERE board_id = ?')
      .all(boardId)
      .map((r) => r.id);

    if (laneIds.length > 0) {
      const placeholders = laneIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM cards WHERE lane_id IN (${placeholders})`).run(...laneIds);
    }
    db.prepare('DELETE FROM lanes WHERE board_id = ?').run(boardId);

    laneList.forEach((lane, laneIndex) => {
      const laneId = lane.id || randomUUID();
      insertLane.run(laneId, boardId, lane.title ?? '未命名', laneIndex);
      (lane.cards || []).forEach((card, cardIndex) => {
        insertCard.run(
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
      });
    });

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE boards
       SET updated_at = ?,
           content_version = COALESCE(content_version, 1) + 1
       WHERE id = ?`
    ).run(now, boardId);
  });

  replace(lanes);
  return getBoardFull(db, boardId);
}

export function logActivity(db, { boardId, userId, action, summary }) {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO activity_events (id, board_id, user_id, action, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, boardId, userId || null, action, summary, new Date().toISOString());
  return id;
}

export function listActivity(db, boardId, limit = 40) {
  const safeLimit = Math.min(Math.max(Number(limit) || 40, 1), 100);
  return db
    .prepare(
      `SELECT e.id, e.board_id AS boardId, e.user_id AS userId, e.action, e.summary,
              e.created_at AS createdAt, u.name AS userName
       FROM activity_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.board_id = ?
       ORDER BY e.created_at DESC
       LIMIT ?`
    )
    .all(boardId, safeLimit);
}

export const DEMO_CREDENTIALS = {
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
};
