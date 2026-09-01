# API 文档

所有接口返回 JSON。错误统一为 `{ "error": "描述" }`。

## 认证

| 方法与路径 | 说明 |
| --- | --- |
| `GET/POST /api/auth/[...nextauth]` | NextAuth 标准端点（登录/回调/会话/登出） |
| `GET /api/auth/signin/github` | 跳转 GitHub OAuth |
| `GET /api/auth/session` | 当前会话信息 |

## 公开接口

| 方法与路径 | 鉴权 | 参数 | 说明 |
| --- | --- | --- | --- |
| `GET /api/posts` | 无 | `cursor`（base64url 游标）、`limit`（默认 10，≤50）、`tag`、`authorId` | 帖子列表（含作者/标签/评论数） |
| `GET /api/posts/:id` | 无 | — | 帖子详情 |
| `GET /api/posts/:id/comments` | 无 | — | 帖子评论列表 |
| `GET /api/tags` | 无 | — | 全部标签及使用量 |
| `GET /api/search` | 无 | `q`（必填）、`cursor`、`limit` | 标题/内容模糊搜索 |
| `GET /api/online` | 无 | — | 当前在线人数 `{ online }` |
| `POST /api/online` | 无 | `{ clientId }` | 心跳，返回最新在线数 |

### 帖子列表响应示例

```json
{
  "items": [
    {
      "id": 1,
      "title": "Hello",
      "excerpt": "摘要文本",
      "createdAt": 1735000000000,
      "updatedAt": 1735000000000,
      "author": { "id": 1, "username": "octocat", "avatarUrl": "https://..." },
      "tags": [{ "id": 1, "name": "Next.js" }],
      "commentCount": 3
    }
  ],
  "nextCursor": "eyJjcmVhdGVkQXQiOjE3MzQ5OTk5OTk5OTksImlkIjoxfQ"
}
```

`nextCursor` 为 `null` 表示没有更多数据，直接回传即可翻页。

## 登录用户接口

| 方法与路径 | 鉴权 | 参数 | 说明 |
| --- | --- | --- | --- |
| `POST /api/posts` | 登录 | `{ title, content, tagNames[] }` | 发布帖子，返回 `{ id }` |
| `PATCH /api/posts/:id` | 作者/管理员 | 同上 | 更新帖子 |
| `DELETE /api/posts/:id` | 作者/管理员 | — | 删除帖子 |
| `POST /api/posts/:id/comments` | 登录 | `{ content }` | 发表评论，返回 `{ comment }` |
| `DELETE /api/comments/:id` | 作者/管理员 | — | 删除评论 |

校验规则（zod）：标题 2–200 字符；内容 1–100000 字符；标签 ≤8 个、每个 ≤30 字符；评论 ≤5000 字符。

## 后台接口（管理员）

| 方法与路径 | 参数 | 说明 |
| --- | --- | --- |
| `GET /api/admin/stats` | — | 仪表盘指标（总数/今日新增/在线） |
| `GET /api/admin/users` | `q`、`sort`（createdAt/username/role）、`order`、`offset`、`limit` | 用户列表（含帖子数） |
| `PATCH /api/admin/users/:id` | `{ role: "user"|"admin" }` | 修改角色（不能改自己） |
| `DELETE /api/admin/users/:id` | — | 删除用户及其数据（不能删自己） |
| `GET /api/admin/posts` | `q`、`sort`（id/createdAt）、`order`、`offset`、`limit` | 帖子列表（含总数） |
| `DELETE /api/admin/posts/:id` | — | 删除帖子 |
| `GET /api/admin/analytics` | `days`（7/30/90） | `{ days[], posts[], comments[], users[], tags[] }` |

## 状态码约定

| 状态码 | 含义 |
| --- | --- |
| 200 / 201 | 成功 |
| 400 | 参数错误（zod 校验失败会附带明细） |
| 401 | 未登录 |
| 403 | 无权限（非作者/非管理员/模块未启用） |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |
