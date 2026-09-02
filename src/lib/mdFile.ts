/**
 * md 文件读取工具（客户端）：校验扩展名，读取内容，文件名（去扩展名）作为标题
 */

export interface MdFileContent {
  /** 文件名（已去除 .md 扩展名） */
  title: string;
  content: string;
}

/** 校验是否为 md 文件（仅 .md / .markdown，其他格式一律拒绝） */
export function isMarkdownFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.md') || name.endsWith('.markdown');
}

/** 读取 md 文件：文件名去扩展名作为标题 */
export function readMdFile(file: File): Promise<MdFileContent> {
  return new Promise((resolve, reject) => {
    if (!isMarkdownFile(file)) {
      reject(new Error(`「${file.name}」不是 md 文件，仅支持 .md / .markdown 格式`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (!content.trim()) {
        reject(new Error('文件内容为空'));
        return;
      }
      const title = file.name.replace(/\.(md|markdown)$/i, '');
      resolve({ title, content });
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file, 'utf-8');
  });
}

/** 触发隐藏的文件选择框（仅 md），返回选中的第一个文件 */
export function pickMdFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,text/markdown';
    input.onchange = () => {
      resolve(input.files && input.files.length > 0 ? input.files[0] : null);
      input.remove();
    };
    input.click();
  });
}
