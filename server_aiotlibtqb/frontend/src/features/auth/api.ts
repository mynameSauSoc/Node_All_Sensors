import { httpClient } from '@/lib/http/client';
import type {
  AuthenticationRequest,
  AuthenticationResponse,
  LogoutRequest,
  UserCreationRequest,
  UserResponse,
} from '@/types/api';

export const authApi = {
  login: (body: AuthenticationRequest) =>
    httpClient.post<AuthenticationResponse>('/auth/login', body, {
      skipAuth: true,
    }),

  register: (body: UserCreationRequest) =>
    httpClient.post<UserResponse>('/users', body, {
      skipAuth: true,
    }),

  logout: (body: LogoutRequest) =>
    httpClient.post<void>('/auth/logout', body, { skipAuth: true }),

  getMyInfo: () => httpClient.get<UserResponse>('/users/myInfo'),
};
