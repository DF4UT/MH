/**
 * 后台布局：管理员鉴权 + 侧边导航
 */
import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions, isAdminGithubId } from '@/lib/auth';
import { getUserById } from '@/modules/users/service';
import AdminSidebar from '@/components/admin/AdminSidebar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const user = await getUserById(Number(session.user.id));
  const isAdmin = !!user && (user.role === 'admin' || isAdminGithubId(user.githubId));
  if (!isAdmin) redirect('/');

  return (
    <div className="admin-layout">
      <AdminSidebar username={user.username} />
      <main className="admin-main container">{children}</main>
    </div>
  );
}
