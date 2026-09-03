/**
 * API 层基础设施：统一错误处理、响应封装、请求体解析
 */
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { PageCursor } from './utils';

/** 业务错误：携带 HTTP 状态码 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** 统一错误 → JSON 响应 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const detail = err.issues.map((i) => `${i.path.join('.') || '参数'}：${i.message}`).join('；');
    return NextResponse.json({ error: `参数校验失败：${detail}` }, { status: 400 });
  }
  console.error('[api] 未处理的错误:', err);
  return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
}

/** 成功响应 */
export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** 安全解析 JSON 请求体 */
export async function parseJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, '请求体不是合法的 JSON');
  }
}

/** 解析游标参数（base64url JSON；兼容 v1 {createdAt,id} 与 v2 {value,id}） */
export function parseCursor(raw: string | null): PageCursor | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<PageCursor> & {
      createdAt?: number;
    };
    // v1：旧格式 createdAt/id → value=createdAt
    if (typeof obj.createdAt === 'number' && typeof obj.id === 'number') {
      return { value: obj.createdAt, id: obj.id };
    }
    if (obj.id !== undefined && (typeof obj.value === 'number' || typeof obj.value === 'string')) {
      return { value: obj.value, id: obj.id };
    }
  } catch {
    /* 非法游标按无游标处理 */
  }
  return null;
}

/** 编码游标参数 */
export function encodeCursor(c: PageCursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url');
}

/** 解析并约束 limit 参数 */
export function parseLimit(raw: string | null, fallback: number, max = 50): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, max);
}
