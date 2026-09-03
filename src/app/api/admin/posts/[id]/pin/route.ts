/**
 * 后台置顶 API
 * body: { pin: 'time' | 'force' | 'none' }
 * - 'time'：按发布时间置顶（最多 4 个）
 * - 'force'：强制置顶（最多 1 个）
 * - 'none'：取消置顶
 */
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, ok, parseJsonBody } from '@/lib/api';
import { requireAdminUser } from '@/lib/auth';
import { setPin } from '@/modules/posts/service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const pinSchema = z.object({
  pin: z.enum(['time', 'force', 'none']),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminUser();
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, '无效的帖子 ID');
    const { pin } = pinSchema.parse(await parseJsonBody(req));
    const result = await setPin(id, pin);
    if (!result.ok) {
      return ok({ error: result.message ?? '置顶失败' }, 409);
    }
    return ok({ id, pin });
  } catch (err) {
    return handleApiError(err);
  }
}
