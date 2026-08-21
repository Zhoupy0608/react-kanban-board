import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setupTestApp, teardownTestApp } from './helpers.js';

describe('drafts API', () => {
  let app;
  let db;
  let token;

  beforeAll(async () => {
    ({ app, db } = await setupTestApp());
    const reg = await request(app).post('/api/auth/register').send({
      email: 'drafts@example.com',
      name: 'Draft User',
      password: 'secret12',
    });
    token = reg.body.token;
  }, 60000);

  afterAll(async () => {
    await teardownTestApp(db);
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
      .send({ title: 'Q4 规划（改）' });
    expect(updated.status).toBe(200);
    expect(updated.body.draft.title).toBe('Q4 规划（改）');

    const published = await request(app)
      .post(`/api/drafts/${draftId}/publish`)
      .set('Authorization', `Bearer ${token}`);
    expect(published.status).toBe(201);
    expect(published.body.board.title).toBe('Q4 规划（改）');

    const listed2 = await request(app)
      .get('/api/drafts')
      .set('Authorization', `Bearer ${token}`);
    expect(listed2.body.drafts.some((d) => d.id === draftId)).toBe(false);
  });
});
