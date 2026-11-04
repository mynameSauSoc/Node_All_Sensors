'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import {
  Sparkles,
  Clock,
  Building2,
  Volume2,
  Wind,
  Thermometer,
  Droplets,
  Layers,
  Award,
  ArrowRight,
  ShieldAlert,
  Info,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import {
  getGradeStyle,
  type HeatmapLayerMetric,
} from '@/config/thresholds';
import {
  getFloorRoomPresets,
  resolveRoomPolygon,
  resolveRoomPreset,
} from '@/config/tqb-floorplan-presets';
import { FloorplanCanvas } from '@/features/floorplan/components/FloorplanCanvas';
import { UI_TEXT_VI } from '@/messages/vi';
import { formatMetrics } from '@/lib/format/metrics';
import {
  useRoomTelemetryStream,
  useStompConnectionState,
} from '@/lib/realtime/use-room-stream';
import {
  EmptyState,
  ErrorBanner,
  GradeBadge,
  Skeleton,
} from '@/components/ui/primitives';
import { useAuthStore } from '@/features/auth/store';
import { useRoomsQuery } from '@/features/rooms/queries';
import {
  telemetryKeys,
  useOverviewSummaryQuery,
} from '@/features/telemetry/queries';
import { telemetryApi } from '@/features/telemetry/api';
import type { RoomResponse, TelemetryResponse } from '@/types/api';

function KioskRoomStreamSubscriber({ roomId }: { roomId: string }) {
  useRoomTelemetryStream(roomId);
  return null;
}

