/**
 * 回归测试：导入草稿 → 编辑内容并发布 → 内容必须为编辑后的（此前 Bug：内容被丢弃）
 * 另测量 listPosts 耗时（查询合并优化效果）
 */
import { db, schema } from '../src/lib/db';
import { eq } from 'drizzle-orm';
import { importPost, updatePost, deletePost, getPostDetail, listPosts } from '../src/modules/posts/service';

async function main() {
  const users = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  const authorId = users[0]?.id ?? 1;

  // 1) 导入草稿（内容 A）
  const id = await importPost({ title: '回归测试帖', content: '内容A-上传时的原文', authorId });
  console.log('导入草稿 id:', id);

  // 2) 模拟"编辑保存并发布"：PATCH 携带 title/content/status
  await updatePost(id, {
    title: '回归测试帖-已编辑',
    content: '内容B-编辑后的最终内容',
    tagNames: [],
    status: 'published',
  });

  // 3) 验证内容与状态（Bug 回归核心断言）
  const after = await getPostDetail(id);
  if (!after) throw new Error('帖子不存在');
  console.log('编辑后标题:', after.title);
  console.log('编辑后状态:', after.status);
  console.log('内容已更新为编辑后版本:', after.content === '内容B-编辑后的最终内容');
  if (after.content !== '内容B-编辑后的最终内容') {
    throw new Error('❌ BUG 复现：内容仍为上传时原文');
  }
  if (after.status !== 'published') throw new Error('状态应为 published');

  // 4) 无 status 的完整更新应保持状态（把上面的帖收回草稿再编辑）
  await import('drizzle-orm').then(async ({ eq: eq2 }) => {
    const { setPostStatus } = await import('../src/modules/posts/service');
    await setPostStatus(id, 'draft');
  });
  const svc = await import('../src/modules/posts/service');
  await svc.setPostStatus(id, 'draft');
  await svc.updatePost(id, { title: '草稿再编辑', content: '新内容C', tagNames: [] });
  const after2 = await getPostDetail(id);
  console.log('无 status 更新后状态:', after2?.status, '(应保持 draft)');
  console.log('无 status 更新后内容:', after2?.content === '新内容C');

  // 5) 性能测量：listPosts 往返耗时
  const t0 = Date.now();
  await listPosts({ status: 'published', limit: 10 });
  const t1 = Date.now();
  await listPosts({ status: 'published', limit: 10 });
  const t2 = Date.now();
  console.log(`listPosts 第1次(冷): ${t1 - t0}ms, 第2次: ${t2 - t1}ms`);

  // 6) 清理
  await deletePost(id);
  console.log('✅ 回归测试通过，数据已清理');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ 测试失败:', e);
  process.exit(1);
});
