import path from 'path';
import os from 'os';
import fs from 'fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/createApp.js';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mykanban-boards-'));

async function register(app, email) {
  const res = await request(app).post('/api/auth/register').send({
    email,
    name: email.split('@')[0],
    password: 'secret12',
  });
  return res.body.token;
}

describe('boards API', () => {
  let app;
  let db;
  let tokenA;
  let tokenB;
  let boardId;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    ({ app, db } = createApp({ dataDir }));
    tokenA = await register(app, 'owner@example.com');
    tokenB = await register(app, 'other@example.com');
  });

  afterAll(() => {
    db?.close?.();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('requires auth for board list', async () => {
    const res = await request(app).get('/api/boards');
    expect(res.status).toBe(401);
  });

  it('creates a board', async () => {
    const res = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Sprint Board', description: 'Q1' });
    expect(res.status).toBe(201);
    expect(res.body.board.title).toBe('Sprint Board');
    boardId = res.body.board.id;
  });

  it('lists only own boards', async () => {
    const resA = await request(app)
      .get('/api/boards')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resA.status).toBe(200);
    expect(resA.body.boards.some((b) => b.id === boardId)).toBe(true);

    const resB = await request(app)
      .get('/api/boards')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resB.body.boards.some((b) => b.id === boardId)).toBe(false);
  });

  it('reads and writes full board', async () => {
    const getRes = await request(app)
      .get(`/api/boards/${boardId}/full`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body.lanes)).toBe(true);
    expect(getRes.body.lanes.length).toBeGreaterThan(0);

    const putRes = await request(app)
      .put(`/api/boards/${boardId}/full`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send([
        {
          id: 'lane-a',
          title: 'Todo',
          cards: [
            {
              id: 'card-1',
              text: 'Ship Phase A',
              description: '',
              tags: ['dev'],
              dueDate: '2026-08-10',
            },
          ],
        },
      ]);
    expect(putRes.status).toBe(200);
    expect(putRes.body.lanes[0].cards[0].text).toBe('Ship Phase A');
    expect(putRes.body.board.contentVersion).toBeGreaterThan(0);
  });

  it('rejects stale baseVersion with 409 conflict', async () => {
    const getRes = await request(app)
      .get(`/api/boards/${boardId}/full`)
      .set('Authorization', `Bearer ${tokenA}`);
    const version = getRes.body.board.contentVersion;
    const lanes = getRes.body.lanes;

    const ok = await request(app)
      .put(`/api/boards/${boardId}/full`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        lanes: [
          {
            id: 'lane-a',
            title: 'Todo',
            cards: [{ id: 'card-1', text: 'First write', description: '', tags: [], dueDate: '' }],
          },
        ],
        baseVersion: version,
      });
    expect(ok.status).toBe(200);
    expect(ok.body.board.contentVersion).toBe(version + 1);

    const conflict = await request(app)
      .put(`/api/boards/${boardId}/full`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        lanes: [
          {
            id: 'lane-a',
            title: 'Todo',
            cards: [{ id: 'card-1', text: 'Stale write', description: '', tags: [], dueDate: '' }],
          },
        ],
        baseVersion: version,
      });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('VERSION_CONFLICT');
    expect(conflict.body.lanes[0].cards[0].text).toBe('First write');

    const forced = await request(app)
      .put(`/api/boards/${boardId}/full`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        lanes,
        force: true,
      });
    expect(forced.status).toBe(200);
  });

  it('forbids other user from accessing board', async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}/full`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(403);
  });

  it('returns activity events', async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}/activity`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.events.length).toBeGreaterThan(0);
  });

  it('deletes board', async () => {
    const res = await request(app)
      .delete(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/api/boards/${boardId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(getRes.status).toBe(404);
  });
});
