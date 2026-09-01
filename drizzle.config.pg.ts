import { defineConfig } from 'drizzle-kit';
import { getConfig } from './src/lib/config';

/**
 * Drizzle 迁移配置（Postgres 方言）
 * 运行前先设置 DB_TYPE=postgres 与 DATABASE_URL（或使用 config.json）
 */
const database = getConfig().database;

export default defineConfig({
  schema: './drizzle/schema-pg.ts',
  out: './drizzle/migrations-pg',
  dialect: 'postgresql',
  dbCredentials: {
    url: database.connectionString ?? database.url,
  },
});
