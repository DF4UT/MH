/**
 * 帖子模块服务层：列表（游标分页）、详情、创建、更新、删除
 * 查询采用「分批关联」策略（先取帖子页，再批量取标签与评论数），
 * 避免方言差异（SQLite group_concat / Postgres string_agg），保证双方言一致。
 */
import { and, asc, count, desc, eq, inArray, lt, ne, or, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { buildExcerpt, escapeLike, type PageCursor } from '@/lib/utils';
import { titleSortKey } from '@/lib/titleSort';
import { findOrCreateTag } from '@/modules/tags/service';

const { posts, users, tags, postTags, comments } = schema;

/** 评论数标量子查询（用于"按评论数排序"；CAST 保证 SQLite/PG 均为整数语义） */
const commentCountSql = sql<number>`(SELECT CAST(COUNT(*) AS INTEGER) FROM ${comments} WHERE ${comments.postId} = ${posts.id})`;

/** 置顶帖（pinned>0）组内按发布时间倒序；普通帖在该层恒为 0（随后续排序列） */
const pinnedOrderExpr = sql`CASE WHEN ${posts.pinned} > 0 THEN -${posts.createdAt} ELSE 0 END`;
/** 空排序键（历史数据）恒排最后 */
const emptySortExpr = sql`CASE WHEN ${posts.titleSort} = '' THEN 1 ELSE 0 END`

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

/** 置顶类型：'time'=按发布时间置顶（≤4）；'force'=强制置顶（≤1） */
export type PinType = 'time' | 'force';

/** 列表排序模式：time=发布时间（默认）；comments=评论数；title=标题 A-Z（英文+拼音，符号置底） */
export type PostSort = 'time' | 'comments' | 'title';

export interface PostListItem {
  id: number;
  title: string;
  excerpt: string;
  createdAt: number;
  updatedAt: number;
  /** published=公开；draft=草稿箱（仅作者/管理员可见） */
  status: PostStatus;
  /** 0=普通；1=时间置顶；2=强制置顶 */
  pinned: number;
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
  /** 排序模式（默认 time）；置顶帖恒置前，其组内按发布时间倒序 */
  sort?: PostSort;
  /** 全文搜索（标题 + 内容） */
  q?: string;
}

/** 按当前排序模式构造游标下界条件（升/降序方向由 sort 决定） */
function cursorWhere(sort: PostSort, cursor: PageCursor): SQL | null | undefined {
  if (cursor.value === undefined) return null;
  if (sort === 'time') {
    const v = cursor.value as number;
    return or(lt(posts.createdAt, v), and(eq(posts.createdAt, v), lt(posts.id, cursor.id)));
  }
  if (sort === 'comments') {
    const v = cursor.value as number;
    return or(
      lt(commentCountSql, v),
      and(eq(commentCountSql, v), lt(posts.id, cursor.id))
    );
  }
  const v = cursor.value as string;
  return or(
    lt(posts.titleSort, v),
    and(eq(posts.titleSort, v), lt(posts.id, cursor.id))
  );
}

/** 帖子列表（含作者、标签、评论数、置顶），返回下一页游标 */
export async function listPosts(opts: ListPostsOptions = {}): Promise<{
  items: PostListItem[];
  nextCursor: PageCursor | null;
}> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 50);
  const sort: PostSort = opts.sort ?? 'time';
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
    // 翻页只翻"普通帖"，避免置顶帖在后续页重复出现
    where.push(eq(posts.pinned, 0));
    const cursorCond = cursorWhere(sort, opts.cursor);
    if (cursorCond) where.push(cursorCond);
  }

  // 排序：置顶层（强制 2 → 时间 1 → 普通 0）→ 置顶组内时间倒序 → 用户排序列
  const order: SQL[] = [sql`${posts.pinned} DESC`];
  if (sort === 'time') {
    order.push(desc(posts.createdAt), desc(posts.id));
  } else {
    order.push(pinnedOrderExpr);
    if (sort === 'comments') {
      order.push(desc(commentCountSql), desc(posts.createdAt), desc(posts.id));
    } else {
      order.push(emptySortExpr, asc(posts.titleSort), asc(posts.id));
    }
  }

  const rows = await db
    .select({
      post: posts,
      author: { id: users.id, username: users.username, avatarUrl: users.avatarUrl },
      // 评论数标量子查询：非 comments 排序时仅作冗余（成本 ~10 行），comments 排序用于排序与游标
      cnt: commentCountSql,
    })
    .from(posts)
    .innerJoin(users, eq(posts.authorId, users.id))
    .where(and(...where))
    .orderBy(...order)
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);

  // 空结果（新用户/空草稿箱/无匹配）：直接返回空页，避免访问末行崩溃
  if (pageRows.length === 0) {
    return { items: [], nextCursor: null };
  }

  const meta = await attachMeta(pageRows.map((r) => r.post));

  let nextValue: number | string = pageRows[pageRows.length - 1].post.createdAt;
  if (sort === 'comments') {
    nextValue = pageRows[pageRows.length - 1].cnt ?? 0;
  } else if (sort === 'title') {
    nextValue = pageRows[pageRows.length - 1].post.titleSort;
  }

  return {
    items: meta.map((item, i) => ({ ...item, author: pageRows[i].author })),
    nextCursor: hasMore
      ? { value: nextValue, id: pageRows[pageRows.length - 1].post.id }
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
    pinned: p.pinned,
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
      titleSort: titleSortKey(input.title),
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
      titleSort: titleSortKey(input.title),
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

/**
 * 后台置顶操作
 * - 'time'：按发布时间置顶（同时最多 4 个）
 * - 'force'：强制置顶（同时最多 1 个）
 * - 'none'：取消置顶
 * 返回 { ok, message }：不满足名额限制时 ok=false 并附原因。
 */
export async function setPin(
  postId: number,
  pin: 'none' | PinType
): Promise<{ ok: boolean; message?: string }> {
  if (pin === 'none') {
    await db.update(posts).set({ pinned: 0 }).where(eq(posts.id, postId));
    return { ok: true };
  }
  const target = pin === 'force' ? 2 : 1;
  const cap = pin === 'force' ? 1 : 4;
  const [countRow] = await db
    .select({ n: count() })
    .from(posts)
    .where(and(eq(posts.pinned, target), ne(posts.id, postId)));
  const used = countRow?.n ?? 0;
  if (used >= cap) {
    return {
      ok: false,
      message: pin === 'force' ? '强制置顶最多同时置顶 1 个帖子' : '按时间置顶最多同时置顶 4 个帖子',
    };
  }
  await db.update(posts).set({ pinned: target, updatedAt: Date.now() }).where(eq(posts.id, postId));
  return { ok: true };
}
