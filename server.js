import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDb, getBoard, saveBoard } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 固定端口：应用始终通过这一地址访问 */
const PORT = Number(process.env.PORT) || 5000;
const HOST = process.env.HOST || '0.0.0.0';
const APP_LINK = `http://localhost:${PORT}`;
const distDir = path.join(__dirname, 'dist');
const isProd =
  process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

async function start() {
  const app = express();
  const db = openDb();

  app.use(cors());
  app.use(express.json());

  app.get('/api/board', (req, res) => {
    try {
      res.json(getBoard(db));
    } catch (err) {
      console.error('读取看板失败:', err);
      res.status(500).json({ success: false, message: '读取看板失败' });
    }
  });

  app.post('/api/update-board', (req, res) => {
    try {
      const newList = req.body;
      if (!Array.isArray(newList)) {
        return res.status(400).json({ success: false, message: '请求体必须是看板数组' });
      }
      saveBoard(db, newList);
      console.log('看板状态已写入 SQLite');
      res.json({ success: true, message: '服务器已同步到数据库' });
    } catch (err) {
      console.error('写入看板失败:', err);
      res.status(500).json({ success: false, message: '写入看板失败' });
    }
  });

  if (isProd && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    // 开发：Vite 挂到同一端口，HMR + API 共用固定链接
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

  app.listen(PORT, HOST, () => {
    const publicUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || APP_LINK;
    console.log('');
    console.log('========================================');
    console.log('  MyKanban 访问地址');
    console.log(`  ${publicUrl}`);
    console.log('========================================');
    console.log(
      `模式: ${isProd && fs.existsSync(distDir) ? '生产 (dist)' : '开发 (Vite HMR)'}`
    );
    console.log('');
  });
}

start().catch((err) => {
  console.error('服务启动失败:', err);
  process.exit(1);
});
