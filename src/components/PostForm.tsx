'use client';

/**
 * 帖子发布/编辑表单（md-editor-rt 编辑器，md-editor-v3 的 React 版）
 * - 标题 + Markdown 内容 + 标签（逗号分隔，自动联想已有标签）
 * - 图片上传：拖拽 / 粘贴 / 工具栏按钮，base64 内嵌 ≤2MB
 * - 导入 md 文件：文件名（去扩展名）自动作为标题
 * - 导出当前内容：md / png / pdf
 * - 状态：发布（published）或存入草稿箱（draft）
 */
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { readMdFile } from '@/lib/mdFile';
import type { PostStatus } from '@/modules/posts/service';
import MarkdownView from './MarkdownView';
import ExportMenu from './ExportMenu';
import { useModal } from '@/components/modal/ModalProvider';

const MdEditor = dynamic(() => import('md-editor-rt').then((m) => m.MdEditor), {
  ssr: false,
});

interface PostFormProps {
  mode: 'create' | 'edit';
  postId?: number;
  initial?: { title: string; content: string; tagNames: string[] };
  /** 编辑模式下的当前状态（用于保持或升级发布） */
  initialStatus?: PostStatus;
}

/** 单张图片大小上限（2MB），避免 base64 内嵌导致数据库膨胀 */
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

/**
 * 图片上传：将本地图片转为 base64 Data URL 插入 Markdown。
 * 轻量方案（零外部依赖、本地/生产行为一致）；如需对象存储，
 * 替换此实现对接 Vercel Blob / R2 / S3 即可。
 * showError：提示回调（由调用方注入模态框等 UI）。
 */
function handleUploadImg(
  files: File[],
  callback: (urls: string[]) => void,
  showError: (msg: string) => void
) {
  const urls: string[] = [];
  let pending = files.length;
  if (pending === 0) {
    callback([]);
    return;
  }
  files.forEach((file, index) => {
    const skip = (msg: string) => {
      showError(msg);
      urls[index] = '';
      pending -= 1;
      if (pending === 0) callback(urls);
    };
    if (!file.type.startsWith('image/')) {
      skip(`「${file.name}」不是图片文件，已跳过`);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      skip(`「${file.name}」超过 2MB 限制，已跳过`);
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

export default function PostForm({ mode, postId, initial, initialStatus }: PostFormProps) {
  const router = useRouter();
  const modal = useModal();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [status, setStatus] = useState<PostStatus>(initialStatus ?? 'published');
  const [tagInput, setTagInput] = useState(initial?.tagNames.join(', ') ?? '');
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 离屏导出捕获节点（导出当前内容 png/pdf 用）
  const captureRef = useRef<HTMLDivElement>(null);

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

  /** 导入 md 文件：文件名（去扩展名）= 标题，内容载入正文区 */
  async function handleImportFile(file: File) {
    try {
      const { title: fileTitle, content: fileContent } = await readMdFile(file);
      if (content.trim()) {
        const ok = await modal.confirm({
          title: '导入 md 文件',
          message: '导入将覆盖当前已编辑的内容，是否继续？',
          confirmText: '覆盖导入',
        });
        if (!ok) return;
      }
      setTitle(fileTitle);
      setContent(fileContent);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  /** 提交：action=publish 发布 / action=draft 存草稿；编辑模式保持当前状态 */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError('标题至少 2 个字符');
      return;
    }
    if (!content.trim()) {
      setError('内容不能为空');
      return;
    }
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const nextStatus: PostStatus =
      submitter?.value === 'draft' ? 'draft' : submitter?.value === 'publish' ? 'published' : status;

    setSubmitting(true);
    setError('');
    try {
      const url = mode === 'edit' ? `/api/posts/${postId}` : '/api/posts';
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), content, tagNames, status: nextStatus }),
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
      <div className="form-toolbar">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown"
          className="visually-hidden"
          aria-label="导入 md 文件"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleImportFile(f);
          }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => fileInputRef.current?.click()}
        >
          📂 导入 md 文件
        </button>
        <span className="form-hint">仅支持 .md 文件，文件名将作为标题</span>
        <span className="form-toolbar-spacer" />
        {mode === 'edit' && (
          <span className={status === 'draft' ? 'badge badge-draft' : 'badge'}>
            {status === 'draft' ? '草稿（仅自己可见）' : '已发布'}
          </span>
        )}
        <ExportMenu title={title || '未命名'} content={content} captureSelector="#postform-capture" />
      </div>

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
            onUploadImg={(files, cb) => {
              void handleUploadImg(files, cb, (msg) => void modal.alert({ title: '图片上传', message: msg }));
            }}
            style={{ height: 480 }}
          />
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        {mode === 'edit' ? (
          <>
            <button type="submit" name="action" value={status} className="btn btn-primary" disabled={submitting}>
              {submitting ? '保存中…' : status === 'draft' ? '保存草稿' : '保存修改'}
            </button>
            {status === 'draft' && (
              <button type="submit" name="action" value="publish" className="btn btn-primary" disabled={submitting}>
                {submitting ? '发布中…' : '保存并发布'}
              </button>
            )}
          </>
        ) : (
          <>
            <button type="submit" name="action" value="publish" className="btn btn-primary" disabled={submitting}>
              {submitting ? '发布中…' : '发布帖子'}
            </button>
            <button type="submit" name="action" value="draft" className="btn btn-ghost" disabled={submitting}>
              {submitting ? '保存中…' : '存入草稿箱'}
            </button>
          </>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
          取消
        </button>
      </div>

      {/* 离屏导出捕获区：渲染当前内容的 Markdown 预览供 png/pdf 导出截图 */}
      <div ref={captureRef} id="postform-capture" className="export-capture" aria-hidden="true">
        <MarkdownView content={content || '（空内容）'} />
      </div>
    </form>
  );
}
