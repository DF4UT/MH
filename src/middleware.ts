/**
 * 路由中间件（Edge Runtime）
 * 保护 /admin 页面：未登录跳转登录页，非管理员跳转首页
 * 注意：Edge 环境无法读取 config.json，管理员角色通过 JWT 中的 role 判断，
 * 后台 API 层另有数据库实时校验（requireAdminUser）。
 */
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token }) => token?.role === 'admin',
  },
  pages: { signIn: '/login' },
});

export const config = {
  matcher: ['/admin/:path*'],
};
