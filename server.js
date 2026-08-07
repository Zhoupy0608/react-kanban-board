import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { createApp } from './server/createApp.js';
import { assertAuthConfig, authenticateWsCredential } from './server/auth.js';
import { getBoardAccess } from './server/collab.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const APP_LINK = `http://localhost:${PORT}`;
const distDir = path.join(__dirname, 'dist');
const isProd =
  process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

async function start() {
  assertAuthConfig();
  const { app, db, realtime } = createApp();

  if (isProd && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      root: __dirname,
      server: {
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      // 优先使用短时 ticket；兼容旧客户端的 token 参数
      const credential = url.searchParams.get('ticket') || url.searchParams.get('token');
      const boardId = url.searchParams.get('boardId');
      if (!credential) {
        ws.close(4401, 'unauthorized');
        return;
      }
      const user = authenticateWsCredential(db, credential);
      realtime.joinUser(user.id, ws);

      if (boardId) {
        const access = getBoardAccess(db, boardId, user.id);
        if (!access) {
          ws.close(4403, 'forbidden');
          return;
        }
        realtime.joinBoard(boardId, ws);
      }

      ws.send(
        JSON.stringify({
          type: 'connected',
          userId: user.id,
          boardId: boardId || null,
          at: new Date().toISOString(),
        })
      );

      ws.on('close', () => realtime.leave(ws));
      ws.on('error', () => realtime.leave(ws));
    } catch {
      ws.close(4401, 'unauthorized');
    }
  });

  server.listen(PORT, HOST, () => {
    const publicUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || APP_LINK;
    console.log('');
    console.log('========================================');
    console.log('  MyKanban 访问地址');
    console.log(`  ${publicUrl}`);
    console.log('========================================');
    console.log(
      `模式: ${isProd && fs.existsSync(distDir) ? '生产 (dist)' : '开发 (Vite HMR)'}`
    );
    console.log('WebSocket: /ws?ticket=...&boardId=...（先 POST /api/auth/ws-ticket）');
    console.log('演示账号: demo@mykanban.dev / demo1234');
    console.log('协作账号: collab@mykanban.dev / demo1234');
    console.log('');
  });
}

start().catch((err) => {
  console.error('服务启动失败:', err);
  process.exit(1);
});
