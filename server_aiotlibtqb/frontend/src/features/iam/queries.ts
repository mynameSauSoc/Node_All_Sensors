import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { iamApi } from './api';
import type {
  PasswordChangeRequest,
  PermissionRequest,
  RoleRequest,
  UserCreationRequest,
  UserUpdateRequest,
} from '@/types/api';

export const iamKeys = {
  users: (params: { page?: number; size?: number }) =>
    ['iam', 'users', params] as const,
  roles: ['iam', 'roles'] as const,
  permissions: ['iam', 'permissions'] as const,
};

export function useUsersQuery(params: { page?: number; size?: number } = {}) {
  return useQuery({
    queryKey: iamKeys.users(params),
    queryFn: () => iamApi.listUsers(params),
  });
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UserCreationRequest) => iamApi.createUser(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['iam', 'users'] });
    },
  });
}

export function useUpdateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UserUpdateRequest }) =>
      iamApi.updateUser(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['iam', 'users'] });
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (body: PasswordChangeRequest) => iamApi.changePassword(body),
  });
}

export function useToggleUserStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      iamApi.toggleUserStatus(id, { active }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['iam', 'users'] });
    },
  });
}

export function useDeleteUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => iamApi.deleteUser(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['iam', 'users'] });
    },
  });
}

export function useRolesQuery(enabled = true) {
  return useQuery({
    queryKey: iamKeys.roles,
    queryFn: () => iamApi.listRoles(),
    enabled,
  });
}

export function usePermissionsQuery(enabled = true) {
  return useQuery({
    queryKey: iamKeys.permissions,
    queryFn: () => iamApi.listPermissions(),
    enabled,
  });
}

export function useSaveRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      isNew,
      body,
    }: {
      isNew: boolean;
      body: RoleRequest;
    }) => (isNew ? iamApi.createRole(body) : iamApi.updateRole(body.name, body)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iamKeys.roles });
    },
  });
}

export function useDeleteRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => iamApi.deleteRole(name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iamKeys.roles });
    },
  });
}

export function useCreatePermissionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PermissionRequest) => iamApi.createPermission(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iamKeys.permissions });
    },
  });
}

export function useDeletePermissionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => iamApi.deletePermission(name),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: iamKeys.permissions });
    },
  });
}
