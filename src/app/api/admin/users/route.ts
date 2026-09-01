/**
 * 后台 API：用户列表（搜索/排序/分页）
 */
import type { NextRequest } from 'next/server';
import { handleApiError, ok } from '@/lib/api';
import { requireAdminUser } from '@/lib/auth';
import { listUsers } from '@/modules/users/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
    const sp = req.nextUrl.searchParams;
    const sort = (sp.get('sort') ?? 'createdAt') as 'createdAt' | 'username' | 'role';
    const order = (sp.get('order') ?? 'desc') as 'asc' | 'desc';
    const data = await listUsers({
      q: sp.get('q') ?? undefined,
      sort,
      order,
      offset: Math.max(Number(sp.get('offset') ?? 0), 0),
      limit: Math.min(Math.max(Number(sp.get('limit') ?? 20), 1), 100),
    });
    return ok(data);
  } catch (err) {
    return handleApiError(err);
  }
}
