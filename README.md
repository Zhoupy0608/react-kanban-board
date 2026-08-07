# React Kanban Board（全栈 Phase A）

面向个人与小团队的全栈看板：**JWT 鉴权**、**多看板归属**、多视图拖拽排期、活动审计日志。数据落在本机 SQLite，前后端同进程启动。

技术栈：**React 19 + Vite 7** · **Express 5** · **better-sqlite3** · **JWT + bcryptjs**

仓库：[Zhoupy0608/react-kanban-board](https://github.com/Zhoupy0608/react-kanban-board)

---

## 核心特性

- **注册 / 登录**：JWT Bearer；密码 bcrypt 哈希
- **多看板**：每用户独立看板列表，资源按 `owner_id` 隔离
- **多视图**：概览 / 看板 / 列表 / 日历
- **双维度拖拽**：卡片跨列 + 列重排；乐观更新 + 串行同步队列防乱序
- **乐观锁**：整板同步携带 `contentVersion`；冲突时提示「保留服务器版 / 强制覆盖」
- **活动日志**：看板创建、同步等操作可审计
- **SQLite 事务**：`PUT /api/boards/:id/full` 整板原子落库
- **健康检查 + CI**：`/api/health`，GitHub Actions 跑测试与构建

---

## 快速开始

环境：Node.js 18+（推荐 22）

```bash
npm install
npm start
```

打开终端提示的地址（默认 **http://localhost:5000**）。

### 演示账号

| 邮箱 | 密码 |
| --- | --- |
| `demo@mykanban.dev` | `demo1234` |

首次启动会按版本执行数据库迁移，并写入演示用户与示例看板（**升级时保留已有业务数据**，不再整库清空）。

> 若需清空数据：删除 `data/kanban.db`（或 `DATA_DIR` 下对应文件）后重启。
> 极旧、无 `schema_meta` 的库默认拒绝启动；确认可丢弃数据时设 `ALLOW_LEGACY_DB_RESET=1`。

| 命令 | 说明 |
| --- | --- |
| `npm start` / `npm run dev` | 开发：Express + Vite HMR，端口 5000 |
| `npm run build` | 构建前端到 `dist/` |
| `npm run start:prod` | 生产模式 |
| `npm test` | API / 迁移测试（vitest + supertest） |
| `npm run migrate` | 查看 schema 迁移状态 |
| `npm run migrate:up` | 升级到最新 schema |
| `npm run migrate:down` | 回退一步迁移（开发用） |
| `npm run share` | cpolar 公网临时分享 |

---

## 协作（Phase B / C）

- **成员分享**：看板所有者可按已注册邮箱邀请 `editor` / `viewer`
- **WebSocket**：前端先 `POST /api/auth/ws-ticket` 换短时票据，再连 `/ws?ticket=...&boardId=...`
- **评论与 @提及**：卡片抽屉内评论；`@昵称` 或 `@邮箱前缀` 会生成通知
- **通知中心**：顶栏铃铛，支持已读与删除
- **板内 AI**（可选）：卡片抽屉「润色描述 / 拆分任务」；需配置 `AI_API_KEY`（OpenAI 兼容），见 `.env.example`

协作演示账号（需先用主账号邀请后可见分享看板）：`collab@mykanban.dev` / `demo1234`

双窗口测试：登录态存在 `sessionStorage`，每个浏览器窗口独立；开两个窗口分别登录 demo / collab 即可，无需改用不同域名。

### 安全相关

- 生产未配置 `JWT_SECRET` 时**拒绝启动**
- 登录/注册按 IP 限流
- `CORS_ORIGINS` 白名单（生产跨域需配置）
- 退出登录会递增 `token_version`，旧 JWT 立即失效
- WebSocket 使用短时 ticket，避免长期 token 出现在 URL/日志

配置模板见 `.env.example`。

| 变量 | 说明 |
| --- | --- |
| `PORT` | 端口，默认 `5000` |
| `HOST` | 监听地址，默认 `0.0.0.0` |
| `DATA_DIR` | SQLite 目录，默认 `./data` |
| `JWT_SECRET` | JWT 签名密钥（**生产必须设置**，否则拒绝启动） |
| `CORS_ORIGINS` | 允许的前端 Origin，逗号分隔；生产跨域必填 |
| `AUTH_RATE_LIMIT_MAX` | 登录/注册窗口内最大次数，默认 `20` |
| `AUTH_RATE_LIMIT_WINDOW_MS` | 限流窗口毫秒，默认 `900000`（15 分钟） |
| `WS_TICKET_EXPIRES` | WebSocket 短时票据有效期，默认 `60s` |
| `ALLOW_LEGACY_DB_RESET` | 设为 `1` 时允许清空无版本旧库后重建 |

---

## API 一览

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/health` | 否 | 健康检查 |
| `POST` | `/api/auth/register` | 否 | 注册 |
| `POST` | `/api/auth/login` | 否 | 登录，返回 JWT |
| `POST` | `/api/auth/logout` | 是 | 退出并作废当前用户全部 access token |
| `POST` | `/api/auth/ws-ticket` | 是 | 换取短时 WebSocket 票据 |
| `GET` | `/api/auth/me` | 是 | 当前用户 |
| `GET/POST` | `/api/boards` | 是 | 列表 / 创建 |
| `GET/PATCH/DELETE` | `/api/boards/:id` | 是 | 元数据 |
| `GET/PUT` | `/api/boards/:id/full` | 是 | 整板读写；PUT 体为 `{ lanes, baseVersion, force? }`，版本冲突返回 409 |
| `GET` | `/api/boards/:id/activity` | 是 | 活动日志 |

请求头：`Authorization: Bearer <token>`

---

## 数据模型

```text
users → boards → lanes → cards
       ↘ board_members
                 ↘ activity_events / card_comments / notifications
```

Schema 由 `server/migrations/` 版本化管理（当前 **v7**）：

| 版本 | 内容 |
| --- | --- |
| v1 | 用户 / 看板 / 列 / 卡片 / 活动 |
| v2 | 多看板发布标记（无结构变更） |
| v3 | 成员 / 评论 / 通知 |
| v4 | `users.token_version`（登出作废 JWT） |
| v5 | `boards.content_version`（整板同步乐观锁） |
| v6 | `cards.checklist`（卡片内勾选清单） |
| v7 | `cards.priority`（低 / 中 / 高） |

启动时自动 `migrate up`；也可用 `npm run migrate` / `migrate:up` / `migrate:down`。升级路径保留数据，不再「版本不够就整库重建」。

---

## 目录结构

```text
.
├── server.js                 # 入口：API + Vite / dist
├── server/
│   ├── createApp.js          # Express 应用工厂（可测）
│   ├── auth.js               # JWT / bcrypt / 中间件
│   ├── cors.js / rateLimit.js
│   ├── db.js                 # SQLite 仓储与启动迁移入口
│   ├── migrations/           # 版本化 schema 迁移（up/down）
│   └── routes/               # auth、boards、notifications
├── .env.example
├── scripts/migrate.mjs       # 迁移 CLI
├── tests/                    # API / 迁移测试
├── .github/workflows/ci.yml
└── src/
    ├── App.jsx               # 路由
    ├── context/AuthContext.jsx
    ├── pages/                # 登录、注册、看板列表、工作区
    ├── hooks/useKanban.js
    └── services/api.js
```

---

## 部署

- **Render**：见 `render.yaml`，请在控制台设置 `JWT_SECRET`
- **Docker**：见 `Dockerfile`，通过环境变量传入 `JWT_SECRET`、`DATA_DIR`

---

## 常见问题

**登录后 401？**  
Token 过期或未带 `Authorization`；重新登录即可。

**想恢复演示数据？**  
删除数据库文件后 `npm start`。

**Windows 编译 better-sqlite3 失败？**  
安装 [VS Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（勾选 C++ 桌面开发）后再 `npm install`。
