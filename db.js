import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data', 'kanban.db');

const DEFAULT_BOARD = [
  {
    id: 'lane1',
    title: '待处理',
    cards: [
      { id: 'c10', text: '写代码', description: '', tags: ['开发', '紧急'] },
      { id: 'c1', text: '清洁', description: '用肥皂洗和抛光地板...', tags: ['生活'] },
      { id: 'c2', text: '买面包', description: '超市里有新鲜面包', tags: ['生活', '购物'] },
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
      },
    ],
  },
  {
    id: 'lane3',
    title: '已完成',
    cards: [{ id: 'c6', text: '买牛奶', description: '2加仑牛奶', tags: ['购物'] }],
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
      position INTEGER NOT NULL,
      FOREIGN KEY (lane_id) REFERENCES lanes(id) ON DELETE CASCADE
    );
  `);

  // 兼容旧库：补上 tags 列
  const cols = db.prepare('PRAGMA table_info(cards)').all();
  if (!cols.some((col) => col.name === 'tags')) {
    db.exec(`ALTER TABLE cards ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
  }
}

export function saveBoard(db, board) {
  if (!Array.isArray(board)) {
    throw new Error('看板数据必须是数组');
  }

  const insertLane = db.prepare(
    'INSERT INTO lanes (id, title, position) VALUES (?, ?, ?)'
  );
  const insertCard = db.prepare(
    'INSERT INTO cards (id, lane_id, text, description, tags, position) VALUES (?, ?, ?, ?, ?, ?)'
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
    'SELECT id, text, description, tags FROM cards WHERE lane_id = ? ORDER BY position ASC'
  );

  return lanes.map((lane) => ({
    id: lane.id,
    title: lane.title,
    cards: cardsStmt.all(lane.id).map((card) => ({
      id: card.id,
      text: card.text,
      description: card.description ?? '',
      tags: normalizeTags(card.tags),
    })),
  }));
}
