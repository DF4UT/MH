/**
 * 后台：编辑任意帖子（复用 PostForm）
 */
import { notFound } from 'next/navigation';
import { getPostDetail } from '@/modules/posts/service';
import PostForm from '@/components/PostForm';

export const dynamic = 'force-dynamic';

export default async function AdminEditPostPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const post = await getPostDetail(id);
  if (!post) notFound();

  return (
    <div>
      <h1 className="page-title">编辑帖子 #{post.id}</h1>
      <PostForm
        mode="edit"
        postId={post.id}
        initialStatus={post.status}
        initial={{
          title: post.title,
          content: post.content,
          tagNames: post.tags.map((t) => t.name),
        }}
      />
    </div>
  );
}
