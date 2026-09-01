/**
 * 参数校验（zod schema）
 * 所有写入类 API 统一走这里，保证数据合法性
 */
import { z } from 'zod';

/** 帖子创建/更新 */
export const postSchema = z.object({
  title: z.string().trim().min(2, '标题至少 2 个字符').max(200, '标题最多 200 个字符'),
  content: z.string().min(1, '内容不能为空').max(100_000, '内容最多 100000 字符'),
  tagNames: z
    .array(z.string().trim().min(1).max(30, '单个标签最多 30 个字符'))
    .max(8, '最多 8 个标签')
    .default([]),
});

/** 评论创建 */
export const commentSchema = z.object({
  content: z.string().trim().min(1, '评论不能为空').max(5000, '评论最多 5000 字符'),
});

/** 用户角色更新 */
export const roleSchema = z.object({
  role: z.enum(['user', 'admin']),
});
