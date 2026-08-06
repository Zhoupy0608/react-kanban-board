/**
 * v4 → users.token_version：登出时递增，使旧 JWT 立即失效
 */
export const version = 4;
export const name = 'user_token_version';

function hasColumn(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

export function up(db) {
  if (!hasColumn(db, 'users', 'token_version')) {
    db.exec(
      `ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0`
    );
  }
}

export function down(db) {
  // SQLite 不便可靠 DROP COLUMN；保留列无害。回退仅降版本号。
  void db;
}
