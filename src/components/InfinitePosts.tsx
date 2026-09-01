'use client';

/**
 * 帖子懒加载列表（Intersection Observer 无限滚动）
 * - 服务端传入首批数据与游标，滚动接近底部时自动加载下一页
 * - 搜索等无初始数据的场景自动发起首次加载
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PostListItem } from '@/modules/posts/service';
import PostCard from './PostCard';

interface PageData {
  items: PostListItem[];
  nextCursor: string | null;
}

interface InfinitePostsProps {
  /** 列表数据接口（不含查询参数） */
  endpoint: string;
  /** 额外查询参数，如 { q, authorId } */
  params?: Record<string, string>;
  /** 服务端预取的首批数据 */
  initialItems: PostListItem[];
  initialCursor: string | null;
  emptyText?: string;
  /** 是否显示"编辑"快捷入口（用于个人主页等"自己的帖子"场景） */
  showEdit?: boolean;
}

export default function InfinitePosts({
  endpoint,
  params = {},
  initialItems,
  initialCursor,
  emptyText = '暂无内容',
  showEdit,
}: InfinitePostsProps) {
  const [items, setItems] = useState<PostListItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialItems.length > 0 && !initialCursor);
  const [error, setError] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const doneRef = useRef(done);
  const paramsKey = JSON.stringify(params);

  const fetchPage = useCallback(
    async (c: string | null) => {
      if (loadingRef.current || doneRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({ ...params, limit: '10', ...(c ? { cursor: c } : {}) });
        const res = await fetch(`${endpoint}?${qs.toString()}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? `请求失败 (${res.status})`);
        }
        const data = (await res.json()) as PageData;
        setItems((prev) => (c ? [...prev, ...data.items] : data.items));
        setCursor(data.nextCursor);
        if (!data.nextCursor) {
          doneRef.current = true;
          setDone(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败，请重试');
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endpoint, paramsKey]
  );

  // 无初始数据时（如搜索结果页）自动加载第一页
  useEffect(() => {
    if (initialItems.length === 0 && !initialCursor) void fetchPage(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 滚动接近底部哨兵节点时加载下一页
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchPage(cursor);
      },
      { rootMargin: '300px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, fetchPage]);

  return (
    <div className="infinite-posts">
      {items.length === 0 && !loading && !error && <p className="empty-text">{emptyText}</p>}
      {items.length > 0 && (
        <div className="post-grid">
          {items.map((p) => (
            <PostCard key={`${endpoint}-${p.id}`} post={p} showEdit={showEdit} />
          ))}
        </div>
      )}
      {loading && <p className="infinite-status">加载中…</p>}
      {error && <p className="infinite-status infinite-error">{error}</p>}
      {!done && !error && (
        <div ref={sentinelRef} className="infinite-sentinel" aria-hidden="true" />
      )}
      {done && items.length > 0 && <p className="infinite-status">— 已经到底啦 —</p>}
    </div>
  );
}
