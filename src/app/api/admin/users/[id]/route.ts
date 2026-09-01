/**
 * 后台 API：用户角色修改 / 删除
 */
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, ok, parseJsonBody } from '@/lib/api';
import { requireAdminUser } from '@/lib/auth';
import { roleSchema } from '@/lib/validation';
import { deleteUser, getUserById, setUserRole } from '@/modules/users/service';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdminUser();
    const id = Number(params.id);
    if (id === admin.id) throw new ApiError(400, '不能修改自己的角色');
    const body = roleSchema.parse(await parseJsonBody(req));
    await setUserRole(id, body.role);
    return ok({ id });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdminUser();
    const id = Number(params.id);
    if (id === admin.id) throw new ApiError(400, '不能删除自己的账号');
    const user = await getUserById(id);
    if (!user) throw new ApiError(404, '用户不存在');
    await deleteUser(id);
    return ok({ id });
  } catch (err) {
    return handleApiError(err);
  }
}
