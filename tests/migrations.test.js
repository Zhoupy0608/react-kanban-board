import { afterAll, describe, expect, it } from 'vitest';
import { MYSQL_SCHEMA_VERSION, openMysqlDb, truncateAllTables } from '../server/db/mysql.js';

describe('mysql schema', () => {
  let db;

  it('opens mysql and has core tables at schema v8', async () => {
    process.env.MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
    process.env.MYSQL_PORT = process.env.MYSQL_PORT || '3306';
    process.env.MYSQL_USER = process.env.MYSQL_USER || 'kanban';
    process.env.MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'kanban';
    process.env.MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'kanban';

    db = await openMysqlDb();
    const version = await db.get('SELECT version FROM schema_meta WHERE id = 1');
    expect(Number(version.version)).toBe(MYSQL_SCHEMA_VERSION);

    const tables = await db.all(
      `SELECT table_name AS name
       FROM information_schema.tables
       WHERE table_schema = ?
       ORDER BY table_name`,
      process.env.MYSQL_DATABASE
    );
    const names = tables.map((t) => t.name || t.TABLE_NAME || t.table_name);
    expect(names).toEqual(
      expect.arrayContaining([
        'users',
        'boards',
        'lanes',
        'cards',
        'board_members',
        'card_comments',
        'notifications',
        'board_drafts',
        'activity_events',
        'schema_meta',
      ])
    );

    await truncateAllTables(db);
  }, 60000);

  afterAll(async () => {
    await db?.close?.();
  });
});
