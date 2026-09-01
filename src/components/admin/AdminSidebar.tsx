'use client';

/**
 * 后台侧边栏导航（移动端折叠为顶部横条）
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/admin', label: '仪表盘' },
  { href: '/admin/users', label: '用户管理' },
  { href: '/admin/posts', label: '帖子管理' },
  { href: '/admin/analytics', label: '数据分析' },
];

export default function AdminSidebar({ username }: { username: string }) {
  const pathname = usePathname();
  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <span className="admin-brand-mark" aria-hidden="true">
          ⚙
        </span>
        <span>管理后台</span>
      </div>
      <nav className="admin-nav">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname === l.href ? 'admin-nav-link active' : 'admin-nav-link'}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="admin-sidebar-footer">
        <span className="admin-user">{username}</span>
        <Link href="/" className="btn btn-ghost btn-sm">
          返回论坛
        </Link>
      </div>
    </aside>
  );
}
