'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { RoomResponse } from '@/types/api';
import { useRoomLatestTelemetryQuery } from '@/features/telemetry/queries';
import { useRoomTelemetryStream } from '@/lib/realtime/use-room-stream';
import { formatMetrics } from '@/lib/format/metrics';
import { formatRelativeTimeVi } from '@/lib/format/datetime';
import { GradeBadge, Skeleton } from '@/components/ui/primitives';

export interface RoomTelemetryCardProps {
  room: RoomResponse;
  stompConnected: boolean;
}

function RoomTelemetryCardComponent({
  room,
  stompConnected,
}: RoomTelemetryCardProps) {
  const [pulsing, setPulsing] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerPulse = useCallback(() => {
    setPulsing(true);
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current);
    }
    pulseTimerRef.current = setTimeout(() => {
      setPulsing(false);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  const { data: latest, isLoading } = useRoomLatestTelemetryQuery(
    room.id,
    stompConnected
  );

  useRoomTelemetryStream(room.id, triggerPulse);

  const overallScore = latest?.comfortScore?.overall ?? null;
  const grade = latest?.comfortScore?.grade ?? 'N/A';

  return (
    <div
      className={`card-interactive flex flex-col justify-between p-4 ${
        pulsing ? 'realtime-pulse' : ''
      }`}
    >
      <div>
        {/* Card Header: Code, Floor, Name & Grade Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-2xs font-medium text-slate-600">
                {room.code}
              </span>
              <span className="text-2xs text-slate-400">
                Tầng {room.floor}
              </span>
            </div>
            <h3 className="mt-1 truncate text-sm font-semibold text-slate-900 group-hover:text-brand-600">
              {room.name}
            </h3>
          </div>
          <GradeBadge grade={grade} score={overallScore} />
        </div>

        {/* Body Content */}
        {isLoading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-6 w-24" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </div>
        ) : latest === null || latest === undefined ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-6 text-center text-slate-400">
            <span className="dot bg-slate-300" />
            <p className="mt-1.5 text-xs">
              Đang chờ bản tin đầu tiên từ trạm đo
            </p>
          </div>
        ) : (
          <div className="mt-3.5 space-y-3">
            {/* Comfort Score Highlight */}
            <div className="flex items-baseline justify-between rounded-lg bg-slate-50/80 px-3 py-2 border border-slate-100">
              <span className="text-xs text-slate-500">
                Điểm tiện nghi
              </span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-lg font-semibold tabular-nums text-slate-900">
                  {formatMetrics.comfortScore(overallScore)}
                </span>
                <span className="text-2xs text-slate-400">/100</span>
              </div>
            </div>

            {/* 6 Key Metrics Grid with Live Threshold Highlighting */}
            <div className="grid grid-cols-3 gap-1.5">
              <div
                className={`rounded-lg border p-2 ${
                  (latest.environment?.temperature ?? 24) > 26
                    ? 'border-red-400 bg-red-50 animate-pulse'
                    : 'border-slate-100 bg-slate-50/40'
                }`}
              >
                <span className="block text-[10px] text-slate-500">Nhiệt độ</span>
                <span
                  className={`mt-0.5 block text-xs font-semibold tabular-nums ${
                    (latest.environment?.temperature ?? 24) > 26
                      ? 'text-red-700'
                      : 'text-slate-800'
                  }`}
                >
                  {formatMetrics.temperature(latest.environment?.temperature)}
                </span>
              </div>
              <div
                className={`rounded-lg border p-2 ${
                  (latest.environment?.humidity ?? 50) > 65
                    ? 'border-red-400 bg-red-50 animate-pulse'
                    : 'border-slate-100 bg-slate-50/40'
                }`}
              >
                <span className="block text-[10px] text-slate-500">Độ ẩm</span>
                <span
                  className={`mt-0.5 block text-xs font-semibold tabular-nums ${
                    (latest.environment?.humidity ?? 50) > 65
                      ? 'text-red-700'
                      : 'text-slate-800'
                  }`}
                >
                  {formatMetrics.humidity(latest.environment?.humidity)}
                </span>
              </div>
              <div
                className={`rounded-lg border p-2 ${
                  (latest.acoustics?.noiseAvg ?? 40) > 55
                    ? 'border-red-400 bg-red-50 animate-pulse'
                    : 'border-slate-100 bg-slate-50/40'
                }`}
              >
                <span className="block text-[10px] text-slate-500">Độ ồn LAeq</span>
                <span
                  className={`mt-0.5 block text-xs font-semibold tabular-nums ${
                    (latest.acoustics?.noiseAvg ?? 40) > 55
                      ? 'text-red-700'
                      : 'text-slate-800'
                  }`}
                >
                  {formatMetrics.noise(latest.acoustics?.noiseAvg)}
                </span>
              </div>
              <div
                className={`rounded-lg border p-2 ${
                  (latest.airQuality?.pm2_5 ?? 10) > 25
                    ? 'border-red-400 bg-red-50 animate-pulse'
                    : 'border-slate-100 bg-slate-50/40'
                }`}
              >
                <span className="block text-[10px] text-slate-500">Bụi PM2.5</span>
                <span
                  className={`mt-0.5 block text-xs font-semibold tabular-nums ${
                    (latest.airQuality?.pm2_5 ?? 10) > 25
                      ? 'text-red-700'
                      : 'text-slate-800'
                  }`}
                >
                  {formatMetrics.pm(latest.airQuality?.pm2_5)}
                </span>
              </div>
              <div
                className={`rounded-lg border p-2 ${
                  (latest.environment?.co2 ?? 485) > 1000
                    ? 'border-red-400 bg-red-50 animate-pulse'
                    : 'border-slate-100 bg-slate-50/40'
                }`}
              >
                <span className="block text-[10px] text-slate-500">Khí CO₂</span>
                <span
                  className={`mt-0.5 block text-xs font-semibold tabular-nums ${
                    (latest.environment?.co2 ?? 485) > 1000
                      ? 'text-red-700'
                      : 'text-slate-800'
                  }`}
                >
                  {formatMetrics.co2(latest.environment?.co2 ?? 485)}
                </span>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/40 p-2">
                <span className="block text-[10px] text-slate-500">Ánh sáng</span>
                <span className="mt-0.5 block text-xs font-semibold tabular-nums text-slate-800">
                  {formatMetrics.lux(latest.environment?.lux ?? 450)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Link to M05 */}
      <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-400">
        <span className="truncate">
          {latest?.timestamp
            ? formatRelativeTimeVi(latest.timestamp)
            : 'Chưa có mẫu đo'}
        </span>
        <Link
          href={`/rooms/${room.id}`}
          className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
        >
          Chi tiết
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

export const RoomTelemetryCard = memo(RoomTelemetryCardComponent);
