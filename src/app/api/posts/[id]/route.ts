/**
 * 帖子 API：GET 详情 / PATCH 更新或切换状态（作者或管理员）/ DELETE 删除（作者或管理员）
 * 说明：草稿（draft）帖子公开访问返回 404，仅作者/管理员可见
 */
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, ok, parseJsonBody } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { postSchema, statusOnlySchema } from '@/lib/validation';
import { deletePost, getPostDetail, setPostStatus, updatePost } from '@/modules/posts/service';
import { getUserById } from '@/modules/users/service';

export const dynamic = 'force-dynamic';

function parseIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, '无效的帖子 ID');
  return id;
}

/** 校验当前用户是否为作者或管理员，返回帖子（可管理时）；非作者查看草稿一律 404 */
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
    const postId = parseIdParam(params.id);
    const post = await getPostDetail(postId);
    if (!post) throw new ApiError(404, '帖子不存在');
    // 草稿仅作者/管理员可见（未登录或非作者一律 404，避免泄露草稿存在性）
    if (post.status === 'draft') {
      const session = await requireUser().catch(() => null);
      const me = session ? await getUserById(session.id) : null;
      if (!me || (me.role !== 'admin' && me.id !== post.author.id)) {
        throw new ApiError(404, '帖子不存在');
      }
    }
    return ok({ post });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const postId = parseIdParam(params.id);
    await assertCanManage(postId);
    const raw = await parseJsonBody<Record<string, unknown>>(req);

    // 判定原则：请求携带了 title/content（完整更新）→ 更新内容与状态；
    // 否则（只有 status）→ 仅切换状态。注意不能按 status 字段判定，
    // 因为完整更新时也总会携带 status（否则编辑内容会被静默丢弃）。
    const isFullUpdate = typeof raw.title === 'string' && typeof raw.content === 'string';
    if (isFullUpdate) {
      const parsed = postSchema.parse(raw);
      await updatePost(postId, parsed);
    } else {
      const parsed = statusOnlySchema.parse(raw);
      await setPostStatus(postId, parsed.status);
    }
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
