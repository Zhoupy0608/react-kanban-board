# React Kanban Board（前后端一体版）

模块化看板：**Vite + React** 前端 + **Express + SQLite** 后端。开发与生产共用固定入口 **http://localhost:5000**，数据持久化到本地数据库。

仓库：[Zhoupy0608/react-kanban-board](https://github.com/Zhoupy0608/react-kanban-board)

---

## 核心特性

- **多视图**：概览 / 看板 / 列表 / 日历，侧边栏切换；顶栏黄色页签显示当前视图
- **双维度拖拽**：卡片跨列移动，列（Lane）左右排序
- **列与卡片**：新增 / 重命名 / 删除列；卡片标题、描述、标签、截止日期
- **详情抽屉**：点击卡片侧栏编辑，保存后自动关闭
- **筛选**：关键词、标签、到期状态（今日 / 逾期 / 已设日期）
- **交互反馈**：删除二次确认弹窗；加载 / 同步失败 Toast 提示
- **SQLite 持久化**：`lanes` / `cards` 分表，整板更新走事务；重启不丢数据

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19 + Vite 7 |
| 后端 | Express 5（`server.js`） |
| 数据库 | SQLite（`better-sqlite3`）→ `data/kanban.db` |
| API | 相对路径 `/api`（开发：同端口 Vite 中间件；生产：同域静态资源） |

---

## 快速开始

环境要求：Node.js 18+（推荐 22）

```bash
npm install
npm start
```

浏览器打开：**http://localhost:5000**

| 命令 | 说明 |
| --- | --- |
| `npm start` / `npm run dev` | 开发模式：Express + Vite HMR，端口 **5000** |
| `npm run build` | 构建前端到 `dist/` |
| `npm run start:prod` | 构建并以生产模式启动（静态资源 + API） |
| `npm run share` | 用 cpolar 把本机 5000 暴露到公网（需已安装 cpolar） |

> 不必再分别启动 5173 前端和 5000 后端；一个进程即可。

---

## 公网分享（cpolar）

适合临时给同事演示。本机需保持开机，且 `npm start` 与隧道进程都不退出。

1. 先执行 `npm start`，确认本机 `http://localhost:5000` 正常
2. 另开终端执行 `npm run share`（或手动：`cpolar http 5000`）
3. 终端会输出形如 `https://xxxx.r8.cpolar.cn` 的地址，发给他人即可访问

说明：

- 免费域名**重启隧道后可能变化**
- 项目已配置 Vite `allowedHosts: true`，避免隧道域名被拦截
- 关闭 cpolar 或本机服务后，公网链接失效
- 访问者看到的是**同一份**本机 SQLite 数据

---

## 部署（可选）

### Docker

```bash
docker build -t mykanban .
docker run -p 5000:5000 -v kanban-data:/data mykanban
```

容器内数据库目录由环境变量 `DATA_DIR` 控制（默认 `/data`）。

### Render 等 PaaS

仓库含 `render.yaml` / `Dockerfile`。构建：`npm ci && npm run build`，启动：`node server.js --prod`。常用环境变量：

| 变量 | 说明 |
| --- | --- |
| `PORT` / `HOST` | 监听端口与地址 |
| `DATA_DIR` | 持久盘路径（无持久盘则重启可能丢数据） |
| `APP_URL` / `RENDER_EXTERNAL_URL` | 启动日志中打印的访问地址 |

---

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/board` | 返回整板数据（lane 数组） |
| `POST` | `/api/update-board` | 请求体为整板数组；事务清空并重写 `lanes` / `cards` |

---

## 数据模型

```js
// Lane
{ id: string, title: string, cards: Card[] }

// Card
{
  id: string,
  text: string,
  description?: string,
  tags?: string[],
  dueDate?: string   // YYYY-MM-DD
}
```

SQLite：

- `lanes(id, title, position)`
- `cards(id, lane_id, text, description, tags, due_date, position)`

---

## 目录结构

```text
.
├── server.js                 # Express：API + 开发 Vite / 生产 dist
├── db.js                     # SQLite 初始化与读写
├── vite.config.js
├── Dockerfile / render.yaml
├── scripts/
│   ├── share.ps1             # cpolar 公网分享
│   └── share-auth.ps1
├── data/                     # kanban.db（gitignore，运行后生成）
└── src/
    ├── App.jsx
    ├── components/           # Lane、FilterBar、Overview、ListView、CalendarView…
    ├── hooks/useKanban.js
    ├── services/api.js
    ├── styles/kanbanStyles.js
    └── utils/cardHelpers.js
```

样式入口：`src/styles/kanbanStyles.js`、`src/index.css`。

---

## 常见问题

**如何恢复默认看板？**  
删除 `data/kanban.db` 后重新 `npm start`，会自动建库并写入默认数据。

**隧道域名提示 Host not allowed？**  
确认已拉取含 `server.allowedHosts: true` 的配置，并重启 `npm start`。

**端口被占用？**  
结束占用 5000 的进程，或设置 `PORT=其他端口` 后重启（分享时 cpolar 也要指向同一端口）。

**Windows 编译 `better-sqlite3` 失败？**  
安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（勾选「使用 C++ 的桌面开发」），再执行 `npm install`。
