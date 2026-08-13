/**
 * v8 → board_drafts：用户看板草稿箱
 */
export const version = 8;
export const name = 'board_drafts';

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_board_drafts_user
      ON board_drafts(user_id, updated_at DESC);
  `);
}

export function down(db) {
  db.exec(`
    DROP INDEX IF EXISTS idx_board_drafts_user;
    DROP TABLE IF EXISTS board_drafts;
  `);
}
