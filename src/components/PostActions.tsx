'use client';

/**
 * 帖子操作栏：发布/收回草稿、编辑、删除（作者或管理员可见）
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PostStatus } from '@/modules/posts/service';

interface PostActionsProps {
  postId: number;
  /** 当前状态：published=已发布；draft=草稿箱 */
  postStatus: PostStatus;
}

export default function PostActions({ postId, postStatus }: PostActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm('确定删除这篇帖子吗？此操作不可恢复。')) return;
    setBusy(true);
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? '删除失败');
      setBusy(false);
    }
  }

  /** 发布草稿 / 收回草稿（类似可见性开关） */
  async function toggleStatus(next: PostStatus) {
    if (next === 'draft' && !window.confirm('将帖子收回草稿箱后，其他用户将不可见，确定继续？')) return;
    setBusy(true);
    const res = await fetch(`/api/posts/${postId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? '操作失败');
      setBusy(false);
    }
  }

  return (
    <div className="post-actions">
      {postStatus === 'draft' ? (
        <>
          <span className="badge badge-draft">草稿（仅自己可见）</span>
          <button
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => void toggleStatus('published')}
          >
            发布
          </button>
        </>
      ) : (
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void toggleStatus('draft')}>
          收回草稿
        </button>
      )}
      <Link href={`/post/${postId}/edit`} className="btn btn-ghost btn-sm">
        编辑
      </Link>
      <button className="btn btn-danger btn-sm" onClick={() => void handleDelete()} disabled={busy}>
        删除
      </button>
    </div>
  );
}
