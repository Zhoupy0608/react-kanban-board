# React Kanban Board（前后端联动版）

一个基于 React 构建的模块化看板系统。前端采用 **Vite + React**，并通过 **Express 后端 API** 完成看板数据的初始化与同步更新。

---

## 🚀 核心特性

- **双维度原生拖拽**：支持卡片跨列移动与列（Lane）左右排序。
- **即时编辑**：支持点击修改卡片标题与描述。
- **模块化结构**：`Hooks + Components + Styles + Services`，便于二次开发。
- **前后端数据同步**：前端操作后将最新看板数据同步到后端（内存存储）。

---

## 🧱 技术栈

- **前端**：React + Vite
- **后端**：Express（`server.js`）+ CORS
- **通信**：HTTP JSON API（`fetch`）

---

## 🛠️ 快速开始

### 1）安装依赖

```bash
npm install
```

### 2）启动后端（API 服务）

```bash
node server.js
```

启动成功后：
- 根路径：`http://localhost:5000/`
- 看板 API：`http://localhost:5000/api/board`

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

前端在“新增/删除/编辑/拖拽”后，会把**整张看板**作为请求体发送到后端，后端用该数据覆盖内存中的 `boardData`。

---

## 📦 数据模型（简化）

```js
// Lane
{ id: string, title: string, cards: Card[] }

// Card
{ id: string, text: string, description?: string }
```

---

## 📂 目录结构

```text
.
├── server.js                 # Express 后端 API（内存存储 boardData）
├── src/
│   ├── components/
│   │   └── Lane.jsx          # Lane + Card 渲染与拖拽/编辑交互
│   ├── hooks/
│   │   └── useKanban.js       # 看板状态管理 + 拖拽/增删改 + 同步到后端
│   ├── services/
│   │   └── api.js            # boardService：封装 fetch API 调用
│   ├── styles/
│   │   └── kanbanStyles.js    # 内联样式对象
│   ├── App.jsx               # 组装 Lane 列表与新增列入口
│   └── main.jsx              # React 挂载点
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

### 修改了 `server.js` 的初始 `boardData`，但 `/api/board` 没变化

`boardData` 是内存变量：
- **需要重启后端进程** 才会重新加载初始数据；
- 如果前端已经调用过 `POST /api/update-board`，后端内存数据会被前端提交的整张看板覆盖。