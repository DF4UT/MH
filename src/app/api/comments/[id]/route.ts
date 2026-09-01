/**
 * 评论 API：DELETE（作者或管理员）
 */
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { deleteComment, getComment } from '@/modules/comments/service';
import { getUserById } from '@/modules/users/service';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const commentId = Number(params.id);
    const comment = await getComment(commentId);
    if (!comment) throw new ApiError(404, '评论不存在');
    const user = await requireUser();
    const me = await getUserById(user.id);
    const isAdmin = !!me && me.role === 'admin';
    if (!isAdmin && me?.id !== comment.authorId) {
      throw new ApiError(403, '只有作者或管理员可以删除评论');
    }
    await deleteComment(commentId);
    return ok({ id: commentId });
  } catch (err) {
    return handleApiError(err);
  }
}
