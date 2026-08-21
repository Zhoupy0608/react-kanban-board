import { openMysqlDb, getMysqlSchemaVersion } from './mysql.js';

/**
 * 仅支持 MySQL。DB_DRIVER 若仍写成 sqlite 会直接报错，提示改用 MySQL。
 */
export function resolveDbDriver(options = {}) {
  const driver = (options.driver || process.env.DB_DRIVER || 'mysql').toLowerCase();
  if (driver === 'sqlite') {
    throw new Error(
      '已移除 SQLite。请使用 MySQL：先执行 docker compose up -d，并确认 MYSQL_* / REDIS_URL 配置正确。'
    );
  }
  if (driver !== 'mysql' && driver !== 'mariadb') {
    throw new Error(`不支持的数据库驱动: ${driver}（仅支持 mysql）`);
  }
  return 'mysql';
}

export async function openDatabase(options = {}) {
  if (options.db) return options.db;
  resolveDbDriver(options);
  return openMysqlDb(options);
}

export async function getDbSchemaVersion(db) {
  return getMysqlSchemaVersion(db);
}

export function emailLookupSql() {
  return `SELECT id, email, name, password_hash, created_at, token_version
          FROM users WHERE LOWER(email) = LOWER(?)`;
}

export function emailExistsSql() {
  return `SELECT id FROM users WHERE LOWER(email) = LOWER(?)`;
}
