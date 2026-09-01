/**
 * 数据库客户端抽象层
 * - 根据配置自动选择 Turso（libSQL）或 Postgres 驱动
 * - 对外只暴露统一的 db / schema / dialect，业务代码无需感知方言差异
 * - 两个方言的 schema 结构保持一致（见 drizzle/schema-*.ts）
 *
 * 类型说明：drizzle 的 SQLite 与 PG 查询构建器类型不兼容，这里统一
 * 以 sqlite 风格类型对外（结构一致），运行时由实际驱动处理。
 */
import { createClient } from '@libsql/client';
import postgres from 'postgres';
import { drizzle as drizzleLibsql } from 'drizzle-orm/libsql';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as sqliteSchema from '@drizzle/schema-sqlite';
import * as pgSchema from '@drizzle/schema-pg';
import { getConfig } from './config';

type SqliteSchema = typeof sqliteSchema;
type SqliteDb = LibSQLDatabase<SqliteSchema>;

function createDb(): { dialect: 'turso' | 'postgres'; db: SqliteDb; schema: SqliteSchema } {
  const cfg = getConfig().database;

  if (cfg.type === 'postgres') {
    const connectionString = cfg.connectionString ?? cfg.url;
    // prepare:false 与 max:1 适配 Serverless 环境，避免连接池占满
    const client = postgres(connectionString, { max: 1, prepare: false });
    return {
      dialect: 'postgres',
      // 结构抽象：pg schema 与 sqlite schema 表名/字段一致，按 sqlite 类型对外
      db: drizzlePostgres(client, { schema: pgSchema }) as unknown as SqliteDb,
      schema: pgSchema as unknown as SqliteSchema,
    };
  }

  const client = createClient({ url: cfg.url, authToken: cfg.authToken ?? undefined });
  return {
    dialect: 'turso',
    db: drizzleLibsql(client, { schema: sqliteSchema }),
    schema: sqliteSchema,
  };
}

const instance = createDb();

/** 统一的 Drizzle 查询对象 */
export const db = instance.db;
/** 统一的表定义（跨方言结构一致） */
export const schema = instance.schema;
/** 当前方言：'turso' | 'postgres' */
export const dialect = instance.dialect;
