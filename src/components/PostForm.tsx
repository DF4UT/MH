'use client';

/**
 * 帖子发布/编辑表单（md-editor-v3 编辑器）
 * - 标题 + Markdown 内容 + 标签（逗号分隔，自动联想已有标签）
 */
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MdEditorComponent } from './md';

const MdEditor = dynamic(
  () => import('md-editor-v3').then((m) => m.MdEditor as unknown as MdEditorComponent),
  { ssr: false }
);

interface PostFormProps {
  mode: 'create' | 'edit';
  postId?: number;
  initial?: { title: string; content: string; tagNames: string[] };
}

export default function PostForm({ mode, postId, initial }: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [tagInput, setTagInput] = useState(initial?.tagNames.join(', ') ?? '');
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 加载已有标签用于联想
  useEffect(() => {
    fetch('/api/tags')
      .then((r) => r.json())
      .then((data: { tags?: { name: string }[] }) => {
        if (Array.isArray(data.tags)) setTagOptions(data.tags.map((t) => t.name));
      })
      .catch(() => undefined);
  }, []);

  // 解析标签输入（支持中英文逗号，去重，最多 8 个）
  const tagNames = useMemo(
    () =>
      [
        ...new Set(
          tagInput
            .split(/[,，]/)
            .map((s) => s.trim())
            .filter(Boolean)
        ),
      ].slice(0, 8),
    [tagInput]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError('标题至少 2 个字符');
      return;
    }
    if (!content.trim()) {
      setError('内容不能为空');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const url = mode === 'edit' ? `/api/posts/${postId}` : '/api/posts';
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content, tagNames }),
      });
      const data = (await res.json()) as { id?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? '保存失败');
      router.push(`/post/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
      setSubmitting(false);
    }
  }

  return (
    <form className="post-form" onSubmit={(e) => void handleSubmit(e)}>
      <div className="form-group">
        <label className="label" htmlFor="post-title">
          标题
        </label>
        <input
          id="post-title"
          className="input"
          type="text"
          placeholder="一句话说明主题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="form-group">
        <label className="label" htmlFor="post-tags">
          标签（逗号分隔，最多 8 个）
        </label>
        <input
          id="post-tags"
          className="input"
          type="text"
          list="tag-suggestions"
          placeholder="例如：Next.js, 数据库, 前端"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
        />
        <datalist id="tag-suggestions">
          {tagOptions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div className="form-group">
        <label className="label">内容（Markdown）</label>
        <div className="editor-wrap">
          <MdEditor
            modelValue={content}
            onChange={(v: string) => setContent(v)}
            theme="dark"
            language="zh-CN"
            placeholder="使用 Markdown 撰写正文…"
            style={{ height: 480 }}
          />
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? '提交中…' : mode === 'edit' ? '保存修改' : '发布帖子'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          取消
        </button>
      </div>
    </form>
  );
}
