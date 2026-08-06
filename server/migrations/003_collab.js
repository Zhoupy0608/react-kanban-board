import { randomUUID } from 'crypto';

/**
 * v3 → 协作：成员 / 评论 / 通知；为已有看板补 owner 成员行
 */
export const version = 3;
export const name = 'collab_members_comments_notifications';

export function up(db) {
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_members (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (board_id, user_id),
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS card_comments (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      board_id TEXT,
      card_id TEXT,
      actor_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_members_board ON board_members(board_id);
    CREATE INDEX IF NOT EXISTS idx_members_user ON board_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_comments_card ON card_comments(board_id, card_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
  `);

  const boards = db.prepare(`SELECT id, owner_id FROM boards`).all();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO board_members (id, board_id, user_id, role, created_at)
     VALUES (?, ?, ?, 'owner', ?)`
  );
  const now = new Date().toISOString();
  for (const b of boards) {
    insert.run(randomUUID(), b.id, b.owner_id, now);
  }
}

export function down(db) {
  db.pragma('foreign_keys = OFF');
  db.exec(`
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS card_comments;
    DROP TABLE IF EXISTS board_members;
  `);
  db.pragma('foreign_keys = ON');
}
