/**
 * 帖子 API：GET 列表（游标分页，含可见性控制）/ POST 创建
 * - 公开列表仅返回 published
 * - 草稿（status=draft）只能查询本人（管理员可查任意作者）
 */
import type { NextRequest } from 'next/server';
import { getConfig, getDefaultLimit } from '@/lib/config';
import { ApiError, handleApiError, ok, parseCursor, parseJsonBody, parseLimit } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { encodeCursor } from '@/lib/api';
import { postSchema } from '@/lib/validation';
import { createPost, listPosts } from '@/modules/posts/service';
import { getUserById } from '@/modules/users/service';
import type { PostStatus } from '@/modules/posts/service';

export const dynamic = 'force-dynamic';

/** 帖子列表：?cursor=&limit=&tag=&authorId=&status= */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const cursor = parseCursor(sp.get('cursor'));
    const rawAuthorId = sp.get('authorId');
    let authorId = rawAuthorId ? Number(rawAuthorId) : undefined;
    let status: PostStatus | undefined =
      sp.get('status') === 'draft' || sp.get('status') === 'published'
        ? (sp.get('status') as PostStatus)
        : undefined;

    if (status === 'draft') {
      // 草稿仅限本人（管理员可查他人草稿）
      const user = await requireUser();
      const me = await getUserById(user.id);
      if (!me) throw new ApiError(401, '用户不存在，请重新登录');
      if (authorId !== undefined && authorId !== user.id && me.role !== 'admin') {
        throw new ApiError(403, '无权查看他人的草稿');
      }
      authorId = authorId ?? user.id;
    } else if (authorId === undefined || !status) {
      // 公开场景（首页/标签/搜索/他人视角）一律只展示已发布
      status = 'published';
    }

    const page = await listPosts({
      cursor,
      limit: parseLimit(sp.get('limit'), getDefaultLimit()),
      tag: sp.get('tag') ?? undefined,
      authorId,
      status,
    });
    return ok({
      items: page.items,
      nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** 创建帖子（需登录；status=draft 时存入草稿箱） */
export async function POST(req: NextRequest) {
  try {
    if (!getConfig().features.posts) throw new ApiError(403, '帖子功能未启用');
    const user = await requireUser();
    const body = postSchema.parse(await parseJsonBody(req));
    const id = await createPost({ ...body, authorId: user.id, status: body.status });
    return ok({ id }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
