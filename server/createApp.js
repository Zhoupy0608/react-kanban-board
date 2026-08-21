import express from 'express';
import cors from 'cors';
import { openDb } from './db.js';
import { createRealtimeHub } from './realtime.js';
import { assertAuthConfig } from './auth.js';
import { buildCorsOptions } from './cors.js';
import { createAuthRouter } from './routes/auth.js';
import { createBoardsRouter } from './routes/boards.js';
import { createDraftsRouter } from './routes/drafts.js';
import { createNotificationsRouter } from './routes/notifications.js';
import { createAiRouter } from './routes/ai.js';
import { isAiConfigured } from './ai.js';
import { getDbSchemaVersion, resolveDbDriver } from './db/index.js';
import { initRedis, getRedisMode } from './redis.js';
import { getBoardCacheMode } from './cache.js';

/**
 * 创建 Express app（默认 MySQL + Redis）
 */
export async function createApp(options = {}) {
  assertAuthConfig();
  if (!options.skipRedis) {
    await initRedis();
  }

  const db = options.db || (await openDb(options));
  const realtime = options.realtime || createRealtimeHub();
  const app = express();

  app.set('trust proxy', 1);
  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', async (_req, res) => {
    const features = [
      'auth',
      'boards',
      'drafts',
      'members',
      'comments',
      'notifications',
      'websocket',
    ];
    if (isAiConfigured()) features.push('ai');
    if (getRedisMode() === 'connected') features.push('redis');

    res.json({
      success: true,
      status: 'ok',
      time: new Date().toISOString(),
      schemaVersion: await getDbSchemaVersion(db),
      dbDriver: db.driver || resolveDbDriver(options),
      redis: getRedisMode(),
      boardCache: getBoardCacheMode(),
      features,
      aiEnabled: isAiConfigured(),
    });
  });

  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/boards', createBoardsRouter(db, realtime));
  app.use('/api/drafts', createDraftsRouter(db));
  app.use('/api/notifications', createNotificationsRouter(db));
  app.use('/api/ai', createAiRouter(db));

  app.use((err, _req, res, _next) => {
    if (err?.message?.startsWith('CORS blocked')) {
      return res.status(403).json({ success: false, message: '跨域请求被拒绝' });
    }
    console.error('未处理错误:', err);
    res.status(500).json({ success: false, message: '服务器内部错误' });
  });

  return { app, db, realtime };
}
