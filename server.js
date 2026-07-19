import express from 'express';
import cors from 'cors';
import { openDb, getBoard, saveBoard } from './db.js';

const app = express();
const PORT = 5000;
const db = openDb();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Kanban API 服务已运行（SQLite 持久化）。可用接口：GET /api/board，POST /api/update-board');
});

// GET：从 SQLite 读取看板
app.get('/api/board', (req, res) => {
  try {
    const board = getBoard(db);
    res.json(board);
  } catch (err) {
    console.error('读取看板失败:', err);
    res.status(500).json({ success: false, message: '读取看板失败' });
  }
});

// POST：整板写入 SQLite（事务替换）
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

app.listen(PORT, () => {
  console.log(`后端服务运行在: http://localhost:${PORT}`);
});
