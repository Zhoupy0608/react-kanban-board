import path from 'path';
import os from 'os';
import fs from 'fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/createApp.js';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mykanban-collab-'));

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
    process.env.JWT_SECRET = 'test-secret';
    ({ app, db } = createApp({ dataDir }));
    owner = await register(app, 'owner-bc@example.com', 'Owner');
    collab = await register(app, 'collab-bc@example.com', 'Collab');

    const created = await request(app)
      .post('/api/boards')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ title: 'Collab Board' });
    boardId = created.body.board.id;

    const full = await request(app)
      .get(`/api/boards/${boardId}/full`)
      .set('Authorization', `Bearer ${owner.token}`);
    cardId = full.body.lanes[0].cards?.[0]?.id;
    if (!cardId) {
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
    }
  });

  afterAll(() => {
    db?.close?.();
    fs.rmSync(dataDir, { recursive: true, force: true });
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

  it('member appears in board list', async () => {
    const res = await request(app)
      .get('/api/boards')
      .set('Authorization', `Bearer ${collab.token}`);
    expect(res.body.boards.some((b) => b.id === boardId)).toBe(true);
  });

  it('supports comments and @mentions notifications', async () => {
    const res = await request(app)
      .post(`/api/boards/${boardId}/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ body: '请 @Collab 帮忙看一下' });
    expect(res.status).toBe(201);

    const notif = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${collab.token}`);
    expect(notif.status).toBe(200);
    expect(notif.body.unread).toBeGreaterThan(0);
    expect(notif.body.notifications.some((n) => n.type === 'mention')).toBe(true);

    const mine = await request(app)
      .post(`/api/boards/${boardId}/cards/${cardId}/comments`)
      .set('Authorization', `Bearer ${collab.token}`)
      .send({ body: '收到，我来看看' });
    expect(mine.status).toBe(201);

    const del = await request(app)
      .delete(`/api/boards/${boardId}/comments/${mine.body.comment.id}`)
      .set('Authorization', `Bearer ${collab.token}`);
    expect(del.status).toBe(200);
  });

  it('viewer cannot edit board content', async () => {
    await request(app)
      .patch(`/api/boards/${boardId}/members/${collab.user.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ role: 'viewer' });

    const res = await request(app)
      .put(`/api/boards/${boardId}/full`)
      .set('Authorization', `Bearer ${collab.token}`)
      .send([{ id: 'x', title: 'Nope', cards: [] }]);
    expect(res.status).toBe(403);
  });
});
