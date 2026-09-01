# 架构说明

本文解释项目的核心骨架如何实现**高兼容性**与**高扩展性**。

## 1. 分层架构

```text
┌────────────────────────────────────────────────┐
│ 表现层（Pages / Components）                    │
│  App Router 页面 + 客户端组件（use client）     │
├────────────────────────────────────────────────┤
│  API 层（src/app/api/**/route.ts）              │
│  参数校验（zod）→ 权限校验（requireUser/Admin） │
├────────────────────────────────────────────────┤
│  业务模块层（src/modules/*/service.ts）         │
│  帖子/评论/标签/用户/在线/统计 —— 可插拔        │
├────────────────────────────────────────────────┤
│  基础设施层（src/lib/*）                        │
│  config（环境变量 + config.json 合并）          │
│  db（Drizzle 双方言抽象）                       │
│  auth（NextAuth JWT）                           │
├────────────────────────────────────────────────┤
│  数据层（drizzle/schema-*.ts + 迁移）           │
│  Turso/libSQL 或 PostgreSQL                     │
└────────────────────────────────────────────────┘
```

- **页面只做编排**：服务端组件取数（SSR 首屏），客户端组件负责交互与懒加载；
- **API 只做协议**：校验、鉴权、调用服务层，不写业务 SQL；
- **服务层是唯一的数据入口**：换库、加缓存、加审计都只改这一层。

## 2. 配置驱动（config.json + 环境变量）

| 优先级 | 来源 | 场景 |
| --- | --- | --- |
| 1 | 环境变量 | Vercel 部署、本地 .env.local |
| 2 | config.json | 本地开发（由 tools/init_config.py 生成） |
| 3 | 内置默认值 | 零配置兜底（本地文件库） |

`src/lib/config.ts` 统一合并三处来源，所有模块只通过 `getConfig()` 读取。**新增配置项**只需：加接口字段 → 初始化工具加一问 → 完成，无需改动业务代码。

## 3. 数据库抽象（Turso ⇄ Postgres 一键切换）

### 3.1 双方言 schema

SQLite 与 Postgres 存在方言差异（id 自增、时间类型、enum 等），因此提供两套结构一致的模型：

- `drizzle/schema-sqlite.ts`：`integer` 自增主键、整数时间戳
- `drizzle/schema-pg.ts`：`serial` 主键、`bigint(mode: number)` 时间戳（Drizzle 自动转 number）

业务侧统一时间戳为 **Unix 毫秒整数**，规避日期函数方言差异。

### 3.2 客户端抽象

`src/lib/db.ts` 根据配置选择驱动并导出统一的 `db` / `schema` / `dialect`：

```ts
// turso：@libsql/client + drizzle-orm/libsql
// postgres：postgres-js + drizzle-orm/postgres-js
const { db, schema } = createDb();
```

服务层只使用双方言共有的 API（select/insert/update/delete/eq/inArray/count/onConflictDoUpdate 等），并刻意避免方言函数（如 group_concat / string_agg / 日期函数），改为**分批关联 + JS 聚合**（见 `posts/service.ts` 的 `attachMeta` 与 `admin/service.ts` 的按天聚合）。

### 3.3 切换步骤

1. 设置 `DB_TYPE=postgres` 与 `DATABASE_URL=postgresql://...`（或 config.json 同名字段）；
2. `npm run db:generate:pg && npm run db:migrate`；
3. 重启服务。**业务代码零改动**。

## 4. 认证与权限

- **JWT 会话**（非数据库会话表）：天然适配 Vercel Serverless，冷启动无查询；
- 登录回调中 **upsert 本站用户**（首次登录自动建号）；
- 角色三层校验：
  1. 配置名单 `ADMIN_GITHUB_IDS`（登录时自动提升为 admin）；
  2. `middleware.ts`（Edge）拦截 `/admin/*` 页面，按 JWT role 快速放行/跳转；
  3. API 层 `requireAdminUser()` **实时查库**校验，防越权（角色被后台调整后立即生效）。

## 5. 在线人数（Serverless 友好）

- 客户端每 30s POST 心跳（登录用户按 userId、游客按 localStorage clientId）；
- 服务端对 `online_users` 表 upsert 并清理 2 分钟前的记录；
- 数据库表方案在 Serverless 下跨实例一致，无需 WebSocket/内存共享。

## 6. 模块化与可插拔

- 每个业务模块 = `src/modules/<name>/` 下的 service + `src/app/api/<name>/` 路由 + 相关组件；
- `config.features.*` 提供模块级开关（posts/comments/tags/search/online/admin），关闭后对应 API 直接拒绝；
- 新增模块流程：加 schema（双文件）→ 生成迁移 → 写 service → 写 API → 写页面，与既有模块零耦合。

## 7. 兼容性说明

- **浏览器**：仅使用标准 Web API（fetch、IntersectionObserver、localStorage、crypto.randomUUID 均带降级），CSS Flex/Grid 布局，`-webkit-` 前缀用于 backdrop-filter 等；已在 Chrome / Edge / Firefox / Safari 语义上对齐（标准属性 + 前缀回退）；
- **移动端**：768px 断点折叠导航为汉堡菜单、单列帖子列表；后台侧边栏转为顶部横条；表格横向滚动；
- **无障碍**：语义化标签（nav/main/article/section）、aria-label、焦点可见性（:focus-visible）、prefers-reduced-motion；
- **Serverless**：数据库连接 `max: 1` + `prepare: false`，避免连接池耗尽。

## 8. 主要数据流

```text
发帖：PostForm(客户端) → POST /api/posts → requireUser → zod 校验
      → posts.service.createPost → db(方言自适应) → 返回 id → 跳转详情

列表：首页(SSR) listPosts(首批) → InfinitePosts 滚动 → GET /api/posts?cursor=
      → 服务层游标分页 → 追加渲染

在线：Navbar 30s → POST /api/online{clientId} → upsert+清理 → 返回人数
```
