/**
 * 帖子 API：GET 详情 / PATCH 更新（作者或管理员）/ DELETE 删除（作者或管理员）
 */
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, ok, parseJsonBody } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { postSchema } from '@/lib/validation';
import { deletePost, getPostDetail, updatePost } from '@/modules/posts/service';
import { getUserById } from '@/modules/users/service';

export const dynamic = 'force-dynamic';

function parseIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, '无效的帖子 ID');
  return id;
}

/** 校验当前用户是否为作者或管理员，返回帖子（可管理时） */
async function assertCanManage(postId: number) {
  const user = await requireUser();
  const post = await getPostDetail(postId);
  if (!post) throw new ApiError(404, '帖子不存在');
  const me = await getUserById(user.id);
  if (!me || (me.role !== 'admin' && me.id !== post.author.id)) {
    throw new ApiError(403, '只有作者或管理员可以操作');
  }
  return post;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const post = await getPostDetail(parseIdParam(params.id));
    if (!post) throw new ApiError(404, '帖子不存在');
    return ok({ post });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const postId = parseIdParam(params.id);
    await assertCanManage(postId);
    const body = postSchema.parse(await parseJsonBody(req));
    await updatePost(postId, body);
    return ok({ id: postId });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const postId = parseIdParam(params.id);
    await assertCanManage(postId);
    await deletePost(postId);
    return ok({ id: postId });
  } catch (err) {
    return handleApiError(err);
  }
}
