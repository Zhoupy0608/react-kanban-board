import path from 'path';
import os from 'os';
import fs from 'fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/createApp.js';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mykanban-drafts-'));

describe('drafts API', () => {
  let app;
  let db;
  let token;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    ({ app, db } = createApp({ dataDir }));
    const reg = await request(app).post('/api/auth/register').send({
      email: 'drafts@example.com',
      name: 'Draft User',
      password: 'secret12',
    });
    token = reg.body.token;
  });

  afterAll(() => {
    db?.close?.();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('creates lists updates publishes and deletes drafts', async () => {
    const created = await request(app)
      .post('/api/drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Q4 规划', description: '先记一笔' });
    expect(created.status).toBe(201);
    expect(created.body.draft.title).toBe('Q4 规划');
    const draftId = created.body.draft.id;

    const listed = await request(app)
      .get('/api/drafts')
      .set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.drafts.some((d) => d.id === draftId)).toBe(true);

    const updated = await request(app)
      .patch(`/api/drafts/${draftId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Q4 正式规划', description: '范围已定' });
    expect(updated.status).toBe(200);
    expect(updated.body.draft.title).toBe('Q4 正式规划');

    const published = await request(app)
      .post(`/api/drafts/${draftId}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(published.status).toBe(201);
    expect(published.body.board.title).toBe('Q4 正式规划');

    const afterPublish = await request(app)
      .get('/api/drafts')
      .set('Authorization', `Bearer ${token}`);
    expect(afterPublish.body.drafts.some((d) => d.id === draftId)).toBe(false);

    const boards = await request(app)
      .get('/api/boards')
      .set('Authorization', `Bearer ${token}`);
    expect(boards.body.boards.some((b) => b.id === published.body.board.id)).toBe(true);

    const another = await request(app)
      .post('/api/drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '临时点子' });
    const del = await request(app)
      .delete(`/api/drafts/${another.body.draft.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);
  });

  it('rejects empty draft title', async () => {
    const res = await request(app)
      .post('/api/drafts')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '   ' });
    expect(res.status).toBe(400);
  });
});
