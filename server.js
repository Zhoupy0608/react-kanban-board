import express from 'express'; 
import cors from 'cors'; // 处理跨域冲突
const app = express();

// 后端服务端口 5000 (以免跟 React默认的3000 冲突)
const PORT = 5000; 

app.use(cors());// 允许 React 跨域访问
app.use(express.json()); // 允许后端解析 JSON 格式的请求体

// 根路径：用于浏览器访问时显示服务信息
app.get('/', (req, res) => {
  res.send('Kanban API 服务已运行。可用接口：GET /api/board，POST /api/update-board');
});

// 1. 数据库
let boardData = [
  { id: 'lane1', title: '待处理', cards: [{ id: 'c10', text: '写代码', description: '' }, { id: 'c1', text: '清洁', description: '用肥皂洗和抛光地板...' }, { id: 'c2', text: '买面包', description: '超市里有新鲜面包' }] },
  { id: 'lane2', title: '进行中', cards: [{ id: 'c4', text: '写博客', description: '人工智能能制作表情包吗' }] },
  { id: 'lane3', title: '已完成', cards: [{ id: 'c6', text: '买牛奶', description: '2加仑牛奶' }] },
  { id: 'lane4', title: '新任务', cards: [] }
];

// 2. GET 接口：获取数据
// 路径：http://localhost:5000/api/board
app.get('/api/board', (req, res) => {
  console.log('前端来要数据了...');
  res.json(boardData);
});

// 3. POST 接口：接收前端的更新（比如拖拽后）
// 路径：http://localhost:5000/api/update-board
app.post('/api/update-board', (req, res) => {
  const newList = req.body; // 假设前端把移动后的整个列表传过来
  boardData = newList; 
  console.log('看板状态已更新');
  res.json({ success: true, message: '服务器已同步' });
});

app.listen(PORT, () => {
  console.log(`后端服务运行在: http://localhost:${PORT}`);
});