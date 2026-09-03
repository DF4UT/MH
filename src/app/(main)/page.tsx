/**
 * 首页：站点简介 + 发布入口 + 热门标签 + 帖子列表（懒加载）
 */
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { getConfig } from '@/lib/config';
import { encodeCursor } from '@/lib/api';
import { authOptions } from '@/lib/auth';
import { listPosts } from '@/modules/posts/service';
import { listTagsWithCounts } from '@/modules/tags/service';
import LatestPosts from '@/components/LatestPosts';
import TagChip from '@/components/TagChip';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { site } = getConfig();
  const session = await getServerSession(authOptions);
  const [page, tags] = await Promise.all([
    // 首页列表仅展示已发布内容
    listPosts({ limit: 10, status: 'published' }),
    listTagsWithCounts(),
  ]);

  return (
    <div className="home-page">
      <section className="hero">
        <h1 className="hero-title">{site.name}</h1>
        <p className="hero-desc">{site.description}</p>
        {session?.user && (
          <div className="home-actions">
            <Link href="/post/new" className="btn btn-primary">
              ✏️ 发布新帖
            </Link>
            <Link href="/profile" className="btn btn-ghost">
              我的主页
            </Link>
          </div>
        )}
      </section>

      {tags.length > 0 && (
        <section className="tag-bar" aria-label="热门标签">
          {tags.slice(0, 12).map((t) => (
            <TagChip key={t.id} name={t.name} count={t.count} />
          ))}
        </section>
      )}

      <LatestPosts
        initialItems={page.items}
        initialCursor={page.nextCursor ? encodeCursor(page.nextCursor) : null}
      />
    </div>
  );
}
