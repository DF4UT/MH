/**
 * 标题排序键生成（供"按标题 A-Z"排序）
 * 规则：
 * - 小写化；英文字母/数字原样保留
 * - 汉字转为拼音（无音调），实现"英文 + 拼音"统一排序
 * - 首个字符为字母/数字/汉字 → 前缀 '1'（正常区）；特殊符号开头 → 前缀 '2'（置底）
 * - 空格等符号以占位符保留，保证长度一致性
 */
import { pinyin } from 'pinyin-pro';

/** 是否汉字 */
function isHan(ch: string): boolean {
  return /[\u4e00-\u9fff]/.test(ch);
}

export function titleSortKey(title: string): string {
  const t = title.trim().toLowerCase();
  if (!t) return '2'; // 空标题排最后
  const prefix = /^[a-z0-9\u4e00-\u9fff]/.test(t) ? '1' : '2';
  let key = prefix;
  for (const ch of t) {
    if (/[a-z0-9]/.test(ch)) {
      key += ch;
    } else if (isHan(ch)) {
      // 单字转拼音（无音调、去空格），多音字取常用读音
      key += pinyin(ch, { toneType: 'none' }).replace(/\s+/g, '');
    } else {
      key += ' '; // 符号/空格占位
    }
  }
  return key;
}
