import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alertsApi, type AlertFilterParams } from './api';

export const alertKeys = {
  all: ['alerts'] as const,
  list: (params: AlertFilterParams) => ['alerts', 'list', params] as const,
  unreadCount: ['alerts', 'unread-count'] as const,
};

export function useAlertsQuery(params: AlertFilterParams = {}, enabled = true) {
  return useQuery({
    queryKey: alertKeys.list(params),
    queryFn: () => alertsApi.list(params),
    enabled,
  });
}

export function useUnreadAlertsCountQuery(enabled = true) {
  return useQuery({
    queryKey: alertKeys.unreadCount,
    queryFn: () => alertsApi.getUnreadCount(),
    enabled,
  });
}

export function useAcknowledgeAlertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.acknowledge(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: alertKeys.all });
    },
  });
}

export function useResolveAlertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.resolve(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: alertKeys.all });
    },
  });
}
