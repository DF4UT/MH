/**
 * 后台 API：仪表盘统计
 */
import { handleApiError, ok } from '@/lib/api';
import { requireAdminUser } from '@/lib/auth';
import { getStats } from '@/modules/admin/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdminUser();
    return ok(await getStats());
  } catch (err) {
    return handleApiError(err);
  }
}
