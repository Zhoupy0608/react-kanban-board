import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setupTestApp, teardownTestApp } from './helpers.js';

async function register(app, email, name) {
  const res = await request(app).post('/api/auth/register').send({
    email,
    name,
    password: 'secret12',
  });
  return { token: res.body.token, user: res.body.user };
}

describe('collab API (members / comments / notifications)', () => {
  let app;
  let db;
  let owner;
  let collab;
  let boardId;
  let cardId;

  beforeAll(async () => {
    ({ app, db } = await setupTestApp());
    owner = await register(app, 'owner-bc@example.com', 'Owner');
    collab = await register(app, 'collab-bc@example.com', 'Collab');

    const created = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Collab Board' });
    boardId = created.body.board.id;

    await request(app)
      .put(`/api/boards/${boardId}/full`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send([
        {
          id: 'lane-1',
          title: 'Todo',
          cards: [{ id: 'card-1', text: 'Task', description: '', tags: [], dueDate: '' }],
        },
      ]);
    cardId = 'card-1';
  }, 60000);

  afterAll(async () => {
    await teardownTestApp(db);
  });

  it('owner can invite member by email', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/members`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ email: 'collab-bc@example.com', role: 'editor' });
    expect(res.status).toBe(201);
    expect(res.body.member.userEmail).toBe('collab-bc@example.com');
  });

  it('member can read shared board', async () => {
    const res = await request(app)
      .get(`/api/boards/${boardId}/full`)
      .set('Authorization', `Bearer ${collab.token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('editor');
  });

  it('member can comment', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${collab.token}`)
      .send({ body: 'hello @Owner' });
    expect(res.status).toBe(201);
    expect(res.body.comment.body).toContain('hello');
  });
});
