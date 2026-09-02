/**
 * NextAuth 认证配置（仅 GitHub Provider）
 * - JWT 会话策略：适合 Serverless 环境，无需数据库会话表
 * - 首次登录自动 upsert 用户到本站数据库
 * - 管理员判定：ADMIN_GITHUB_IDS / config.json admins 列表，或后台手动提升的角色
 */
import fs from 'node:fs';
import path from 'node:path';
import NextAuth, { getServerSession } from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import { getConfig } from './config';
import { ApiError } from './api';
import { getUserByGithubId, getUserById, upsertGithubUser } from '@/modules/users/service';

/**
 * 用户角色内存缓存（TTL 5 分钟）
 * 目的：session/JWT 每次校验都查库会显著拖慢响应（尤其远程 Turso 场景）。
 * 缓存后普通请求零 DB 往返；后台改角色后最长 5 分钟生效（可通过重新登录立即生效）。
 * 说明：权限敏感操作（requireAdminUser）仍实时查库，不受缓存影响。
 */
const roleCache = new Map<number, { role: 'user' | 'admin'; ts: number }>();
const ROLE_CACHE_TTL = 5 * 60_000;

function getCachedRole(userId: number): { role: 'user' | 'admin' } | null {
  const hit = roleCache.get(userId);
  if (!hit) return null;
  if (Date.now() - hit.ts > ROLE_CACHE_TTL) {
    roleCache.delete(userId);
    return null;
  }
  return { role: hit.role };
}

function setCachedRole(userId: number, role: 'user' | 'admin'): void {
  roleCache.set(userId, { role, ts: Date.now() });
  // 防止内存无限增长（用户数少时无所谓，防御性清理）
  if (roleCache.size > 5000) {
    const now = Date.now();
    for (const [k, v] of roleCache) {
      if (now - v.ts > ROLE_CACHE_TTL) roleCache.delete(k);
    }
  }
}

/**
 * NextAuth 日志落盘（诊断用）：错误写入 data/nextauth-errors.log，
 * 便于在无法查看终端时定位 OAuth 失败原因。
 */
function writeAuthError(code: string, ...args: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${code} ${args.map((a) => (a instanceof Error ? a.stack ?? a.message : JSON.stringify(a))).join(' | ')}`;
  console.error('[next-auth]', line);
  try {
    fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
    fs.appendFileSync(path.join(process.cwd(), 'data', 'nextauth-errors.log'), line + '\n', 'utf8');
  } catch {
    /* 日志写入失败不影响主流程 */
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: getConfig().auth.githubClientId,
      clientSecret: getConfig().auth.githubClientSecret,
    }),
  ],
  session: { strategy: 'jwt' },
  secret: getConfig().auth.secret || 'dev-only-insecure-secret-change-me',
  // 自定义登录页与错误页：signin/error 均由登录页承载并展示对应提示
  pages: { signIn: '/login', error: '/login' },
  logger: {
    error: (code: string, ...args: unknown[]) => writeAuthError(code, ...args),
  },
  callbacks: {
    /** OAuth 成功后的首次写入：创建或更新本站用户 */
    async signIn({ user, profile }) {
      // githubId 使用 GitHub 数字用户 ID（唯一且稳定，不会随改名变化）
      const githubId = String(
        (profile as { id?: number | string } | undefined)?.id ?? user.id ?? ''
      );
      if (!githubId) return false;
      // 管理员名单匹配的是 GitHub 登录名（如 ADMIN_GITHUB_IDS=DF4UT），注意不能用数字 ID 比较
      const login = (profile as { login?: string } | undefined)?.login ?? '';
      const admins = getConfig().admins;
      await upsertGithubUser({
        githubId,
        username: login || user.name || '用户',
        email: user.email ?? null,
        avatarUrl: user.image ?? null,
        isAdmin: admins.includes(login),
      });
      return true;
    },
    /** 将本站用户 ID 写入 token；角色优先走内存缓存，TTL 内零 DB 查询 */
    async jwt({ token, user }) {
      if (user) {
        const githubId = String(user.id);
        const dbUser = await getUserByGithubId(githubId);
        if (dbUser) {
          token.userId = String(dbUser.id);
          token.githubId = githubId;
          token.role = dbUser.role;
          token.username = dbUser.username;
          token.avatarUrl = dbUser.avatarUrl;
          setCachedRole(dbUser.id, dbUser.role);
        }
      } else if (token.userId) {
        const userId = Number(token.userId);
        const cached = getCachedRole(userId);
        if (cached) {
          token.role = cached.role;
        } else {
          const dbUser = await getUserById(userId);
          if (dbUser) {
            token.role = dbUser.role;
            token.username = dbUser.username;
            token.avatarUrl = dbUser.avatarUrl;
            setCachedRole(userId, dbUser.role);
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId;
        session.user.role = token.role;
        session.user.name = token.username ?? session.user.name;
        session.user.image = token.avatarUrl ?? session.user.image;
      }
      return session;
    },
  },
};

/**
 * 登录名是否在管理员名单中（仅用于登录时判定，见 signIn callback；
 * 运行时权限一律以数据库 users.role 为准，后台可随时调整）
 */
export function isAdminGithubId(login: string): boolean {
  return getConfig().admins.includes(login);
}

/** 要求登录：未登录抛 401 */
export async function requireUser(): Promise<{ id: number; name: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new ApiError(401, '请先登录');
  return { id: Number(session.user.id), name: session.user.name ?? '用户' };
}

/** 要求管理员：未登录 401，非管理员 403（以数据库实时角色为准） */
export async function requireAdminUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new ApiError(401, '请先登录');
  const user = await getUserById(Number(session.user.id));
  if (!user) throw new ApiError(401, '用户不存在，请重新登录');
  if (user.role !== 'admin') {
    throw new ApiError(403, '无权访问，需要管理员权限');
  }
  return user;
}
