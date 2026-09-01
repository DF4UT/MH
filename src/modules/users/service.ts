/**
 * 用户模块服务层：所有用户相关的数据访问
 */
import { and, asc, count, desc, eq, inArray, like, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { escapeLike } from '@/lib/utils';

const { users, posts, comments, postTags } = schema;

export interface UserRow {
  id: number;
  githubId: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  createdAt: number;
  updatedAt: number;
  /** 帖子数（列表查询时填充） */
  postCount?: number;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getUserByGithubId(githubId: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.githubId, githubId)).limit(1);
  return rows[0] ?? null;
}

export interface UpsertGithubUserInput {
  githubId: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  /** 是否在管理员名单中（名单命中则提升为 admin，否则保留原角色） */
  isAdmin: boolean;
}

/** GitHub 登录时 upsert：已存在则更新资料，不存在则创建 */
export async function upsertGithubUser(input: UpsertGithubUserInput): Promise<UserRow> {
  const now = Date.now();
  const existing = await getUserByGithubId(input.githubId);
  if (existing) {
    const nextRole: 'user' | 'admin' = input.isAdmin ? 'admin' : existing.role;
    const [row] = await db
      .update(users)
      .set({
        username: input.username,
        email: input.email ?? existing.email,
        avatarUrl: input.avatarUrl ?? existing.avatarUrl,
        role: nextRole,
        updatedAt: now,
      })
      .where(eq(users.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(users)
    .values({
      githubId: input.githubId,
      username: input.username,
      email: input.email,
      avatarUrl: input.avatarUrl,
      role: input.isAdmin ? 'admin' : 'user',
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export interface ListUsersOptions {
  q?: string;
  sort?: 'createdAt' | 'username' | 'role';
  order?: 'asc' | 'desc';
  offset?: number;
  limit?: number;
}

/** 后台用户列表：搜索 + 排序 + 分页（含帖子数） */
export async function listUsers(
  opts: ListUsersOptions = {}
): Promise<{ items: UserRow[]; total: number }> {
  const { q, sort = 'createdAt', order = 'desc', offset = 0, limit = 20 } = opts;
  const where = q
    ? or(like(users.username, `%${escapeLike(q)}%`), like(users.githubId, `%${escapeLike(q)}%`))
    : undefined;

  const sortCol =
    sort === 'username' ? users.username : sort === 'role' ? users.role : users.createdAt;
  const [rows, totalRows, postRows] = await Promise.all([
    db
      .select()
      .from(users)
      .where(where)
      .orderBy(order === 'asc' ? asc(sortCol) : desc(sortCol))
      .limit(Math.min(limit, 100))
      .offset(offset),
    db.select({ n: count() }).from(users).where(where),
    db.select({ authorId: posts.authorId, n: count() }).from(posts).groupBy(posts.authorId),
  ]);

  const postCountMap = new Map(postRows.map((r) => [r.authorId, r.n]));
  return {
    items: rows.map((r) => ({ ...r, postCount: postCountMap.get(r.id) ?? 0 })),
    total: totalRows[0]?.n ?? 0,
  };
}

/** 设置用户角色 */
export async function setUserRole(id: number, role: 'user' | 'admin'): Promise<void> {
  await db.update(users).set({ role, updatedAt: Date.now() }).where(eq(users.id, id));
}

/** 删除用户及其全部数据（帖子、评论、标签关联级联清理） */
export async function deleteUser(id: number): Promise<boolean> {
  const user = await getUserById(id);
  if (!user) return false;
  const userPosts = await db.select({ id: posts.id }).from(posts).where(eq(posts.authorId, id));
  const postIds = userPosts.map((p) => p.id);
  await db.transaction(async (tx) => {
    await tx.delete(comments).where(eq(comments.authorId, id));
    if (postIds.length > 0) {
      await tx.delete(postTags).where(inArray(postTags.postId, postIds));
      await tx.delete(posts).where(eq(posts.authorId, id));
    }
    await tx.delete(users).where(eq(users.id, id));
  });
  return true;
}
