/**
 * v5 → boards.content_version：整板同步乐观锁
 */
export const version = 5;
export const name = 'board_content_version';

function hasColumn(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

export function up(db) {
  if (!hasColumn(db, 'boards', 'content_version')) {
    db.exec(
      `ALTER TABLE boards ADD COLUMN content_version INTEGER NOT NULL DEFAULT 1`
    );
  }
}

export function down(db) {
  // SQLite 不便可靠 DROP COLUMN；保留列无害
  void db;
}
