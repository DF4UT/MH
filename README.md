# 知识论坛（Knowledge Forum）

一个**非商业、轻量级**的知识技术论坛：GitHub OAuth 登录、Markdown 发帖、标签分类、评论、全文搜索、在线人数，以及带数据可视化的后台管理系统。界面采用 **VSCode High Contrast 高对比度主题**，适配 PC 与移动端。

## ✨ 功能特性

| 模块     | 说明                                                             |
| -------- | ---------------------------------------------------------------- |
| 认证     | 仅 GitHub OAuth（NextAuth.js），首次登录自动建号，管理员名单驱动 |
| 帖子     | Markdown 发布/编辑/删除（md-editor-v3），作者或管理员可管理      |
| 标签     | 多标签关联、标签云、按标签筛选                                   |
| 评论     | 登录后评论（支持 Markdown 与预览），作者/管理员可删              |
| 搜索     | 标题 + 内容模糊搜索，游标分页                                    |
| 在线人数 | 客户端 30s 心跳 + 服务端活跃窗口统计，导航栏实时显示             |
| 懒加载   | Intersection Observer 无限滚动                                   |
| 后台     | 仪表盘 / 用户管理 / 帖子管理 / Highcharts 数据分析               |
| 主题     | VSCode High Contrast 高对比度，CSS 变量集中管理，可换肤          |

## 🛠 技术栈

- **框架**：Next.js 14（App Router）+ React 18 + TypeScript（严格模式）
- **ORM**：Drizzle ORM（**Turso/libSQL 与 PostgreSQL 双方言抽象**，一键切换）
- **认证**：NextAuth.js v4（JWT 会话策略，适配 Serverless）
- **编辑器**：md-editor-v3（编辑 + 预览）
- **图表**：Highcharts + highcharts-react-official
- **校验**：zod
- **规范**：ESLint（next/core-web-vitals）+ Prettier，遵循腾讯编码规范（命名、注释、结构）

## 📁 项目结构

```text
/
├── config.json                  # 初始化工具生成（不提交）
├── .env.local                   # 本地环境变量（不提交）
├── drizzle/                     # ORM 模型与迁移
│   ├── schema-sqlite.ts         #   SQLite/Turso 模型
│   ├── schema-pg.ts             #   Postgres 模型（结构一致）
│   └── migrations-sqlite/       #   已生成的 SQLite 迁移
├── scripts/
│   ├── migrate.ts               # 数据库迁移脚本（自动选方言）
│   └── smoke.mjs                # 冒烟测试
├── src/
│   ├── app/
│   │   ├── (main)/              # 主界面：首页/帖子/标签/搜索/个人/登录
│   │   ├── admin/               # 后台：仪表盘/用户/帖子/分析
│   │   └── api/                 # API 路由（auth/posts/comments/tags/search/online/admin）
│   ├── components/              # 通用组件（含 admin/ 子目录）
│   ├── lib/                     # 核心库：config/db/auth/api/utils/validation
│   ├── modules/                 # 业务模块（可插拔）：posts/comments/tags/users/online/admin
│   ├── middleware.ts            # 后台路由守卫（Edge）
│   └── app/globals.css          # 高对比度主题变量与全局样式
├── tools/init_config.py         # 初始化配置工具（Python 标准库）
└── docs/                        # 架构/API/部署文档
```

## 🚀 快速开始

> 需要：Node.js ≥ 18.17、Python 3.8+（仅初始化工具需要）、GitHub OAuth App

### 1. 初始化配置

```bash
python tools/init_config.py
```

按提示输入站点名、数据库、GitHub OAuth 凭证与管理员 ID，工具将自动生成 `config.json` 与 `.env.local`。

也可以非交互式执行：

```bash
python tools/init_config.py --non-interactive \
  --site-name "知识论坛" \
  --db-type turso \
  --db-url "libsql://your-db.turso.io" \
  --db-token "your-token" \
  --github-client-id xxx --github-client-secret xxx \
  --admin-ids octocat
```

> 没有外部数据库？默认使用本地文件数据库 `file:./data/forum.db`（libSQL 文件模式），零配置即可跑通。

### 2. 安装依赖并初始化数据库

```bash
npm install
npm run db:migrate   # 按配置自动选择方言执行迁移
```

### 3. 启动开发服务器

```bash
npm run dev
# 打开 http://localhost:3000
```

## 🔑 GitHub OAuth 配置

1. 打开 https://github.com/settings/developers → **New OAuth App**
2. 填写：
   - Homepage URL：`http://localhost:3000`（生产为你的域名）
   - Authorization callback URL：`http://localhost:3000/api/auth/callback/github`
3. 将生成的 Client ID / Secret 填入初始化工具

## 🔧 常用命令

```bash
npm run dev              # 开发
npm run build            # 生产构建
npm run start            # 生产启动
npm run lint             # ESLint
npm run format           # Prettier
npm run typecheck        # TypeScript 检查
npm run db:migrate       # 执行迁移（自动选方言）
npm run db:generate      # 生成 SQLite 迁移
npm run db:generate:pg   # 生成 Postgres 迁移
npm run smoke            # 冒烟测试（需先启动服务）
```

## ☁️ 部署到 Vercel

详见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)（含环境变量清单、Turso 建库步骤、回调地址配置）。

## 📚 文档

- [架构说明（兼容性与扩展性设计）](docs/ARCHITECTURE.md)
- [API 文档](docs/API.md)
- [部署指南](docs/DEPLOYMENT.md)
- [初始化配置工具说明](docs/DEPLOYMENT.md#初始化配置工具)

## 📄 许可

MIT，非商业用途自由使用。数据与内容归发布者所有。
