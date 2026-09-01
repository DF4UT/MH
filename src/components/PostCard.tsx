/**
 * 帖子卡片：标题、摘要、标签、作者、时间、评论数
 */
import Link from 'next/link';
import { timeAgo } from '@/lib/utils';
import type { PostListItem } from '@/modules/posts/service';
import TagChip from './TagChip';

export default function PostCard({ post }: { post: PostListItem }) {
  return (
    <article className="card post-card">
      <h3 className="post-card-title">
        <Link href={`/post/${post.id}`}>{post.title}</Link>
      </h3>
      {post.excerpt && <p className="post-card-excerpt">{post.excerpt}</p>}
      <div className="post-card-tags">
        {post.tags.slice(0, 4).map((t) => (
          <TagChip key={t.id} name={t.name} small />
        ))}
      </div>
      <div className="post-card-meta">
        <Link href="/profile" className="post-author" title={post.author.username}>
          {post.author.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="avatar avatar-sm"
              src={post.author.avatarUrl}
              alt={post.author.username}
            />
          )}
          <span className="post-author-name">{post.author.username}</span>
        </Link>
        <span className="post-card-time">{timeAgo(post.createdAt)}</span>
        <span className="post-card-comments" title="评论数">
          💬 {post.commentCount}
        </span>
      </div>
    </article>
  );
}
