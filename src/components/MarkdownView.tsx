'use client';

/**
 * Markdown 渲染组件（md-editor-rt 仅浏览模式，md-editor-v3 的 React 版）
 * 使用动态导入避免 SSR 时初始化编辑器导致的闪烁/水合问题
 */
import dynamic from 'next/dynamic';

const MdPreview = dynamic(() => import('md-editor-rt').then((m) => m.MdPreview), {
  ssr: false,
});

export default function MarkdownView({ content }: { content: string }) {
  return (
    <div className="md-preview-wrap">
      <MdPreview modelValue={content} theme="dark" language="zh-CN" />
    </div>
  );
}
