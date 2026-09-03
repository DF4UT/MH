'use client';

/**
 * 首页"最新帖子"区：排序切换（发布时间/评论数/标题 A-Z）+ 无限懒加载
 * - 置顶帖恒置前（强制置顶 → 时间置顶，组内按发布时间倒序）
 * - 排序切换后重新拉取（游标随之重置，避免跨排序翻页错乱）
 */
import { useState } from 'react';
import type { PostListItem } from '@/modules/posts/service';
import InfinitePosts from './InfinitePosts';

const SORT_OPTIONS = [
  { key: 'time', label: '发布时间' },
  { key: 'comments', label: '评论数' },
  { key: 'title', label: '标题 A-Z' },
] as const;

interface LatestPostsProps {
  /** 服务端预取的首批（按发布时间排序） */
  initialItems: PostListItem[];
  initialCursor: string | null;
}

export default function LatestPosts({ initialItems, initialCursor }: LatestPostsProps) {
  const [sort, setSort] = useState<'time' | 'comments' | 'title'>('time');

  return (
    <section>
      <div className="sort-bar">
        <h2 className="section-title sort-bar-title">最新帖子</h2>
        <div className="sort-options" role="group" aria-label="排序方式">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className={sort === o.key ? 'sort-option active' : 'sort-option'}
              onClick={() => setSort(o.key)}
              aria-pressed={sort === o.key}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {sort === 'time' ? (
        <InfinitePosts
          endpoint="/api/posts"
          initialItems={initialItems}
          initialCursor={initialCursor}
          emptyText="还没有帖子，登录后发布第一篇吧！"
        />
      ) : (
        <InfinitePosts
          key={sort}
          endpoint="/api/posts"
          params={{ sort }}
          initialItems={[]}
          initialCursor={null}
          emptyText="还没有帖子，登录后发布第一篇吧！"
        />
      )}
    </section>
  );
}
