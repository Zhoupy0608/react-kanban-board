import * as m001 from './001_core.js';
import * as m002 from './002_multiboard_marker.js';
import * as m003 from './003_collab.js';
import * as m004 from './004_token_version.js';
import * as m005 from './005_content_version.js';
import * as m006 from './006_card_checklist.js';
import * as m007 from './007_card_priority.js';
import * as m008 from './008_board_drafts.js';

/** 按 version 升序；version 必须连续且与 schema_meta.version 对齐 */
export const migrations = [m001, m002, m003, m004, m005, m006, m007, m008];

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1].version;

function tableExists(db, name) {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(name);
  return Boolean(row);
}

export function getSchemaVersion(db) {
  if (!tableExists(db, 'schema_meta')) return 0;
  const row = db.prepare('SELECT version FROM schema_meta WHERE id = 1').get();
  return Number(row?.version) || 0;
}

function ensureSchemaMetaRow(db, version) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      version INTEGER NOT NULL
    );
  `);
  const row = db.prepare('SELECT version FROM schema_meta WHERE id = 1').get();
  if (!row) {
    db.prepare('INSERT INTO schema_meta (id, version) VALUES (1, ?)').run(version);
  } else {
    db.prepare('UPDATE schema_meta SET version = ? WHERE id = 1').run(version);
  }
}

/**
 * 无 schema_meta 但已有 lanes/cards 的极旧库无法安全推断结构。
 * 默认拒绝启动；仅当 ALLOW_LEGACY_DB_RESET=1 时允许清空后重建。
 */
export function assertMigratable(db, { allowLegacyReset = false } = {}) {
  const version = getSchemaVersion(db);
  if (version > 0) return { version, legacy: false };

  const legacy =
    tableExists(db, 'lanes') ||
    tableExists(db, 'cards') ||
    tableExists(db, 'boards');

  if (!legacy) return { version: 0, legacy: false };

  if (!allowLegacyReset) {
    const err = new Error(
      '检测到无版本号的旧数据库，无法安全自动迁移。请备份后删除 data/kanban.db 再启动；' +
        '或设置环境变量 ALLOW_LEGACY_DB_RESET=1 强制清空重建（将丢失全部数据）。'
    );
    err.code = 'LEGACY_DB';
    throw err;
  }

  return { version: 0, legacy: true };
}

export function dropAllUserTables(db) {
  db.pragma('foreign_keys = OFF');
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    )
    .all();
  for (const { name } of tables) {
    db.exec(`DROP TABLE IF EXISTS "${name}"`);
  }
  db.pragma('foreign_keys = ON');
}

export function getMigrationStatus(db) {
  const current = getSchemaVersion(db);
  return {
    current,
    latest: LATEST_SCHEMA_VERSION,
    pending: migrations.filter((m) => m.version > current).map((m) => ({
      version: m.version,
      name: m.name,
    })),
    applied: migrations.filter((m) => m.version <= current).map((m) => ({
      version: m.version,
      name: m.name,
    })),
  };
}

/**
 * 升级到 targetVersion（默认最新）。每步在事务中执行 up + 写版本号。
 * @returns {{ from: number, to: number, ran: Array<{ version: number, name: string }> }}
 */
export function migrateUp(db, { targetVersion = LATEST_SCHEMA_VERSION } = {}) {
  const from = getSchemaVersion(db);
  const target = Math.min(Number(targetVersion) || LATEST_SCHEMA_VERSION, LATEST_SCHEMA_VERSION);
  const ran = [];

  if (from > LATEST_SCHEMA_VERSION) {
    const err = new Error(
      `数据库 schema v${from} 新于应用支持的 v${LATEST_SCHEMA_VERSION}，请升级应用代码。`
    );
    err.code = 'SCHEMA_TOO_NEW';
    throw err;
  }

  for (const m of migrations) {
    if (m.version <= from || m.version > target) continue;

    const apply = db.transaction(() => {
      m.up(db);
      ensureSchemaMetaRow(db, m.version);
    });
    apply();
    ran.push({ version: m.version, name: m.name });
    console.log(`迁移完成: v${m.version} (${m.name})`);
  }

  return { from, to: getSchemaVersion(db), ran };
}

/**
 * 回退一步（或直到 targetVersion）。用于开发/演示，生产慎用。
 * @returns {{ from: number, to: number, ran: Array<{ version: number, name: string }> }}
 */
export function migrateDown(db, { steps = 1, targetVersion } = {}) {
  const from = getSchemaVersion(db);
  let target;
  if (targetVersion != null) {
    target = Math.max(0, Number(targetVersion));
  } else {
    target = Math.max(0, from - Math.max(1, Number(steps) || 1));
  }

  const ran = [];
  const ordered = [...migrations].sort((a, b) => b.version - a.version);

  for (const m of ordered) {
    const current = getSchemaVersion(db);
    if (m.version > current || m.version <= target) continue;

    const apply = db.transaction(() => {
      m.down(db);
      const nextVersion = m.version - 1;
      if (nextVersion <= 0) {
        db.prepare('DELETE FROM schema_meta WHERE id = 1').run();
      } else {
        ensureSchemaMetaRow(db, nextVersion);
      }
    });
    apply();
    ran.push({ version: m.version, name: m.name });
    console.log(`已回退迁移: v${m.version} (${m.name}) → v${getSchemaVersion(db)}`);
  }

  return { from, to: getSchemaVersion(db), ran };
}
