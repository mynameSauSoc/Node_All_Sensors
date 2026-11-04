import { useMutation, useQuery } from '@tanstack/react-query';
import { authApi } from './api';
import type {
  AuthenticationRequest,
  LogoutRequest,
  UserCreationRequest,
} from '@/types/api';

export const authKeys = {
  myInfo: ['auth', 'myInfo'] as const,
};

export function useMyInfoQuery(enabled = true) {
  return useQuery({
    queryKey: authKeys.myInfo,
    queryFn: () => authApi.getMyInfo(),
    enabled,
  });
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: (body: AuthenticationRequest) => authApi.login(body),
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (body: UserCreationRequest) => authApi.register(body),
  });
}

export function useLogoutMutation() {
  return useMutation({
    mutationFn: (body: LogoutRequest) => authApi.logout(body),
  });
}
