/**
 * 评论 API：GET 帖子评论列表 / POST 发表评论（需登录）
 */
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, ok, parseJsonBody } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { commentSchema } from '@/lib/validation';
import { createComment, listCommentsByPost } from '@/modules/comments/service';
import { getPostDetail } from '@/modules/posts/service';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const postId = Number(params.id);
    const items = await listCommentsByPost(postId);
    return ok({ comments: items });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const postId = Number(params.id);
    const post = await getPostDetail(postId);
    if (!post) throw new ApiError(404, '帖子不存在');
    const user = await requireUser();
    const body = commentSchema.parse(await parseJsonBody(req));
    const comment = await createComment({ postId, authorId: user.id, content: body.content });
    return ok({ comment }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
