/**
 * 帖子 API：GET 列表（游标分页）/ POST 创建
 */
import type { NextRequest } from 'next/server';
import { getConfig, getDefaultLimit } from '@/lib/config';
import { ApiError, handleApiError, ok, parseCursor, parseJsonBody, parseLimit } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { encodeCursor } from '@/lib/api';
import { postSchema } from '@/lib/validation';
import { createPost, listPosts } from '@/modules/posts/service';

export const dynamic = 'force-dynamic';

/** 帖子列表：?cursor=&limit=&tag=&authorId= */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const cursor = parseCursor(sp.get('cursor'));
    const page = await listPosts({
      cursor,
      limit: parseLimit(sp.get('limit'), getDefaultLimit()),
      tag: sp.get('tag') ?? undefined,
      authorId: sp.get('authorId') ? Number(sp.get('authorId')) : undefined,
    });
    return ok({
      items: page.items,
      nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

/** 创建帖子（需登录） */
export async function POST(req: NextRequest) {
  try {
    if (!getConfig().features.posts) throw new ApiError(403, '帖子功能未启用');
    const user = await requireUser();
    const body = postSchema.parse(await parseJsonBody(req));
    const id = await createPost({ ...body, authorId: user.id });
    return ok({ id }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
