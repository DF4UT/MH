/**
 * NextAuth 类型增强：将自定义字段注入 Session / JWT
 */
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      /** 本站用户表 ID（字符串形式，便于客户端比较） */
      id: string;
      /** 角色：user | admin */
      role?: string;
    } & DefaultSession['user'];
  }

  interface User {
    githubId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    githubId?: string;
    role?: string;
    username?: string;
    avatarUrl?: string | null;
  }
}
