import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import * as ai from '../server/ai.js';
import { setupTestApp, teardownTestApp } from './helpers.js';

describe('AI API', () => {
  let app;
  let db;
  let token;
  let boardId;

  beforeAll(async () => {
    delete process.env.AI_API_KEY;
    ({ app, db } = await setupTestApp());

    const reg = await request(app).post('/api/auth/register').send({
      email: 'ai-user@example.com',
      name: 'AI User',
      password: 'secret12',
    });
    token = reg.body.token;

    const board = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'AI Board' });
    boardId = board.body.board.id;
  }, 60000);

  beforeEach(() => {
    delete process.env.AI_API_KEY;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await teardownTestApp(db);
  });

  it('reports ai disabled on status when unset', async () => {
    const res = await request(app)
      .get('/api/ai/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it('returns 503 when AI key missing', async () => {
    const res = await request(app)
      .post('/api/ai/card-polish')
      .set('Authorization', `Bearer ${token}`)
      .send({ boardId, title: 'Task', description: '' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_NOT_CONFIGURED');
  });

  it('can polish when mocked', async () => {
    process.env.AI_API_KEY = 'test-key';
    vi.spyOn(ai, 'polishCardDescription').mockResolvedValue({
      description: 'polished',
      model: 'mock',
    });

    const res = await request(app)
      .post('/api/ai/card-polish')
      .set('Authorization', `Bearer ${token}`)
      .send({ boardId, title: 'Task', description: 'raw' });
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('polished');
  });
});
