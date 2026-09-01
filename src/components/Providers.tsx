'use client';

/**
 * 全局 SessionProvider：让所有客户端组件共享 NextAuth 会话状态
 */
import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

export default function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
