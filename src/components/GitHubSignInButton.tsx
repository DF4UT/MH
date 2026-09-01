'use client';

/**
 * GitHub 登录按钮
 * 必须使用 next-auth/react 的 signIn()（内部先取 csrfToken 再 POST），
 * 不能使用 <a href="/api/auth/signin/github"> 这类 GET 链接：
 * 配置了自定义登录页（pages.signIn）时，GET signin 端点会被 NextAuth
 * 重定向回登录页（带 error=providerId），不会发起 OAuth 授权。
 */
import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function GitHubSignInButton({ callbackUrl = '/' }: { callbackUrl?: string }) {
  const [loading, setLoading] = useState(false);

  function handleClick() {
    setLoading(true);
    // signIn 返回 Promise，失败时恢复按钮可用
    void signIn('github', { callbackUrl }).finally(() => setLoading(false));
  }

  return (
    <button
      type="button"
      className="btn btn-primary btn-lg"
      onClick={handleClick}
      disabled={loading}
    >
      <span aria-hidden="true">⛭</span>
      {loading ? '正在跳转 GitHub…' : '使用 GitHub 登录'}
    </button>
  );
}
