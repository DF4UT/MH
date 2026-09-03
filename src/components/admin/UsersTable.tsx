'use client';

/**
 * 后台用户管理：搜索 / 排序 / 分页 / 角色修改 / 删除
 */
import { useCallback, useEffect, useState } from 'react';
import { useModal } from '@/components/modal/ModalProvider';

interface AdminUser {
  id: number;
  githubId: string;
  username: string;
  email: string | null;
  avatarUrl: string | null;
  role: 'user' | 'admin';
  createdAt: number;
  postCount: number;
}

const PAGE_SIZE = 10;

export default function UsersTable() {
  const modal = useModal();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'createdAt' | 'username' | 'role'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        q,
        sort,
        order,
        offset: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/admin/users?${qs.toString()}`);
      const data = (await res.json()) as { items?: AdminUser[]; total?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? '加载失败');
      setUsers(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [q, sort, order, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleSort(col: 'createdAt' | 'username' | 'role') {
    if (sort === col) {
      setOrder((v) => (v === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(col);
      setOrder('desc');
    }
  }

  async function changeRole(u: AdminUser) {
    const nextRole = u.role === 'admin' ? 'user' : 'admin';
    const ok = await modal.confirm({
      title: '修改角色',
      message: `确定将 ${u.username} 的角色改为「${nextRole === 'admin' ? '管理员' : '普通用户'}」吗？`,
      confirmText: '确认修改',
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole }),
    });
    if (res.ok) void load();
    else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      await modal.alert({ title: '操作失败', message: data.error ?? '操作失败' });
    }
  }

  async function removeUser(u: AdminUser) {
    const ok = await modal.confirm({
      title: '删除用户',
      message: `确定删除用户 ${u.username}？其所有帖子与评论将一并删除！`,
      danger: true,
      confirmText: '删除',
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    if (res.ok) void load();
    else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      await modal.alert({ title: '操作失败', message: data.error ?? '操作失败' });
    }
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div>
      <div className="admin-page-header">
        <h1>用户管理</h1>
        <div className="admin-toolbar">
          <input
            className="input search-input"
            type="search"
            placeholder="搜索用户名 / GitHub ID…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>用户</th>
              <th>
                <button className="table-sort" onClick={() => toggleSort('username')}>
                  用户名 {sort === 'username' && (order === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>
                <button className="table-sort" onClick={() => toggleSort('role')}>
                  角色 {sort === 'role' && (order === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>帖子数</th>
              <th>
                <button className="table-sort" onClick={() => toggleSort('createdAt')}>
                  注册时间 {sort === 'createdAt' && (order === 'asc' ? '↑' : '↓')}
                </button>
              </th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.avatarUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="avatar avatar-sm" src={u.avatarUrl} alt={u.username} />
                  )}
                </td>
                <td>
                  {u.username}
                  <div className="table-sub">GitHub: {u.githubId}</div>
                </td>
                <td>
                  <span className={u.role === 'admin' ? 'badge badge-admin' : 'badge'}>
                    {u.role}
                  </span>
                </td>
                <td>{u.postCount}</td>
                <td>{new Date(u.createdAt).toLocaleString('zh-CN')}</td>
                <td className="table-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => void changeRole(u)}>
                    {u.role === 'admin' ? '降为普通' : '设为管理员'}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => void removeUser(u)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  没有匹配的用户
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="pagination-bar">
        <button
          className="btn btn-ghost btn-sm"
          disabled={page <= 0}
          onClick={() => setPage((p) => p - 1)}
        >
          上一页
        </button>
        <span>
          {page + 1} / {totalPages}（共 {total} 人）
        </span>
        <button
          className="btn btn-ghost btn-sm"
          disabled={page >= totalPages - 1}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
