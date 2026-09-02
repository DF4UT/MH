'use client';

/**
 * 个人主页帖子列表（我的帖子 / 草稿箱共用）
 * - 无限滚动加载
 * - 管理模式：多选 → 批量删除 / 批量导出（md zip）
 * - 行内操作：编辑、导出 md、发布/收回草稿、删除
 * - 导入 md：文件上传生成草稿并跳转编辑
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { timeAgo } from '@/lib/utils';
import { pickMdFile, readMdFile } from '@/lib/mdFile';
import { exportMarkdown, exportMarkdownZip } from '@/lib/export';
import type { PostListItem, PostStatus } from '@/modules/posts/service';

interface PageData {
  items: PostListItem[];
  nextCursor: string | null;
}

interface ProfilePostsProps {
  userId: number;
  /** 当前列表状态：published=我的帖子；draft=草稿箱 */
  status: PostStatus;
  initialItems: PostListItem[];
  initialCursor: string | null;
  onImported?: () => void;
}

interface RowItem extends PostListItem {
  content?: string;
}

export default function ProfilePosts({
  userId,
  status,
  initialItems,
  initialCursor,
  onImported,
}: ProfilePostsProps) {
  const router = useRouter();
  const [items, setItems] = useState<PostListItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialItems.length > 0 && !initialCursor);
  const [error, setError] = useState('');
  const [manageMode, setManageMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 无限滚动加载更多
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && cursor && !loading) void loadMore();
      },
      { rootMargin: '300px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, loading, status, userId]);

  async function loadMore() {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ authorId: String(userId), status, limit: '10' });
      if (cursor) qs.set('cursor', cursor);
      const res = await fetch(`/api/posts?${qs.toString()}`);
      const data = (await res.json()) as PageData & { error?: string };
      if (!res.ok) throw new Error(data.error ?? '加载失败');
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
      if (!data.nextCursor) setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function refresh() {
    router.refresh();
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }

  async function removeOne(post: PostListItem) {
    if (!window.confirm(`确定删除「${post.title}」吗？`)) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
    if (res.ok) {
      setItems((prev) => prev.filter((p) => p.id !== post.id));
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? '删除失败');
    }
  }

  /** 批量删除所选 */
  async function removeSelected() {
    if (selected.size === 0) return;
    if (!window.confirm(`确定删除选中的 ${selected.size} 篇帖子吗？此操作不可恢复。`)) return;
    setBusy(true);
    try {
      await Promise.all([...selected].map((id) => fetch(`/api/posts/${id}`, { method: 'DELETE' })));
      setItems((prev) => prev.filter((p) => !selected.has(p.id)));
      setSelected(new Set());
      setManageMode(false);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  /** 取选中帖子的完整内容（批量导出需要） */
  async function fetchContents(ids: number[]): Promise<RowItem[]> {
    const rows = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/posts/${id}`);
          const data = (await res.json()) as { post?: PostListItem & { content: string }; error?: string };
          return res.ok && data.post
            ? ({ ...data.post, content: data.post.content } as RowItem)
            : null;
        } catch {
          return null;
        }
      })
    );
    return rows.filter((r): r is RowItem => !!r);
  }

  /** 行内导出 .md（拉取全文后下载） */
  async function exportOne(post: PostListItem) {
    setBusy(true);
    try {
      const [full] = await fetchContents([post.id]);
      if (full?.content) exportMarkdown(full.title, full.content);
      else window.alert('获取帖子内容失败');
    } finally {
      setBusy(false);
    }
  }

  /** 批量导出所选为 md zip */
  async function exportSelected() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const full = await fetchContents([...selected]);
      if (full.length === 0) {
        window.alert('获取帖子内容失败');
        return;
      }
      await exportMarkdownZip(
        full.map((f) => ({ title: f.title, content: f.content ?? '' }))
      );
    } finally {
      setBusy(false);
    }
  }

  /** 切换发布状态（草稿↔发布） */
  async function toggleStatus(post: PostListItem) {
    if (
      post.status === 'published' &&
      !window.confirm(`将「${post.title}」收回草稿箱？其他用户将不可见。`)
    )
      return;
    const next: PostStatus = post.status === 'draft' ? 'published' : 'draft';
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? '操作失败');
    }
  }

  /** 导入单个 md 文件：上传生成草稿后跳转编辑页 */
  async function importFile() {
    setImporting(true);
    try {
      const file = await pickMdFile();
      if (!file) return;
      const { title, content } = await readMdFile(file);
      const res = await fetch('/api/posts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });
      const data = (await res.json()) as { id?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? '导入失败');
      onImported?.();
      router.push(`/post/${data.id}/edit`);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="profile-posts">
      <div className="profile-posts-toolbar">
        <Link href="/post/new" className="btn btn-primary btn-sm">
          ✏️ 新建帖子
        </Link>
        <button className="btn btn-ghost btn-sm" onClick={() => void importFile()} disabled={importing}>
          {importing ? '导入中…' : '📂 导入 md'}
        </button>
        <span className="form-hint">导入生成草稿，编辑完成后发布</span>
        <span className="form-toolbar-spacer" />
        {manageMode ? (
          <>
            <button className="btn btn-ghost btn-sm" onClick={toggleAll}>
              {selected.size === items.length && items.length > 0 ? '取消全选' : '全选'}
            </button>
            <button
              className="btn btn-danger btn-sm"
              disabled={selected.size === 0 || busy}
              onClick={() => void removeSelected()}
            >
              删除所选（{selected.size}）
            </button>
            <button
              className="btn btn-ghost btn-sm"
              disabled={selected.size === 0 || busy}
              onClick={() => void exportSelected()}
            >
              导出所选（md）
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setManageMode(false); setSelected(new Set()); }}>
              退出管理
            </button>
          </>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => setManageMode(true)} disabled={items.length === 0}>
            批量管理
          </button>
        )}
      </div>

      {items.length === 0 && !loading && (
        <p className="empty-text">{status === 'draft' ? '草稿箱是空的：导入的 md 文件或收回的帖子会出现在这里' : '还没有帖子，点击上方「新建帖子」或「导入 md」开始吧'}</p>
      )}

      <ul className="profile-post-list">
        {items.map((post) => (
          <li key={post.id} className="profile-post-row">
            {manageMode && (
              <input
                type="checkbox"
                className="profile-post-check"
                checked={selected.has(post.id)}
                onChange={() => toggleSelect(post.id)}
                aria-label={`选择 ${post.title}`}
              />
            )}
            <div className="profile-post-main">
              <Link href={`/post/${post.id}`} className="profile-post-title">
                {post.title}
              </Link>
              <div className="profile-post-sub">
                {timeAgo(post.createdAt)} · 💬 {post.commentCount}
                {post.tags.slice(0, 3).map((t) => (
                  <span key={t.id} className="profile-post-tag">
                    #{t.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="profile-post-actions">
              {!manageMode && (
                <>
                  {status === 'draft' ? (
                    <button className="btn btn-primary btn-sm" onClick={() => void toggleStatus(post)}>
                      发布
                    </button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => void toggleStatus(post)}>
                      收回草稿
                    </button>
                  )}
                  <Link href={`/post/${post.id}/edit`} className="btn btn-ghost btn-sm">
                    编辑
                  </Link>
                  <button className="btn btn-ghost btn-sm" onClick={() => void exportOne(post)}>
                    导出 md
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => void removeOne(post)}>
                    删除
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {loading && <p className="infinite-status">加载中…</p>}
      {error && <p className="infinite-status infinite-error">{error}</p>}
      {!done && !error && <div ref={sentinelRef} className="infinite-sentinel" aria-hidden="true" />}
      {done && items.length > 0 && <p className="infinite-status">— 已经到底啦 —</p>}
    </div>
  );
}
