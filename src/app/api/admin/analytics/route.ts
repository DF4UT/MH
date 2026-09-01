/**
 * 后台 API：数据分析（Highcharts 数据源）
 */
import type { NextRequest } from 'next/server';
import { handleApiError, ok } from '@/lib/api';
import { requireAdminUser } from '@/lib/auth';
import { getAnalytics } from '@/modules/admin/service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireAdminUser();
    const days = Number(req.nextUrl.searchParams.get('days') ?? 30);
    return ok(await getAnalytics(days));
  } catch (err) {
    return handleApiError(err);
  }
}
