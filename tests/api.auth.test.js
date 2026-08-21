import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setupTestApp, teardownTestApp } from './helpers.js';

describe('auth API', () => {
  let app;
  let db;

  beforeAll(async () => {
    ({ app, db } = await setupTestApp());
  }, 60000);

  afterAll(async () => {
    await teardownTestApp(db);
  });

  it('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.dbDriver).toBe('mysql');
    expect(res.body.redis).toBe('connected');
  });

  it('registers and returns JWT', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      name: 'Alice',
      password: 'secret12',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('alice@example.com');
  });

  it('logs in with correct password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'secret12',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'wrong-password',
    });
    expect(res.status).toBe(401);
  });

  it('returns current user with Bearer token', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'secret12',
    });
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('alice@example.com');
  });
});
