/**
 * 数据库迁移脚本：根据配置选择 SQLite/Turso 或 Postgres 方言执行迁移
 * 用法：npm run db:migrate
 */
import 'dotenv/config';
import { createClient } from '@libsql/client';
import postgres from 'postgres';
import { migrate as migrateLibsql } from 'drizzle-orm/libsql/migrator';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { getConfig } from '../src/lib/config';

async function main() {
  const cfg = getConfig().database;
  if (cfg.type === 'postgres') {
    const client = postgres(cfg.connectionString ?? cfg.url, { max: 1 });
    const db = drizzlePostgres(client);
    console.log('[migrate] 方言：Postgres，执行迁移 ...');
    await migratePostgres(db, { migrationsFolder: './drizzle/migrations-pg' });
    await client.end();
  } else {
    const client = createClient({ url: cfg.url, authToken: cfg.authToken ?? undefined });
    const db = drizzleLibsql(client);
    console.log('[migrate] 方言：SQLite/Turso，执行迁移 ...');
    await migrateLibsql(db, { migrationsFolder: './drizzle/migrations-sqlite' });
    client.close();
  }
  console.log('[migrate] ✅ 数据库迁移完成');
  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate] ❌ 迁移失败:', err);
  process.exit(1);
});
