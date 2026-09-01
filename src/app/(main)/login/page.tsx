/**
 * 登录页：GitHub OAuth 一键登录
 * 注意：URL 上的 error 参数来自 NextAuth（例如 GET /api/auth/signin/github
 * 被重定向回来时携带 error=github），用于提示用户登录流程未完成。
 */
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import GitHubSignInButton from '@/components/GitHubSignInButton';
import SignOutButton from '@/components/SignOutButton';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  github: 'GitHub 登录流程未完成或已取消，请重新点击登录按钮。',
  OAuthSignin: '无法发起 GitHub 授权，请稍后重试。',
  OAuthCallback: 'GitHub 授权回调失败，请检查 GitHub OAuth App 的回调地址配置。',
  OAuthAccountNotLinked: '该 GitHub 账号已绑定其他登录方式，请使用原方式登录。',
  AccessDenied: '登录被拒绝，可能未获得访问权限。',
  Configuration: '服务端配置错误，请检查 NEXTAUTH_SECRET 等环境变量。',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string; callbackUrl?: string };
}) {
  const session = await getServerSession(authOptions);
  const error = searchParams?.error;
  const callbackUrl = searchParams?.callbackUrl ?? '/';

  return (
    <div className="container main-content auth-page">
      <div className="card auth-card">
        {session?.user ? (
          <>
            <h1 className="auth-title">已登录</h1>
            {session.user.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="avatar avatar-lg" src={session.user.image} alt={session.user.name ?? '头像'} />
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
            {error && (
              <p className="form-error" role="alert">
                {ERROR_MESSAGES[error] ?? '登录失败，请重试。'}
              </p>
            )}
            <GitHubSignInButton callbackUrl={callbackUrl} />
            <p className="auth-hint">
              首次登录将自动创建本站账号；管理员名单见 ADMIN_GITHUB_IDS 配置。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
