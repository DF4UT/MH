import { defineConfig } from 'drizzle-kit';
import { getConfig } from './src/lib/config';

/**
 * Drizzle 迁移配置（SQLite / Turso 方言）
 * 说明：generate 命令无需连接数据库；远程 Turso 的认证在运行时
 * （scripts/migrate.ts）与 API 层通过 TURSO_AUTH_TOKEN 提供。
 */
const database = getConfig().database;

export default defineConfig({
  schema: './drizzle/schema-sqlite.ts',
  out: './drizzle/migrations-sqlite',
  dialect: 'sqlite',
  dbCredentials: {
    url: database.url,
  },
});
