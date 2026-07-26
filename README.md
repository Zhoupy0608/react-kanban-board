# React Kanban Board（前后端一体版）

面向个人与小团队的轻量看板：拖拽排期、多视图切换、标签与截止日期筛选，数据落在本机 SQLite，前后端同进程启动，改完即同步。

技术上由 **Vite + React** 界面、**Express** API 与 **better-sqlite3** 组成；开发与生产共用同一端口，无需拆成两套服务。

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

启动成功后，按终端提示的访问地址打开即可（默认端口 **5000**）。

| 命令 | 说明 |
| --- | --- |
| `npm start` / `npm run dev` | 开发模式：Express + Vite HMR，默认端口 **5000** |
| `npm run build` | 构建前端到 `dist/` |
| `npm run start:prod` | 构建并以生产模式启动（静态资源 + API） |
| `npm run share` | 用 cpolar 把本机 5000 暴露到公网（需已安装 cpolar） |

> 不必再分别启动前端与后端；一个进程即可。

---

## 公网分享（cpolar）

适合临时给同事演示。本机需保持开机，且 `npm start` 与隧道进程都不退出。

1. 先执行 `npm start`，确认本机服务在端口 **5000** 正常
2. 另开终端执行 `npm run share`（或手动：`cpolar http 5000`）
3. 终端会输出形如 `https://xxxx.r8.cpolar.cn` 的公网地址，发给他人即可访问

说明：

- 免费域名**重启隧道后可能变化**
- 项目已配置 Vite `allowedHosts: true`，避免隧道域名被拦截
- 关闭 cpolar 或本机服务后，公网链接失效
- 访问者看到的是**同一份**本机 SQLite 数据

---

## 界面预览

侧边栏可在四种视图间切换：

### 概览

统计列分布、标签分布与需关注的到期任务。

![概览视图](docs/screenshots/overview.png)

### 看板

多列拖拽排期，支持列管理与卡片标签、截止日期。

![看板视图](docs/screenshots/board.png)

### 列表

表格形式浏览全部任务，支持排序与筛选。

![列表视图](docs/screenshots/list.png)

### 日历

按日期查看与拖拽改期；未排期任务可拖到日期格子上。

![日历视图](docs/screenshots/calendar.png)

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
