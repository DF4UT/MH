/**
 * 在线人数 API
 * GET  ：查询当前在线人数
 * POST ：心跳（登录用户按 userId 计数，游客按 clientId 计数）
 */
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { ApiError, handleApiError, ok, parseJsonBody } from '@/lib/api';
import { authOptions } from '@/lib/auth';
import { getConfig } from '@/lib/config';
import { heartbeat, countOnline } from '@/modules/online/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const online = getConfig().features.online ? await countOnline() : 0;
    return ok({ online });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!getConfig().features.online) return ok({ online: 0 });
    const body = await parseJsonBody<{ clientId?: string }>(req);
    const session = await getServerSession(authOptions);

    let key: string;
    let kind: 'user' | 'guest';
    let name: string;
    if (session?.user?.id) {
      key = `u:${session.user.id}`;
      kind = 'user';
      name = session.user.name ?? '用户';
    } else {
      const cid = (body.clientId ?? '').trim();
      if (!cid || cid.length > 100) throw new ApiError(400, '缺少 clientId');
      key = `g:${cid}`;
      kind = 'guest';
      name = '游客';
    }
    const online = await heartbeat(key, kind, name);
    return ok({ online });
  } catch (err) {
    return handleApiError(err);
  }
}
