import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setupTestApp, teardownTestApp } from './helpers.js';

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
    ({ app, db } = await setupTestApp());
    tokenA = await register(app, 'owner@example.com');
    tokenB = await register(app, 'other@example.com');
  }, 60000);

  afterAll(async () => {
    await teardownTestApp(db);
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
          cards: [{ id: 'c1', text: 'Task 1', description: '', tags: ['dev'], dueDate: '' }],
        },
      ]);
    expect(putRes.status).toBe(200);
    expect(putRes.body.lanes[0].cards[0].text).toBe('Task 1');
  });
});
