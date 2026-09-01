/**
 * 通用工具函数（无副作用，可安全用于客户端与服务端）
 */

/** 拼接 className，过滤假值 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** 分页游标：按 (createdAt, id) 复合排序，保证稳定分页 */
export interface PageCursor {
  createdAt: number;
  id: number;
}

/** 相对时间显示：刚刚 / N 分钟前 / N 小时前 / N 天前 / 具体日期 */
export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return formatDate(ts);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 格式化为 YYYY-MM-DD */
export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 格式化为 YYYY-MM-DD HH:mm */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${formatDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 去除 Markdown 语法生成纯文本摘要 */
export function buildExcerpt(content: string, maxLen = 160): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~\-|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

/** 转义 LIKE 模式中的特殊字符（配合 ESCAPE '\\' 使用） */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** 解析数字 ID 参数，非法时抛错 */
export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new Error('无效的 ID');
  return id;
}
