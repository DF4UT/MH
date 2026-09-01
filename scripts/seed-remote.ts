/**
 * 为远程 Turso 库补充演示帖子（供登录后测试编辑/上传功能）
 */
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/lib/db';

const { users, posts, tags, postTags } = schema;

async function main() {
  const now = Date.now();
  const userRows = await db.select().from(users).where(eq(users.githubId, '1')).limit(1);
  const authorId = userRows.length > 0 ? userRows[0].id : 1;

  const data = [
    {
      title: '欢迎来到 MeowHub 论坛 🎉',
      content:
        '## 使用指南\n\n- 点击右上角「发布」发帖\n- 编辑器支持 **Markdown** 与图片上传（拖拽/粘贴/工具栏）\n- 在自己的帖子详情页或个人主页可「编辑」「删除」\n- 管理员可进入「后台」管理数据',
      tags: ['公告'],
    },
    {
      title: '图片上传测试帖：Markdown 中如何插入图片',
      content:
        '## 插入图片的两种方式\n\n1. **本地文件**：点击工具栏图片按钮或直接拖拽/粘贴图片（单张 ≤2MB）\n2. **网络图片**：使用 `![描述](https://example.com/image.png)` 语法',
      tags: ['教程', 'Markdown'],
    },
    {
      title: 'Drizzle ORM 双数据库方言实战',
      content:
        '## 核心思路\n\n1. 双方言 schema 结构一致（sqlite/pg）\n2. 时间统一整数时间戳\n3. 避免方言函数，分批关联 + JS 聚合',
      tags: ['数据库', 'Turso'],
    },
  ];

  for (const d of data) {
    const [row] = await db
      .insert(posts)
      .values({ title: d.title, content: d.content, authorId, createdAt: now, updatedAt: now })
      .returning({ id: posts.id });
    for (const name of d.tags) {
      let tag = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
      if (tag.length === 0) {
        await db.insert(tags).values({ name, createdAt: now }).onConflictDoNothing();
        tag = await db.select().from(tags).where(eq(tags.name, name)).limit(1);
      }
      if (tag[0]) await db.insert(postTags).values({ postId: row.id, tagId: tag[0].id });
    }
  }
  console.log('✅ 远程库种子数据已写入（作者 id=' + authorId + '）');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
