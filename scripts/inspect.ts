/**
 * 开发用：查看当前数据库内容
 */
import { db, schema } from '../src/lib/db';

async function main() {
  const users = await db.select().from(schema.users);
  const posts = await db
    .select({ id: schema.posts.id, title: schema.posts.title })
    .from(schema.posts);
  const tags = await db.select().from(schema.tags);
  const pts = await db.select().from(schema.postTags);
  const cs = await db.select().from(schema.comments);
  console.log('users:', users.length);
  console.log('posts:', JSON.stringify(posts, null, 1));
  console.log('tags:', JSON.stringify(tags.map((t) => t.name)));
  console.log('postTags:', pts.length);
  console.log('comments:', cs.length);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
