import { db, schema } from '../src/lib/db';
async function main() {
  const users = await db.select({ id: schema.users.id, username: schema.users.username, role: schema.users.role }).from(schema.users);
  console.log('users:', JSON.stringify(users));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
