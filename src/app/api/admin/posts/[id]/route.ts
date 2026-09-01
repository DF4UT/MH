/**
 * 后台 API：删除帖子
 */
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, ok } from '@/lib/api';
import { requireAdminUser } from '@/lib/auth';
import { deletePost, getPostDetail } from '@/modules/posts/service';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminUser();
    const id = Number(params.id);
    const post = await getPostDetail(id);
    if (!post) throw new ApiError(404, '帖子不存在');
    await deletePost(id);
    return ok({ id });
  } catch (err) {
    return handleApiError(err);
  }
}
