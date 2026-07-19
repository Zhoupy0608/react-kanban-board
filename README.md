# React Kanban Board（前后端联动版）

一个基于 React 构建的模块化看板系统。前端采用 **Vite + React**，后端采用 **Express + SQLite**，看板数据持久化到本地数据库文件。

---

## 🚀 核心特性

- **双维度原生拖拽**：支持卡片跨列移动与列（Lane）左右排序。
- **即时编辑**：支持点击修改卡片标题与描述。
- **模块化结构**：`Hooks + Components + Styles + Services`，便于二次开发。
- **SQLite 持久化**：重启后端后数据仍保留；`lanes` / `cards` 分表存储，整板更新走事务。

---

## 🧱 技术栈

- **前端**：React + Vite
- **后端**：Express（`server.js`）+ CORS
- **数据库**：SQLite（`better-sqlite3`，文件位于 `data/kanban.db`）
- **通信**：HTTP JSON API（`fetch`）

---

## 🛠️ 快速开始

### 1）安装依赖

```bash
npm install
```

### 2）启动后端（API 服务）

```bash
npm run server
```

启动成功后：
- 根路径：`http://localhost:5000/`
- 看板 API：`http://localhost:5000/api/board`
- 数据库文件：`data/kanban.db`（首次启动自动创建并写入默认数据）

### 3）启动前端（开发服务器）

```bash
npm run dev
```

Vite 默认会在控制台提示访问地址（通常是 `http://localhost:5173/`）。

---

## 🔌 后端 API 文档

### GET `/api/board`

返回整张看板数据（数组，每个元素为一个 lane）。

### POST `/api/update-board`

前端在“新增/删除/编辑/拖拽”后，会把**整张看板**作为请求体发送到后端；后端在事务中清空并重写 `lanes` / `cards` 表。

---

## 📦 数据模型（简化）

```js
// Lane
{ id: string, title: string, cards: Card[] }

// Card
{ id: string, text: string, description?: string }
```

SQLite 表结构：
- `lanes(id, title, position)`
- `cards(id, lane_id, text, description, position)`

---

## 📂 目录结构

```text
.
├── server.js                 # Express 后端 API
├── db.js                     # SQLite 初始化 / 读写看板
├── data/
│   └── kanban.db             # 本地数据库文件（gitignore，运行后生成）
├── src/
│   ├── components/
│   │   └── Lane.jsx
│   ├── hooks/
│   │   └── useKanban.js
│   ├── services/
│   │   └── api.js
│   ├── styles/
│   │   └── kanbanStyles.js
│   ├── App.jsx
│   └── main.jsx
└── index.html
```

---

## 🧩 样式自定义

你可以通过修改 `src/styles/kanbanStyles.js` 来调整视觉风格，例如：
- lane 宽度/最大高度（`lane.width` / `lane.maxHeight`）
- 卡片阴影、间距、字体大小等

---

## ❓ 常见问题（FAQ）

### 访问 `http://localhost:5000/` 显示 `Cannot GET /`

说明后端没有配置根路由。当前版本已在 `server.js` 中添加 `GET /`，重启后端后即可看到提示信息。

### 想清空看板恢复默认数据？

删除 `data/kanban.db` 后重新执行 `npm run server`，会自动重建并写入默认看板。
