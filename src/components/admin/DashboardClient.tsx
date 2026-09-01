'use client';

/**
 * 后台仪表盘：核心指标卡片
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  users: number;
  posts: number;
  comments: number;
  tags: number;
  today: { posts: number; comments: number; users: number };
  online: number;
}

export default function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/stats');
      const data = (await res.json()) as Stats & { error?: string };
      if (!res.ok) throw new Error(data.error ?? '加载失败');
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <p className="empty-text">加载中…</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!stats) return null;

  const cards = [
    { label: '总用户数', value: stats.users, href: '/admin/users' },
    { label: '总帖子数', value: stats.posts, href: '/admin/posts' },
    { label: '总评论数', value: stats.comments, href: '/admin/posts' },
    { label: '标签数', value: stats.tags, href: '/tags' },
    { label: '今日新增帖子', value: stats.today.posts, href: '/admin/analytics' },
    { label: '今日新增评论', value: stats.today.comments, href: '/admin/analytics' },
    { label: '今日新增用户', value: stats.today.users, href: '/admin/users' },
    { label: '当前在线', value: stats.online, href: '/admin/analytics' },
  ];

  return (
    <div>
      <div className="admin-page-header">
        <h1>仪表盘</h1>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()}>
          刷新
        </button>
      </div>
      <div className="stat-grid">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card stat-card">
            <span className="stat-value">{c.value}</span>
            <span className="stat-label">{c.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
