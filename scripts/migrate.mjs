#!/usr/bin/env node
/**
 * 数据库迁移 CLI
 *   node scripts/migrate.mjs status
 *   node scripts/migrate.mjs up
 *   node scripts/migrate.mjs down [--steps 1]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import {
  getMigrationStatus,
  migrateDown,
  migrateUp,
} from '../server/migrations/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'kanban.db');

const [, , cmd = 'status', ...rest] = process.argv;

function parseSteps(args) {
  const idx = args.indexOf('--steps');
  if (idx >= 0) return Math.max(1, Number(args[idx + 1]) || 1);
  return 1;
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);

try {
  if (cmd === 'status') {
    const status = getMigrationStatus(db);
    console.log(`数据库: ${dbPath}`);
    console.log(`当前版本: v${status.current}`);
    console.log(`最新版本: v${status.latest}`);
    if (status.pending.length === 0) {
      console.log('待执行: （无）');
    } else {
      console.log('待执行:');
      for (const m of status.pending) {
        console.log(`  - v${m.version} ${m.name}`);
      }
    }
  } else if (cmd === 'up') {
    const result = migrateUp(db);
    if (result.ran.length === 0) {
      console.log(`已是最新 v${result.to}`);
    } else {
      console.log(`升级完成: v${result.from} → v${result.to}`);
      for (const m of result.ran) console.log(`  + v${m.version} ${m.name}`);
    }
  } else if (cmd === 'down') {
    const steps = parseSteps(rest);
    const result = migrateDown(db, { steps });
    if (result.ran.length === 0) {
      console.log(`无法再回退（当前 v${result.to}）`);
    } else {
      console.log(`已回退: v${result.from} → v${result.to}`);
      for (const m of result.ran) console.log(`  - v${m.version} ${m.name}`);
    }
  } else {
    console.error('用法: node scripts/migrate.mjs <status|up|down> [--steps N]');
    process.exitCode = 1;
  }
} finally {
  db.close();
}
