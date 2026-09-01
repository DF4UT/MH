/**
 * 登录页：GitHub OAuth 一键登录
 */
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import SignOutButton from '@/components/SignOutButton';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="container main-content auth-page">
      <div className="card auth-card">
        {session?.user ? (
          <>
            <h1 className="auth-title">已登录</h1>
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="avatar avatar-lg"
                src={session.user.image}
                alt={session.user.name ?? '头像'}
              />
            )}
            <p className="auth-info">
              <strong>{session.user.name}</strong>
              {session.user.role === 'admin' && <span className="badge badge-admin">管理员</span>}
            </p>
            <div className="auth-actions">
              <Link href="/" className="btn btn-primary">
                返回首页
              </Link>
              <SignOutButton className="btn btn-ghost" />
            </div>
          </>
        ) : (
          <>
            <h1 className="auth-title">登录</h1>
            <p className="auth-info">使用 GitHub 账号一键登录，即可发布帖子与评论。</p>
            <a className="btn btn-primary btn-lg" href="/api/auth/signin/github">
              <span aria-hidden="true">⛭</span> 使用 GitHub 登录
            </a>
            <p className="auth-hint">
              首次登录将自动创建本站账号；管理员名单见 ADMIN_GITHUB_IDS 配置。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
