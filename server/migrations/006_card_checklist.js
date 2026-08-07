/**
 * v6 → cards.checklist：卡片内勾选清单（JSON 数组）
 */
export const version = 6;
export const name = 'card_checklist';

function hasColumn(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

export function up(db) {
  if (!hasColumn(db, 'cards', 'checklist')) {
    db.exec(
      `ALTER TABLE cards ADD COLUMN checklist TEXT NOT NULL DEFAULT '[]'`
    );
  }
}

export function down(db) {
  // SQLite 不便可靠 DROP COLUMN；保留列无害
  void db;
}
