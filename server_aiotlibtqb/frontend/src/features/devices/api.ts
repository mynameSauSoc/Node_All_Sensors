import { httpClient } from '@/lib/http/client';
import type {
  DeviceRegistrationRequest,
  DeviceRegistrationResponse,
  DeviceResponse,
  DeviceUpdateRequest,
  DiscoveredDeviceResponse,
  PageResponse,
} from '@/types/api';

export const devicesApi = {
  list: (
    params: {
      page?: number;
      size?: number;
      zoneId?: string;
      roomId?: string;
    } = {}
  ) => {
    const search = new URLSearchParams();
    search.set('page', String(params.page ?? 0));
    search.set('size', String(params.size ?? 10));
    if (params.zoneId) search.set('zoneId', params.zoneId);
    if (params.roomId) search.set('roomId', params.roomId);
    return httpClient.get<PageResponse<DeviceResponse>>(
      `/devices?${search.toString()}`
    );
  },

  getById: (id: string) => httpClient.get<DeviceResponse>(`/devices/${id}`),

  listByZone: (zoneId: string) =>
    httpClient.get<DeviceResponse[]>(
      `/devices/zone/${encodeURIComponent(zoneId)}`
    ),

  listDiscovered: () =>
    httpClient.get<DiscoveredDeviceResponse[]>('/devices/discovered'),

  register: (body: DeviceRegistrationRequest) =>
    httpClient.post<DeviceRegistrationResponse>('/devices/register', body),

  update: (id: string, body: DeviceUpdateRequest) =>
    httpClient.put<DeviceResponse>(`/devices/${id}`, body),

  regenerateKey: (id: string) =>
    httpClient.post<DeviceRegistrationResponse>(
      `/devices/${id}/regenerate-key`
    ),

  toggleStatus: (id: string, active: boolean) =>
    httpClient.patch<DeviceResponse>(
      `/devices/${id}/status?active=${String(active)}`
    ),

  remove: (id: string) => httpClient.delete<void>(`/devices/${id}`),
};
