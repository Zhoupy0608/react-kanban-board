/**
 * v1 → 核心表：用户 / 看板 / 列 / 卡片 / 活动
 * （对应早期「鉴权 + 多看板」数据结构）
 */
export const version = 1;
export const name = 'core_auth_boards';

export function up(db) {
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS lanes (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      title TEXT NOT NULL,
      position INTEGER NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
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

    CREATE TABLE IF NOT EXISTS activity_events (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner_id);
    CREATE INDEX IF NOT EXISTS idx_lanes_board ON lanes(board_id, position);
    CREATE INDEX IF NOT EXISTS idx_cards_lane ON cards(lane_id, position);
    CREATE INDEX IF NOT EXISTS idx_activity_board ON activity_events(board_id, created_at DESC);
  `);
}

export function down(db) {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    DROP TABLE IF EXISTS activity_events;
    DROP TABLE IF EXISTS cards;
    DROP TABLE IF EXISTS lanes;
    DROP TABLE IF EXISTS boards;
    DROP TABLE IF EXISTS users;
  `);
  db.pragma('foreign_keys = ON');
}
