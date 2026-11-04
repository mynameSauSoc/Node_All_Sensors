'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import {
  Download,
  History,
  LayoutGrid,
  Search,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { useRoomsQuery } from '@/features/rooms/queries';
import { useDevicesQuery } from '@/features/devices/queries';
import {
  telemetryKeys,
  useRawTelemetryQuery,
} from '@/features/telemetry/queries';
import { telemetryApi } from '@/features/telemetry/api';
import {
  escapeCsvCell,
  formatMetrics,
  getLibrarianActionGuide,
} from '@/lib/format/metrics';
import { formatVietnamDateTime } from '@/lib/format/datetime';
import { ERROR_MESSAGES_VI } from '@/messages/vi';
import {
  EmptyState,
  ErrorBanner,
  GradeBadge,
  Skeleton,
  useToast,
} from '@/components/ui/primitives';
import type { RoomResponse, TelemetryResponse } from '@/types/api';

const MAX_RAW_QUERY_MS = 24 * 3600 * 1000; // 24 hours (FE-API-11)

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TelemetryExplorerPage() {
  const capabilities = useAuthStore((s) => s.capabilities);
  const { pushToast } = useToast();

  const [viewTab, setViewTab] = useState<'matrix' | 'raw'>('matrix');
  const [matrixSort, setMatrixSort] = useState<
    'score_asc' | 'noise_desc' | 'co2_desc' | 'floor_asc'
  >('score_asc');

  const [mode, setMode] = useState<'room' | 'device'>('room');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [startLocal, setStartLocal] = useState<string>(() => {
    const d = new Date(Date.now() - 2 * 3600 * 1000); // Default last 2 hours
    return toLocalDateTimeInputValue(d);
  });
  const [endLocal, setEndLocal] = useState<string>(() =>
    toLocalDateTimeInputValue(new Date())
  );

  const [committedParams, setCommittedParams] = useState<{
    mode: 'room' | 'device';
    targetId: string;
    start: string;
    end: string;
  } | null>(null);

  const roomsQuery = useRoomsQuery({ page: 0, size: 100 });
  const devicesQuery = useDevicesQuery(
    { page: 0, size: 100 },
    capabilities.canViewRawTelemetry && capabilities.canViewDevices
  );

  const rooms = useMemo(
    () => roomsQuery.data?.content ?? [],
    [roomsQuery.data]
  );
  const devices = useMemo(
    () => devicesQuery.data?.content ?? [],
    [devicesQuery.data]
  );

  const roomLatestQueries = useQueries({
    queries: rooms.map((room) => ({
      queryKey: telemetryKeys.roomLatest(room.id),
      queryFn: () => telemetryApi.getRoomLatest(room.id),
      enabled: viewTab === 'matrix' && Boolean(room.id),
      staleTime: 10000,
      refetchInterval: 10000,
    })),
  });

  const matrixRows = useMemo(() => {
    const list = rooms.map((room, idx) => {
      const latest = roomLatestQueries[idx]?.data ?? null;
      return {
        room,
        latest,
        score: latest?.comfortScore?.overall ?? 100,
        noise: latest?.acoustics?.noiseAvg ?? 0,
        co2: latest?.environment?.co2 ?? 480,
      };
    });

    return list.sort((a, b) => {
      if (matrixSort === 'score_asc') return a.score - b.score;
      if (matrixSort === 'noise_desc') return b.noise - a.noise;
      if (matrixSort === 'co2_desc') return b.co2 - a.co2;
      return a.room.floor - b.room.floor;
    });
  }, [rooms, roomLatestQueries, matrixSort]);

  useEffect(() => {
    if (mode === 'room') {
      if (rooms.length > 0 && !rooms.some((r) => r.id === selectedTargetId)) {
        setSelectedTargetId(rooms[0].id);
      }
    } else {
      if (
        devices.length > 0 &&
        !devices.some((d) => d.id === selectedTargetId)
      ) {
        setSelectedTargetId(devices[0].id);
      }
    }
  }, [mode, rooms, devices, selectedTargetId]);

  const timeWindowValidation = useMemo(() => {
    const startMs = new Date(startLocal).getTime();
    const endMs = new Date(endLocal).getTime();

    if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) {
      return {
        valid: false,
        message: ERROR_MESSAGES_VI[7001],
        durationHours: 0,
      };
    }

    const diffMs = endMs - startMs;
    const durationHours = diffMs / (3600 * 1000);

    if (diffMs > MAX_RAW_QUERY_MS) {
      return {
        valid: false,
        message: `Khoảng thời gian tra cứu dữ liệu thô vượt quá giới hạn 24 giờ (${durationHours.toFixed(
          1
        )} giờ). Vui lòng thu hẹp phạm vi ≤ 24 giờ để bảo vệ hiệu năng hệ thống.`,
        durationHours,
      };
    }

    return {
      valid: true,
      message: null,
      durationHours,
      startIso: new Date(startMs).toISOString(),
      endIso: new Date(endMs).toISOString(),
    };
  }, [startLocal, endLocal]);

  const rawQuery = useRawTelemetryQuery({
    mode: committedParams?.mode ?? mode,
    targetId: committedParams?.targetId ?? '',
    start: committedParams?.start ?? '',
    end: committedParams?.end ?? '',
    enabled:
      capabilities.canViewRawTelemetry &&
      Boolean(committedParams?.targetId) &&
      Boolean(committedParams?.start) &&
      Boolean(committedParams?.end),
  });

  const handleRunQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeWindowValidation.valid || !selectedTargetId) return;
    setCommittedParams({
      mode,
      targetId: selectedTargetId,
      start: timeWindowValidation.startIso!,
      end: timeWindowValidation.endIso!,
    });
  };

  const handleExportCsv = () => {
    const records: TelemetryResponse[] = rawQuery.data ?? [];
    if (records.length === 0) return;

    const headers = [
      'timestamp',
      'hardwareId',
      'roomId',
      'temperature',
      'humidity',
      'lux',
      'noiseAvg',
      'noisePeak',
      'pm1_0',
      'pm2_5',
      'pm10',
      'comfortScore',
      'grade',
      'wifiRssi',
    ];

    const rows = records.map((row) =>
      [
        row.timestamp,
        row.metadata?.hardwareId ?? '',
        row.metadata?.roomId ?? '',
        row.environment?.temperature ?? '',
        row.environment?.humidity ?? '',
        row.environment?.lux ?? '',
        row.acoustics?.noiseAvg ?? '',
        row.acoustics?.noisePeak ?? '',
        row.airQuality?.pm1_0 ?? '',
        row.airQuality?.pm2_5 ?? '',
        row.airQuality?.pm10 ?? '',
        row.comfortScore?.overall ?? '',
        row.comfortScore?.grade ?? '',
        row.wifiRssi ?? '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeTarget = committedParams?.targetId ?? 'telemetry';
    link.download = `aiot-raw-telemetry-${safeTarget}-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    pushToast({
      title: 'Xuất CSV thành công',
      message: `Đã kết xuất ${records.length} bản ghi dữ liệu cảm biến thô.`,
      variant: 'success',
    });
  };

  if (!capabilities.canViewRawTelemetry) {
    return (
      <div className="page">
        <ErrorBanner message={ERROR_MESSAGES_VI[1007]} />
      </div>
    );
  }

  const records = rawQuery.data ?? [];

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Trung tâm Dữ liệu Cảm biến Toàn Thư viện &amp; Tra cứu Lịch sử
          </h1>
          <p className="page-subtitle">
            Giám sát bảng ma trận đa phòng thời gian thực hoặc truy vấn gói tin gốc xuất CSV (tối đa 24 giờ)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === 'matrix'}
              onClick={() => setViewTab('matrix')}
              className={`segmented-item inline-flex items-center gap-1.5 ${
                viewTab === 'matrix' ? 'segmented-item-active' : ''
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Bảng Tổng quan Đa phòng (Live)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewTab === 'raw'}
              onClick={() => setViewTab('raw')}
              className={`segmented-item inline-flex items-center gap-1.5 ${
                viewTab === 'raw' ? 'segmented-item-active' : ''
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Tra cứu Lịch sử 24h &amp; CSV</span>
            </button>
          </div>

          {viewTab === 'raw' && (
            <button
              type="button"
              disabled={records.length === 0 || rawQuery.isLoading}
              onClick={handleExportCsv}
              className="btn-secondary btn-sm"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Xuất CSV</span>
              {records.length > 0 && (
                <span className="tabular">({records.length})</span>
              )}
            </button>
          )}
        </div>
      </div>

      {viewTab === 'matrix' ? (
        <div className="space-y-4">
          {/* Matrix Controls & Sort Bar */}
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Bảng Ma trận So sánh 12 Phòng đọc Thời gian thực
              </h2>
              <p className="text-xs text-slate-500">
                Giúp Thủ thư nhìn bao quát toàn bộ thư viện trong 1 màn hình mà không cần chọn từng phòng
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500 font-medium">Sắp xếp nhanh:</span>
              <button
                type="button"
                onClick={() => setMatrixSort('score_asc')}
                className={`btn-sm rounded border px-2.5 py-1 ${
                  matrixSort === 'score_asc'
                    ? 'border-brand-600 bg-brand-600 text-white font-semibold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                Cần chú ý nhất trước
              </button>
              <button
                type="button"
                onClick={() => setMatrixSort('noise_desc')}
                className={`btn-sm rounded border px-2.5 py-1 ${
                  matrixSort === 'noise_desc'
                    ? 'border-brand-600 bg-brand-600 text-white font-semibold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                Độ ồn cao nhất
              </button>
              <button
                type="button"
                onClick={() => setMatrixSort('co2_desc')}
                className={`btn-sm rounded border px-2.5 py-1 ${
                  matrixSort === 'co2_desc'
                    ? 'border-brand-600 bg-brand-600 text-white font-semibold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                Khí CO₂ cao nhất
              </button>
              <button
                type="button"
                onClick={() => setMatrixSort('floor_asc')}
                className={`btn-sm rounded border px-2.5 py-1 ${
                  matrixSort === 'floor_asc'
                    ? 'border-brand-600 bg-brand-600 text-white font-semibold'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                Theo Tầng (1 → 5)
              </button>
            </div>
          </div>

          <div className="card">
            {roomsQuery.isLoading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Phòng đọc &amp; Tầng</th>
                      <th>Trạm đo</th>
                      <th className="text-right">Điểm LCS</th>
                      <th className="text-right">Nhiệt độ</th>
                      <th className="text-right">Độ ẩm</th>
                      <th className="text-right">Khí CO₂</th>
                      <th className="text-right">Độ ồn LAeq</th>
                      <th className="text-right">Bụi PM2.5</th>
                      <th className="text-right">Ánh sáng</th>
                      <th>Đánh giá &amp; Chỉ dẫn Thủ thư</th>
                      <th className="text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map(({ room, latest }) => {
                      const temp = latest?.environment?.temperature ?? null;
                      const hum = latest?.environment?.humidity ?? null;
                      const co2 = latest?.environment?.co2 ?? 485;
                      const noise = latest?.acoustics?.noiseAvg ?? null;
                      const pm25 = latest?.airQuality?.pm2_5 ?? null;
                      const lux = latest?.environment?.lux ?? 450;
                      const sop = getLibrarianActionGuide({
                        noiseAvg: noise,
                        pm25,
                        temperature: temp,
                        humidity: hum,
                        co2,
                        lux,
                      });

                      return (
                        <tr key={room.id}>
                          <td>
                            <div className="font-semibold text-slate-900">
                              {room.name}
                            </div>
                            <div className="text-2xs text-slate-500">
                              Mã: <span className="font-mono">{room.code}</span> · Tầng {room.floor}
                            </div>
                          </td>
                          <td className="font-mono text-xs text-slate-600">
                            {latest?.metadata?.hardwareId ?? 'Đang đồng bộ'}
                          </td>
                          <td className="text-right">
                            <GradeBadge
                              grade={latest?.comfortScore?.grade}
                              score={latest?.comfortScore?.overall}
                            />
                          </td>
                          <td
                            className={`text-right tabular font-medium ${
                              (temp ?? 24) > 26
                                ? 'text-red-600 font-bold'
                                : 'text-slate-800'
                            }`}
                          >
                            {formatMetrics.temperature(temp)}
                          </td>
                          <td
                            className={`text-right tabular font-medium ${
                              (hum ?? 50) > 65
                                ? 'text-red-600 font-bold'
                                : 'text-slate-800'
                            }`}
                          >
                            {formatMetrics.humidity(hum)}
                          </td>
                          <td
                            className={`text-right tabular font-medium ${
                              co2 > 1000
                                ? 'text-red-600 font-bold'
                                : 'text-slate-800'
                            }`}
                          >
                            {formatMetrics.co2(co2)}
                          </td>
                          <td
                            className={`text-right tabular font-medium ${
                              (noise ?? 40) > 55
                                ? 'text-red-600 font-bold'
                                : 'text-slate-800'
                            }`}
                          >
                            {formatMetrics.noise(noise)}
                          </td>
                          <td
                            className={`text-right tabular font-medium ${
                              (pm25 ?? 10) > 25
                                ? 'text-red-600 font-bold'
                                : 'text-slate-800'
                            }`}
                          >
                            {formatMetrics.pm(pm25)}
                          </td>
                          <td className="text-right tabular text-xs text-slate-700">
                            {formatMetrics.lux(lux)}
                          </td>
                          <td className="max-w-xs text-xs">
                            {sop.severity === 'optimal' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Đạt chuẩn tối ưu
                              </span>
                            ) : (
                              <div className="text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1 text-[11px]">
                                <span className="font-semibold flex items-center gap-1 text-red-700">
                                  <AlertTriangle className="h-3 w-3" />
                                  {sop.steps[0]}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setMode('room');
                                  setSelectedTargetId(room.id);
                                  setViewTab('raw');
                                }}
                                className="btn-secondary btn-sm text-2xs"
                              >
                                Lịch sử 24h
                              </button>
                              <Link
                                href={`/rooms/${room.id}`}
                                className="inline-flex items-center gap-0.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
                              >
                                Phòng
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Filter & Time Window Form */}
          <form
            onSubmit={handleRunQuery}
            className="card p-4 space-y-3.5"
          >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Mode Selector */}
          <div>
            <span className="label">Chế độ tra cứu</span>
            <div className="segmented w-full">
              <button
                type="button"
                onClick={() => setMode('room')}
                className={`segmented-item flex-1 text-center ${mode === 'room' ? 'segmented-item-active' : ''}`}
              >
                Phòng đọc
              </button>
              <button
                type="button"
                onClick={() => setMode('device')}
                className={`segmented-item flex-1 text-center ${mode === 'device' ? 'segmented-item-active' : ''}`}
              >
                Thiết bị
              </button>
            </div>
          </div>

          {/* Target Entity Dropdown */}
          <div>
            <label htmlFor="explorer-target" className="label">
              {mode === 'room' ? 'Chọn phòng đọc' : 'Chọn thiết bị cảm biến'}
            </label>
            <select
              id="explorer-target"
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="select text-xs"
            >
              {mode === 'room' ? (
                rooms.length === 0 ? (
                  <option value="">-- Không có phòng đọc --</option>
                ) : (
                  rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code} · Tầng {r.floor})
                    </option>
                  ))
                )
              ) : devices.length === 0 ? (
                <option value="">-- Không có thiết bị --</option>
              ) : (
                devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.hardwareId} · Zone {d.zoneId})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Start Time */}
          <div>
            <label htmlFor="explorer-start" className="label">
              Từ thời điểm
            </label>
            <input
              id="explorer-start"
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="input text-xs"
            />
          </div>

          {/* End Time */}
          <div>
            <label htmlFor="explorer-end" className="label">
              Đến thời điểm
            </label>
            <input
              id="explorer-end"
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className="input text-xs"
            />
          </div>
        </div>

        {/* Validation Alert */}
        {!timeWindowValidation.valid && timeWindowValidation.message && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-800"
          >
            {timeWindowValidation.message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <span>Chọn nhanh:</span>
            {[1, 6, 12, 24].map((hrs) => (
              <button
                key={hrs}
                type="button"
                onClick={() => {
                  const now = new Date();
                  const start = new Date(now.getTime() - hrs * 3600 * 1000);
                  setStartLocal(toLocalDateTimeInputValue(start));
                  setEndLocal(toLocalDateTimeInputValue(now));
                }}
                className="btn-secondary btn-sm"
              >
                {hrs} giờ qua
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={
              !timeWindowValidation.valid ||
              !selectedTargetId ||
              rawQuery.isFetching
            }
            className="btn-primary btn-sm"
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{rawQuery.isFetching ? 'Đang truy vấn...' : 'Truy vấn dữ liệu'}</span>
          </button>
        </div>
      </form>

      {/* Results View */}
      <div className="card">
        {!committedParams ? (
          <div className="p-6 text-center text-slate-500">
            <p className="text-sm font-medium">Chưa thực hiện truy vấn</p>
            <p className="mt-1 text-xs text-slate-400">
              Hãy chọn phòng hoặc thiết bị và bấm &ldquo;Truy vấn dữ liệu&rdquo; để xem bản tin thô.
            </p>
          </div>
        ) : rawQuery.isLoading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <Skeleton key={idx} className="h-10 w-full" />
            ))}
          </div>
        ) : rawQuery.isError ? (
          <div className="p-5">
            <ErrorBanner
              message="Không thể nạp dữ liệu cảm biến thô từ máy chủ."
              onRetry={() => void rawQuery.refetch()}
            />
          </div>
        ) : records.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Không có bản tin cảm biến trong khoảng thời gian này"
              description="Vui lòng mở rộng khoảng thời gian hoặc kiểm tra trạng thái trạm đo."
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Phòng</th>
                  <th>Thiết bị</th>
                  <th className="text-right">Tiện nghi</th>
                  <th className="text-right">Nhiệt độ</th>
                  <th className="text-right">Độ ẩm</th>
                  <th className="text-right">Ánh sáng</th>
                  <th className="text-right">Độ ồn TB</th>
                  <th className="text-right">Đỉnh ồn</th>
                  <th className="text-right">PM2.5</th>
                  <th className="text-right">Sóng Wi-Fi</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => (
                  <tr key={idx}>
                    <td className="whitespace-nowrap tabular text-slate-500 text-xs">
                      {formatVietnamDateTime(r.timestamp)}
                    </td>
                    <td className="font-medium text-slate-900">
                      {r.metadata?.roomId ?? '--'}
                    </td>
                    <td className="font-mono text-2xs text-slate-600">
                      {r.metadata?.hardwareId ?? '--'}
                    </td>
                    <td className="text-right">
                      <GradeBadge
                        grade={r.comfortScore?.grade}
                        score={r.comfortScore?.overall}
                      />
                    </td>
                    <td className="text-right tabular font-medium text-slate-800">
                      {formatMetrics.temperature(r.environment?.temperature)}
                    </td>
                    <td className="text-right tabular font-medium text-slate-800">
                      {formatMetrics.humidity(r.environment?.humidity)}
                    </td>
                    <td className="text-right tabular font-medium text-slate-800">
                      {formatMetrics.lux(r.environment?.lux)}
                    </td>
                    <td className="text-right tabular font-medium text-slate-800">
                      {formatMetrics.noise(r.acoustics?.noiseAvg)}
                    </td>
                    <td className="text-right tabular text-xs text-slate-500">
                      {formatMetrics.noise(r.acoustics?.noisePeak)}
                    </td>
                    <td className="text-right tabular font-medium text-slate-800">
                      {formatMetrics.pm(r.airQuality?.pm2_5)}
                    </td>
                    <td className="text-right tabular text-xs text-slate-500">
                      {formatMetrics.rssi(r.wifiRssi)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
