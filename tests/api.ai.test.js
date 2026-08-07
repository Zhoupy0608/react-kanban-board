import path from 'path';
import os from 'os';
import fs from 'fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/createApp.js';
import * as ai from '../server/ai.js';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mykanban-ai-'));

describe('AI API', () => {
  let app;
  let db;
  let token;
  let boardId;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    delete process.env.AI_API_KEY;
    ({ app, db } = createApp({ dataDir }));

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
  });

  beforeEach(() => {
    delete process.env.AI_API_KEY;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    db?.close?.();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('reports ai disabled on status when unset', async () => {
    const res = await request(app)
      .get('/api/ai/status')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it('returns 503 when polishing without AI_API_KEY', async () => {
    const res = await request(app)
      .post('/api/ai/card-polish')
      .set('Authorization', `Bearer ${token}`)
      .send({ boardId, title: '写登录页', description: '' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('AI_NOT_CONFIGURED');
  });

  it('returns 503 when splitting without AI_API_KEY', async () => {
    const res = await request(app)
      .post('/api/ai/card-split')
      .set('Authorization', `Bearer ${token}`)
      .send({ boardId, title: '写登录页', description: '' });
    expect(res.status).toBe(503);
  });

  it('rejects polish without title when configured', async () => {
    process.env.AI_API_KEY = 'test-key';
    const res = await request(app)
      .post('/api/ai/card-polish')
      .set('Authorization', `Bearer ${token}`)
      .send({ boardId, title: '  ', description: 'x' });
    expect(res.status).toBe(400);
  });

  it('rejects unauthorized board', async () => {
    process.env.AI_API_KEY = 'test-key';
    const res = await request(app)
      .post('/api/ai/card-polish')
      .set('Authorization', `Bearer ${token}`)
      .send({ boardId: 'missing-board', title: '任务' });
    expect(res.status).toBe(404);
  });

  it('polishes description via mocked fetch', async () => {
    process.env.AI_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  description: '- 完成登录表单\n- 接入鉴权 API',
                }),
              },
            },
          ],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await ai.polishCardDescription({
      title: '写登录页',
      description: '做一下',
    });
    expect(result.description).toContain('登录表单');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('generates description from title via mocked fetch', async () => {
    process.env.AI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    description: '- 完成登录表单\n- 接入鉴权并跳转首页',
                  }),
                },
              },
            ],
          }),
      })
    );

    const result = await ai.generateCardDescription({ title: '写登录页' });
    expect(result.description).toContain('登录表单');
  });

  it('splits into checklist via mocked fetch', async () => {
    process.env.AI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    items: [
                      { text: '画线框' },
                      { text: '写表单' },
                      { text: '联调接口' },
                    ],
                  }),
                },
              },
            ],
          }),
      })
    );

    const result = await ai.splitCardIntoChecklist({
      title: '写登录页',
      description: '',
    });
    expect(result.items).toHaveLength(3);
    expect(result.items[0].text).toBe('画线框');
  });

  it('suggests priority via mocked fetch', async () => {
    process.env.AI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    priority: 'high',
                    reason: '阻塞上线',
                  }),
                },
              },
            ],
          }),
      })
    );

    const result = await ai.suggestCardPriority({
      title: '生产故障修复',
      description: '登录接口 500',
    });
    expect(result.priority).toBe('high');
    expect(result.reason).toContain('上线');
  });

  it('rejects lane-inject without prompt when configured', async () => {
    process.env.AI_API_KEY = 'test-key';
    const res = await request(app)
      .post('/api/ai/lane-inject')
      .set('Authorization', `Bearer ${token}`)
      .send({ boardId, laneTitle: '待办', prompt: '  ' });
    expect(res.status).toBe(400);
  });

  it('injects lane tasks via mocked fetch', async () => {
    process.env.AI_API_KEY = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    cards: [
                      { title: '写 Dockerfile', description: '多阶段构建' },
                      { title: '配置 GitHub Actions', description: '跑测试与构建' },
                      { title: '部署预发环境', description: '验证流水线' },
                    ],
                  }),
                },
              },
            ],
          }),
      })
    );

    const result = await ai.injectLaneTasks({
      laneTitle: '待办',
      prompt: '搭建 CI/CD',
      existingTitles: ['已有任务'],
    });
    expect(result.cards).toHaveLength(3);
    expect(result.cards[0].title).toBe('写 Dockerfile');
  });
});
