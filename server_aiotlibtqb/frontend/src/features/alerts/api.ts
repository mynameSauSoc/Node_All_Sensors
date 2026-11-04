import { httpClient } from '@/lib/http/client';
import type {
  AlertResponse,
  AlertStatus,
  AlertType,
  PageResponse,
} from '@/types/api';

export interface AlertFilterParams {
  roomId?: string;
  type?: AlertType | '';
  status?: AlertStatus | '';
  page?: number;
  size?: number;
}

export const alertsApi = {
  list: (params: AlertFilterParams = {}) => {
    const search = new URLSearchParams();
    search.set('page', String(params.page ?? 0));
    search.set('size', String(params.size ?? 10));
    if (params.roomId) search.set('roomId', params.roomId);
    if (params.type) search.set('type', params.type);
    if (params.status) search.set('status', params.status);
    return httpClient.get<PageResponse<AlertResponse>>(
      `/alerts?${search.toString()}`
    );
  },

  getUnreadCount: () => httpClient.get<number>('/alerts/unread-count'),

  acknowledge: (id: string) =>
    httpClient.patch<AlertResponse>(`/alerts/${id}/acknowledge`),

  resolve: (id: string) =>
    httpClient.patch<AlertResponse>(`/alerts/${id}/resolve`),
};
