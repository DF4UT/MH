/**
 * 发布帖子页（需登录）
 */
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import PostForm from '@/components/PostForm';

export const dynamic = 'force-dynamic';

export default async function NewPostPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  return (
    <div>
      <h1 className="page-title">发布新帖子</h1>
      <PostForm mode="create" />
    </div>
  );
}
