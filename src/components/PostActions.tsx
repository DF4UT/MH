'use client';

/**
 * 帖子操作栏：编辑 / 删除（作者或管理员可见）
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PostActions({ postId }: { postId: number }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm('确定删除这篇帖子吗？此操作不可恢复。')) return;
    setDeleting(true);
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? '删除失败');
      setDeleting(false);
    }
  }

  return (
    <div className="post-actions">
      <Link href={`/post/${postId}/edit`} className="btn btn-ghost btn-sm">
        编辑
      </Link>
      <button
        className="btn btn-danger btn-sm"
        onClick={() => void handleDelete()}
        disabled={deleting}
      >
        {deleting ? '删除中…' : '删除'}
      </button>
    </div>
  );
}
