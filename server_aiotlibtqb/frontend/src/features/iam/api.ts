import { httpClient } from '@/lib/http/client';
import type {
  PageResponse,
  PasswordChangeRequest,
  PermissionRequest,
  PermissionResponse,
  RoleRequest,
  RoleResponse,
  UserCreationRequest,
  UserResponse,
  UserStatusRequest,
  UserUpdateRequest,
} from '@/types/api';

export const iamApi = {
  listUsers: (params: { page?: number; size?: number } = {}) => {
    const search = new URLSearchParams();
    search.set('page', String(params.page ?? 0));
    search.set('size', String(params.size ?? 10));
    return httpClient.get<PageResponse<UserResponse>>(
      `/users?${search.toString()}`
    );
  },

  getUserById: (id: string) => httpClient.get<UserResponse>(`/users/${id}`),

  createUser: (body: UserCreationRequest) =>
    httpClient.post<UserResponse>('/users', body),

  updateUser: (id: string, body: UserUpdateRequest) =>
    httpClient.put<UserResponse>(`/users/${id}`, body),

  changePassword: (body: PasswordChangeRequest) =>
    httpClient.post<void>('/users/change-password', body),

  toggleUserStatus: (id: string, body: UserStatusRequest) =>
    httpClient.patch<UserResponse>(`/users/${id}/status`, body),

  deleteUser: (id: string) => httpClient.delete<string>(`/users/${id}`),

  listRoles: () => httpClient.get<RoleResponse[]>('/roles'),

  createRole: (body: RoleRequest) =>
    httpClient.post<RoleResponse>('/roles', body),

  updateRole: (name: string, body: RoleRequest) =>
    httpClient.put<RoleResponse>(`/roles/${encodeURIComponent(name)}`, body),

  deleteRole: (name: string) =>
    httpClient.delete<void>(`/roles/${encodeURIComponent(name)}`),

  listPermissions: () => httpClient.get<PermissionResponse[]>('/permissions'),

  createPermission: (body: PermissionRequest) =>
    httpClient.post<PermissionResponse>('/permissions', body),

  deletePermission: (name: string) =>
    httpClient.delete<void>(`/permissions/${encodeURIComponent(name)}`),
};
