/**
 * v7 → cards.priority：独立优先级 low | normal | high
 */
export const version = 7;
export const name = 'card_priority';

function hasColumn(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

export function up(db) {
  if (!hasColumn(db, 'cards', 'priority')) {
    db.exec(
      `ALTER TABLE cards ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'`
    );
  }
}

export function down(db) {
  void db;
}
