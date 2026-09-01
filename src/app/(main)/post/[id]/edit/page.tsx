/**
 * 编辑帖子页（作者或管理员）
 */
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPostDetail } from '@/modules/posts/service';
import { getUserById } from '@/modules/users/service';
import PostForm from '@/components/PostForm';

export const dynamic = 'force-dynamic';

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');

  const post = await getPostDetail(id);
  if (!post) notFound();

  const me = await getUserById(Number(session.user.id));
  if (!me || (me.role !== 'admin' && me.id !== post.author.id)) {
    redirect(`/post/${id}`);
  }

  return (
    <div>
      <h1 className="page-title">编辑帖子</h1>
      <PostForm
        mode="edit"
        postId={post.id}
        initial={{
          title: post.title,
          content: post.content,
          tagNames: post.tags.map((t) => t.name),
        }}
      />
    </div>
  );
}
