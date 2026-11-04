'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  mergeRealtimeTelemetry,
  stompManager,
  upsertRealtimeAlertList,
} from './stomp-client';
import type { AlertResponse, PageResponse, TelemetryResponse } from '@/types/api';

export function useStompConnectionState(): boolean {
  const [connected, setConnected] = useState<boolean>(() =>
    stompManager.isConnected()
  );

  useEffect(() => {
    return stompManager.onConnectionChange(setConnected);
  }, []);

  return connected;
}

/**
 * Subscribes to `/topic/rooms/{roomId}/telemetry` for the lifecycle of the component
 * and updates TanStack Query cache directly (FE-RT-03, FE-RT-04, FE-RT-05).
 */
export function useRoomTelemetryStream(
  roomId: string | null | undefined,
  onPulse?: (latest: TelemetryResponse) => void
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!roomId) return;

    return stompManager.subscribeRoom(roomId, (incoming) => {
      queryClient.setQueryData<TelemetryResponse | null>(
        ['telemetry', 'room-latest', roomId],
        (prev) => mergeRealtimeTelemetry(prev, incoming)
      );
      const deviceId = incoming.metadata?.deviceId;
      if (deviceId) {
        queryClient.setQueryData<TelemetryResponse | null>(
          ['telemetry', 'device-latest', deviceId],
          (prev) => mergeRealtimeTelemetry(prev, incoming)
        );
      }
      onPulse?.(incoming);
    });
  }, [roomId, queryClient, onPulse]);
}

interface AlertListFilterKey {
  roomId?: string;
  type?: string;
  status?: string;
  page?: number;
  size?: number;
}

/**
 * Subscribes to `/topic/alerts` when user has VIEW_ALERTS permission (FE-RT-06, FE-RBAC-05).
 */
export function useGlobalAlertStream(
  enabled: boolean,
  onNewAlert?: (alert: AlertResponse) => void
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    return stompManager.onAlert((incoming) => {
      const existingQueries = queryClient.getQueriesData<
        PageResponse<AlertResponse>
      >({
        queryKey: ['alerts', 'list'],
      });

      for (const [queryKey, prev] of existingQueries) {
        if (!prev) continue;
        const params = (queryKey[2] ?? {}) as AlertListFilterKey;
        const matchesRoom = !params.roomId || params.roomId === incoming.roomId;
        const matchesType = !params.type || params.type === incoming.type;
        const matchesStatus =
          !params.status || params.status === incoming.status;
        const isFirstPage = !params.page || params.page === 0;

        queryClient.setQueryData<PageResponse<AlertResponse>>(queryKey, () => {
          if (!matchesRoom || !matchesType) {
            return prev;
          }
          if (!matchesStatus) {
            return {
              ...prev,
              content: prev.content.filter((a) => a.id !== incoming.id),
            };
          }
          if (!isFirstPage) {
            const existsInPage = prev.content.some((a) => a.id === incoming.id);
            if (!existsInPage) return prev;
            return {
              ...prev,
              content: prev.content.map((a) =>
                a.id === incoming.id ? incoming : a
              ),
            };
          }
          return {
            ...prev,
            content: upsertRealtimeAlertList(prev.content, incoming),
          };
        });
      }

      void queryClient.invalidateQueries({ queryKey: ['alerts', 'unread-count'] });
      onNewAlert?.(incoming);
    });
  }, [enabled, queryClient, onNewAlert]);
}
