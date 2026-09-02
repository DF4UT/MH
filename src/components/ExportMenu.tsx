'use client';

/**
 * 帖子导出菜单：md / png / pdf（以标题命名文件）
 * - md：直接下载
 * - png/pdf：对 captureSelector 定位的正文 DOM 截图（无法定位时仅提供 md）
 */
import { useState } from 'react';
import { exportMarkdown, exportNodeAsImage } from '@/lib/export';

interface ExportMenuProps {
  title: string;
  content: string;
  /** 正文 DOM 的选择器（png/pdf 截图目标；可跨 RSC 边界传递） */
  captureSelector?: string;
  /** 按钮样式类 */
  className?: string;
}

export default function ExportMenu({ title, content, captureSelector, className }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doExport(format: 'md' | 'png' | 'pdf') {
    setBusy(true);
    try {
      if (format === 'md') {
        exportMarkdown(title, content);
      } else {
        const node = captureSelector ? document.querySelector<HTMLElement>(captureSelector) : null;
        if (!node) {
          window.alert('当前页面无可导出的预览内容');
          return;
        }
        await exportNodeAsImage(node, title, format);
      }
      setOpen(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '导出失败');
    } finally {
      setBusy(false);
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
  }

  return (
    <div className="export-menu" onBlur={handleBlur}>
      <button
        className={className ?? 'btn btn-ghost btn-sm'}
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-expanded={open}
      >
        {busy ? '导出中…' : '导出'}
      </button>
      {open && (
        <div className="export-menu-list" role="menu">
          <button role="menuitem" onClick={() => void doExport('md')}>
            📄 导出 .md
          </button>
          <button role="menuitem" onClick={() => void doExport('png')} disabled={!captureSelector}>
            🖼 导出 .png
          </button>
          <button role="menuitem" onClick={() => void doExport('pdf')} disabled={!captureSelector}>
            📕 导出 .pdf
          </button>
          {!captureSelector && <span className="export-menu-hint">png/pdf 请在帖子详情页导出</span>}
        </div>
      )}
    </div>
  );
}
