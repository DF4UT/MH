/**
 * 搜索 API：按标题/内容模糊搜索帖子（游标分页）
 */
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, ok, parseCursor, parseLimit, encodeCursor } from '@/lib/api';
import { getDefaultLimit } from '@/lib/config';
import { listPosts } from '@/modules/posts/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get('q') ?? '').trim();
    if (!q) throw new ApiError(400, '缺少搜索关键词 q');
    if (q.length > 100) throw new ApiError(400, '关键词过长');
    const page = await listPosts({
      q,
      cursor: parseCursor(sp.get('cursor')),
      limit: parseLimit(sp.get('limit'), getDefaultLimit()),
      status: 'published',
    });
    return ok({
      items: page.items,
      nextCursor: page.nextCursor ? encodeCursor(page.nextCursor) : null,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
