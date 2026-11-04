import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { devicesApi } from './api';
import type {
  DeviceRegistrationRequest,
  DeviceUpdateRequest,
} from '@/types/api';

export const deviceKeys = {
  all: ['devices'] as const,
  list: (params: {
    page?: number;
    size?: number;
    zoneId?: string;
    roomId?: string;
  }) => ['devices', 'list', params] as const,
  detail: (id: string) => ['devices', 'detail', id] as const,
  discovered: ['devices', 'discovered'] as const,
};

export function useDevicesQuery(
  params: {
    page?: number;
    size?: number;
    zoneId?: string;
    roomId?: string;
  } = {},
  enabled = true
) {
  return useQuery({
    queryKey: deviceKeys.list(params),
    queryFn: () => devicesApi.list(params),
    enabled,
  });
}

export function useDeviceDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: deviceKeys.detail(id ?? ''),
    queryFn: () => devicesApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useDiscoveredDevicesQuery(enabled = true) {
  return useQuery({
    queryKey: deviceKeys.discovered,
    queryFn: () => devicesApi.listDiscovered(),
    enabled,
    refetchInterval: 15000,
  });
}

/**
 * FE-SEC-02: Never persist rawApiKey in React Query cache (gcTime: 0).
 */
export function useRegisterDeviceMutation() {
  const qc = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: (body: DeviceRegistrationRequest) => devicesApi.register(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deviceKeys.all });
    },
  });
}

export function useUpdateDeviceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: DeviceUpdateRequest }) =>
      devicesApi.update(id, body),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: deviceKeys.all });
      void qc.invalidateQueries({ queryKey: deviceKeys.detail(vars.id) });
    },
  });
}

export function useRegenerateDeviceKeyMutation() {
  return useMutation({
    gcTime: 0,
    mutationFn: (id: string) => devicesApi.regenerateKey(id),
  });
}

export function useToggleDeviceStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      devicesApi.toggleStatus(id, active),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deviceKeys.all });
    },
  });
}

export function useDeleteDeviceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => devicesApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deviceKeys.all });
    },
  });
}
