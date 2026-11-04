'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  AlertTriangle,
  ChevronRight,
  Map as MapIcon,
  ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { useOverviewSummaryQuery } from '@/features/telemetry/queries';
import { useRoomsQuery } from '@/features/rooms/queries';
import {
  useAlertsQuery,
  useUnreadAlertsCountQuery,
} from '@/features/alerts/queries';
import { useStompConnectionState } from '@/lib/realtime/use-room-stream';
import {
  formatBottleneckReasonVi,
  formatMetrics,
  getLibrarianActionGuide,
} from '@/lib/format/metrics';
import { formatVietnamDateTime } from '@/lib/format/datetime';
import { UI_TEXT_VI } from '@/messages/vi';
import {
  EmptyState,
  ErrorBanner,
  GradeBadge,
  Skeleton,
} from '@/components/ui/primitives';
import {
  AlertStatusBadge,
  AlertTypeBadge,
} from '@/features/alerts/components/AlertBadges';
import { RoomTelemetryCard } from '@/features/telemetry/components/RoomTelemetryCard';

export default function DashboardPage() {
  const capabilities = useAuthStore((s) => s.capabilities);
  const stompConnected = useStompConnectionState();
  const [selectedFloor, setSelectedFloor] = useState<number | 'ALL'>('ALL');

  const summaryQuery = useOverviewSummaryQuery(
    true,
    stompConnected ? 15000 : 10000
  );

  const roomsQuery = useRoomsQuery({ page: 0, size: 100 });

  const unreadAlertsQuery = useUnreadAlertsCountQuery(
    capabilities.canViewAlerts
  );

  const recentAlertsQuery = useAlertsQuery(
    { page: 0, size: 5 },
    capabilities.canViewAlerts
  );

  const rooms = useMemo(
    () => roomsQuery.data?.content ?? [],
    [roomsQuery.data]
  );

  // Map roomId -> actual room name & code from rooms query cache (FE-UI-06, D9)
  const roomLookupMap = useMemo(() => {
    const map = new Map<string, { name: string; code: string; floor: number }>();
    for (const r of rooms) {
      map.set(r.id, { name: r.name, code: r.code, floor: r.floor });
    }
    return map;
  }, [rooms]);

  const resolveDisplayRoomName = (roomId: string, fallbackName: string) => {
    const found = roomLookupMap.get(roomId);
    if (found) {
      return `${found.name} (${found.code} · Tầng ${found.floor})`;
    }
    return fallbackName;
  };

  const availableFloors = useMemo(() => {
    const set = new Set<number>();
    for (const r of rooms) {
      set.add(r.floor);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    if (selectedFloor === 'ALL') return rooms;
    return rooms.filter((r) => r.floor === selectedFloor);
  }, [rooms, selectedFloor]);

  const summary = summaryQuery.data;
  const isSummaryEmpty =
    !summary || summary.totalRooms === 0 || summary.overallGrade === 'N/A';

  const bestRoom = summary?.bestRoom ?? null;
  const attentionRoom = summary?.attentionRoom ?? null;
  const showAttentionRoom =
    attentionRoom !== null &&
    (!bestRoom || attentionRoom.roomId !== bestRoom.roomId);

  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Tổng quan Vi khí hậu & Tiện nghi Toàn Thư viện
          </h1>
          <p className="page-subtitle">
            {UI_TEXT_VI.appSubtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/floorplan" className="btn-secondary btn-sm">
            <MapIcon className="h-4 w-4" aria-hidden="true" />
            Bản đồ mặt bằng
          </Link>
        </div>
      </div>

      {summaryQuery.isError && (
        <ErrorBanner
          message="Không thể tải dữ liệu tổng quan toàn thư viện."
          onRetry={() => void summaryQuery.refetch()}
        />
      )}

      {/* 4 KPI Summary Cards */}
      <section aria-label="Chỉ số KPI toàn thư viện">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* KPI 1: Total Streaming Rooms */}
          <div className="card p-4">
            <span className="metric-label">Phòng đang phát dữ liệu</span>
            {summaryQuery.isLoading ? (
              <Skeleton className="mt-2 h-8 w-24" />
            ) : (
              <div className="mt-1 flex items-baseline gap-2">
                <span className="metric-value">
                  {summary?.totalRooms ?? 0}
                </span>
                <span className="metric-unit">
                  / {rooms.length} phòng đã đăng ký
                </span>
              </div>
            )}
          </div>

          {/* KPI 2: Optimal Rooms Count (>= 75) */}
          <div className="card p-4">
            <span className="metric-label">Phòng đạt chuẩn tối ưu (≥ 75đ)</span>
            {summaryQuery.isLoading ? (
              <Skeleton className="mt-2 h-8 w-24" />
            ) : (
              <div className="mt-1 flex items-baseline gap-2">
                <span className="metric-value text-emerald-600">
                  {summary?.optimalRoomsCount ?? 0}
                </span>
                <span className="metric-unit">phòng Gold / Platinum</span>
              </div>
            )}
          </div>

          {/* KPI 3: Average Comfort Score & Overall Grade */}
          <div className="card p-4">
            <span className="metric-label">Điểm tiện nghi trung bình</span>
            {summaryQuery.isLoading ? (
              <Skeleton className="mt-2 h-8 w-32" />
            ) : (
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-baseline gap-0.5">
                  <span className="metric-value">
                    {isSummaryEmpty
                      ? '--'
                      : formatMetrics.comfortScore(summary?.averageComfortScore)}
                  </span>
                  <span className="metric-unit">/100</span>
                </div>
                <GradeBadge
                  grade={summary?.overallGrade ?? 'N/A'}
                  score={summary?.averageComfortScore}
                />
              </div>
            )}
          </div>

          {/* KPI 4: Active / Unread Alerts */}
          <div className="card p-4">
            <span className="metric-label">Cảnh báo đang kích hoạt</span>
            {!capabilities.canViewAlerts ? (
              <div className="mt-2">
                <span className="badge-neutral">
                  Dành cho nhân sự vận hành
                </span>
              </div>
            ) : unreadAlertsQuery.isLoading ? (
              <Skeleton className="mt-2 h-8 w-20" />
            ) : (
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span
                  className={`metric-value ${
                    (unreadAlertsQuery.data ?? 0) > 0
                      ? 'text-red-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {unreadAlertsQuery.data ?? 0}
                </span>
                <Link
                  href="/alerts"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Chi tiết
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Spotlight Section: Best Room & Attention Room */}
      <section aria-label="Điểm sáng & Cảnh báo phòng đọc">
        {summaryQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : isSummaryEmpty ? (
          <EmptyState
            title="Chưa có dữ liệu tổng hợp từ bộ nhớ đệm thời gian thực"
            description={UI_TEXT_VI.emptySummaryWaiting}
          />
        ) : (
          <div
            className={`grid grid-cols-1 gap-4 ${
              showAttentionRoom ? 'lg:grid-cols-2' : 'lg:grid-cols-1'
            }`}
          >
            {/* Best Room Spotlight */}
            {bestRoom && (
              <div className="card p-5 border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/70 via-white to-white ring-1 ring-emerald-200/80 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                      <Award className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      <span>ĐIỂM SÁNG — PHÒNG ĐỌC LÝ TƯỞNG NHẤT</span>
                    </div>
                    <h2 className="mt-2 text-lg font-bold text-slate-900">
                      {resolveDisplayRoomName(
                        bestRoom.roomId,
                        bestRoom.roomName
                      )}
                    </h2>
                    <p className="mt-1 text-xs text-slate-600">
                      Đánh giá:{' '}
                      <span className="font-semibold text-emerald-700">
                        {bestRoom.bottleneckReason
                          ? formatBottleneckReasonVi(bestRoom.bottleneckReason)
                          : UI_TEXT_VI.optimalStatus}
                      </span>
                    </p>
                  </div>
                  <GradeBadge
                    grade={bestRoom.grade}
                    score={bestRoom.comfortScore}
                  />
                </div>

                <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-900">
                  <p className="font-semibold">
                    ✓ Khuyến nghị điều phối cho Thủ thư:
                  </p>
                  <p className="mt-0.5 text-emerald-800">
                    Ưu tiên hướng dẫn sinh viên tự học cá nhân hoặc nghiên cứu sâu vào phòng này. Duy trì chế độ điều hòa và thông gió hiện tại.
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-emerald-100 pt-2.5 text-xs text-slate-600">
                  <div className="flex flex-wrap gap-3">
                    <span>Điểm: <strong className="text-slate-900">{formatMetrics.comfortScore(bestRoom.comfortScore)}/100</strong></span>
                    <span>Nhiệt độ: <strong className="text-slate-900">{formatMetrics.temperature(bestRoom.temperature)}</strong></span>
                    <span>Độ ồn: <strong className="text-slate-900">{formatMetrics.noise(bestRoom.noiseAvg)}</strong></span>
                    <span>PM2.5: <strong className="text-slate-900">{formatMetrics.pm(bestRoom.pm25)}</strong></span>
                  </div>
                  <Link
                    href={`/rooms/${bestRoom.roomId}`}
                    className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    Xem phòng
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )}

            {/* Attention Room Spotlight */}
            {showAttentionRoom && attentionRoom && (() => {
              const attentionSop = getLibrarianActionGuide({
                bottleneckReason: attentionRoom.bottleneckReason,
                noiseAvg: attentionRoom.noiseAvg,
                pm25: attentionRoom.pm25,
                temperature: attentionRoom.temperature,
                humidity: attentionRoom.humidity,
              });
              const isCritical =
                (attentionRoom.noiseAvg ?? 0) > 55 ||
                (attentionRoom.pm25 ?? 0) > 25 ||
                (attentionRoom.temperature ?? 0) > 26 ||
                (attentionRoom.comfortScore ?? 100) < 70;
              return (
                <div
                  className={`card p-5 border-l-4 ${
                    isCritical
                      ? 'border-l-red-600 bg-gradient-to-br from-red-50/80 via-amber-50/40 to-white ring-2 ring-red-200'
                      : 'border-l-amber-500 bg-gradient-to-br from-amber-50/80 via-white to-white ring-1 ring-amber-200'
                  } shadow-xs`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isCritical
                            ? 'bg-red-600 text-white animate-pulse'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        <span>CẢNH BÁO — PHÒNG ĐỌC CẦN CHÚ Ý &amp; XỬ LÝ</span>
                      </div>
                      <h2 className="mt-2 text-lg font-bold text-slate-900">
                        {resolveDisplayRoomName(
                          attentionRoom.roomId,
                          attentionRoom.roomName
                        )}
                      </h2>
                      <p className="mt-1 text-xs text-slate-600">
                        Nguyên nhân giới hạn:{' '}
                        <span className="font-semibold text-red-700">
                          {attentionRoom.bottleneckReason
                            ? formatBottleneckReasonVi(
                                attentionRoom.bottleneckReason
                              )
                            : 'Có chỉ số tiệm cận ngưỡng cảnh báo (Độ ồn / Vi khí hậu)'}
                        </span>
                      </p>
                    </div>
                    <GradeBadge
                      grade={attentionRoom.grade}
                      score={attentionRoom.comfortScore}
                    />
                  </div>

                  {/* Actionable SOP Instructions for Librarian */}
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50/90 p-2.5 text-xs text-amber-950">
                    <p className="font-bold text-amber-900">
                      👉 Thủ thư cần thực hiện ngay (Quy trình SOP):
                    </p>
                    <ul className="mt-1 list-disc pl-4 space-y-0.5 text-amber-900">
                      {attentionSop.steps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-amber-200/70 pt-2.5 text-xs text-slate-700">
                    <div className="flex flex-wrap gap-3">
                      <span>Điểm: <strong className="text-slate-900">{formatMetrics.comfortScore(attentionRoom.comfortScore)}/100</strong></span>
                      <span>Nhiệt độ: <strong className="text-slate-900">{formatMetrics.temperature(attentionRoom.temperature)}</strong></span>
                      <span>Độ ồn: <strong className={(attentionRoom.noiseAvg ?? 0) > 50 ? 'text-red-600 font-bold' : 'text-slate-900'}>{formatMetrics.noise(attentionRoom.noiseAvg)}</strong></span>
                      <span>PM2.5: <strong className="text-slate-900">{formatMetrics.pm(attentionRoom.pm25)}</strong></span>
                    </div>
                    <Link
                      href={`/rooms/${attentionRoom.roomId}`}
                      className="inline-flex items-center gap-1 rounded bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-700"
                    >
                      Kiểm tra &amp; Xử lý ngay
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </section>

      {/* Room Telemetry Grid with Floor Filter */}
      <section aria-label="Danh sách trạng thái từng phòng đọc" className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title">
              Trạng thái trực tuyến từng phòng đọc
            </h2>
            <p className="text-xs text-slate-500">
              Đồng bộ thời gian thực qua WebSocket STOMP
            </p>
          </div>

          {/* Floor Filter */}
          <div
            className="segmented"
            role="group"
            aria-label="Lọc theo tầng"
          >
            <button
              type="button"
              onClick={() => setSelectedFloor('ALL')}
              className={`segmented-item ${selectedFloor === 'ALL' ? 'segmented-item-active' : ''}`}
            >
              Tất cả ({rooms.length})
            </button>
            {availableFloors.map((fl) => (
              <button
                key={fl}
                type="button"
                onClick={() => setSelectedFloor(fl)}
                className={`segmented-item ${selectedFloor === fl ? 'segmented-item-active' : ''}`}
              >
                Tầng {fl}
              </button>
            ))}
          </div>
        </div>

        {roomsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <EmptyState
            title={UI_TEXT_VI.emptyRoomsFloor}
            description="Hãy chọn tầng khác hoặc kiểm tra cấu hình danh mục phòng đọc."
            actionLabel={
              selectedFloor !== 'ALL' ? 'Xem tất cả các tầng' : undefined
            }
            onAction={
              selectedFloor !== 'ALL'
                ? () => setSelectedFloor('ALL')
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredRooms.map((room) => (
              <RoomTelemetryCard
                key={room.id}
                room={room}
                stompConnected={stompConnected}
              />
            ))}
          </div>
        )}
      </section>

      {/* Top 5 Latest Alerts Section */}
      {capabilities.canViewAlerts && (
        <section
          aria-label="5 cảnh báo vận hành mới nhất"
          className="card"
        >
          <div className="card-header">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-slate-500" aria-hidden="true" />
                5 Cảnh báo vận hành mới nhất
              </h2>
              <p className="text-xs text-slate-500">
                Cập nhật tự động từ luồng giám sát ngưỡng vi khí hậu
              </p>
            </div>
            <Link
              href="/alerts"
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              Xem toàn bộ
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div>
            {recentAlertsQuery.isLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : (recentAlertsQuery.data?.content.length ?? 0) === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Không có cảnh báo nào"
                  description={UI_TEXT_VI.emptyAlertsStable}
                />
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Trạng thái</th>
                      <th>Loại sự cố</th>
                      <th>Phòng / Thiết bị</th>
                      <th>Nội dung cảnh báo</th>
                      <th>Thời điểm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAlertsQuery.data?.content.map((alert) => (
                      <tr key={alert.id}>
                        <td>
                          <AlertStatusBadge status={alert.status} />
                        </td>
                        <td>
                          <AlertTypeBadge type={alert.type} />
                        </td>
                        <td className="font-medium text-slate-900">
                          {alert.roomId
                            ? resolveDisplayRoomName(alert.roomId, alert.roomId)
                            : alert.hardwareId}
                        </td>
                        <td>
                          {alert.message}
                        </td>
                        <td className="whitespace-nowrap tabular text-slate-500 text-xs">
                          {formatVietnamDateTime(alert.startedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
