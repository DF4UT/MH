/**
 * 后台管理模块：仪表盘统计与数据分析
 * 时间序列在 JS 层按天聚合，避免方言差异（SQLite/PG 的日期函数不同）。
 */
import { count, eq, gt, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { formatDate } from '@/lib/utils';

const { users, posts, comments, tags, postTags, onlineUsers } = schema;

const DAY_MS = 86_400_000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 仪表盘核心指标 */
export async function getStats() {
  const now = Date.now();
  const dayStart = startOfDay(now);
  const [
    userCount,
    postCount,
    commentCount,
    tagCount,
    postsToday,
    commentsToday,
    usersToday,
    online,
  ] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(posts),
    db.select({ n: count() }).from(comments),
    db.select({ n: count() }).from(tags),
    db.select({ n: count() }).from(posts).where(gt(posts.createdAt, dayStart)),
    db.select({ n: count() }).from(comments).where(gt(comments.createdAt, dayStart)),
    db.select({ n: count() }).from(users).where(gt(users.createdAt, dayStart)),
    db
      .select({ n: count() })
      .from(onlineUsers)
      .where(gt(onlineUsers.lastSeenAt, now - 120_000)),
  ]);
  return {
    users: userCount[0]?.n ?? 0,
    posts: postCount[0]?.n ?? 0,
    comments: commentCount[0]?.n ?? 0,
    tags: tagCount[0]?.n ?? 0,
    today: {
      posts: postsToday[0]?.n ?? 0,
      comments: commentsToday[0]?.n ?? 0,
      users: usersToday[0]?.n ?? 0,
    },
    online: online[0]?.n ?? 0,
  };
}

export interface AnalyticsData {
  days: string[];
  posts: number[];
  comments: number[];
  users: number[];
  tags: { name: string; value: number }[];
}

/** 数据分析：近 N 天帖子/评论/用户趋势 + 标签分布 */
export async function getAnalytics(days: number): Promise<AnalyticsData> {
  const clamped = Math.min(Math.max(days, 1), 90);
  const from = startOfDay(Date.now()) - (clamped - 1) * DAY_MS;

  const [postRows, commentRows, userRows, tagLinks] = await Promise.all([
    db.select({ ts: posts.createdAt }).from(posts).where(gt(posts.createdAt, from)),
    db.select({ ts: comments.createdAt }).from(comments).where(gt(comments.createdAt, from)),
    db.select({ ts: users.createdAt }).from(users).where(gt(users.createdAt, from)),
    db.select({ tagId: postTags.tagId }).from(postTags),
  ]);

  // 生成日期轴
  const daysList: string[] = [];
  for (let i = 0; i < clamped; i += 1) {
    daysList.push(formatDate(from + i * DAY_MS));
  }

  const bucket = (ts: number): number => {
    const idx = Math.floor((startOfDay(ts) - from) / DAY_MS);
    return idx >= 0 && idx < clamped ? idx : -1;
  };
  const postsArr = new Array(clamped).fill(0) as number[];
  const commentsArr = new Array(clamped).fill(0) as number[];
  const usersArr = new Array(clamped).fill(0) as number[];

  for (const r of postRows) {
    const i = bucket(r.ts);
    if (i >= 0) postsArr[i] += 1;
  }
  for (const r of commentRows) {
    const i = bucket(r.ts);
    if (i >= 0) commentsArr[i] += 1;
  }
  for (const r of userRows) {
    const i = bucket(r.ts);
    if (i >= 0) usersArr[i] += 1;
  }

  // 标签分布（按使用量降序，取前 12 个）
  const tagCountMap = new Map<number, number>();
  for (const l of tagLinks) {
    tagCountMap.set(l.tagId, (tagCountMap.get(l.tagId) ?? 0) + 1);
  }
  const tagIds = [...tagCountMap.keys()];
  const tagRows =
    tagIds.length > 0
      ? await db.select({ id: tags.id, name: tags.name }).from(tags).where(inArray(tags.id, tagIds))
      : [];
  const tagNameMap = new Map(tagRows.map((t) => [t.id, t.name]));
  const tagDist = [...tagCountMap.entries()]
    .map(([id, value]) => ({ name: tagNameMap.get(id) ?? `#${id}`, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  return {
    days: daysList,
    posts: postsArr,
    comments: commentsArr,
    users: usersArr,
    tags: tagDist,
  };
}
