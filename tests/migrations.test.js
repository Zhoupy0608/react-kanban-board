import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LATEST_SCHEMA_VERSION,
  assertMigratable,
  getMigrationStatus,
  getSchemaVersion,
  migrateDown,
  migrateUp,
} from '../server/migrations/index.js';
import { openDb } from '../server/db.js';

const tmpDirs = [];

function tempDbPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mykanban-mig-'));
  tmpDirs.push(dir);
  return path.join(dir, 'kanban.db');
}

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('schema migrations', () => {
  it('empty database migrates to latest with all core tables', () => {
    const db = new Database(tempDbPath());
    const result = migrateUp(db);
    expect(result.from).toBe(0);
    expect(result.to).toBe(LATEST_SCHEMA_VERSION);
    expect(result.ran.map((r) => r.version)).toEqual([1, 2, 3, 4, 5]);

    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
      .all()
      .map((r) => r.name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'schema_meta',
        'users',
        'boards',
        'lanes',
        'cards',
        'activity_events',
        'board_members',
        'card_comments',
        'notifications',
      ])
    );
    expect(getSchemaVersion(db)).toBe(5);
    db.close();
  });

  it('v2 database upgrades to v5 without wiping users/boards', () => {
    const db = new Database(tempDbPath());
    migrateUp(db, { targetVersion: 2 });
    expect(getSchemaVersion(db)).toBe(2);

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)`
    ).run('u1', 'keep@example.com', 'Keep', 'hash', now);
    db.prepare(
      `INSERT INTO boards (id, owner_id, title, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('b1', 'u1', '保留看板', '', now, now);

    const result = migrateUp(db);
    expect(result.from).toBe(2);
    expect(result.to).toBe(5);
    expect(result.ran.map((r) => r.version)).toEqual([3, 4, 5]);

    const user = db.prepare(`SELECT email FROM users WHERE id = ?`).get('u1');
    const board = db.prepare(`SELECT title FROM boards WHERE id = ?`).get('b1');
    const member = db
      .prepare(`SELECT role FROM board_members WHERE board_id = ? AND user_id = ?`)
      .get('b1', 'u1');

    expect(user.email).toBe('keep@example.com');
    expect(board.title).toBe('保留看板');
    expect(member.role).toBe('owner');
    const cols = db.prepare(`PRAGMA table_info(boards)`).all().map((c) => c.name);
    expect(cols).toContain('content_version');
    db.close();
  });

  it('migrateUp is idempotent at latest version', () => {
    const db = new Database(tempDbPath());
    migrateUp(db);
    const again = migrateUp(db);
    expect(again.from).toBe(5);
    expect(again.to).toBe(5);
    expect(again.ran).toHaveLength(0);
    db.close();
  });

  it('migrateDown can roll back then up again', () => {
    const db = new Database(tempDbPath());
    migrateUp(db);
    const down = migrateDown(db, { steps: 3 });
    expect(down.to).toBe(2);

    const membersGone = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='board_members'`)
      .get();
    expect(membersGone).toBeUndefined();

    migrateUp(db);
    expect(getSchemaVersion(db)).toBe(5);
    const membersBack = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='board_members'`)
      .get();
    expect(membersBack).toBeTruthy();
    db.close();
  });

  it('refuses unversioned legacy DB unless allowLegacyReset', () => {
    const dbPath = tempDbPath();
    const db = new Database(dbPath);
    db.exec(`CREATE TABLE lanes (id TEXT PRIMARY KEY, title TEXT)`);
    expect(() => assertMigratable(db)).toThrow(/无法安全自动迁移/);
    db.close();

    const opened = openDb({
      dbPath,
      dataDir: path.dirname(dbPath),
      allowLegacyReset: true,
    });
    expect(getSchemaVersion(opened)).toBe(5);
    opened.close();
  });

  it('getMigrationStatus reports pending list', () => {
    const db = new Database(tempDbPath());
    migrateUp(db, { targetVersion: 1 });
    const status = getMigrationStatus(db);
    expect(status.current).toBe(1);
    expect(status.pending.map((p) => p.version)).toEqual([2, 3, 4, 5]);
    db.close();
  });

  it('openDb seeds demo after migrations', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mykanban-open-'));
    tmpDirs.push(dir);
    const db = openDb({ dataDir: dir });
    const demo = db
      .prepare(`SELECT email FROM users WHERE email = ?`)
      .get('demo@mykanban.dev');
    expect(demo).toBeTruthy();
    expect(getSchemaVersion(db)).toBe(LATEST_SCHEMA_VERSION);
    db.close();
  });
});
