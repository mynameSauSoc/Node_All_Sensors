import { useQuery } from '@tanstack/react-query';
import { telemetryApi } from './api';
import type { BucketInterval } from '@/types/api';
import { validateBucketRange } from '@/lib/format/metrics';

export const telemetryKeys = {
  summary: ['telemetry', 'summary'] as const,
  roomLatest: (roomId: string) => ['telemetry', 'room-latest', roomId] as const,
  deviceLatest: (deviceId: string) => ['telemetry', 'device-latest', deviceId] as const,
  roomBuckets: (roomId: string, interval: BucketInterval, start: string, end: string) =>
    ['telemetry', 'buckets', roomId, interval, start, end] as const,
  rawHistory: (mode: 'room' | 'device', targetId: string, start: string, end: string) =>
    ['telemetry', 'raw', mode, targetId, start, end] as const,
};

export function useOverviewSummaryQuery(
  enabled = true,
  refetchIntervalMs: number | false = false
) {
  return useQuery({
    queryKey: telemetryKeys.summary,
    queryFn: () => telemetryApi.getOverviewSummary(),
    enabled,
    refetchInterval: refetchIntervalMs,
  });
}

/**
 * FE-RT-04, FE-RT-07, FE-PERF-03:
 * Polls every 15s ONLY when STOMP is disconnected. When STOMP is connected, polling is disabled.
 */
export function useRoomLatestTelemetryQuery(
  roomId: string | undefined,
  stompConnected: boolean
) {
  return useQuery({
    queryKey: telemetryKeys.roomLatest(roomId ?? ''),
    queryFn: () => telemetryApi.getRoomLatest(roomId!),
    enabled: Boolean(roomId),
    refetchInterval: stompConnected ? false : 5000,
  });
}

export function useRoomBucketsQuery(params: {
  roomId: string | undefined;
  interval: BucketInterval;
  start: string;
  end: string;
}) {
  const check = validateBucketRange(params.start, params.end, params.interval);
  return useQuery({
    queryKey: telemetryKeys.roomBuckets(
      params.roomId ?? '',
      params.interval,
      params.start,
      params.end
    ),
    queryFn: () =>
      telemetryApi.getRoomBuckets({
        roomId: params.roomId!,
        interval: params.interval,
        start: params.start,
        end: params.end,
      }),
    enabled: Boolean(params.roomId) && check.valid,
  });
}

export function useRawTelemetryQuery(params: {
  mode: 'room' | 'device';
  targetId: string;
  start: string;
  end: string;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: telemetryKeys.rawHistory(
      params.mode,
      params.targetId,
      params.start,
      params.end
    ),
    queryFn: () =>
      params.mode === 'room'
        ? telemetryApi.getRoomRawHistory({
            roomId: params.targetId,
            start: params.start,
            end: params.end,
          })
        : telemetryApi.getDeviceRawHistory({
            deviceId: params.targetId,
            start: params.start,
            end: params.end,
          }),
    enabled: params.enabled && Boolean(params.targetId),
  });
}
