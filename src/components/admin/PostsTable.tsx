'use client';

/**
 * 后台帖子管理：搜索 / 排序 / 分页 / 删除
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { PostListItem } from '@/modules/posts/service';
import TagChip from '@/components/TagChip';

const PAGE_SIZE = 10;

export default function PostsTable() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'createdAt' | 'id'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        q,
        sort,
        order,
        offset: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/admin/posts?${qs.toString()}`);
      const data = (await res.json()) as { items?: PostListItem[]; total?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? '加载失败');
      setPosts(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [q, sort, order, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSort(col: 'createdAt' | 'id') {
    if (sort === col) {
      setOrder((v) => (v === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(col);
      setOrder('desc');
    }
  }

  async function removePost(p: PostListItem) {
    if (!window.confirm(`确定删除帖子「${p.title}」吗？其所有评论将一并删除！`)) return;
    const res = await fetch(`/api/admin/posts/${p.id}`, { method: 'DELETE' });
    if (res.ok) void load();
    else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? '操作失败');
    }
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div>
      <div className="admin-page-header">
        <h1>帖子管理</h1>
        <div className="admin-toolbar">
          <input
            className="input search-input"
            type="search"
            placeholder="搜索标题 / 内容…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>
                <button className="table-sort" onClick={() => toggleSort('id')}>
                  ID {sort === 'id' && (order === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>标题</th>
              <th>作者</th>
              <th>标签</th>
              <th>评论</th>
              <th>
                <button className="table-sort" onClick={() => toggleSort('createdAt')}>
                  发布时间 {sort === 'createdAt' && (order === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>
                  <Link href={`/post/${p.id}`} className="table-title">
                    {p.title}
                  </Link>
                  <div className="table-sub">{p.excerpt}</div>
                </td>
                <td>{p.author.username}</td>
                <td>
                  <div className="table-tags">
                    {p.tags.slice(0, 3).map((t) => (
                      <TagChip key={t.id} name={t.name} small />
                    ))}
                  </div>
                </td>
                <td>{p.commentCount}</td>
                <td>{new Date(p.createdAt).toLocaleString('zh-CN')}</td>
                <td className="table-actions">
                  <Link href={`/admin/posts/${p.id}/edit`} className="btn btn-ghost btn-sm">
                    编辑
                  </Link>
                  <button className="btn btn-danger btn-sm" onClick={() => void removePost(p)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {!loading && posts.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty">
                  没有匹配的帖子
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="pagination-bar">
        <button
          className="btn btn-ghost btn-sm"
          disabled={page <= 0}
          onClick={() => setPage((p) => p - 1)}
        >
          上一页
        </button>
        <span>
          {page + 1} / {totalPages}（共 {total} 篇）
        </span>
        <button
          className="btn btn-ghost btn-sm"
          disabled={page >= totalPages - 1}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
