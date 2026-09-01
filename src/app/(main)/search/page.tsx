'use client';

/**
 * 搜索结果页：按标题/内容模糊搜索（懒加载）
 * useSearchParams 需要 Suspense 边界（Next.js CSR bailout 要求）
 */
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import InfinitePosts from '@/components/InfinitePosts';

function SearchResults() {
  const searchParams = useSearchParams();
  const q = (searchParams.get('q') ?? '').trim();
  const params = useMemo<Record<string, string>>(() => {
    const p: Record<string, string> = {};
    if (q) p.q = q;
    return p;
  }, [q]);

  if (!q) {
    return (
      <div>
        <h1 className="page-title">搜索</h1>
        <p className="empty-text">在上方搜索框输入关键词，搜索帖子标题与内容。</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">搜索：{q}</h1>
      <InfinitePosts
        key={q}
        endpoint="/api/search"
        params={params}
        initialItems={[]}
        initialCursor={null}
        emptyText="没有找到相关帖子，换个关键词试试"
      />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="empty-text">加载中…</p>}>
      <SearchResults />
    </Suspense>
  );
}
