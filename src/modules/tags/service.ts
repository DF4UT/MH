/**
 * 标签模块服务层
 */
import { asc, count, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

const { tags, postTags } = schema;

export interface TagWithCount {
  id: number;
  name: string;
  count: number;
}

/** 全部标签及其帖子数（按使用量降序） */
export async function listTagsWithCounts(): Promise<TagWithCount[]> {
  const [countRows, tagRows] = await Promise.all([
    db.select({ tagId: postTags.tagId, n: count() }).from(postTags).groupBy(postTags.tagId),
    db.select().from(tags).orderBy(asc(tags.name)),
  ]);
  const countMap = new Map(countRows.map((c) => [c.tagId, c.n]));
  return tagRows
    .map((t) => ({ id: t.id, name: t.name, count: countMap.get(t.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

/** 按名称查询标签 */
export async function getTagByName(name: string) {
  const rows = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
  return rows[0] ?? null;
}

/** 获取或创建标签（并发安全：onConflictDoNothing + 回查） */
export async function findOrCreateTag(name: string): Promise<number> {
  const clean = name.trim().replace(/\s+/g, ' ');
  let row = await getTagByName(clean);
  if (!row) {
    await db.insert(tags).values({ name: clean, createdAt: Date.now() }).onConflictDoNothing();
    row = await getTagByName(clean);
  }
  if (!row) throw new Error(`标签创建失败：${name}`);
  return row.id;
}
