/**
 * 在线人数模块服务层
 * 轻量方案：客户端每 30s 心跳一次，服务端 upsert 活跃记录，
 * 超过 2 分钟未心跳的记录被清理。数据库表方案天然适配 Serverless。
 */
import { count, gt, lt } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

const { onlineUsers } = schema;

/** 活跃窗口：2 分钟 */
export const ONLINE_WINDOW_MS = 120_000;

/** 心跳：upsert 活跃记录并清理过期记录，返回当前在线数 */
export async function heartbeat(
  key: string,
  kind: 'user' | 'guest',
  name: string
): Promise<number> {
  const now = Date.now();
  await db
    .insert(onlineUsers)
    .values({ clientKey: key, kind, name, lastSeenAt: now })
    .onConflictDoUpdate({
      target: onlineUsers.clientKey,
      set: { kind, name, lastSeenAt: now },
    });
  await db.delete(onlineUsers).where(lt(onlineUsers.lastSeenAt, now - ONLINE_WINDOW_MS));
  return countOnline();
}

/** 当前在线人数 */
export async function countOnline(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(onlineUsers)
    .where(gt(onlineUsers.lastSeenAt, Date.now() - ONLINE_WINDOW_MS));
  return row?.n ?? 0;
}
