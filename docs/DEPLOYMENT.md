# 部署指南

## 一、初始化配置工具

`tools/init_config.py`（仅 Python 标准库）负责生成 `config.json` 与 `.env.local`，并输出 Vercel 环境变量清单。

### 交互模式

```bash
python tools/init_config.py
```

### 非交互模式

```bash
python tools/init_config.py --non-interactive \
  --site-name "知识论坛" \
  --db-type turso \
  --db-url "libsql://your-db.turso.io" \
  --db-token "your-token" \
  --github-client-id xxx \
  --github-client-secret xxx \
  --admin-ids octocat,alice
```

### 仅打印 Vercel 环境变量清单

```bash
python tools/init_config.py --print-env
```

## 二、准备数据库

### 方式 A：Turso（推荐）

1. 注册 https://app.turso.tech → **Create Database**（选离用户近的区域，如 Tokyo）；
2. 进入数据库 → **Settings → API Keys** 创建 Token；
3. 复制 **URL**（形如 `libsql://xxx.turso.io`）与 **Token**。

### 方式 B：PostgreSQL（Neon / Supabase / 自建）

获取连接串 `postgresql://user:pass@host:5432/db`，将 `DB_TYPE` 设为 `postgres`。

> 本地零配置体验：不填任何数据库即可，默认使用 `file:./data/forum.db` 本地文件库。

## 三、本地开发

```bash
npm install
npm run db:migrate    # 初始化表结构（自动识别方言）
npm run dev           # http://localhost:3000
```

## 四、部署到 Vercel

1. **推送代码到 GitHub 仓库**（`config.json` 与 `.env.local` 已被 .gitignore 排除）；
2. **Vercel 导入项目**：vercel.com → Add New → Project → 选择仓库；
3. **配置环境变量**：Project → Settings → Environment Variables，逐项添加（见下方清单），分别配置 Production / Preview / Development（Development 可指向本地 Turso 库）；
4. **重新部署**：Settings 修改环境变量后需 Redeploy；
5. **配置 GitHub OAuth**：
   - Homepage URL：`https://你的项目名.vercel.app`
   - Callback URL：`https://你的项目名.vercel.app/api/auth/callback/github`
6. 访问 `https://你的项目名.vercel.app`。

### Vercel 环境变量清单

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DB_TYPE` | ✅ | `turso` 或 `postgres` |
| `TURSO_DATABASE_URL` | 按需 | Turso 数据库 URL（DB_TYPE=turso 时必填） |
| `TURSO_AUTH_TOKEN` | 按需 | Turso Token（远程库必填） |
| `DATABASE_URL` | 按需 | Postgres 连接串（DB_TYPE=postgres 时必填） |
| `GITHUB_CLIENT_ID` | ✅ | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | ✅ | GitHub OAuth App Secret |
| `NEXTAUTH_SECRET` | ✅ | 会话签名密钥（初始化工具自动生成） |
| `NEXTAUTH_URL` | ⚠️ | 自定义域名时必填（Vercel 自动注入默认域名） |
| `ADMIN_GITHUB_IDS` | ✅ | 管理员 GitHub 登录名，逗号分隔 |
| `NEXT_PUBLIC_SITE_NAME` | 可选 | 站点名（构建期注入） |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | 可选 | 站点描述 |

> 注意：`NEXT_PUBLIC_*` 变量在**构建期**注入，修改后必须重新部署（Redeploy）才生效。

## 五、常见问题

| 问题 | 解决 |
| --- | --- |
| 点击"使用 GitHub 登录"无响应，但 Network 里请求返回 302 | 登录按钮必须使用客户端 `signIn('github')`（POST 方式），**不能**用 `<a href="/api/auth/signin/github">` 这类 GET 链接：配置了自定义登录页（`pages.signIn`）时，NextAuth 会把 GET signin 请求重定向回登录页（带 `error=github`），不会发起 OAuth 授权（见 `src/components/GitHubSignInButton.tsx` 注释） |
| 登录报 OAUTH_CALLBACK_ERROR | 检查 GitHub OAuth 的 Callback URL 是否与部署域名一致（`/api/auth/callback/github`） |
| 登录后跳转 500 | 检查数据库迁移是否已执行（`npm run db:migrate`） |
| 后台提示无权限 | 确认 `ADMIN_GITHUB_IDS` 填的是 **GitHub 登录名**（如 `octocat`）而非昵称 |
| 切换数据库 | 改 `DB_TYPE` 与连接变量 → `npm run db:generate:pg`（如需新表）→ `npm run db:migrate` |
| 在线人数长期为 0 | 检查 `features.online` 开关与心跳表是否创建 |

## 六、安全建议

- `NEXTAUTH_SECRET` 使用高强度随机串（工具已自动生成），且 Production / Preview 使用不同值；
- 不要提交 `config.json`、`.env.local`（.gitignore 已排除）；
- 管理员账号通过后台授予后，请谨慎操作删除类功能；
- Turso Token 按最小权限创建，可随时在控制台轮换。
