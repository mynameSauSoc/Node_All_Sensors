import { httpClient } from '@/lib/http/client';
import type {
  BucketInterval,
  TelemetryBucketResponse,
  TelemetryResponse,
  TelemetrySummaryResponse,
} from '@/types/api';

export const telemetryApi = {
  getOverviewSummary: () =>
    httpClient.get<TelemetrySummaryResponse>('/telemetry/overview/summary'),

  getRoomLatest: (roomId: string) =>
    httpClient.get<TelemetryResponse | null>(
      `/telemetry/room/${encodeURIComponent(roomId)}/latest`
    ),

  getDeviceLatest: (deviceId: string) =>
    httpClient.get<TelemetryResponse | null>(
      `/telemetry/device/${encodeURIComponent(deviceId)}/latest`
    ),

  getRoomBuckets: (params: {
    roomId: string;
    interval: BucketInterval;
    start: string;
    end: string;
  }) => {
    const search = new URLSearchParams({
      interval: params.interval,
      start: params.start,
      end: params.end,
    });
    return httpClient.get<TelemetryBucketResponse>(
      `/telemetry/room/${encodeURIComponent(params.roomId)}/buckets?${search.toString()}`
    );
  },

  getRoomRawHistory: (params: { roomId: string; start: string; end: string }) => {
    const search = new URLSearchParams({
      start: params.start,
      end: params.end,
    });
    return httpClient.get<TelemetryResponse[]>(
      `/telemetry/room/${encodeURIComponent(params.roomId)}?${search.toString()}`
    );
  },

  getDeviceRawHistory: (params: {
    deviceId: string;
    start: string;
    end: string;
  }) => {
    const search = new URLSearchParams({
      start: params.start,
      end: params.end,
    });
    return httpClient.get<TelemetryResponse[]>(
      `/telemetry/device/${encodeURIComponent(params.deviceId)}?${search.toString()}`
    );
  },
};
