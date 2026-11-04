'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldPlus,
  Key,
  Plus,
  Trash2,
  Check,
  Save,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import {
  useCreatePermissionMutation,
  useDeletePermissionMutation,
  useDeleteRoleMutation,
  usePermissionsQuery,
  useRolesQuery,
  useSaveRoleMutation,
} from '@/features/iam/queries';
import { ApiError } from '@/lib/http/error-mapper';
import { ERROR_MESSAGES_VI } from '@/messages/vi';
import {
  EmptyState,
  ErrorBanner,
  ModalDialog,
  Skeleton,
  useToast,
} from '@/components/ui/primitives';
import type { RoleResponse } from '@/types/api';

export default function AdminRolesPage() {
  const capabilities = useAuthStore((s) => s.capabilities);
  const { pushToast } = useToast();

  const rolesQuery = useRolesQuery(capabilities.canManageRoles);
  const permissionsQuery = usePermissionsQuery(capabilities.canManageRoles);

  const saveRoleMutation = useSaveRoleMutation();
  const deleteRoleMutation = useDeleteRoleMutation();
  const createPermissionMutation = useCreatePermissionMutation();
  const deletePermissionMutation = useDeletePermissionMutation();

  // Local editable matrix: roleName -> Set of permission names
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [savingRoleName, setSavingRoleName] = useState<string | null>(null);

  // Create Role modal
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');

  // Create Permission modal
  const [createPermOpen, setCreatePermOpen] = useState(false);
  const [newPermName, setNewPermName] = useState('');
  const [newPermDesc, setNewPermDesc] = useState('');

  // Confirm delete Role / Permission
  const [deletingRoleName, setDeletingRoleName] = useState<string | null>(null);
  const [deletingPermName, setDeletingPermName] = useState<string | null>(null);

  useEffect(() => {
    if (rolesQuery.data) {
      const next: Record<string, string[]> = {};
      for (const r of rolesQuery.data) {
        next[r.name] = (r.permissions ?? []).map((p) => p.name);
      }
      setMatrix(next);
    }
  }, [rolesQuery.data]);

  if (!capabilities.canManageRoles) {
    return (
      <div className="page max-w-5xl">
        <ErrorBanner message={ERROR_MESSAGES_VI[1007]} />
      </div>
    );
  }

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];

  const handleToggleCell = (roleName: string, permName: string) => {
    setMatrix((prev) => {
      const current = prev[roleName] ?? [];
      const updated = current.includes(permName)
        ? current.filter((p) => p !== permName)
        : [...current, permName];
      return { ...prev, [roleName]: updated };
    });
  };

  const handleSaveRoleColumn = (role: RoleResponse) => {
    const selectedPermissions = matrix[role.name] ?? [];
    setSavingRoleName(role.name);
    saveRoleMutation.mutate(
      {
        isNew: false,
        body: {
          name: role.name,
          description: role.description,
          permissions: selectedPermissions,
        },
      },
      {
        onSuccess: () => {
          setSavingRoleName(null);
          pushToast({
            title: 'Đã lưu ma trận quyền',
            message: `Vai trò "${role.name}" đã được cập nhật quyền hạn.`,
            variant: 'success',
          });
        },
        onError: (err) => {
          setSavingRoleName(null);
          pushToast({
            title: 'Lỗi lưu vai trò',
            message:
              err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999],
            variant: 'danger',
          });
        },
      }
    );
  };

  const handleCreateRole = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = newRoleName.trim().toUpperCase();
    if (!trimmed) return;

    saveRoleMutation.mutate(
      {
        isNew: true,
        body: {
          name: trimmed,
          description: newRoleDesc.trim(),
          permissions: [],
        },
      },
      {
        onSuccess: () => {
          setCreateRoleOpen(false);
          setNewRoleName('');
          setNewRoleDesc('');
          pushToast({
            title: 'Đã tạo vai trò mới',
            message: `Vai trò "${trimmed}" đã được thêm vào hệ thống.`,
            variant: 'success',
          });
        },
        onError: (err) => {
          pushToast({
            title: 'Lỗi tạo vai trò',
            message:
              err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999],
            variant: 'danger',
          });
        },
      }
    );
  };

  const handleCreatePermission = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = newPermName.trim().toUpperCase();
    if (!trimmed) return;

    createPermissionMutation.mutate(
      {
        name: trimmed,
        description: newPermDesc.trim(),
      },
      {
        onSuccess: () => {
          setCreatePermOpen(false);
          setNewPermName('');
          setNewPermDesc('');
          pushToast({
            title: 'Đã tạo quyền hạn mới',
            message: `Quyền "${trimmed}" đã được kích hoạt.`,
            variant: 'success',
          });
        },
        onError: (err) => {
          pushToast({
            title: 'Lỗi tạo quyền hạn',
            message:
              err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999],
            variant: 'danger',
          });
        },
      }
    );
  };

  const handleConfirmDeleteRole = () => {
    if (!deletingRoleName) return;
    const target = deletingRoleName;
    deleteRoleMutation.mutate(target, {
      onSuccess: () => {
        setDeletingRoleName(null);
        pushToast({
          title: 'Đã xóa vai trò',
          message: `Vai trò "${target}" đã được gỡ khỏi hệ thống.`,
          variant: 'info',
        });
      },
      onError: (err) => {
        setDeletingRoleName(null);
        pushToast({
          title: 'Không thể xóa vai trò',
          message:
            err instanceof ApiError ? err.message : ERROR_MESSAGES_VI[9999],
          variant: 'danger',
        });
      },
    });
  };

  const handleConfirmDeletePermission = () => {
    if (!deletingPermName) return;
    const target = deletingPermName;
    deletePermissionMutation.mutate(target, {
      onSuccess: () => {
        setDeletingPermName(null);
        pushToast({
          title: 'Đã xóa quyền hạn',
          message: `Quyền "${target}" đã được xóa khỏi hệ thống.`,
          variant: 'info',
        });
      },
      onError: (err) => {
        setDeletingPermName(null);
        const msg =
          err instanceof ApiError
            ? err.code === 2005
              ? ERROR_MESSAGES_VI[2005]
              : err.message
            : ERROR_MESSAGES_VI[9999];
        pushToast({
          title: 'Không thể xóa quyền hạn',
          message: msg,
          variant: 'danger',
        });
      },
    });
  };

  const isLoading = rolesQuery.isLoading || permissionsQuery.isLoading;
  const isError = rolesQuery.isError || permissionsQuery.isError;

  return (
    <div className="page space-y-6">
      {/* Header */}
      <div className="page-header flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>M14</span>
            <span>·</span>
            <span>Quản trị Ma trận Phân quyền (RBAC Matrix)</span>
          </div>
          <h1 className="page-title mt-1 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
            <span>Ma trận Vai trò &amp; Quyền hạn RBAC</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreatePermOpen(true)}
            className="btn-secondary"
          >
            <Key className="h-4 w-4" />
            <span>Thêm Quyền hạn</span>
          </button>
          <button
            type="button"
            onClick={() => setCreateRoleOpen(true)}
            className="btn-primary"
          >
            <ShieldPlus className="h-4 w-4" />
            <span>Thêm Vai trò</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isError ? (
        <ErrorBanner
          message={ERROR_MESSAGES_VI[9999]}
          onRetry={() => {
            void rolesQuery.refetch();
            void permissionsQuery.refetch();
          }}
        />
      ) : roles.length === 0 || permissions.length === 0 ? (
        <EmptyState
          title="Chưa đủ dữ liệu Ma trận RBAC"
          description="Hãy khởi tạo ít nhất một Vai trò (Role) và một Quyền hạn (Permission) để cấu hình ma trận."
          actionLabel="Thêm Vai trò mới"
          onAction={() => setCreateRoleOpen(true)}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="min-w-64 bg-canvas-subtle/80">
                    Quyền hạn (Permissions) \ Vai trò (Roles)
                  </th>
                  {roles.map((role) => (
                    <th
                      key={role.name}
                      className="min-w-36 text-center align-top"
                    >
                      <div className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                        {role.name}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-2xs font-normal text-slate-500">
                        {role.description || 'Chưa có mô tả'}
                      </div>
                      <div className="mt-2.5 flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveRoleColumn(role)}
                          disabled={
                            saveRoleMutation.isPending &&
                            savingRoleName === role.name
                          }
                          className="btn-primary btn-sm"
                          title={`Lưu quyền cho vai trò ${role.name}`}
                        >
                          <Save className="h-3 w-3" />
                          <span>
                            {saveRoleMutation.isPending &&
                            savingRoleName === role.name
                              ? 'Đang lưu...'
                              : 'Lưu'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingRoleName(role.name)}
                          aria-label={`Xóa vai trò ${role.name}`}
                          className="btn-sm rounded-md border border-red-200 bg-white px-2 py-1 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-slate-900 dark:text-red-400 dark:hover:bg-red-950/40"
                          title="Xóa vai trò"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm) => (
                  <tr key={perm.name}>
                    <td className="bg-canvas-subtle/30">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                            {perm.name}
                          </div>
                          <div className="text-2xs text-slate-400">
                            {perm.description || 'Không có mô tả chi tiết'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDeletingPermName(perm.name)}
                          aria-label={`Xóa quyền ${perm.name}`}
                          className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title="Xóa quyền"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    {roles.map((role) => {
                      const checked = (matrix[role.name] ?? []).includes(
                        perm.name
                      );
                      return (
                        <td key={role.name} className="text-center">
                          <input
                            type="checkbox"
                            aria-label={`Gán quyền ${perm.name} cho vai trò ${role.name}`}
                            checked={checked}
                            onChange={() =>
                              handleToggleCell(role.name, perm.name)
                            }
                            className="checkbox"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal tạo Role mới */}
      <ModalDialog
        open={createRoleOpen}
        title="Tạo Vai trò (Role) mới"
        description="Tên vai trò sẽ tự động chuẩn hóa chữ in hoa."
        onClose={() => setCreateRoleOpen(false)}
      >
        <form onSubmit={handleCreateRole} className="space-y-3.5">
          <div>
            <label
              htmlFor="new-role-name"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Mã Vai trò (VD: AUDITOR) *
            </label>
            <input
              id="new-role-name"
              type="text"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="VD: AUDITOR"
              className="input mt-1 font-mono uppercase"
            />
          </div>
          <div>
            <label
              htmlFor="new-role-desc"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Mô tả chức năng
            </label>
            <input
              id="new-role-desc"
              type="text"
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              placeholder="VD: Kiểm toán viên tra cứu nhật ký"
              className="input mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setCreateRoleOpen(false)}
              className="btn-secondary"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saveRoleMutation.isPending}
              className="btn-primary"
            >
              {saveRoleMutation.isPending ? 'Đang tạo...' : 'Tạo Vai trò'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal tạo Permission mới */}
      <ModalDialog
        open={createPermOpen}
        title="Tạo Quyền hạn (Permission) mới"
        description="Thêm quyền hạn hạt mịn vào danh mục hệ thống."
        onClose={() => setCreatePermOpen(false)}
      >
        <form onSubmit={handleCreatePermission} className="space-y-3.5">
          <div>
            <label
              htmlFor="new-perm-name"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Mã Quyền hạn (VD: EXPORT_AUDIT_LOG) *
            </label>
            <input
              id="new-perm-name"
              type="text"
              value={newPermName}
              onChange={(e) => setNewPermName(e.target.value)}
              placeholder="VD: EXPORT_AUDIT_LOG"
              className="input mt-1 font-mono uppercase"
            />
          </div>
          <div>
            <label
              htmlFor="new-perm-desc"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Mô tả quyền hạn
            </label>
            <input
              id="new-perm-desc"
              type="text"
              value={newPermDesc}
              onChange={(e) => setNewPermDesc(e.target.value)}
              placeholder="VD: Cho phép xuất báo cáo kiểm toán ra file"
              className="input mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setCreatePermOpen(false)}
              className="btn-secondary"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createPermissionMutation.isPending}
              className="btn-primary"
            >
              {createPermissionMutation.isPending ? 'Đang tạo...' : 'Tạo Quyền hạn'}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Xác nhận xóa Role */}
      <ModalDialog
        open={Boolean(deletingRoleName)}
        title="Xác nhận xóa Vai trò"
        description={`Bạn có chắc chắn muốn xóa vai trò "${deletingRoleName ?? ''}"?`}
        onClose={() => setDeletingRoleName(null)}
      >
        <div className="flex justify-end gap-2 pt-3">
          <button
            type="button"
            onClick={() => setDeletingRoleName(null)}
            className="btn-secondary"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirmDeleteRole}
            disabled={deleteRoleMutation.isPending}
            className="btn-sm rounded-md bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleteRoleMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </ModalDialog>

      {/* Xác nhận xóa Permission */}
      <ModalDialog
        open={Boolean(deletingPermName)}
        title="Xác nhận xóa Quyền hạn"
        description={`Bạn có chắc chắn muốn xóa quyền hạn "${deletingPermName ?? ''}"? Lưu ý: Hệ thống sẽ từ chối (mã 2005) nếu quyền này đang được gán cho bất kỳ vai trò nào.`}
        onClose={() => setDeletingPermName(null)}
      >
        <div className="flex justify-end gap-2 pt-3">
          <button
            type="button"
            onClick={() => setDeletingPermName(null)}
            className="btn-secondary"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleConfirmDeletePermission}
            disabled={deletePermissionMutation.isPending}
            className="btn-sm rounded-md bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deletePermissionMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
