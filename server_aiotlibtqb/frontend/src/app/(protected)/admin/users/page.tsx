'use client';

import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Shield,
  MapPin,
  Mail,
  Phone,
  Key,
  Lock,
  Unlock,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useRolesQuery,
  useToggleUserStatusMutation,
  useUpdateUserMutation,
  useUsersQuery,
} from '@/features/iam/queries';
import { ApiError } from '@/lib/http/error-mapper';
import { ERROR_MESSAGES_VI } from '@/messages/vi';
import {
  EmptyState,
  ErrorBanner,
  ModalDialog,
  PaginationBar,
  Skeleton,
  useToast,
} from '@/components/ui/primitives';
import type { UserResponse } from '@/types/api';

function parseZonesInput(raw: string): string[] {
  return raw
    .split(',')
    .map((z) => z.trim())
    .filter(Boolean);
}

export default function AdminUsersPage() {
  const capabilities = useAuthStore((s) => s.capabilities);
  const { pushToast } = useToast();

  const [page, setPage] = useState(0);
  const pageSize = 10;

  const usersQuery = useUsersQuery({ page, size: pageSize });
  const rolesQuery = useRolesQuery(capabilities.canManageUsers);

  const createUserMutation = useCreateUserMutation();
  const updateUserMutation = useUpdateUserMutation();
  const toggleStatusMutation = useToggleUserStatusMutation();
  const deleteUserMutation = useDeleteUserMutation();

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRoles, setNewRoles] = useState<string[]>([]);
  const [newZonesText, setNewZonesText] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit modal state
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editZonesText, setEditZonesText] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirm modal state
  const [deletingUser, setDeletingUser] = useState<UserResponse | null>(null);

  if (!capabilities.canManageUsers) {
    return (
      <div className="page max-w-5xl">
        <ErrorBanner message={ERROR_MESSAGES_VI[1007]} />
      </div>
    );
  }

  const availableRoles = rolesQuery.data ?? [];

  const toggleRoleInList = (list: string[], roleName: string): string[] =>
    list.includes(roleName)
      ? list.filter((r) => r !== roleName)
      : [...list, roleName];

  const handleOpenCreate = () => {
    setNewUsername('');
    setNewPassword('');
    setNewEmail('');
    setNewPhone('');
    setNewRoles([]);
    setNewZonesText('');
    setCreateError(null);
    setCreateOpen(true);
  };

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError(null);

    const trimmedUsername = newUsername.trim();
    if (trimmedUsername.length < 6) {
      setCreateError(ERROR_MESSAGES_VI[1002]);
      return;
    }
    if (newPassword.length < 8) {
      setCreateError(ERROR_MESSAGES_VI[1003]);
      return;
    }

    createUserMutation.mutate(
      {
        username: trimmedUsername,
        password: newPassword,
        email: newEmail.trim() || undefined,
        phone: newPhone.trim() || undefined,
        roles: newRoles,
        assignedZones: parseZonesInput(newZonesText),
      },
      {
        onSuccess: (created) => {
          setCreateOpen(false);
          pushToast({
            title: 'Đã tạo tài khoản',
            message: `Tài khoản "${created.username}" đã được khởi tạo.`,
            variant: 'success',
          });
        },
        onError: (err) => {
          setCreateError(
            err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999]
          );
        },
      }
    );
  };

  const handleOpenEdit = (u: UserResponse) => {
    setEditingUser(u);
    setEditPassword('');
    setEditEmail(u.email ?? '');
    setEditPhone(u.phone ?? '');
    setEditRoles((u.roles ?? []).map((r) => r.name));
    setEditZonesText((u.assignedZones ?? []).join(', '));
    setEditError(null);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);

    if (editPassword && editPassword.length < 8) {
      setEditError(ERROR_MESSAGES_VI[1003]);
      return;
    }

    updateUserMutation.mutate(
      {
        id: editingUser.id,
        body: {
          password: editPassword ? editPassword : undefined,
          email: editEmail.trim() || undefined,
          phone: editPhone.trim() || undefined,
          roles: editRoles,
          assignedZones: parseZonesInput(editZonesText),
        },
      },
      {
        onSuccess: (updated) => {
          setEditingUser(null);
          pushToast({
            title: 'Cập nhật thành công',
            message: `Đã lưu thông tin người dùng "${updated.username}".`,
            variant: 'success',
          });
        },
        onError: (err) => {
          setEditError(
            err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999]
          );
        },
      }
    );
  };

  const handleToggleActive = (u: UserResponse) => {
    toggleStatusMutation.mutate(
      { id: u.id, active: !u.active },
      {
        onSuccess: (updated) => {
          pushToast({
            title: updated.active ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản',
            message: `Tài khoản "${updated.username}" hiện ${
              updated.active ? 'đang hoạt động' : 'bị vô hiệu hóa'
            }.`,
            variant: updated.active ? 'success' : 'warning',
          });
        },
        onError: (err) => {
          pushToast({
            title: 'Lỗi cập nhật trạng thái',
            message:
              err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999],
            variant: 'danger',
          });
        },
      }
    );
  };

  const handleConfirmDelete = () => {
    if (!deletingUser) return;
    const targetName = deletingUser.username;
    deleteUserMutation.mutate(deletingUser.id, {
      onSuccess: () => {
        setDeletingUser(null);
        pushToast({
          title: 'Đã xóa tài khoản',
          message: `Người dùng "${targetName}" đã được xóa khỏi hệ thống.`,
          variant: 'info',
        });
      },
      onError: (err) => {
        pushToast({
          title: 'Không thể xóa người dùng',
          message:
            err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999],
          variant: 'danger',
        });
      },
    });
  };

  const pageData = usersQuery.data;
  const users = pageData?.content ?? [];

  return (
    <div className="page space-y-6">
      {/* Header */}
      <div className="page-header flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>M13</span>
            <span>·</span>
            <span>Quản trị Định danh &amp; Phân vùng (Zone ABAC)</span>
          </div>
          <h1 className="page-title mt-1 flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-600" />
            <span>Quản lý Người dùng &amp; Phân vùng</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="btn-primary"
        >
          <UserPlus className="h-4 w-4" />
          <span>Thêm người dùng</span>
        </button>
      </div>

      {usersQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : usersQuery.isError ? (
        <ErrorBanner
          message={
            usersQuery.error instanceof ApiError
              ? usersQuery.error.message
              : ERROR_MESSAGES_VI[9999]
          }
          onRetry={() => void usersQuery.refetch()}
        />
      ) : users.length === 0 ? (
        <EmptyState
          title="Chưa có người dùng nào"
          description="Danh sách người dùng hiện đang trống. Hãy khởi tạo tài khoản đầu tiên."
          actionLabel="Tạo người dùng mới"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-1/4">Tài khoản</th>
                  <th className="w-1/5">Liên hệ</th>
                  <th className="w-1/5">Vai trò (Roles)</th>
                  <th className="w-1/6">Phân vùng (assignedZones)</th>
                  <th className="w-24 text-center">Trạng thái</th>
                  <th className="w-28 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {u.username}
                      </div>
                      <div className="font-mono text-2xs text-slate-400">
                        {u.id}
                      </div>
                    </td>
                    <td className="text-xs text-slate-600 dark:text-slate-300">
                      <div>{u.email || '—'}</div>
                      <div className="text-2xs text-slate-400">{u.phone || '—'}</div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(u.roles ?? []).map((r) => (
                          <span
                            key={r.name}
                            className="badge-info font-mono text-2xs"
                          >
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {u.assignedZones && u.assignedZones.length > 0 ? (
                          u.assignedZones.map((zone) => (
                            <span
                              key={zone}
                              className="badge-neutral font-mono text-2xs"
                            >
                              {zone}
                            </span>
                          ))
                        ) : (
                          <span className="text-2xs text-slate-400">Toàn cục</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        disabled={toggleStatusMutation.isPending}
                        title={u.active ? 'Nhấn để khóa tài khoản' : 'Nhấn để mở khóa'}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-2xs font-medium transition-colors ${
                          u.active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            u.active ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                          aria-hidden="true"
                        />
                        <span>{u.active ? 'Hoạt động' : 'Đã khóa'}</span>
                      </button>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="btn-secondary btn-sm"
                          title="Sửa thông tin"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingUser(u)}
                          className="btn-sm rounded-md border border-red-200 bg-white px-2 py-1 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                          title="Xóa người dùng"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border-subtle p-3">
            <PaginationBar
              page={pageData?.page ?? page}
              totalPages={pageData?.totalPages ?? 1}
              totalElements={pageData?.totalElements ?? users.length}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}

      {/* Modal tạo mới User */}
      <ModalDialog
        open={createOpen}
        title="Tạo tài khoản người dùng mới"
        description="Thiết lập thông tin đăng nhập, vai trò RBAC và phân vùng quản lý."
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={handleCreateSubmit} className="space-y-3.5">
          {createError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{createError}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="create-username"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Tên đăng nhập (tối thiểu 6 ký tự) *
            </label>
            <input
              id="create-username"
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="VD: nguyen_van_a"
              className="input mt-1"
            />
          </div>

          <div>
            <label
              htmlFor="create-password"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Mật khẩu khởi tạo (tối thiểu 8 ký tự) *
            </label>
            <input
              id="create-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="input mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="create-email"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Email
              </label>
              <input
                id="create-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@library.edu.vn"
                className="input mt-1"
              />
            </div>
            <div>
              <label
                htmlFor="create-phone"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Số điện thoại
              </label>
              <input
                id="create-phone"
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="0912345678"
                className="input mt-1"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Vai trò (Roles)
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {availableRoles.map((r) => (
                <label
                  key={r.name}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border-subtle bg-canvas-subtle px-2.5 py-1 text-xs hover:border-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={newRoles.includes(r.name)}
                    onChange={() =>
                      setNewRoles((prev) => toggleRoleInList(prev, r.name))
                    }
                    className="checkbox"
                  />
                  <span className="font-mono text-2xs font-semibold text-slate-800 dark:text-slate-200">
                    {r.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="create-zones"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Phân vùng quản lý (assignedZones, cách nhau bằng dấu phẩy)
            </label>
            <input
              id="create-zones"
              type="text"
              placeholder="VD: ZONE_FLOOR_2, ZONE_FLOOR_3"
              value={newZonesText}
              onChange={(e) => setNewZonesText(e.target.value)}
              className="input mt-1 font-mono text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="btn-secondary"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="btn-primary"
            >
              {createUserMutation.isPending ? 'Đang tạo...' : 'Tạo người dùng'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal cập nhật User */}
      <ModalDialog
        open={Boolean(editingUser)}
        title={`Cập nhật người dùng: ${editingUser?.username ?? ''}`}
        description="Điều chỉnh thông tin liên hệ, vai trò và phân vùng quản lý."
        onClose={() => setEditingUser(null)}
      >
        <form onSubmit={handleEditSubmit} className="space-y-3.5">
          {editError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{editError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="edit-email"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Email
              </label>
              <input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="user@library.edu.vn"
                className="input mt-1"
              />
            </div>
            <div>
              <label
                htmlFor="edit-phone"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Số điện thoại
              </label>
              <input
                id="edit-phone"
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="0912345678"
                className="input mt-1"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="edit-password"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Đặt lại mật khẩu mới (để trống nếu giữ nguyên, tối thiểu 8 ký tự)
            </label>
            <input
              id="edit-password"
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="••••••••"
              className="input mt-1"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Vai trò (Roles)
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {availableRoles.map((r) => (
                <label
                  key={r.name}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border-subtle bg-canvas-subtle px-2.5 py-1 text-xs hover:border-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={editRoles.includes(r.name)}
                    onChange={() =>
                      setEditRoles((prev) => toggleRoleInList(prev, r.name))
                    }
                    className="checkbox"
                  />
                  <span className="font-mono text-2xs font-semibold text-slate-800 dark:text-slate-200">
                    {r.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="edit-zones"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Phân vùng quản lý (assignedZones, cách nhau bằng dấu phẩy)
            </label>
            <input
              id="edit-zones"
              type="text"
              value={editZonesText}
              onChange={(e) => setEditZonesText(e.target.value)}
              className="input mt-1 font-mono text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setEditingUser(null)}
              className="btn-secondary"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={updateUserMutation.isPending}
              className="btn-primary"
            >
              {updateUserMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Hộp thoại xác nhận xóa (FE-SEC-06) */}
      <ModalDialog
        open={Boolean(deletingUser)}
        title="Xác nhận xóa tài khoản người dùng"
        description={`Bạn có chắc chắn muốn xóa vĩnh viễn tài khoản "${deletingUser?.username ?? ''}"? Thao tác này không thể hoàn tác.`}
        onClose={() => setDeletingUser(null)}
      >
        <div className="flex justify-end gap-2 pt-3">
          <button
            type="button"
            onClick={() => setDeletingUser(null)}
            className="btn-secondary"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirmDelete}
            disabled={deleteUserMutation.isPending}
            className="btn-sm rounded-md bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleteUserMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
