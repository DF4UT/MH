'use client';

/**
 * 帖子发布/编辑表单（md-editor-rt 编辑器，md-editor-v3 的 React 版）
 * - 标题 + Markdown 内容 + 标签（逗号分隔，自动联想已有标签）
 * - 图片上传：拖拽 / 粘贴（clip2upload）/ 工具栏按钮，base64 内嵌 ≤2MB
 */
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const MdEditor = dynamic(() => import('md-editor-rt').then((m) => m.MdEditor), {
  ssr: false,
});

interface PostFormProps {
  mode: 'create' | 'edit';
  postId?: number;
  initial?: { title: string; content: string; tagNames: string[] };
}

/** 单张图片大小上限（2MB），避免 base64 内嵌导致数据库膨胀 */
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

/**
 * 图片上传：将本地图片转为 base64 Data URL 插入 Markdown。
 * 轻量方案（零外部依赖、本地/生产行为一致）；如需对象存储，
 * 替换此实现对接 Vercel Blob / R2 / S3 即可。
 */
function handleUploadImg(files: File[], callback: (urls: string[]) => void) {
  const urls: string[] = [];
  let pending = files.length;
  if (pending === 0) {
    callback([]);
    return;
  }
  files.forEach((file, index) => {
    if (!file.type.startsWith('image/')) {
      window.alert(`「${file.name}」不是图片文件，已跳过`);
      urls[index] = '';
      pending -= 1;
      if (pending === 0) callback(urls);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      window.alert(`「${file.name}」超过 2MB 限制，已跳过`);
      urls[index] = '';
      pending -= 1;
      if (pending === 0) callback(urls);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      urls[index] = typeof reader.result === 'string' ? reader.result : '';
      pending -= 1;
      if (pending === 0) callback(urls);
    };
    reader.onerror = () => {
      urls[index] = '';
      pending -= 1;
      if (pending === 0) callback(urls);
    };
    reader.readAsDataURL(file);
  });
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
    () => [...new Set(tagInput.split(/[,，]/).map((s) => s.trim()).filter(Boolean))].slice(0, 8),
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
            placeholder="使用 Markdown 撰写正文…（支持拖拽/粘贴/工具栏上传图片，单张 ≤2MB）"
            onUploadImg={handleUploadImg}
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
