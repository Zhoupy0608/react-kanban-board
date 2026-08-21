import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MYSQL_SCHEMA_VERSION = 8;

function mysqlConfig(options = {}) {
  return {
    host: options.host || process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(options.port || process.env.MYSQL_PORT) || 3306,
    user: options.user || process.env.MYSQL_USER || 'kanban',
    password: options.password || process.env.MYSQL_PASSWORD || 'kanban',
    database: options.database || process.env.MYSQL_DATABASE || 'kanban',
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE) || 10,
    timezone: 'Z',
    multipleStatements: true,
  };
}

function createMysqlTx(pool) {
  /** @type {import('mysql2/promise').PoolConnection | null} */
  let conn = null;

  const tx = {
    async get(sql, ...params) {
      const [rows] = await conn.execute(sql, params);
      return rows[0] ?? null;
    },
    async all(sql, ...params) {
      const [rows] = await conn.execute(sql, params);
      return rows;
    },
    async run(sql, ...params) {
      const [result] = await conn.execute(sql, params);
      return {
        changes: result.affectedRows,
        lastInsertRowid: result.insertId,
      };
    },
  };

  return {
    tx,
    async begin() {
      conn = await pool.getConnection();
      await conn.beginTransaction();
    },
    async commit() {
      await conn.commit();
      conn.release();
      conn = null;
    },
    async rollback() {
      try {
        await conn.rollback();
      } finally {
        conn.release();
        conn = null;
      }
    },
  };
}

export function createMysqlAdapter(pool) {
  return {
    driver: 'mysql',
    pool,

    async get(sql, ...params) {
      const [rows] = await pool.execute(sql, params);
      return rows[0] ?? null;
    },

    async all(sql, ...params) {
      const [rows] = await pool.execute(sql, params);
      return rows;
    },

    async run(sql, ...params) {
      const [result] = await pool.execute(sql, params);
      return {
        changes: result.affectedRows,
        lastInsertRowid: result.insertId,
      };
    },

    async exec(sql) {
      await pool.query(sql);
    },

    async transaction(fn) {
      const session = createMysqlTx(pool);
      await session.begin();
      try {
        const result = await fn(session.tx);
        await session.commit();
        return result;
      } catch (err) {
        await session.rollback();
        throw err;
      }
    },

    async close() {
      await pool.end();
    },
  };
}

async function ensureSchemaMeta(adapter) {
  const row = await adapter.get('SELECT version FROM schema_meta WHERE id = 1');
  if (!row) {
    await adapter.run(
      'INSERT INTO schema_meta (id, version) VALUES (1, ?)',
      MYSQL_SCHEMA_VERSION
    );
  }
}

export async function openMysqlDb(options = {}) {
  const config = mysqlConfig(options);
  const pool = mysql.createPool(config);

  try {
    await pool.query('SELECT 1');
  } catch (err) {
    await pool.end();
    throw new Error(
      `MySQL 连接失败 (${config.host}:${config.port}/${config.database}): ${err.message}\n` +
        '请先执行: docker compose up -d'
    );
  }

  const schemaPath = path.join(__dirname, '..', 'migrations', 'mysql', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schemaSql);

  const adapter = createMysqlAdapter(pool);
  await ensureSchemaMeta(adapter);

  console.log(
    `[mysql] 已连接: ${config.host}:${config.port}/${config.database} (schema v${MYSQL_SCHEMA_VERSION})`
  );
  return adapter;
}

export async function getMysqlSchemaVersion(db) {
  const row = await db.get('SELECT version FROM schema_meta WHERE id = 1');
  return Number(row?.version) || 0;
}

/** 测试用：清空业务表（保留 schema） */
export async function truncateAllTables(db) {
  await db.exec('SET FOREIGN_KEY_CHECKS = 0');
  const tables = [
    'notifications',
    'card_comments',
    'activity_events',
    'cards',
    'lanes',
    'board_members',
    'board_drafts',
    'boards',
    'users',
  ];
  for (const table of tables) {
    await db.exec(`TRUNCATE TABLE ${table}`);
  }
  await db.exec('SET FOREIGN_KEY_CHECKS = 1');
}
