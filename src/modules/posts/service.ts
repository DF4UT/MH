/**
 * 帖子模块服务层：列表（游标分页）、详情、创建、更新、删除
 * 查询采用「分批关联」策略（先取帖子页，再批量取标签与评论数），
 * 避免方言差异（SQLite group_concat / Postgres string_agg），保证双方言一致。
 */
import { and, count, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { buildExcerpt, escapeLike, type PageCursor } from '@/lib/utils';
import { findOrCreateTag } from '@/modules/tags/service';

const { posts, users, tags, postTags, comments } = schema;

export interface PostAuthor {
  id: number;
  username: string;
  avatarUrl: string | null;
}

export interface TagInfo {
  id: number;
  name: string;
}

export type PostStatus = 'published' | 'draft';

export interface PostListItem {
  id: number;
  title: string;
  excerpt: string;
  createdAt: number;
  updatedAt: number;
  /** published=公开；draft=草稿箱（仅作者/管理员可见） */
  status: PostStatus;
  author: PostAuthor;
  tags: TagInfo[];
  commentCount: number;
}

export interface PostDetail extends PostListItem {
  content: string;
}

export interface ListPostsOptions {
  cursor?: PageCursor | null;
  limit?: number;
  /** 按标签名筛选 */
  tag?: string;
  /** 按作者筛选 */
  authorId?: number;
  /** 按状态筛选（published/draft）；不传则返回全部，调用方需自行控制可见性 */
  status?: PostStatus;
  /** 全文搜索（标题 + 内容） */
  q?: string;
}

/** 游标条件：按 (createdAt DESC, id DESC) 稳定翻页 */
function cursorWhere(cursor: PageCursor) {
  return or(
    lt(posts.createdAt, cursor.createdAt),
    and(eq(posts.createdAt, cursor.createdAt), lt(posts.id, cursor.id))
  );
}

/** 帖子列表（含作者、标签、评论数），返回下一页游标 */
export async function listPosts(opts: ListPostsOptions = {}): Promise<{
  items: PostListItem[];
  nextCursor: PageCursor | null;
}> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const where: SQL[] = [];

  if (opts.tag) {
    const tagRow = await db.select().from(tags).where(eq(tags.name, opts.tag)).limit(1);
    if (tagRow.length === 0) return { items: [], nextCursor: null };
    const links = await db
      .select({ postId: postTags.postId })
      .from(postTags)
      .where(eq(postTags.tagId, tagRow[0].id));
    const postIds = links.map((l) => l.postId);
    if (postIds.length === 0) return { items: [], nextCursor: null };
    where.push(inArray(posts.id, postIds));
  }
  if (opts.authorId !== undefined) {
    where.push(eq(posts.authorId, opts.authorId));
  }
  if (opts.status) {
    where.push(eq(posts.status, opts.status));
  }
  if (opts.q) {
    const pattern = `%${escapeLike(opts.q)}%`;
    where.push(
      sql`(${posts.title} LIKE ${pattern} ESCAPE '\\' OR ${posts.content} LIKE ${pattern} ESCAPE '\\')`
    );
  }
  if (opts.cursor) {
    const cursorCond = cursorWhere(opts.cursor);
    if (cursorCond) where.push(cursorCond);
  }

  const rows = await db
    .select({
      post: posts,
      author: { id: users.id, username: users.username, avatarUrl: users.avatarUrl },
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(...where))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const meta = await attachMeta(pageRows.map((r) => r.post));

  return {
    items: meta.map((item, i) => ({ ...item, author: pageRows[i].author })),
    nextCursor: hasMore
      ? {
          createdAt: pageRows[pageRows.length - 1].post.createdAt,
          id: pageRows[pageRows.length - 1].post.id,
        }
      : null,
  };
}

/**
 * 批量补充标签与评论数（性能优化：两次查询并行执行 = 1 个网络往返，
 * 标签名通过一次 join 直接取出，避免逐表回查）
 */
async function attachMeta(
  postRows: Array<typeof posts.$inferSelect>
): Promise<Array<Omit<PostListItem, 'author'>>> {
  const ids = postRows.map((p) => p.id);
  if (ids.length === 0) return [];

  const [linkRows, countRows] = await Promise.all([
    // 一次 join 拿到帖子的全部标签（含名称）
    ids.length > 0
      ? db
          .select({ postId: postTags.postId, tagId: tags.id, name: tags.name })
          .from(postTags)
          .innerJoin(tags, eq(postTags.tagId, tags.id))
          .where(inArray(postTags.postId, ids))
      : Promise.resolve([]),
    // 评论数按帖聚合
    ids.length > 0
      ? db
          .select({ postId: comments.postId, n: count() })
          .from(comments)
          .where(inArray(comments.postId, ids))
          .groupBy(comments.postId)
      : Promise.resolve([]),
  ]);

  const countMap = new Map(countRows.map((c) => [c.postId, c.n]));

  return postRows.map((p) => ({
    id: p.id,
    title: p.title,
    excerpt: buildExcerpt(p.content),
    status: p.status as PostStatus,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    tags: linkRows
      .filter((l) => l.postId === p.id)
      .map((l) => ({ id: l.tagId, name: l.name })),
    commentCount: countMap.get(p.id) ?? 0,
  }));
}

/** 帖子详情 */
export async function getPostDetail(id: number): Promise<PostDetail | null> {
  const rows = await db
    .select({
      post: posts,
      author: { id: users.id, username: users.username, avatarUrl: users.avatarUrl },
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(eq(posts.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  const [meta] = await attachMeta([rows[0].post]);
  return { ...meta, content: rows[0].post.content, author: rows[0].author };
}

export interface SavePostInput {
  title: string;
  content: string;
  tagNames: string[];
  /** 发布（published）或存入草稿箱（draft），默认 published */
  status?: PostStatus;
}

/** 创建帖子，返回新帖子 ID */
export async function createPost(
  input: SavePostInput & { authorId: number }
): Promise<number> {
  const now = Date.now();
  const status: PostStatus = input.status === 'draft' ? 'draft' : 'published';
  const [row] = await db
    .insert(posts)
    .values({
      title: input.title,
      content: input.content,
      authorId: input.authorId,
      status,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: posts.id });
  await setPostTags(row.id, input.tagNames);
  return row.id;
}

/** 从 md 文件导入：以文件名（去扩展名）为标题创建草稿 */
export async function importPost(
  input: { title: string; content: string } & { authorId: number }
): Promise<number> {
  return createPost({
    title: input.title,
    content: input.content,
    tagNames: [],
    status: 'draft',
    authorId: input.authorId,
  });
}

/** 更新帖子（标题/内容/标签/状态）；未显式传 status 时保持原状态 */
export async function updatePost(id: number, input: SavePostInput): Promise<boolean> {
  // 显式传了 status 用之；否则读取当前状态保持不变，避免编辑草稿时被误发布
  let nextStatus: PostStatus;
  if (input.status === 'draft' || input.status === 'published') {
    nextStatus = input.status;
  } else {
    const cur = await db
      .select({ status: posts.status })
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1);
    nextStatus = ((cur[0]?.status as PostStatus | undefined) ?? 'published') as PostStatus;
  }
  const [row] = await db
    .update(posts)
    .set({
      title: input.title,
      content: input.content,
      updatedAt: Date.now(),
      status: nextStatus,
    })
    .where(eq(posts.id, id))
    .returning({ id: posts.id });
  if (!row) return false;
  await db.transaction(async (tx) => {
    await tx.delete(postTags).where(eq(postTags.postId, id));
  });
  await setPostTags(id, input.tagNames);
  return true;
}

/** 仅切换帖子状态（发布草稿 / 收回草稿），标题内容不变 */
export async function setPostStatus(id: number, status: PostStatus): Promise<boolean> {
  const [row] = await db
    .update(posts)
    .set({ status, updatedAt: Date.now() })
    .where(eq(posts.id, id))
    .returning({ id: posts.id });
  return !!row;
}

/** 重建帖子的标签关联（去重、最多 8 个） */
async function setPostTags(postId: number, tagNames: string[]): Promise<void> {
  const names = [
    ...new Set(tagNames.map((n) => n.trim().replace(/\s+/g, ' ')).filter(Boolean)),
  ].slice(0, 8);
  if (names.length === 0) return;
  const tagIds: number[] = [];
  for (const name of names) {
    tagIds.push(await findOrCreateTag(name));
  }
  await db.insert(postTags).values(tagIds.map((tagId) => ({ postId, tagId })));
}

/** 删除帖子（评论、标签关联级联清理） */
export async function deletePost(id: number): Promise<boolean> {
  const [row] = await db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
  return !!row;
}
