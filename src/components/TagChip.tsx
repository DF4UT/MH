/**
 * 标签徽章：点击跳转到对应标签筛选页
 */
import Link from 'next/link';

interface TagChipProps {
  name: string;
  count?: number;
  small?: boolean;
}

export default function TagChip({ name, count, small }: TagChipProps) {
  return (
    <Link
      href={`/tag/${encodeURIComponent(name)}`}
      className={small ? 'tag-chip tag-chip-sm' : 'tag-chip'}
    >
      #{name}
      {count !== undefined && <span className="tag-chip-count">{count}</span>}
    </Link>
  );
}
