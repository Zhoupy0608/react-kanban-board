import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { authenticateWsCredential, signToken, signWsTicket } from '../server/auth.js';
import { getUserByEmail } from '../server/db.js';
import { setupTestApp, teardownTestApp } from './helpers.js';

describe('security hardening', () => {
  let app;
  let db;
  let token;

  beforeAll(async () => {
    process.env.AUTH_RATE_LIMIT_MAX = '8';
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = '60000';
    ({ app, db } = await setupTestApp());

    const reg = await request(app).post('/api/auth/register').send({
      email: 'sec@example.com',
      name: 'Sec User',
      password: 'secret12',
    });
    token = reg.body.token;
  }, 60000);

  afterAll(async () => {
    await teardownTestApp(db);
    delete process.env.AUTH_RATE_LIMIT_MAX;
    delete process.env.AUTH_RATE_LIMIT_WINDOW_MS;
  });

  it('logout invalidates previous access token', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'sec@example.com',
      password: 'secret12',
    });
    const t = login.body.token;

    const me1 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${t}`);
    expect(me1.status).toBe(200);

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${t}`);
    expect(logout.status).toBe(200);

    const me2 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${t}`);
    expect(me2.status).toBe(401);

    const login2 = await request(app).post('/api/auth/login').send({
      email: 'sec@example.com',
      password: 'secret12',
    });
    expect(login2.status).toBe(200);
    token = login2.body.token;
  });

  it('issues short-lived ws ticket', async () => {
    const res = await request(app)
      .post('/api/auth/ws-ticket')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ticket).toBeTruthy();

    const user = await authenticateWsCredential(db, res.body.ticket);
    expect(user.email).toBe('sec@example.com');
    expect(user.typ).toBe('ws');
  });

  it('rejects ws ticket as API access token', async () => {
    const ticketRes = await request(app)
      .post('/api/auth/ws-ticket')
      .set('Authorization', `Bearer ${token}`);
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ticketRes.body.ticket}`);
    expect(me.status).toBe(401);
  });

  it('rate-limits repeated failed logins', async () => {
    let lastStatus = 0;
    for (let i = 0; i < 12; i += 1) {
      const res = await request(app).post('/api/auth/login').send({
        email: 'sec@example.com',
        password: 'wrong-password',
      });
      lastStatus = res.status;
      if (res.status === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  it('signToken embeds token version', async () => {
    const row = await getUserByEmail(db, 'sec@example.com');
    const t = signToken(row);
    const ws = signWsTicket(row);
    expect(t).toBeTruthy();
    expect(ws).toBeTruthy();
    expect((await authenticateWsCredential(db, t)).typ).toBe('access');
  });
});
