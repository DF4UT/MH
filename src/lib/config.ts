/**
 * 配置系统核心
 * 配置来源优先级：环境变量 > config.json（项目根目录，由 tools/init_config.py 生成）> 内置默认值
 * - 本地开发：初始化工具生成 config.json + .env.local
 * - Vercel 部署：仅通过 Environment Variables 注入
 */
import fs from 'node:fs';
import path from 'node:path';

export type DatabaseType = 'turso' | 'postgres';

export interface AppConfig {
  site: { name: string; description: string };
  database: {
    type: DatabaseType;
    url: string;
    authToken: string | null;
    connectionString: string | null;
  };
  auth: { githubClientId: string; githubClientSecret: string; secret: string };
  /** 管理员 GitHub 登录名列表 */
  admins: string[];
  /** 业务模块开关（可插拔） */
  features: {
    posts: boolean;
    comments: boolean;
    tags: boolean;
    search: boolean;
    online: boolean;
    admin: boolean;
  };
  pagination: { defaultLimit: number };
}

const DEFAULT_CONFIG: AppConfig = {
  site: { name: '知识论坛', description: '一个轻量级的知识技术论坛' },
  database: { type: 'turso', url: 'file:./data/forum.db', authToken: null, connectionString: null },
  auth: { githubClientId: '', githubClientSecret: '', secret: '' },
  admins: [],
  features: { posts: true, comments: true, tags: true, search: true, online: true, admin: true },
  pagination: { defaultLimit: 10 },
};

/** 读取项目根目录 config.json（不存在或解析失败返回 null） */
export function loadConfigFile(): Partial<AppConfig> | null {
  const filePath = path.join(process.cwd(), 'config.json');
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<AppConfig>;
  } catch (err) {
    console.warn('[config] 读取 config.json 失败，已回退到默认配置:', err);
    return null;
  }
}

function pick<T>(...values: Array<T | undefined | null>): T | undefined {
  return values.find((v) => v !== undefined && v !== null) as T | undefined;
}

let cached: AppConfig | null = null;

/** 获取合并后的应用配置（进程内缓存） */
export function getConfig(): AppConfig {
  if (cached) return cached;

  const file = loadConfigFile() ?? {};
  const dbType: DatabaseType =
    (process.env.DB_TYPE as DatabaseType | undefined) ?? file.database?.type ?? 'turso';
  const tursoUrl = process.env.TURSO_DATABASE_URL ?? file.database?.url ?? 'file:./data/forum.db';
  const pgUrl =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    file.database?.connectionString ??
    file.database?.url ??
    '';
  const authToken = process.env.TURSO_AUTH_TOKEN ?? file.database?.authToken ?? null;

  cached = {
    site: {
      name: process.env.NEXT_PUBLIC_SITE_NAME ?? file.site?.name ?? DEFAULT_CONFIG.site.name,
      description:
        process.env.NEXT_PUBLIC_SITE_DESCRIPTION ??
        file.site?.description ??
        DEFAULT_CONFIG.site.description,
    },
    database: {
      type: dbType,
      url: dbType === 'postgres' ? pgUrl || tursoUrl : tursoUrl,
      authToken,
      connectionString: dbType === 'postgres' ? pgUrl : null,
    },
    auth: {
      githubClientId:
        process.env.GITHUB_CLIENT_ID ?? process.env.GITHUB_ID ?? file.auth?.githubClientId ?? '',
      githubClientSecret:
        process.env.GITHUB_CLIENT_SECRET ??
        process.env.GITHUB_SECRET ??
        file.auth?.githubClientSecret ??
        '',
      secret: process.env.NEXTAUTH_SECRET ?? file.auth?.secret ?? '',
    },
    admins: (process.env.ADMIN_GITHUB_IDS ?? file.admins?.join(',') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    features: { ...DEFAULT_CONFIG.features, ...file.features },
    pagination: { ...DEFAULT_CONFIG.pagination, ...file.pagination },
  };
  return cached;
}

/** 列表默认分页大小 */
export function getDefaultLimit(): number {
  return getConfig().pagination.defaultLimit;
}
