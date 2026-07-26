import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 云部署时可挂载持久盘：DATA_DIR=/var/data
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'kanban.db');

const DEFAULT_BOARD = [
  {
    id: 'lane1',
    title: '待处理',
    cards: [
      {
        id: 'c10',
        text: '写代码',
        description: '',
        tags: ['开发', '紧急'],
        dueDate: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
      },
      {
        id: 'c1',
        text: '清洁',
        description: '用肥皂洗和抛光地板...',
        tags: ['生活'],
        dueDate: new Date().toISOString().slice(0, 10),
      },
      {
        id: 'c2',
        text: '买面包',
        description: '超市里有新鲜面包',
        tags: ['生活', '购物'],
        dueDate: '',
      },
    ],
  },
  {
    id: 'lane2',
    title: '进行中',
    cards: [
      {
        id: 'c4',
        text: '写博客',
        description: '人工智能能制作表情包吗',
        tags: ['写作', '开发'],
        dueDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      },
    ],
  },
  {
    id: 'lane3',
    title: '已完成',
    cards: [
      {
        id: 'c6',
        text: '买牛奶',
        description: '2加仑牛奶',
        tags: ['购物'],
        dueDate: '',
      },
    ],
  },
  { id: 'lane4', title: '新任务', cards: [] },
];

function normalizeTags(tags) {
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

function normalizeDueDate(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function ensureColumn(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function createSchema(db) {
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS lanes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      lane_id TEXT NOT NULL,
      text TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      due_date TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL,
      FOREIGN KEY (lane_id) REFERENCES lanes(id) ON DELETE CASCADE
    );
  `);

  ensureColumn(db, 'cards', 'tags', `TEXT NOT NULL DEFAULT '[]'`);
  ensureColumn(db, 'cards', 'due_date', `TEXT NOT NULL DEFAULT ''`);
}

export function saveBoard(db, board) {
  if (!Array.isArray(board)) {
    throw new Error('看板数据必须是数组');
  }

  const insertLane = db.prepare(
    'INSERT INTO lanes (id, title, position) VALUES (?, ?, ?)'
  );
  const insertCard = db.prepare(
    'INSERT INTO cards (id, lane_id, text, description, tags, due_date, position) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  const replaceAll = db.transaction((lanes) => {
    db.prepare('DELETE FROM cards').run();
    db.prepare('DELETE FROM lanes').run();

    lanes.forEach((lane, laneIndex) => {
      insertLane.run(lane.id, lane.title, laneIndex);
      (lane.cards || []).forEach((card, cardIndex) => {
        insertCard.run(
          card.id,
          lane.id,
          card.text ?? '',
          card.description ?? '',
          JSON.stringify(normalizeTags(card.tags)),
          normalizeDueDate(card.dueDate),
          cardIndex
        );
      });
    });
  });

  replaceAll(board);
}

function seedIfEmpty(db) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM lanes').get();
  if (row.count === 0) {
    saveBoard(db, DEFAULT_BOARD);
    console.log('已写入默认看板数据到 SQLite');
  }
}

export function openDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  createSchema(db);
  seedIfEmpty(db);
  console.log(`SQLite 已连接: ${DB_PATH}`);
  return db;
}

export function getBoard(db) {
  const lanes = db
    .prepare('SELECT id, title FROM lanes ORDER BY position ASC')
    .all();

  const cardsStmt = db.prepare(
    'SELECT id, text, description, tags, due_date FROM cards WHERE lane_id = ? ORDER BY position ASC'
  );

  return lanes.map((lane) => ({
    id: lane.id,
    title: lane.title,
    cards: cardsStmt.all(lane.id).map((card) => ({
      id: card.id,
      text: card.text,
      description: card.description ?? '',
      tags: normalizeTags(card.tags),
      dueDate: normalizeDueDate(card.due_date),
    })),
  }));
}
