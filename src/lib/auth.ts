/**
 * NextAuth 认证配置（仅 GitHub Provider）
 * - JWT 会话策略：适合 Serverless 环境，无需数据库会话表
 * - 首次登录自动 upsert 用户到本站数据库
 * - 管理员判定：ADMIN_GITHUB_IDS / config.json admins 列表，或后台手动提升的角色
 */
import NextAuth, { getServerSession } from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import { getConfig } from './config';
import { ApiError } from './api';
import { getUserByGithubId, getUserById, upsertGithubUser } from '@/modules/users/service';

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: getConfig().auth.githubClientId,
      clientSecret: getConfig().auth.githubClientSecret,
    }),
  ],
  session: { strategy: 'jwt' },
  secret: getConfig().auth.secret || 'dev-only-insecure-secret-change-me',
  pages: { signIn: '/login' },
  callbacks: {
    /** OAuth 成功后的首次写入：创建或更新本站用户 */
    async signIn({ user, profile }) {
      const githubId = String(
        (profile as { id?: number | string } | undefined)?.id ?? user.id ?? ''
      );
      if (!githubId) return false;
      const admins = getConfig().admins;
      await upsertGithubUser({
        githubId,
        username: (profile as { login?: string } | undefined)?.login ?? user.name ?? '用户',
        email: user.email ?? null,
        avatarUrl: user.image ?? null,
        isAdmin: admins.includes(githubId),
      });
      return true;
    },
    /** 将本站用户 ID 写入 token；每次会话刷新时同步数据库中的角色等字段 */
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
        }
      } else if (token.userId) {
        const dbUser = await getUserById(Number(token.userId));
        if (dbUser) {
          token.role = dbUser.role;
          token.username = dbUser.username;
          token.avatarUrl = dbUser.avatarUrl;
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

/** GitHub 登录名是否在管理员名单中 */
export function isAdminGithubId(githubId: string): boolean {
  return getConfig().admins.includes(githubId);
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
  if (user.role !== 'admin' && !isAdminGithubId(user.githubId)) {
    throw new ApiError(403, '无权访问，需要管理员权限');
  }
  return user;
}
