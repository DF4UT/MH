/**
 * 标签 API：GET 全部标签及使用量
 */
import { handleApiError, ok } from '@/lib/api';
import { listTagsWithCounts } from '@/modules/tags/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const tags = await listTagsWithCounts();
    return ok({ tags });
  } catch (err) {
    return handleApiError(err);
  }
}
