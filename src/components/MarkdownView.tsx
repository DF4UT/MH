'use client';

/**
 * Markdown 渲染组件（md-editor-v3 仅浏览模式）
 * 使用动态导入避免 SSR 时初始化编辑器导致的闪烁/水合问题
 */
import dynamic from 'next/dynamic';
import type { MdPreviewComponent } from './md';

const MdPreview = dynamic(
  () => import('md-editor-v3').then((m) => m.MdPreview as unknown as MdPreviewComponent),
  { ssr: false }
);

export default function MarkdownView({ content }: { content: string }) {
  return (
    <div className="md-preview-wrap">
      <MdPreview modelValue={content} theme="dark" language="zh-CN" />
    </div>
  );
}
