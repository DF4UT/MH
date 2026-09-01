/**
 * 开发用种子数据脚本（本地验证用，可随时删除）
 * 用法：npx tsx scripts/seed.ts
 */
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/lib/db';

const { users, posts, tags, postTags, comments } = schema;

async function main() {
  const now = Date.now();
  const [u1] = await db
    .insert(users)
    .values({
      githubId: 'octocat',
      username: 'octocat',
      email: 'octocat@example.com',
      avatarUrl: 'https://github.com/octocat.png',
      role: 'admin',
      createdAt: now - 86400000 * 30,
      updatedAt: now - 86400000 * 30,
    })
    .onConflictDoNothing()
    .returning({ id: users.id });
  const [u2] = await db
    .insert(users)
    .values({
      githubId: 'alice',
      username: 'alice',
      email: null,
      avatarUrl: 'https://github.com/alice.png',
      role: 'user',
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 10,
    })
    .onConflictDoNothing()
    .returning({ id: users.id });

  const author1 = u1?.id ?? 1;
  const author2 = u2?.id ?? 2;

  const postsData = [
    {
      title: 'Next.js App Router 最佳实践分享',
      content:
        '## 为什么选择 App Router\n\n- 服务端组件默认渲染，首屏更快\n- 布局复用（layout）\n- 流式渲染支持\n\n### 性能优化\n\n- 使用 `dynamic` 按需加载\n- 图片懒加载\n\n> 更多内容持续更新中',
      authorId: author1,
      createdAt: now - 3600000 * 5,
    },
    {
      title: 'Drizzle ORM 双数据库方言实战：Turso 与 Postgres 一键切换',
      content:
        '## 核心思路\n\n1. 双方言 schema 结构一致\n2. 时间统一使用整数时间戳\n3. 避免方言函数，分批关联 + JS 聚合\n\n```ts\nconst { db, schema } = createDb();\n```',
      authorId: author1,
      createdAt: now - 3600000 * 26,
    },
    {
      title: 'VSCode 高对比度主题下的 UI 设计要点',
      content:
        '高对比度主题要求：\n\n- 纯黑背景 + 纯白前景\n- 对比边框色 `#6FC3DF`\n- 焦点色 `#F38518`\n- 链接色 `#3794FF`',
      authorId: author2,
      createdAt: now - 3600000 * 50,
    },
  ];

  for (const p of postsData) {
    const [row] = await db
      .insert(posts)
      .values({ ...p, updatedAt: p.createdAt })
      .returning({ id: posts.id });
    const tagNames: Record<string, string[]> = {
      'Next.js App Router 最佳实践分享': ['Next.js', '前端'],
      'Drizzle ORM 双数据库方言实战：Turso 与 Postgres 一键切换': ['数据库', 'Turso', 'Postgres'],
      'VSCode 高对比度主题下的 UI 设计要点': ['设计', 'CSS'],
    };
    for (const name of tagNames[p.title] ?? []) {
      let tag = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
      if (tag.length === 0) {
        await db.insert(tags).values({ name, createdAt: now }).onConflictDoNothing();
        tag = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
      }
      if (tag[0]) await db.insert(postTags).values({ postId: row.id, tagId: tag[0].id });
    }
    if (p.title.startsWith('Next.js')) {
      await db
        .insert(comments)
        .values({
          content: '写得太好了，学习了！',
          authorId: author2,
          postId: row.id,
          createdAt: now - 3600000,
        });
    }
  }

  console.log('✅ 种子数据已写入（用户 2、帖子 3、评论 1、标签 5）');
  process.exit(0);
}

main().catch((err) => {
  console.error('种子数据写入失败:', err);
  process.exit(1);
});
