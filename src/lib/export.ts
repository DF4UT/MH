/**
 * 帖子导出工具（客户端）
 * - md：Blob 下载（标题.md）
 * - png：html-to-image 截图（暗色主题，标题.png）
 * - pdf：截图 → jsPDF 生成（标题.pdf，图片型 PDF）
 * - zip：jszip 打包多个 md 文件（批量导出）
 * 说明：三个重型库均为按需动态导入，避免拖累首屏体积。
 */

/** 生成安全文件名（去除非法字符，保留扩展名） */
export function safeFileName(title: string, ext: 'md' | 'png' | 'pdf' | 'zip'): string {
  const clean = title
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
    .trim()
    .slice(0, 80);
  return (clean || '未命名') + '.' + ext;
}

/** 下载 Blob */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** 导出 Markdown 文件 */
export function exportMarkdown(title: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, safeFileName(title, 'md'));
}

/**
 * 将 DOM 节点导出为 PNG / PDF
 * @param node 需要截图的正文节点（如 .md-preview-wrap）
 * @param title 文件名标题
 * @param format png | pdf
 */
export async function exportNodeAsImage(
  node: HTMLElement,
  title: string,
  format: 'png' | 'pdf'
): Promise<void> {
  // 按需加载截图库
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(node, {
    backgroundColor: '#000000',
    pixelRatio: 2,
    cacheBust: true,
  });

  if (format === 'png') {
    const blob = await (await fetch(dataUrl)).blob();
    downloadBlob(blob, safeFileName(title, 'png'));
    return;
  }

  // PDF：jsPDF 按图片宽高比放入 A4
  const { jsPDF } = await import('jspdf');
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('图片生成失败'));
  });
  const pdf = new jsPDF({ orientation: img.width > img.height ? 'landscape' : 'portrait', unit: 'px', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageWidth / img.width, pageHeight / img.height);
  const w = img.width * ratio;
  const h = img.height * ratio;
  pdf.addImage(dataUrl, 'PNG', (pageWidth - w) / 2, 0, w, h);
  pdf.save(safeFileName(title, 'pdf'));
}

/** 批量导出：将多篇帖子打包为 md zip（标题.md） */
export async function exportMarkdownZip(items: { title: string; content: string }[]): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const used = new Set<string>();
  for (const item of items) {
    let name = safeFileName(item.title, 'md');
    // 避免同名文件覆盖
    let i = 1;
    while (used.has(name)) {
      name = safeFileName(item.title + '_' + i, 'md');
      i += 1;
    }
    used.add(name);
    zip.file(name, item.content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, safeFileName('导出帖子', 'zip'));
}
