import { createApp } from '../server/createApp.js';
import { closeRedis, initRedis } from '../server/redis.js';
import { truncateAllTables } from '../server/db/mysql.js';
import { __clearBoardCacheForTests } from '../server/cache.js';

/**
 * 测试环境：依赖本机 docker compose 的 MySQL + Redis。
 * 使用开发同库 kanban，每个 suite 前 truncate（vitest 已串行）。
 */
export async function setupTestApp() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.DB_DRIVER = 'mysql';
  process.env.MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
  process.env.MYSQL_PORT = process.env.MYSQL_PORT || '3306';
  process.env.MYSQL_USER = process.env.MYSQL_USER || 'kanban';
  process.env.MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || 'kanban';
  process.env.MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'kanban';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  delete process.env.REDIS_OPTIONAL;
  delete process.env.REDIS_ENABLED;

  await initRedis();
  const { app, db, realtime } = await createApp({ skipRedis: true });
  await truncateAllTables(db);
  __clearBoardCacheForTests();
  return { app, db, realtime };
}

export async function teardownTestApp(db) {
  try {
    if (db) {
      await truncateAllTables(db);
      await db.close?.();
    }
  } finally {
    await closeRedis();
    __clearBoardCacheForTests();
  }
}
