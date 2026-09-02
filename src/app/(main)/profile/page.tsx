/**
 * 个人主页：用户信息 + 「我的帖子 / 草稿箱」双 Tab
 * - 我的帖子：新建、导入 md、批量管理（删除/导出）、收回草稿
 * - 草稿箱：导入的 md 与收回的帖子（仅自己可见），可编辑后发布
 */
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserById } from '@/modules/users/service';
import { listPosts } from '@/modules/posts/service';
import { encodeCursor } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import ProfileTabs from '@/components/ProfileTabs';
import ProfilePosts from '@/components/ProfilePosts';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  const user = await getUserById(Number(session.user.id));
  if (!user) redirect('/login');

  const [published, drafts] = await Promise.all([
    listPosts({ authorId: user.id, status: 'published', limit: 10 }),
    listPosts({ authorId: user.id, status: 'draft', limit: 10 }),
  ]);

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

      <ProfileTabs
        tabs={[
          {
            key: 'published',
            label: '我的帖子',
            content: (
              <ProfilePosts
                userId={user.id}
                status="published"
                initialItems={published.items}
                initialCursor={published.nextCursor ? encodeCursor(published.nextCursor) : null}
              />
            ),
          },
          {
            key: 'drafts',
            label: '草稿箱',
            content: (
              <ProfilePosts
                userId={user.id}
                status="draft"
                initialItems={drafts.items}
                initialCursor={drafts.nextCursor ? encodeCursor(drafts.nextCursor) : null}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
