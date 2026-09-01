'use client';

/** 退出登录按钮 */
import { signOut } from 'next-auth/react';

export default function SignOutButton({ className }: { className?: string }) {
  return (
    <button
      className={className ?? 'btn btn-ghost btn-sm'}
      onClick={() => void signOut({ callbackUrl: '/' })}
    >
      退出登录
    </button>
  );
}
