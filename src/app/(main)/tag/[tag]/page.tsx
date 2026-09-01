/**
 * 标签筛选页：展示该标签下的全部帖子（懒加载）
 */
import { encodeCursor } from '@/lib/api';
import { listPosts } from '@/modules/posts/service';
import InfinitePosts from '@/components/InfinitePosts';

export const dynamic = 'force-dynamic';

export default async function TagPage({ params }: { params: { tag: string } }) {
  const tag = decodeURIComponent(params.tag);
  const page = await listPosts({ tag, limit: 10 });

  return (
    <div>
      <h1 className="page-title">#{tag}</h1>
      <p className="page-subtitle">共 {page.items.length}+ 篇帖子（继续滚动加载）</p>
      <InfinitePosts
        endpoint="/api/posts"
        params={{ tag }}
        initialItems={page.items}
        initialCursor={page.nextCursor ? encodeCursor(page.nextCursor) : null}
        emptyText="该标签下还没有帖子"
      />
    </div>
  );
}
