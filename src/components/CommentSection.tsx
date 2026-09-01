'use client';

/**
 * 评论区：评论列表 + 发表表单（Markdown 可选，带预览）
 */
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { timeAgo } from '@/lib/utils';
import type { CommentItem } from '@/modules/comments/service';
import MarkdownView from './MarkdownView';

interface CommentSectionProps {
  postId: number;
  initialComments: CommentItem[];
}

export default function CommentSection({ postId, initialComments }: CommentSectionProps) {
  const { data: session, status } = useSession();
  const [comments, setComments] = useState<CommentItem[]>(initialComments);
  const [content, setContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currentUserId = session?.user?.id;
  const isAdmin = session?.user?.role === 'admin';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) {
      setError('评论内容不能为空');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      const data = (await res.json()) as { comment?: CommentItem; error?: string };
      if (!res.ok) throw new Error(data.error ?? '发表失败');
      if (data.comment) {
        setComments((prev) => [...prev, data.comment!]);
        setContent('');
        setShowPreview(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发表失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('确定删除这条评论吗？')) return;
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? '删除失败');
    }
  }

  return (
    <section className="comment-section">
      <h2 className="section-title">评论（{comments.length}）</h2>

      <div className="comment-list">
        {comments.length === 0 && <p className="empty-text">还没有评论，来说两句吧～</p>}
        {comments.map((c) => {
          const canDelete = currentUserId === String(c.author.id) || isAdmin;
          return (
            <div key={c.id} className="comment-item">
              <div className="comment-header">
                {c.author.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="avatar avatar-sm"
                    src={c.author.avatarUrl}
                    alt={c.author.username}
                  />
                )}
                <span className="comment-author">{c.author.username}</span>
                <span className="comment-time">{timeAgo(c.createdAt)}</span>
                {canDelete && (
                  <button
                    className="btn btn-ghost btn-sm comment-delete"
                    onClick={() => void handleDelete(c.id)}
                  >
                    删除
                  </button>
                )}
              </div>
              <div className="comment-body">
                <MarkdownView content={c.content} />
              </div>
            </div>
          );
        })}
      </div>

      {status === 'authenticated' ? (
        <form className="comment-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="comment-form-toolbar">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowPreview((v) => !v)}
            >
              {showPreview ? '编辑' : '预览'}
            </button>
            <span className="form-hint">支持 Markdown 语法</span>
          </div>
          {showPreview ? (
            <div className="comment-preview">
              <MarkdownView content={content || '（空内容）'} />
            </div>
          ) : (
            <textarea
              className="textarea"
              rows={4}
              placeholder="写下你的评论…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={5000}
            />
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="comment-form-footer">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '提交中…' : '发表评论'}
            </button>
          </div>
        </form>
      ) : (
        <p className="login-tip">
          请先 <Link href="/login">登录</Link> 后发表评论
        </p>
      )}
    </section>
  );
}
