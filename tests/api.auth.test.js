import path from 'path';
import os from 'os';
import fs from 'fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/createApp.js';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mykanban-auth-'));

describe('auth API', () => {
  let app;
  let db;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    ({ app, db } = createApp({ dataDir }));
  });

  afterAll(() => {
    db?.close?.();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
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

  it('rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      name: 'Alice2',
      password: 'secret12',
    });
    expect(res.status).toBe(409);
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
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Alice');
  });

  it('rejects /me without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('demo account is seeded', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'demo@mykanban.dev',
      password: 'demo1234',
    });
    expect(res.status).toBe(200);
  });
});
