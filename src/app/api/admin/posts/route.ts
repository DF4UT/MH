/**
 * 后台 API：帖子管理列表（搜索/排序/分页/总数）
 * 排序字段：id | createdAt（默认 createdAt desc）
 * 搜索：标题或内容模糊匹配
 */
import { asc, count, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db, schema } from '@/lib/db';
import { handleApiError, ok } from '@/lib/api';
import { requireAdminUser } from '@/lib/auth';
import { buildExcerpt, escapeLike } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const { posts, users, tags, postTags, comments } = schema;

export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
    const sp = req.nextUrl.searchParams;
    const q = (sp.get('q') ?? '').trim();
    const limit = Math.min(Math.max(Number(sp.get('limit') ?? 20), 1), 100);
    const offset = Math.max(Number(sp.get('offset') ?? 0), 0);
    const sortCol = sp.get('sort') === 'id' ? posts.id : posts.createdAt;
    const order = sp.get('order') === 'asc' ? asc(sortCol) : desc(sortCol);

    // 搜索：先查出匹配的帖子 ID（LIKE + ESCAPE，双方言一致）
    let matchedIds: number[] | null = null;
    if (q) {
      const pattern = `%${escapeLike(q)}%`;
      const matched = await db
        .select({ id: posts.id })
        .from(posts)
        .where(
          or(
            sql`${posts.title} LIKE ${pattern} ESCAPE '\\'`,
            sql`${posts.content} LIKE ${pattern} ESCAPE '\\'`
          )
        );
      matchedIds = matched.map((m) => m.id);
    }
    const baseWhere = matchedIds === null ? undefined : inArray(posts.id, matchedIds);

    // 当前页 + 总数
    const [rows, totalRows] = await Promise.all([
      db
        .select({
          post: posts,
          author: { id: users.id, username: users.username, avatarUrl: users.avatarUrl },
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(baseWhere)
        .orderBy(order)
        .limit(limit)
        .offset(offset),
      db.select({ n: count() }).from(posts).where(baseWhere),
    ]);

    // 批量补充标签与评论数
    const ids = rows.map((r) => r.post.id);
    const [tagLinks, countRows] = await Promise.all([
      ids.length > 0
        ? db
            .select({ postId: postTags.postId, tagId: postTags.tagId })
            .from(postTags)
            .where(inArray(postTags.postId, ids))
        : Promise.resolve([]),
      ids.length > 0
        ? db
            .select({ postId: comments.postId, n: count() })
            .from(comments)
            .where(inArray(comments.postId, ids))
            .groupBy(comments.postId)
        : Promise.resolve([]),
    ]);
    const tagIds = [...new Set(tagLinks.map((t) => t.tagId))];
    const tagRows =
      tagIds.length > 0 ? await db.select().from(tags).where(inArray(tags.id, tagIds)) : [];
    const tagMap = new Map(tagRows.map((t) => [t.id, t]));
    const countMap = new Map(countRows.map((c) => [c.postId, c.n]));

    const items = rows.map(({ post, author }) => ({
      id: post.id,
      title: post.title,
      excerpt: buildExcerpt(post.content, 100),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      pinned: post.pinned,
      author,
      tags: tagLinks
        .filter((l) => l.postId === post.id)
        .map((l) => ({ id: l.tagId, name: tagMap.get(l.tagId)?.name ?? '' }))
        .filter((t) => t.name !== ''),
      commentCount: countMap.get(post.id) ?? 0,
    }));

    return ok({ items, total: totalRows[0]?.n ?? 0, offset, limit });
  } catch (err) {
    return handleApiError(err);
  }
}
