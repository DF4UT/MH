/**
 * 标签页：全部标签及使用量
 */
import { listTagsWithCounts } from '@/modules/tags/service';
import TagChip from '@/components/TagChip';

export const dynamic = 'force-dynamic';

export default async function TagsPage() {
  const tags = await listTagsWithCounts();
  return (
    <div>
      <h1 className="page-title">标签</h1>
      <p className="page-subtitle">共 {tags.length} 个标签，点击查看对应帖子</p>
      {tags.length === 0 ? (
        <p className="empty-text">暂无标签</p>
      ) : (
        <div className="tag-cloud">
          {tags.map((t) => (
            <TagChip key={t.id} name={t.name} count={t.count} />
          ))}
        </div>
      )}
    </div>
  );
}
