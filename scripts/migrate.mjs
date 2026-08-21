#!/usr/bin/env node
/**
 * MySQL schema 状态 CLI
 *   node scripts/migrate.mjs status
 *
 * 说明：MySQL 使用全量 schema.sql（server/migrations/mysql/schema.sql），
 * 启动时自动建表；此处仅查看 schema_meta 版本。
 */
import 'dotenv/config';
import { openMysqlDb, MYSQL_SCHEMA_VERSION } from '../server/db/mysql.js';

const [, , cmd = 'status'] = process.argv;

async function main() {
  if (cmd !== 'status') {
    console.error('用法: node scripts/migrate.mjs status');
    console.error('MySQL 表结构在服务启动时自动确保（schema.sql）。');
    process.exitCode = 1;
    return;
  }

  const db = await openMysqlDb();
  try {
    const row = await db.get('SELECT version FROM schema_meta WHERE id = 1');
    const current = Number(row?.version) || 0;
    console.log(
      `MySQL: ${process.env.MYSQL_HOST || '127.0.0.1'}:${process.env.MYSQL_PORT || 3306}/${process.env.MYSQL_DATABASE || 'kanban'}`
    );
    console.log(`当前版本: v${current}`);
    console.log(`应用期望: v${MYSQL_SCHEMA_VERSION}`);
    if (current === MYSQL_SCHEMA_VERSION) {
      console.log('状态: 已对齐');
    } else {
      console.log('状态: 版本不一致，请检查 schema.sql 是否已应用');
    }
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
