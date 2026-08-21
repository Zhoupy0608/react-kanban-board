# React Kanban Board

面向个人与小团队的轻量全栈看板：多视图拖拽排期、草稿箱、协作分享与可选板内 AI。默认使用 **MySQL + Redis**，前后端同进程启动，改完即同步。

**技术栈：** React 19 + Vite 7 · Express 5 · MySQL · Redis · JWT + bcryptjs · WebSocket

**仓库：** [Zhoupy0608/react-kanban-board](https://github.com/Zhoupy0608/react-kanban-board)

---

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 账号 | 注册 / 登录 / 个人页（昵称与邮箱可改）/ 退出作废 Token |
| 看板列表 | 正式看板 + **草稿箱**（暂存想法，一键发布成看板） |
| 多视图 | 概览 / 看板 / 列表 / 日历 |
| 看板交互 | 卡片跨列拖拽、列重排、列宽高可调（本地记忆） |
| 卡片 | 标签、截止日期、清单、评论与 @提及 |
| 协作 | 成员邀请（editor / viewer）、实时同步、通知中心 |
| AI（可选） | 列内注入、描述润色、拆分任务 / 清单等（OpenAI 兼容接口） |
| 工程 | 版本化迁移、乐观锁、健康检查、GitHub Actions CI |

---

## 快速开始

环境：Node.js 18+（推荐 22）、Docker（用于 MySQL + Redis）

```bash
npm install
cp .env.example .env
docker compose up -d
npm start
```

打开 `http://localhost:5000`。健康检查：`http://localhost:5000/api/health`（应看到 `dbDriver: "mysql"`、`redis: "connected"`）。

### 演示账号

| 邮箱 | 密码 |
| --- | --- |
| `demo@mykanban.dev` | `demo1234` |
| `collab@mykanban.dev` | `demo1234`（协作演示，需先被主账号邀请） |

首次启动会自动建表并写入演示数据。

> 数据在 Docker MySQL 卷中。清空可执行：`docker compose down -v` 后重新 `docker compose up -d`。  
> Redis 默认必连；仅应急可设 `REDIS_OPTIONAL=1`（不推荐）。

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run docker:up` | 启动 MySQL + Redis |
| `npm start` / `npm run dev` | 开发：Express + Vite HMR，端口 5000 |
| `npm run build` | 构建前端到 `dist/` |
| `npm run start:prod` | 生产模式（静态 `dist`） |
| `npm test` | API 测试（需 Docker 已启动） |
| `npm run share` | cpolar 公网临时分享 |

---

## 使用提示

- **草稿箱**：列表页下方可添加草稿；完善后点发布，生成带默认三列的正式看板。
- **个人页**：点击顶栏用户胶囊进入，可修改昵称 / 邮箱。
- **双窗口协作**：登录态在 `sessionStorage`，每个窗口独立；分别登录 demo / collab 即可联调。
- **板内 AI**：复制 `.env.example` 为 `.env`，配置 `AI_API_KEY`（及可选 `AI_BASE_URL` / `AI_MODEL`）。国内模型一般无需 `AI_HTTP_PROXY`。

---

## 界面预览

**图 1 · 登录** — 演示账号预填，支持双窗口独立登录态

![登录](docs/screenshots/login.png)

**图 2 · 看板列表** — 正式看板与草稿箱，支持添加、发布与删除

![看板列表](docs/screenshots/boards.png)

**图 3 · 看板视图** — 多列拖拽、筛选与 AI 添加卡片

![看板视图](docs/screenshots/board.png)

**图 4 · 概览** — 任务统计、列分布与标签分布

![概览视图](docs/screenshots/overview.png)

**图 5 · 列表视图** — 表格化浏览任务、标签与截止日期

![列表视图](docs/screenshots/list.png)

**图 6 · 日历视图** — 按日期排期，未排期任务可拖入日历

![日历视图](docs/screenshots/calendar.png)

---

## 安全与配置

- 生产未配置 `JWT_SECRET` 时**拒绝启动**
- 登录 / 注册按 IP 限流；`CORS_ORIGINS` 生产跨域必填
- 退出登录递增 `token_version`，旧 JWT 立即失效
- WebSocket 使用短时 ticket，避免长期 token 出现在 URL

完整模板见 [`.env.example`](.env.example)。

| 变量 | 说明 |
| --- | --- |
| `PORT` / `HOST` | 默认 `5000` / `0.0.0.0` |
| `DATA_DIR` | SQLite 目录，默认 `./data` |
| `JWT_SECRET` | JWT 签名密钥（**生产必须**） |
| `CORS_ORIGINS` | 允许的 Origin，逗号分隔 |
| `AI_API_KEY` | 板内 AI；未设置时 AI 接口返回 503 |
| `AI_BASE_URL` / `AI_MODEL` | OpenAI 兼容地址与模型名 |
| `AI_HTTP_PROXY` | 仅 AI 出网代理（可选） |
| `ALLOW_LEGACY_DB_RESET` | `1` 时允许清空无版本旧库 |

---

## API 摘要

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/health` | 否 | 健康检查（含 `schemaVersion`、`features`） |
| `POST` | `/api/auth/register` · `/login` | 否 | 注册 / 登录 |
| `GET` · `PATCH` | `/api/auth/me` | 是 | 当前用户 / 更新昵称与邮箱 |
| `POST` | `/api/auth/logout` · `/ws-ticket` | 是 | 退出 · 短时 WS 票据 |
| `GET` · `POST` | `/api/boards` | 是 | 看板列表 / 创建 |
| `GET` · `PUT` | `/api/boards/:id/full` | 是 | 整板读写（乐观锁） |
| `GET` · `POST` · `PATCH` · `DELETE` | `/api/drafts` | 是 | 草稿 CRUD |
| `POST` | `/api/drafts/:id/publish` | 是 | 草稿发布为看板 |
| `GET` · `POST` … | `/api/boards/:id/members` 等 | 是 | 成员 / 评论 / 活动 |
| `GET` · `POST` … | `/api/notifications` | 是 | 通知 |
| `POST` | `/api/ai/*` | 是 | 板内 AI（需配置密钥） |

请求头：`Authorization: Bearer <token>`

---

## 数据模型与迁移

```text
users → boards → lanes → cards
     ↘ board_drafts
     ↘ board_members → comments / notifications / activity_events
```

Schema 由 `server/migrations/` 管理（当前 **v8**）：

| 版本 | 内容 |
| --- | --- |
| v1 | 用户 / 看板 / 列 / 卡片 / 活动 |
| v2 | 多看板发布标记 |
| v3 | 成员 / 评论 / 通知 |
| v4 | `users.token_version` |
| v5 | `boards.content_version` |
| v6 | `cards.checklist` |
| v7 | `cards.priority` |
| v8 | `board_drafts` 草稿箱 |

启动时自动 `migrate up`；也可用 `npm run migrate*`。

---

## 目录结构

```text
.
├── server.js                 # 入口：API + Vite / dist
├── server/
│   ├── createApp.js
│   ├── auth.js / db.js / ai.js
│   ├── migrations/           # v1 … v8
│   └── routes/               # auth、boards、drafts、notifications、ai
├── src/
│   ├── pages/                # 登录、列表、个人页、看板工作区
│   ├── components/           # 列、抽屉、筛选、弹窗等
│   ├── context/AuthContext.jsx
│   └── services/api.js
├── tests/                    # vitest + supertest
├── scripts/migrate.mjs
├── .env.example
└── .github/workflows/ci.yml
```

---

## 部署

- **Render**：见 `render.yaml`，控制台设置 `JWT_SECRET`
- **Docker**：见 `Dockerfile`；需配置 `JWT_SECRET`、`MYSQL_*`、`REDIS_URL`

---

## 常见问题

**登录后 401？**  
Token 过期或未带 `Authorization`，重新登录即可。

**启动报 MySQL / Redis 连接失败？**  
先执行 `docker compose up -d`（或 `npm run docker:up`），确认 `.env` 中 `MYSQL_*` / `REDIS_URL` 正确。健康检查：`http://localhost:5000/api/health`。

**想清空业务数据？**  
`docker compose down -v` 后重新 `docker compose up -d`，再 `npm start`（会重建表并写入演示账号）。

**本机没有 Docker？**  
需要可用的 MySQL 8 与 Redis 7，并在 `.env` 填对应连接信息。
