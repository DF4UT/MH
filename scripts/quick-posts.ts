import { db, schema } from '../src/lib/db';
async function main() {
  const posts = await db.select({ id: schema.posts.id, title: schema.posts.title }).from(schema.posts).orderBy(schema.posts.id);
  console.log('帖子:', JSON.stringify(posts));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
