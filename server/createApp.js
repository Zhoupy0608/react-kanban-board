import express from 'express';
import cors from 'cors';
import { openDb } from './db.js';
import { createRealtimeHub } from './realtime.js';
import { assertAuthConfig } from './auth.js';
import { buildCorsOptions } from './cors.js';
import { createAuthRouter } from './routes/auth.js';
import { createBoardsRouter } from './routes/boards.js';
import { createNotificationsRouter } from './routes/notifications.js';
import { getSchemaVersion } from './migrations/index.js';

/**
 * 创建 Express app（可测：传入 dataDir / dbPath 隔离测试库）
 */
export function createApp(options = {}) {
  assertAuthConfig();
  const db = options.db || openDb(options);
  const realtime = options.realtime || createRealtimeHub();
  const app = express();

  app.set('trust proxy', 1);
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      success: true,
      status: 'ok',
      time: new Date().toISOString(),
      schemaVersion: getSchemaVersion(db),
      features: ['auth', 'boards', 'members', 'comments', 'notifications', 'websocket'],
    });
  });

  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/boards', createBoardsRouter(db, realtime));
  app.use('/api/notifications', createNotificationsRouter(db));

  app.use((err, _req, res, _next) => {
    if (err?.message?.startsWith('CORS blocked')) {
      return res.status(403).json({ success: false, message: '跨域请求被拒绝' });
    }
    console.error('未处理错误:', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  });

  return { app, db, realtime };
}
