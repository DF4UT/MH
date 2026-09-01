'use client';

/**
 * 冻结导航栏：Logo、导航链接、搜索框、在线人数、登录状态
 * - 固定在视口顶部，滚动不消失
 * - 移动端折叠为汉堡菜单
 * - 每 30s 发送一次心跳，服务端返回当前在线人数
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || '知识论坛';
const HEARTBEAT_MS = 30_000;

/** 游客身份标识（localStorage 持久化） */
function getClientId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('forum_client_id');
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `g-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('forum_client_id', id);
  }
  return id;
}

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [online, setOnline] = useState(0);
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const clientIdRef = useRef('');

  // 在线人数心跳
  useEffect(() => {
    clientIdRef.current = getClientId();
    const sendHeartbeat = async () => {
      try {
        const res = await fetch('/api/online', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: clientIdRef.current }),
        });
        if (res.ok) {
          const data = (await res.json()) as { online?: number };
          setOnline(data.online ?? 0);
        }
      } catch {
        /* 心跳失败静默忽略，下个周期重试 */
      }
    };
    void sendHeartbeat();
    const timer = setInterval(() => void sendHeartbeat(), HEARTBEAT_MS);
    return () => clearInterval(timer);
  }, []);

  // 关闭移动端菜单
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    setMenuOpen(false);
    router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  const links = [
    { href: '/', label: '首页' },
    { href: '/tags', label: '标签' },
    { href: '/search', label: '搜索' },
  ];

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link href="/" className="navbar-brand">
          <span className="navbar-logo" aria-hidden="true">
            ▣
          </span>
          <span className="navbar-name">{SITE_NAME}</span>
        </Link>

        <nav className="nav-links" aria-label="主导航">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? 'nav-link active' : 'nav-link'}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <form className="search-form" onSubmit={(e) => handleSearch(e)} role="search">
          <input
            className="input search-input"
            type="search"
            placeholder="搜索帖子…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="搜索帖子"
          />
        </form>

        <span className="online-badge" title="当前在线人数">
          <span className="online-dot" aria-hidden="true" />
          {online}
        </span>

        <div className="user-area">
          {status === 'loading' ? null : session?.user ? (
            <>
              <Link href="/profile" className="user-chip" title={session.user.name ?? '我的主页'}>
                {session.user.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="avatar avatar-sm"
                    src={session.user.image}
                    alt={session.user.name ?? '头像'}
                  />
                )}
                <span className="user-name">{session.user.name}</span>
              </Link>
              {session.user.role === 'admin' && (
                <Link href="/admin" className="btn btn-ghost btn-sm nav-admin-link">
                  后台
                </Link>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => void signOut({ callbackUrl: '/' })}
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link href="/post/new" className="btn btn-primary btn-sm">
                发布
              </Link>
              <Link href="/login" className="btn btn-ghost btn-sm">
                登录
              </Link>
            </>
          )}
        </div>

        <button
          className="hamburger"
          aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="hamburger-line" />
          <span className="hamburger-line" />
          <span className="hamburger-line" />
        </button>
      </div>

      {menuOpen && (
        <div className="mobile-menu">
          <nav className="mobile-nav">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={pathname === l.href ? 'nav-link active' : 'nav-link'}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <form className="search-form" onSubmit={(e) => handleSearch(e)} role="search">
            <input
              className="input search-input"
              type="search"
              placeholder="搜索帖子…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>
          <div className="mobile-actions">
            {status === 'loading' ? null : session?.user ? (
              <>
                <Link href="/profile" className="btn btn-ghost btn-sm">
                  我的主页
                </Link>
                {session.user.role === 'admin' && (
                  <Link href="/admin" className="btn btn-ghost btn-sm">
                    后台管理
                  </Link>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => void signOut({ callbackUrl: '/' })}
                >
                  退出登录
                </button>
              </>
            ) : (
              <>
                <Link href="/post/new" className="btn btn-primary btn-sm">
                  发布
                </Link>
                <Link href="/login" className="btn btn-ghost btn-sm">
                  登录
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
