/**
 * 评论模块服务层
 */
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

const { comments, users } = schema;

export interface CommentItem {
  id: number;
  content: string;
  createdAt: number;
  author: { id: number; username: string; avatarUrl: string | null };
}

/** 某帖子的全部评论（按时间正序） */
export async function listCommentsByPost(postId: number): Promise<CommentItem[]> {
  const rows = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      author: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.postId, postId))
    .orderBy(asc(comments.createdAt), asc(comments.id));
  return rows;
}

/** 发表评论 */
export async function createComment(input: {
  postId: number;
  authorId: number;
  content: string;
}): Promise<CommentItem | null> {
  const [row] = await db
    .insert(comments)
    .values({
      postId: input.postId,
      authorId: input.authorId,
      content: input.content,
      createdAt: Date.now(),
    })
    .returning({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      authorId: comments.authorId,
    });
  const authorRows = await db
    .select({ id: users.id, username: users.username, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, row.authorId))
    .limit(1);
  const author = authorRows[0];
  return {
    id: row.id,
    content: row.content,
    createdAt: row.createdAt,
    author: {
      id: row.authorId,
      username: author?.username ?? '用户',
      avatarUrl: author?.avatarUrl ?? null,
    },
  };
}

/** 查询单条评论（用于权限校验） */
export async function getComment(id: number) {
  const rows = await db
    .select({ id: comments.id, authorId: comments.authorId, postId: comments.postId })
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/** 删除评论 */
export async function deleteComment(id: number): Promise<boolean> {
  const [row] = await db.delete(comments).where(eq(comments.id, id)).returning({ id: comments.id });
  return !!row;
}
