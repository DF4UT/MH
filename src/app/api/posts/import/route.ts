/**
 * 帖子导入 API：接收 md 文件内容，以文件名（去扩展名）为标题创建草稿
 * 客户端负责读取文件并限制为 .md 类型，服务端做二次校验
 */
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, ok, parseJsonBody } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { importSchema } from '@/lib/validation';
import { importPost } from '@/modules/posts/service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = importSchema.parse(await parseJsonBody(req));
    // 标题必须是纯文件名（客户端已去除 .md 扩展名）
    if (/\.md$/i.test(body.title)) {
      throw new ApiError(400, '标题不能包含 .md 扩展名');
    }
    const id = await importPost({ title: body.title, content: body.content, authorId: user.id });
    return ok({ id }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