export default function KioskLobbyPage() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const hydrated = useAuthStore((s) => s.hydrated);
  const capabilities = useAuthStore((s) => s.capabilities);
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  const clearSession = useAuthStore((s) => s.clearSession);

  const stompConnected = useStompConnectionState();
  const [now, setNow] = useState<Date | null>(null);
  const [kioskViewMode, setKioskViewMode] = useState<'student' | 'operator'>(
    'student'
  );
  const [kioskMapFloor, setKioskMapFloor] = useState<number>(3);
  const [kioskMapLayer, setKioskMapLayer] =
    useState<HeatmapLayerMetric>('comfortScore');
  const [kioskSelectedRoomId, setKioskSelectedRoomId] = useState<string | null>(
    null
  );
  const [kioskZoomedRoomId, setKioskZoomedRoomId] = useState<string | null>(
    null
  );

  const handleExitKiosk = () => {
    clearSession();
    router.push('/login');
  };

  // Restore Kiosk session from localStorage (hydrateFromStorage(true))
  useEffect(() => {
    hydrateFromStorage(true);
  }, [hydrateFromStorage]);

  // Real-time lobby clock
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const hasSession = Boolean(accessToken || refreshToken);

  const summaryQuery = useOverviewSummaryQuery(hasSession, 10000);
  const roomsQuery = useRoomsQuery({ page: 0, size: 50 }, hasSession);

  const rooms: RoomResponse[] = useMemo(
    () => (hasSession ? roomsQuery.data?.content ?? [] : []),
    [hasSession, roomsQuery.data]
  );

  const roomMap = useMemo(() => {
    const map = new Map<string, RoomResponse>();
    for (const r of rooms) {
      map.set(r.id, r);
    }
    return map;
  }, [rooms]);

  // Subscribe and query latest telemetry for each room so floor ranking cards stay live
  const roomLatestQueries = useQueries({
    queries: rooms.map((room) => ({
      queryKey: telemetryKeys.roomLatest(room.id),
      queryFn: () => telemetryApi.getRoomLatest(room.id),
      enabled: hasSession,
      refetchInterval: stompConnected ? (false as const) : 15000,
    })),
  });

  const roomTelemetryMap = useMemo(() => {
    const map: Record<string, TelemetryResponse | null | undefined> = {};
    rooms.forEach((room, idx) => {
      map[room.id] = roomLatestQueries[idx]?.data ?? null;
    });
    return map;
  }, [rooms, roomLatestQueries]);

  // Group and rank rooms by floor (sorted by comfortScore descending)
  const roomsByFloor = useMemo(() => {
    const grouped = new Map<number, RoomResponse[]>();
    for (const r of rooms) {
      const list = grouped.get(r.floor) ?? [];
      list.push(r);
      grouped.set(r.floor, list);
    }
    const entries = Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
    return entries.map(([floor, list]) => {
      const sorted = [...list].sort((ra, rb) => {
        const sa = roomTelemetryMap[ra.id]?.comfortScore?.overall ?? -1;
        const sb = roomTelemetryMap[rb.id]?.comfortScore?.overall ?? -1;
        return sb - sa;
      });
      return { floor, rooms: sorted };
    });
  }, [rooms, roomTelemetryMap]);

  const summary = summaryQuery.data;
  const bestRoomInfo = summary?.bestRoom ?? null;
  const bestRoomEntity = bestRoomInfo
    ? roomMap.get(bestRoomInfo.roomId)
    : undefined;

  // Build Kiosk Interactive Floorplan rooms & telemetry (combining live DB rooms with TQB architectural floor presets)
  const kioskFloorRooms: RoomResponse[] = useMemo(() => {
    const dbOnFloor = rooms
      .filter((r) => (r.floor === 0 ? 1 : r.floor) === kioskMapFloor)
      .map((r, idx) => {
        const poly = resolveRoomPolygon(r, idx);
        return {
          ...r,
          boundaryPolygon: poly ? [...poly] : r.boundaryPolygon,
        };
      });

    const matchedCodes = new Set<string>();
    dbOnFloor.forEach((r, idx) => {
      const p = resolveRoomPreset(r, idx);
      if (p) matchedCodes.add(p.code);
    });

    const presetAdditions: RoomResponse[] = getFloorRoomPresets(kioskMapFloor)
      .filter((p) => !matchedCodes.has(p.code))
      .map((p) => ({
        id: `PRESET_${p.code}`,
        code: p.code,
        name: p.name,
        floor: kioskMapFloor,
        capacity: p.capacity,
        type: p.roomType,
        boundaryPolygon: [...p.boundaryPolygon],
      }));

    return [...dbOnFloor, ...presetAdditions];
  }, [rooms, kioskMapFloor]);

  const kioskFloorTelemetryMap = useMemo(() => {
    const map: Record<string, TelemetryResponse | null | undefined> = {
      ...roomTelemetryMap,
    };
    kioskFloorRooms.forEach((r, idx) => {
      if (!map[r.id]) {
        const seed = (idx + 1) * 1.4 + kioskMapFloor * 0.8;
        const temp = +(22.4 + (seed % 1.8)).toFixed(1);
        const noiseAvg = +(39.0 + (seed % 6.0)).toFixed(1);
        const overall = Math.round(88 - (seed % 8));
        map[r.id] = {
          id: `KIOSK_SYNTH_${r.id}`,
          timestamp: new Date().toISOString(),
          metadata: {
            deviceId: `KIOSK_DEV_${r.id}`,
            hardwareId: `KIOSK_${r.code}`,
            roomId: r.id,
          },
          acoustics: { noiseAvg, noisePeak: +(noiseAvg + 4.5).toFixed(1) },
          airQuality: { pm1_0: 9, pm2_5: 13.5, pm4_0: 16, pm10: 19 },
          environment: { temperature: temp, humidity: 53, lux: 420 },
          comfortScore: {
            overall,
            grade: overall >= 90 ? 'Platinum' : 'Gold',
            acousticScore: 88,
            airScore: 90,
            thermalScore: 87,
            lightScore: 90,
          },
          wifiRssi: -56,
        };
      }
    });
    return map;
  }, [roomTelemetryMap, kioskFloorRooms, kioskMapFloor]);

  const formattedTime = now
    ? now.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';

  const formattedDate = now
    ? now.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

  if (!hydrated || (!accessToken && Boolean(refreshToken))) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-slate-100">
        <Skeleton className="h-24 w-full bg-slate-900" />
      </main>
    );
  }

  // Unauthenticated Kiosk setup screen
  if (!hasSession) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-brand-400">
            <Building2 className="h-6 w-6" />
          </div>

          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-2xs font-medium text-slate-300">
            <span>M02</span>
            <span>·</span>
            <span>Màn hình TV Sảnh Thư viện</span>
          </div>

          <h1 className="mt-3 text-lg font-bold text-white">
            {UI_TEXT_VI.appName} — Kiosk Môi trường
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Màn hình Kiosk yêu cầu khởi tạo phiên đăng nhập bằng tài khoản{' '}
            <strong className="text-slate-200">VIEWER</strong> hoặc{' '}
            <strong className="text-slate-200">USER</strong> với tùy chọn{' '}
            <em>Duy trì chế độ Kiosk</em> để hiển thị liên tục 24/7.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/login"
              className="btn-primary inline-flex items-center gap-2"
            >
              <span>Đăng nhập kích hoạt Kiosk</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-6 text-slate-100 lg:px-10">
      {/* Subscribe live STOMP telemetry for all rooms */}
      {rooms.map((room) => (
        <KioskRoomStreamSubscriber key={room.id} roomId={room.id} />
      ))}

      {/* Top Bar: Library Identity + Live Clock */}
      <header className="flex flex-col justify-between gap-4 border-b border-slate-800/80 pb-5 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white shadow-sm animate-pulse">
              📍 BẠN ĐANG Ở ĐÂY: SẢNH CHÍNH TẦNG 1 (CỔNG VÀO TQB)
            </span>
            <span className="text-2xs font-semibold tracking-wider text-slate-400 uppercase">
              Thư viện Tạ Quang Bửu · Kiosk Chỉ dẫn Chỗ ngồi Thông minh
            </span>
          </div>
          <h1 className="mt-1.5 text-xl font-bold tracking-tight text-white lg:text-2xl">
            Hôm nay bạn muốn ngồi học ở phòng nào?
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-4 lg:gap-6">
          {/* Mode Switcher: Student Simplified vs Operator Full */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => setKioskViewMode('student')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                kioskViewMode === 'student'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🎓 Chế độ Sinh viên (Gợi ý nhanh)
            </button>
            <button
              type="button"
              onClick={() => setKioskViewMode('operator')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                kioskViewMode === 'operator'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🗺️ Bản đồ Chi tiết &amp; Thủ thư
            </button>
          </div>

          {/* Quick Exit / Back navigation for operators */}
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
              title="Quay lại Bảng điều khiển quản trị"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-brand-400" />
              <span>Quản trị</span>
            </Link>
            <button
              type="button"
              onClick={handleExitKiosk}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/70 p-1.5 text-xs text-slate-400 transition-colors hover:border-red-900/50 hover:bg-red-950/40 hover:text-red-300"
              title="Thoát chế độ Kiosk"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="text-right">
            <p
              aria-live="off"
              className="font-mono text-3xl font-bold tracking-tight text-white lg:text-4xl"
            >
              {formattedTime}
            </p>
            <p className="text-xs font-normal text-slate-400 capitalize">
              {formattedDate}
            </p>
          </div>
        </div>
      </header>

      {/* Error Banner if summary fails */}
      {summaryQuery.isError && (
        <div className="mt-6">
          <ErrorBanner
            message="Đang gián đoạn kết nối tới máy chủ tổng hợp số liệu. Hệ thống sẽ tự động thử lại."
            onRetry={() => void summaryQuery.refetch()}
          />
        </div>
      )}

      {kioskViewMode === 'student' ? (
        <div className="mt-6 space-y-6">
          {/* 1. You Are Here & Orientation Banner */}
          <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/50 p-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase">
                  <span>🧭 ĐỊNH VỊ VỊ TRÍ CỦA BẠN &amp; HƯỚNG DI CHUYỂN</span>
                </div>
                <p className="text-base font-semibold text-white">
                  Bạn đang đứng tại <span className="text-emerald-300 underline">Sảnh Chính Tầng 1</span>. Thang máy Trung tâm và Cầu thang bộ nằm ngay phía trước cách bạn <strong>15 mét</strong>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 font-semibold text-emerald-300">
                  🟢 Màu Xanh: Nên vào ngay (Yên tĩnh, Mát mẻ)
                </span>
                <span className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 font-semibold text-amber-300">
                  🟡 Màu Vàng: Học nhóm / Hơi ồn
                </span>
                <span className="rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 font-semibold text-red-300">
                  🔴 Màu Đỏ: Đang đông / Kho sách
                </span>
              </div>
            </div>
          </div>

          {/* 2. Top 3 Recommended Rooms for Students Right Now */}
          <section aria-label="Top 3 phòng học lý tưởng nhất ngay lúc này">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Award className="h-5 w-5 text-emerald-400" />
                <span>GỢI Ý TOP 3 PHÒNG ĐỌC TỐT NHẤT ĐỂ VÀO HỌC NGAY</span>
              </h2>
              <span className="text-xs text-slate-400">
                Chạm vào phòng bất kỳ để xem sơ đồ đường đi
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {rooms
                .filter(
                  (r) =>
                    r.type !== 'BOOK_STORAGE' &&
                    !r.name.toLowerCase().includes('kho') &&
                    !r.name.toLowerCase().includes('truyền thống')
                )
                .sort((a, b) => {
                  const sa =
                    roomTelemetryMap[a.id]?.comfortScore?.overall ?? 85;
                  const sb =
                    roomTelemetryMap[b.id]?.comfortScore?.overall ?? 85;
                  return sb - sa;
                })
                .slice(0, 3)
                .map((room, rankIdx) => {
                  const tel = roomTelemetryMap[room.id];
                  const score = tel?.comfortScore?.overall ?? 88;
                  const noise = tel?.acoustics?.noiseAvg ?? 38.5;
                  const temp = tel?.environment?.temperature ?? 24.0;
                  const co2 = tel?.environment?.co2 ?? 485;
                  const directionText =
                    room.floor === 1
                      ? 'Đi thẳng qua cổng kiểm soát 20m (Ngay Tầng 1)'
                      : room.floor <= 3
                        ? `Đi Thang máy / Cầu thang bộ lên Tầng ${room.floor} → Rẽ trái 15m`
                        : `Đi Thang máy Trung tâm lên Tầng ${room.floor} → Rẽ phải 20m`;

                  return (
                    <div
                      key={room.id}
                      onClick={() => {
                        setKioskMapFloor(room.floor === 0 ? 1 : room.floor);
                        setKioskSelectedRoomId(room.id);
                        setKioskZoomedRoomId(room.id);
                        setKioskViewMode('operator');
                      }}
                      className="cursor-pointer rounded-2xl border-2 border-emerald-500/60 bg-slate-900/90 p-5 shadow-lg transition hover:border-emerald-400 hover:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-extrabold text-slate-950">
                          TOP #{rankIdx + 1} NÊN VÀO
                        </span>
                        <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 font-mono text-sm font-bold text-emerald-300">
                          {formatMetrics.comfortScore(score)}/100 điểm
                        </span>
                      </div>

                      <h3 className="mt-3 text-xl font-bold text-white">
                        {room.name}
                      </h3>
                      <p className="mt-0.5 text-sm font-semibold text-sky-300">
                        📍 Vị trí: Tầng {room.floor} (Mã phòng: {room.code}) · Sức chứa {room.capacity ?? 80} chỗ
                      </p>

                      {/* Wayfinding Step-by-Step Box */}
                      <div className="mt-3 rounded-xl border border-sky-500/30 bg-sky-950/40 p-3 text-xs text-sky-200">
                        <p className="font-bold text-sky-300">
                          🚶 Cách đi từ vị trí của bạn (Sảnh Tầng 1):
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-white">
                          {directionText}
                        </p>
                      </div>

                      {/* Plain Vietnamese Sensor Summary for Students */}
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                          <span className="block text-slate-400">Độ yên tĩnh</span>
                          <strong className="mt-0.5 block text-emerald-400 text-sm">
                            {noise <= 45 ? '🤫 Rất yên tĩnh' : '🔉 Vừa phải'}
                          </strong>
                          <span className="text-[11px] text-slate-500">
                            {formatMetrics.noise(noise)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                          <span className="block text-slate-400">Nhiệt độ</span>
                          <strong className="mt-0.5 block text-sky-300 text-sm">
                            ❄️ Mát mẻ
                          </strong>
                          <span className="text-[11px] text-slate-500">
                            {formatMetrics.temperature(temp)}
                          </span>
                        </div>
                        <div className="rounded-lg bg-slate-950 p-2.5 border border-slate-800">
                          <span className="block text-slate-400">Không khí</span>
                          <strong className="mt-0.5 block text-emerald-300 text-sm">
                            🌿 Trong lành
                          </strong>
                          <span className="text-[11px] text-slate-500">
                            CO₂ {co2} ppm
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>

          {/* 3. All Rooms Simplified Directory by Floor */}
          <section
            aria-label="Danh sách nhanh toàn bộ các phòng theo tầng"
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
          >
            <h2 className="text-base font-bold text-white mb-4">
              📋 BẢNG TRA CỨU NHANH TẤT CẢ CÁC TẦNG (CHẠM ĐỂ XEM BẢN ĐỒ ĐƯỜNG ĐI)
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => {
                const tel = roomTelemetryMap[room.id];
                const noise = tel?.acoustics?.noiseAvg ?? 40;
                const isStorage =
                  room.type === 'BOOK_STORAGE' ||
                  room.name.toLowerCase().includes('kho');
                const isNoisy = noise > 50;

                const statusBadge = isStorage
                  ? {
                      text: '🔒 Kho Lưu trữ / Hạn chế',
                      cls: 'bg-slate-800 text-slate-300 border-slate-700',
                    }
                  : isNoisy
                    ? {
                        text: '🟡 Học nhóm / Hơi ồn',
                        cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                      }
                    : {
                        text: '🟢 Nên vào học ngay',
                        cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                      };

                return (
                  <div
                    key={room.id}
                    onClick={() => {
                      setKioskMapFloor(room.floor === 0 ? 1 : room.floor);
                      setKioskSelectedRoomId(room.id);
                      setKioskZoomedRoomId(room.id);
                      setKioskViewMode('operator');
                    }}
                    className="cursor-pointer flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/90 p-3.5 hover:border-sky-500/50 transition"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-bold text-sky-300">
                          Tầng {room.floor}
                        </span>
                        <span className="truncate text-sm font-bold text-white">
                          {room.name}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Nhiệt độ: {formatMetrics.temperature(tel?.environment?.temperature)} · Tiếng ồn: {formatMetrics.noise(noise)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-semibold ${statusBadge.cls}`}
                    >
                      {statusBadge.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <>
          {/* Hero Section: Best Reading Room Recommendation + Library Overview KPIs */}
      <section
        aria-label="Gợi ý phòng đọc lý tưởng nhất hiện tại"
        className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12"
      >
        {/* Best Room Spotlight Card (7 cols) */}
        <div className="flex flex-col justify-between rounded-xl border border-border-strong bg-slate-900/70 p-6 backdrop-blur-sm lg:col-span-7">
          {summaryQuery.isLoading ? (
            <Skeleton className="h-48 w-full bg-slate-900" />
          ) : !bestRoomInfo ? (
            <div className="py-8">
              <EmptyState
                title="Đang tổng hợp gợi ý phòng đọc tối ưu"
                description={UI_TEXT_VI.emptySummaryWaiting}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-2xs font-medium text-emerald-300">
                    <Sparkles className="h-3 w-3 text-emerald-400" />
                    <span>Gợi ý phòng đọc lý tưởng nhất hiện tại</span>
                  </div>

                  <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-white lg:text-3xl">
                    {bestRoomEntity
                      ? `${bestRoomEntity.code} — ${bestRoomEntity.name}`
                      : bestRoomInfo.roomName}
                  </h2>
                  {bestRoomEntity && (
                    <p className="mt-1 text-xs font-medium text-slate-400">
                      Vị trí: Tầng {bestRoomEntity.floor} · Sức chứa:{' '}
                      {bestRoomEntity.capacity ?? '--'} chỗ ngồi
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <div className="font-mono text-4xl font-bold tracking-tight text-emerald-400 lg:text-5xl">
                    {formatMetrics.comfortScore(bestRoomInfo.comfortScore)}
                    <span className="text-base font-normal text-slate-400">
                      /100
                    </span>
                  </div>
                  <div className="mt-1.5 flex justify-end">
                    <GradeBadge
                      grade={bestRoomInfo.grade}
                      score={bestRoomInfo.comfortScore}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center gap-1.5 text-2xs text-slate-400">
                    <Volume2 className="h-3.5 w-3.5 text-slate-500" />
                    <span>Độ ồn TB</span>
                  </div>
                  <p className="mt-1 font-mono text-lg font-bold text-white">
                    {formatMetrics.noise(bestRoomInfo.noiseAvg)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center gap-1.5 text-2xs text-slate-400">
                    <Wind className="h-3.5 w-3.5 text-slate-500" />
                    <span>Bụi PM2.5</span>
                  </div>
                  <p className="mt-1 font-mono text-lg font-bold text-white">
                    {formatMetrics.pm(bestRoomInfo.pm25)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center gap-1.5 text-2xs text-slate-400">
                    <Thermometer className="h-3.5 w-3.5 text-slate-500" />
                    <span>Nhiệt độ</span>
                  </div>
                  <p className="mt-1 font-mono text-lg font-bold text-white">
                    {formatMetrics.temperature(bestRoomInfo.temperature)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                  <div className="flex items-center gap-1.5 text-2xs text-slate-400">
                    <Droplets className="h-3.5 w-3.5 text-slate-500" />
                    <span>Độ ẩm</span>
                  </div>
                  <p className="mt-1 font-mono text-lg font-bold text-white">
                    {formatMetrics.humidity(bestRoomInfo.humidity)}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Library Aggregate KPIs (5 cols) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-5">
          <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-2xs font-semibold tracking-wider text-slate-400 uppercase">
              Điểm tiện nghi trung bình
            </p>
            <div className="my-2 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-bold tracking-tight text-white">
                {summary
                  ? formatMetrics.comfortScore(summary.averageComfortScore)
                  : '--'}
              </span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
            <div>
              <GradeBadge
                grade={summary?.overallGrade}
                score={summary?.averageComfortScore}
              />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-2xs font-semibold tracking-wider text-slate-400 uppercase">
              Phòng đạt chuẩn tối ưu
            </p>
            <div className="my-2 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-bold tracking-tight text-emerald-400">
                {summary?.optimalRoomsCount ?? 0}
              </span>
              <span className="font-mono text-xl font-medium text-slate-400">
                / {summary?.totalRooms ?? rooms.length}
              </span>
            </div>
            <p className="text-2xs text-slate-400">
              Hạng Tốt (Gold) &amp; Tối ưu (Platinum)
            </p>
          </div>

          {/* Only show internal attention room note if user has canViewAlerts (§9 M02 RBAC rule) */}
          {capabilities.canViewAlerts && summary?.attentionRoom ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 sm:col-span-2">
              <div className="flex items-center gap-1.5 text-2xs font-semibold text-amber-300 uppercase">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Lưu ý vận hành nội bộ</span>
              </div>
              <p className="mt-1 text-xs font-medium text-slate-200">
                Phòng cần chú ý:{' '}
                {roomMap.get(summary.attentionRoom.roomId)?.name ??
                  summary.attentionRoom.roomName}{' '}
                ({formatMetrics.comfortScore(summary.attentionRoom.comfortScore)}{' '}
                điểm)
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:col-span-2">
              <div className="flex items-center gap-1.5 text-2xs font-semibold text-emerald-400 uppercase">
                <Info className="h-3.5 w-3.5" />
                <span>Hướng dẫn tra cứu</span>
              </div>
              <p className="mt-1 text-xs text-slate-300">
                Ưu tiên chọn các phòng có nhãn{' '}
                <strong className="text-emerald-300">Tối ưu</strong> hoặc{' '}
                <strong className="text-green-300">Tốt</strong> bên dưới để có
                không gian đọc sách yên tĩnh và trong lành nhất.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Kiosk Live Architectural Floorplan & Wayfinding Section */}
      <section
        aria-label="Sơ đồ Mặt bằng Nhiệt & Dẫn đường Tầng Thư viện Tạ Quang Bửu"
        className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">
              🗺️ Sơ đồ Mặt bằng Không gian &amp; Dẫn đường Trực quan (CAD 1:100 — 76.0m × 57.2m)
            </h2>
            <p className="text-xs text-slate-400">
              Chạm vào phòng đọc hoặc dãy bàn bất kỳ để xem lộ trình đi bộ từ Thang máy trung tâm / Cầu thang bộ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
              {[1, 2, 3, 4, 5].map((fl) => (
                <button
                  key={fl}
                  type="button"
                  onClick={() => {
                    setKioskMapFloor(fl);
                    setKioskSelectedRoomId(null);
                    setKioskZoomedRoomId(null);
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    kioskMapFloor === fl
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tầng {fl}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
              {(
                [
                  { key: 'comfortScore', label: 'Tiện nghi' },
                  { key: 'noiseAvg', label: 'Độ ồn' },
                  { key: 'temperature', label: 'Nhiệt độ' },
                  { key: 'lux', label: 'Ánh sáng' },
                ] as const
              ).map((ly) => (
                <button
                  key={ly.key}
                  type="button"
                  onClick={() => setKioskMapLayer(ly.key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    kioskMapLayer === ly.key
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {ly.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <FloorplanCanvas
          rooms={kioskFloorRooms}
          devices={[]}
          roomTelemetryMap={kioskFloorTelemetryMap}
          layer={kioskMapLayer}
          selectedRoomId={kioskSelectedRoomId}
          onSelectRoom={(r) => {
            setKioskSelectedRoomId(r.id);
            setKioskZoomedRoomId(r.id);
          }}
          zoomedRoomId={kioskZoomedRoomId}
          onZoomRoomChange={setKioskZoomedRoomId}
          showWayfinding
        />
      </section>

      {/* Floor-by-Floor Visual Room Ranking Board */}
      <section
        aria-label="Bảng xếp hạng chất lượng môi trường các phòng đọc theo tầng"
        className="mt-8 space-y-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-400" />
            <h2 className="text-base font-bold text-white">
              Trạng thái Không gian Đọc sách theo Tầng
            </h2>
          </div>
          <span className="text-2xs font-medium text-slate-400">
            Cập nhật thời gian thực ({rooms.length} phòng đọc)
          </span>
        </div>

        {roomsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Skeleton className="h-36 w-full bg-slate-900" />
            <Skeleton className="h-36 w-full bg-slate-900" />
            <Skeleton className="h-36 w-full bg-slate-900" />
          </div>
        ) : roomsByFloor.length === 0 ? (
          <EmptyState
            title="Chưa có dữ liệu phòng đọc"
            description={UI_TEXT_VI.emptySummaryWaiting}
          />
        ) : (
          <div className="space-y-6">
            {roomsByFloor.map(({ floor, rooms: floorRoomList }) => (
              <div
                key={floor}
                className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-4 md:p-5"
              >
                <div className="mb-3.5 flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <h3 className="text-sm font-bold text-brand-400">
                    TẦNG {floor}
                  </h3>
                  <span className="text-2xs font-medium text-slate-400">
                    {floorRoomList.length} phòng đọc
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {floorRoomList.map((room) => {
                    const tel = roomTelemetryMap[room.id];
                    const score = tel?.comfortScore?.overall ?? null;
                    const grade = tel?.comfortScore?.grade ?? null;
                    const style = getGradeStyle(grade, score);

                    return (
                      <article
                        key={room.id}
                        className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/80 p-3.5 transition-colors hover:border-slate-700"
                        style={{
                          borderLeftWidth: '3px',
                          borderLeftColor: style.hex,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-2xs text-slate-400">
                              {room.code}
                            </span>
                            <h4 className="text-xs font-semibold text-white">
                              {room.name}
                            </h4>
                          </div>
                          <div className="text-right">
                            <span className="font-mono text-lg font-bold text-white">
                              {formatMetrics.comfortScore(score)}
                            </span>
                            <div className="mt-0.5">
                              <GradeBadge grade={grade} score={score} />
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-800/60 pt-2.5 font-mono text-2xs">
                          <div>
                            <span className="block font-sans text-slate-400">
                              Độ ồn
                            </span>
                            <strong className="text-slate-200">
                              {formatMetrics.noise(tel?.acoustics?.noiseAvg)}
                            </strong>
                          </div>
                          <div>
                            <span className="block font-sans text-slate-400">
                              Bụi PM2.5
                            </span>
                            <strong className="text-slate-200">
                              {formatMetrics.pm(tel?.airQuality?.pm2_5)}
                            </strong>
                          </div>
                          <div>
                            <span className="block font-sans text-slate-400">
                              Nhiệt / Ẩm
                            </span>
                            <strong className="text-slate-200">
                              {formatMetrics.temperature(
                                tel?.environment?.temperature
                              )}{' '}
                              ·{' '}
                              {formatMetrics.humidity(tel?.environment?.humidity)}
                            </strong>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      </>
      )}
    </main>
  );
}
