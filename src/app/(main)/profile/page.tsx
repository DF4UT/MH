/**
 * 个人主页：个人信息 + 我的帖子（懒加载）
 */
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserById } from '@/modules/users/service';
import { listPosts } from '@/modules/posts/service';
import { encodeCursor } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import InfinitePosts from '@/components/InfinitePosts';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const user = await getUserById(Number(session.user.id));
  if (!user) redirect('/login');

  const page = await listPosts({ authorId: user.id, limit: 10 });

  return (
    <div>
      <div className="card profile-card">
        {user.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar avatar-lg" src={user.avatarUrl} alt={user.username} />
        )}
        <div className="profile-info">
          <h1 className="profile-name">
            {user.username}
            {user.role === 'admin' && <span className="badge badge-admin">管理员</span>}
          </h1>
          <p className="profile-meta">GitHub ID：{user.githubId}</p>
          <p className="profile-meta">加入时间：{formatDateTime(user.createdAt)}</p>
        </div>
      </div>

      <section>
        <h2 className="section-title">我的帖子</h2>
        <InfinitePosts
          endpoint="/api/posts"
          params={{ authorId: String(user.id) }}
          initialItems={page.items}
          initialCursor={page.nextCursor ? encodeCursor(page.nextCursor) : null}
          emptyText="还没有发布过帖子"
          showEdit
        />
      </section>
    </div>
  );
}
