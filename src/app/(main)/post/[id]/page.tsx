/**
 * 帖子详情页：Markdown 渲染 + 评论区 + 作者/管理员操作
 */
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPostDetail } from '@/modules/posts/service';
import { listCommentsByPost } from '@/modules/comments/service';
import { getUserById } from '@/modules/users/service';
import { formatDateTime, timeAgo } from '@/lib/utils';
import { getConfig } from '@/lib/config';
import MarkdownView from '@/components/MarkdownView';
import CommentSection from '@/components/CommentSection';
import PostActions from '@/components/PostActions';
import TagChip from '@/components/TagChip';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const post = await getPostDetail(Number(params.id));
  const { site } = getConfig();
  return {
    title: post ? post.title : '帖子不存在',
    description: post ? post.excerpt : site.description,
  };
}

export default async function PostPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const [post, comments] = await Promise.all([getPostDetail(id), listCommentsByPost(id)]);
  if (!post) notFound();

  // 作者或管理员可编辑/删除
  const session = await getServerSession(authOptions);
  let canManage = false;
  if (session?.user?.id) {
    const me = await getUserById(Number(session.user.id));
    canManage = !!me && (me.role === 'admin' || me.id === post.author.id);
  }

  return (
    <article className="post-page">
      <h1 className="post-title">{post.title}</h1>
      <div className="post-meta-line">
        {post.author.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="avatar avatar-sm"
            src={post.author.avatarUrl}
            alt={post.author.username}
          />
        )}
        <span className="post-author-name">{post.author.username}</span>
        <span className="post-meta-sep">·</span>
        <time dateTime={new Date(post.createdAt).toISOString()}>{timeAgo(post.createdAt)}</time>
        <span className="post-meta-sep">·</span>
        <span>{formatDateTime(post.createdAt)}</span>
        {post.updatedAt > post.createdAt + 60_000 && (
          <>
            <span className="post-meta-sep">·</span>
            <span className="post-meta-edited">已编辑</span>
          </>
        )}
      </div>

      <div className="post-tags">
        {post.tags.map((t) => (
          <TagChip key={t.id} name={t.name} small />
        ))}
      </div>

      <div className="card post-content">
        <MarkdownView content={post.content} />
      </div>

      {canManage && <PostActions postId={post.id} />}

      <CommentSection postId={post.id} initialComments={comments} />
    </article>
  );
}
