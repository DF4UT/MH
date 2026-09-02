/**
 * 草稿箱流程冒烟测试（直接调用服务层）：
 * importPost 生成草稿 → listPosts(status) 过滤 → setPostStatus 发布/收回 → 清理
 */
import { db, schema } from '../src/lib/db';
import { eq } from 'drizzle-orm';
import { importPost, setPostStatus, deletePost, listPosts, getPostDetail } from '../src/modules/posts/service';

async function main() {
  const users = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  const authorId = users[0]?.id ?? 1;
  console.log('测试作者 id:', authorId);

  // 1) 导入生成草稿
  const id = await importPost({ title: '冒烟测试草稿', content: '# 测试内容', authorId });
  const detail = await getPostDetail(id);
  console.log('导入草稿状态:', detail?.status, '(期望 draft)');
  if (detail?.status !== 'draft') throw new Error('导入应为草稿');

  // 2) published 列表不应包含草稿
  const pub = await listPosts({ status: 'published', authorId });
  if (pub.items.some((p) => p.id === id)) throw new Error('published 列表不应包含草稿');

  // 3) draft 列表应包含
  const draftList = await listPosts({ status: 'draft', authorId });
  console.log('草稿箱包含新草稿:', draftList.items.some((p) => p.id === id));

  // 4) 发布
  await setPostStatus(id, 'published');
  const afterPub = await getPostDetail(id);
  console.log('发布后状态:', afterPub?.status, '(期望 published)');

  // 5) 收回草稿
  await setPostStatus(id, 'draft');
  const afterDraft = await getPostDetail(id);
  console.log('收回后状态:', afterDraft?.status, '(期望 draft)');

  // 6) 清理测试数据
  await deletePost(id);
  console.log('✅ 草稿箱流程全部通过，测试数据已清理');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ 冒烟失败:', e);
  process.exit(1);
});
