/**
 * 开发用：清空全部数据表（注意：会删除所有数据）
 * 用法：npx tsx scripts/reset.ts
 */
import { db, schema } from '../src/lib/db';

async function main() {
  await db.delete(schema.comments);
  await db.delete(schema.postTags);
  await db.delete(schema.posts);
  await db.delete(schema.tags);
  await db.delete(schema.users);
  await db.delete(schema.onlineUsers);
  console.log('✅ 数据已清空');
  process.exit(0);
}

main().catch((err) => {
  console.error('清空失败:', err);
  process.exit(1);
});
