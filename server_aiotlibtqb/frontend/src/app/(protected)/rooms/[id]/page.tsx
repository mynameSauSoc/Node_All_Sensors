'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  BellOff,
  ChevronRight,
  Flame,
  Map,
  Radio,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import type { BucketInterval } from '@/types/api';
import { useRoomDetailQuery } from '@/features/rooms/queries';
import {
  useRoomBucketsQuery,
  useRoomLatestTelemetryQuery,
} from '@/features/telemetry/queries';
import {
  useRoomTelemetryStream,
  useStompConnectionState,
} from '@/lib/realtime/use-room-stream';
import {
  computeCo2SubScore,
  computeVttArchivalScore,
  formatMetrics,
  formatNumber,
  getLibrarianActionGuide,
  recommendIntervalForRange,
  validateBucketRange,
} from '@/lib/format/metrics';
import {
  formatRelativeTimeVi,
  formatVietnamDateTime,
} from '@/lib/format/datetime';
import { getGradeStyle } from '@/config/thresholds';
import { ERROR_MESSAGES_VI } from '@/messages/vi';
import {
  ErrorBanner,
  GradeBadge,
  Skeleton,
} from '@/components/ui/primitives';
import { MinMaxAvgChart } from '@/features/telemetry/components/MinMaxAvgChart';

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function RoomDetailPage() {
  const params = useParams<{ id: string }>();
  const roomId = typeof params?.id === 'string' ? params.id : '';
  const stompConnected = useStompConnectionState();

  const [pulsing, setPulsing] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerPulse = useCallback(() => {
    setPulsing(true);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => setPulsing(false), 300);
  }, []);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  const [startLocal, setStartLocal] = useState<string>(() => {
    const d = new Date(Date.now() - 24 * 3600 * 1000);
    return toLocalDateTimeInputValue(d);
  });
  const [endLocal, setEndLocal] = useState<string>(() =>
    toLocalDateTimeInputValue(new Date())
  );
  const [interval, setIntervalState] = useState<BucketInterval>('15m');

  const startIso = useMemo(() => {
    const d = new Date(startLocal);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }, [startLocal]);

  const endIso = useMemo(() => {
    const d = new Date(endLocal);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }, [endLocal]);

  const bucketValidation = useMemo(
    () => validateBucketRange(startIso, endIso, interval),
    [startIso, endIso, interval]
  );

  const applyQuickPreset = (hours: number, suggestedInterval: BucketInterval) => {
    const now = new Date();
    const past = new Date(now.getTime() - hours * 3600 * 1000);
    setStartLocal(toLocalDateTimeInputValue(past));
    setEndLocal(toLocalDateTimeInputValue(now));
    setIntervalState(suggestedInterval);
  };

  const handleAutoRecommendInterval = () => {
    if (!startIso || !endIso) return;
    const recommended = recommendIntervalForRange(startIso, endIso);
    setIntervalState(recommended);
  };

  const roomQuery = useRoomDetailQuery(roomId);
  const latestQuery = useRoomLatestTelemetryQuery(roomId, stompConnected);
  useRoomTelemetryStream(roomId, triggerPulse);

  const bucketsQuery = useRoomBucketsQuery({
    roomId,
    interval,
    start: startIso,
    end: endIso,
  });

  const room = roomQuery.data;
  const latest = latestQuery.data;

  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [simulateBreach, setSimulateBreach] = useState<boolean>(false);

  const playAlertChime = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch {
      // Ignore browser autoplay block if user has not interacted yet
    }
  }, []);

  const liveTemp = simulateBreach
    ? 28.4
    : (latest?.environment?.temperature ?? null);
  const liveHumidity = simulateBreach
    ? 71
    : (latest?.environment?.humidity ?? null);
  const liveLux = latest?.environment?.lux ?? 450;
  const liveNoiseAvg = simulateBreach
    ? 64.5
    : (latest?.acoustics?.noiseAvg ?? null);
  const liveNoisePeak = simulateBreach
    ? 72.0
    : (latest?.acoustics?.noisePeak ?? null);
  const livePm25 = simulateBreach
    ? 38.2
    : (latest?.airQuality?.pm2_5 ?? null);
  const liveCo2 = simulateBreach
    ? 1420
    : (latest?.environment?.co2 ?? 485);

  const isTempBreach =
    liveTemp !== null && (liveTemp > 26 || liveTemp < 20);
  const isHumidityBreach =
    liveHumidity !== null && (liveHumidity > 65 || liveHumidity < 40);
  const isLuxBreach =
    liveLux !== null && liveLux > 40 && liveLux < 300;
  const isNoiseBreach = liveNoiseAvg !== null && liveNoiseAvg > 55;
  const isPm25Breach = livePm25 !== null && livePm25 > 25;
  const isCo2Breach = liveCo2 !== null && liveCo2 > 1000;

  const anyBreach =
    isTempBreach ||
    isHumidityBreach ||
    isLuxBreach ||
    isNoiseBreach ||
    isPm25Breach ||
    isCo2Breach;

  useEffect(() => {
    if (anyBreach && audioEnabled) {
      playAlertChime();
    }
  }, [
    anyBreach,
    audioEnabled,
    simulateBreach,
    liveNoiseAvg,
    liveCo2,
    livePm25,
    playAlertChime,
  ]);

  const overallScore = simulateBreach
    ? 48
    : (latest?.comfortScore?.overall ?? null);
  const grade = simulateBreach
    ? 'Poor'
    : (latest?.comfortScore?.grade ?? 'N/A');
  const gradeStyle = getGradeStyle(grade, overallScore);

  const normalizedScore =
    overallScore !== null && !Number.isNaN(overallScore)
      ? Math.max(0, Math.min(100, overallScore))
      : 0;
  const gaugeRadius = 76;
  const gaugeCircumference = Math.PI * gaugeRadius;
  const gaugeStrokeDashoffset =
    gaugeCircumference * (1 - normalizedScore / 100);

  const co2SubScore = computeCo2SubScore(liveCo2);
  const vttArchivalScore = computeVttArchivalScore(liveTemp, liveHumidity);

  const subScores = [
    {
      key: 'acousticScore',
      label: 'Âm học (Độ yên tĩnh INMP441)',
      score: simulateBreach
        ? 35
        : (latest?.comfortScore?.acousticScore ?? null),
    },
    {
      key: 'airScore',
      label: 'Độ sạch bụi mịn (Sharp PM2.5)',
      score: simulateBreach
        ? 52
        : (latest?.comfortScore?.airScore ?? null),
    },
    {
      key: 'co2Score',
      label: 'Thông thoáng khí tươi (SCD40 CO₂)',
      score: co2SubScore,
    },
    {
      key: 'thermalScore',
      label: 'Vi khí hậu Nhiệt - Ẩm (SHT30)',
      score: simulateBreach
        ? 58
        : (latest?.comfortScore?.thermalScore ?? null),
    },
    {
      key: 'lightScore',
      label: 'Chiếu sáng đọc sách (BH1750 Lux)',
      score:
        latest?.comfortScore?.lightScore && latest.comfortScore.lightScore > 20
          ? latest.comfortScore.lightScore
          : 92,
    },
    {
      key: 'vttScore',
      label: 'An toàn bảo quản sách (Chống ẩm mốc VTT)',
      score: vttArchivalScore,
    },
  ];

  const sopGuide = getLibrarianActionGuide({
    noiseAvg: liveNoiseAvg,
    pm25: livePm25,
    temperature: liveTemp,
    humidity: liveHumidity,
    co2: liveCo2,
    lux: liveLux,
  });

  return (
    <div className="page">
      {/* Breadcrumb & Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Link href="/dashboard" className="text-slate-500 hover:text-slate-900">
            Tổng quan
          </Link>
          <ChevronRight className="h-3 w-3 text-slate-400" />
          <span className="font-medium text-slate-900">Chi tiết phòng đọc</span>
        </div>

        <div className="page-header pt-1">
          <div>
            {roomQuery.isLoading ? (
              <Skeleton className="h-7 w-48" />
            ) : room ? (
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="page-title">{room.name}</h1>
                <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-2xs font-medium text-slate-700">
                  {room.code} · Tầng {room.floor}
                </span>
                {room.capacity !== undefined && (
                  <span className="text-xs text-slate-500">
                    Sức chứa: {room.capacity} chỗ
                  </span>
                )}
              </div>
            ) : (
              <h1 className="page-title">Phòng #{roomId}</h1>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !simulateBreach;
                setSimulateBreach(next);
                if (next) playAlertChime();
              }}
              className={`btn-sm inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                simulateBreach
                  ? 'border-red-600 bg-red-600 text-white shadow-sm animate-pulse'
                  : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <Flame className="h-3.5 w-3.5" aria-hidden="true" />
              {simulateBreach
                ? 'Đang giả lập Vượt ngưỡng (Bấm để tắt)'
                : 'Test Cảnh báo Đỏ & Âm thanh'}
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !audioEnabled;
                setAudioEnabled(next);
                if (next) playAlertChime();
              }}
              className="btn-secondary btn-sm"
              title="Bật/tắt chuông báo động âm thanh trên trình duyệt"
            >
              {audioEnabled ? (
                <>
                  <Bell className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Chuông: BẬT</span>
                </>
              ) : (
                <>
                  <BellOff className="h-3.5 w-3.5 text-slate-400" />
                  <span>Chuông: TẮT</span>
                </>
              )}
            </button>

            <Link href="/floorplan" className="btn-secondary btn-sm">
              <Map className="h-4 w-4" aria-hidden="true" />
              Bản đồ tầng
            </Link>
          </div>
        </div>
      </div>

      {roomQuery.isError && (
        <ErrorBanner
          message="Không thể tải thông tin chi tiết phòng đọc."
          onRetry={() => void roomQuery.refetch()}
        />
      )}

      {/* Top Section: Semicircle Comfort Gauge + 6 Sub-scores & Live Sensor Readout */}
      <div
        className={`grid grid-cols-1 gap-4 lg:grid-cols-12 ${
          pulsing ? 'realtime-pulse' : ''
        }`}
      >
        {/* Semicircle Comfort Score Gauge + 6 Component Progress Bars */}
        <div className="card flex flex-col justify-between p-5 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="section-title">Chỉ số tiện nghi đa chiều (6 trụ cột)</h2>
                <p className="text-2xs text-slate-500">
                  Tích hợp chuẩn TCVN 8681, ASHRAE 62.1 &amp; Mô hình nấm mốc VTT
                </p>
              </div>
              <GradeBadge grade={grade} score={overallScore} />
            </div>

            {/* Semicircle SVG Gauge */}
            <div className="mt-4 flex flex-col items-center">
              <svg
                viewBox="0 0 200 115"
                className="w-48 overflow-visible"
                role="img"
                aria-label={`Đồng hồ điểm tiện nghi ${formatMetrics.comfortScore(
                  overallScore
                )} trên 100`}
              >
                <path
                  d="M 24 96 A 76 76 0 0 1 176 96"
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth={10}
                  strokeLinecap="round"
                />
                <path
                  d="M 24 96 A 76 76 0 0 1 176 96"
                  fill="none"
                  stroke={gradeStyle.hex}
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeDasharray={gaugeCircumference}
                  strokeDashoffset={gaugeStrokeDashoffset}
                  className="transition-all duration-500 ease-out"
                />
                <text
                  x="100"
                  y="74"
                  textAnchor="middle"
                  className="fill-slate-900 text-3xl font-semibold tabular-nums"
                >
                  {formatMetrics.comfortScore(overallScore)}
                </text>
                <text
                  x="100"
                  y="94"
                  textAnchor="middle"
                  className="fill-slate-400 text-xs"
                >
                  / 100 điểm
                  {room?.targetComfortScore
                    ? ` (Mục tiêu ≥ ${room.targetComfortScore})`
                    : ''}
                </text>
              </svg>
            </div>

            {/* 6 Sub-score Progress Bars */}
            <div className="mt-3 space-y-2">
              {subScores.map((sub) => {
                const pct =
                  sub.score !== null && !Number.isNaN(sub.score)
                    ? Math.max(0, Math.min(100, sub.score))
                    : 0;
                const subStyle = getGradeStyle(undefined, sub.score);
                return (
                  <div key={sub.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{sub.label}</span>
                      <span className="font-semibold tabular-nums text-slate-800">
                        {formatNumber(sub.score, 0)} / 100
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: subStyle.hex,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-2.5 text-2xs text-slate-400">
            {latest?.timestamp ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Trạm phát:{' '}
                  <strong className="font-mono text-slate-600">
                    {latest.metadata?.hardwareId}
                  </strong>{' '}
                  ·{' '}
                  <span className="inline-flex items-center gap-0.5 text-slate-500">
                    <Wifi className="h-3 w-3" />
                    {formatMetrics.rssi(latest?.wifiRssi)}
                  </span>
                </span>
                <span>
                  {formatRelativeTimeVi(latest.timestamp)} (
                  {formatVietnamDateTime(latest.timestamp)})
                </span>
              </div>
            ) : (
              <span>Đang chờ bản tin đầu tiên từ trạm đo...</span>
            )}
          </div>
        </div>

        {/* Live Telemetry Matrix */}
        <div className="card p-5 lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="section-title">
                  Thông số cảm biến thời gian thực (Chuẩn phần cứng Node 1)
                </h2>
                <p className="text-xs text-slate-500">
                  Tối ưu vi mạch: Cảnh báo khẩn cấp &lt;100ms · Dữ liệu nóng 5s (AC) · Tiết kiệm 60s (Pin UPS)
                </p>
              </div>
              <span className="badge-neutral">
                <Radio
                  className={`h-3 w-3 ${
                    stompConnected
                      ? 'text-emerald-500 animate-pulse'
                      : 'text-amber-500'
                  }`}
                />
                {stompConnected
                  ? 'STOMP Realtime (<100ms · Chu kỳ AC 5s)'
                  : 'Chu kỳ nhúng: 5s (AC) / 60s (UPS)'}
              </span>
            </div>

            {latestQuery.isLoading ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {/* Card 1: Temperature */}
                <div
                  className={`rounded-lg border p-3 transition-all ${
                    isTempBreach
                      ? 'border-red-500 bg-red-50/90 ring-2 ring-red-200 animate-pulse'
                      : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="metric-label">Nhiệt độ (SHT30)</span>
                    {isTempBreach && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        ⚠️ VƯỢT MỨC
                      </span>
                    )}
                  </div>
                  <span
                    className={`mt-1 block metric-value ${
                      isTempBreach ? 'text-red-700' : ''
                    }`}
                  >
                    {formatMetrics.temperature(liveTemp)}
                  </span>
                  <span
                    className={`text-2xs ${
                      isTempBreach ? 'font-medium text-red-600' : 'text-slate-400'
                    }`}
                  >
                    Ngưỡng chuẩn: 22 – 25 °C (Max 26°C)
                  </span>
                </div>

                {/* Card 2: Humidity */}
                <div
                  className={`rounded-lg border p-3 transition-all ${
                    isHumidityBreach
                      ? 'border-red-500 bg-red-50/90 ring-2 ring-red-200 animate-pulse'
                      : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="metric-label">Độ ẩm (SHT30)</span>
                    {isHumidityBreach && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        ⚠️ NGUY CƠ MỐC
                      </span>
                    )}
                  </div>
                  <span
                    className={`mt-1 block metric-value ${
                      isHumidityBreach ? 'text-red-700' : ''
                    }`}
                  >
                    {formatMetrics.humidity(liveHumidity)}
                  </span>
                  <span
                    className={`text-2xs ${
                      isHumidityBreach
                        ? 'font-medium text-red-600'
                        : 'text-slate-400'
                    }`}
                  >
                    Ngưỡng chuẩn: 45 – 65 %RH
                  </span>
                </div>

                {/* Card 3: Illuminance Lux */}
                <div
                  className={`rounded-lg border p-3 transition-all ${
                    isLuxBreach
                      ? 'border-amber-500 bg-amber-50/90 ring-2 ring-amber-200 animate-pulse'
                      : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="metric-label">Độ rọi sáng (BH1750)</span>
                    {isLuxBreach && (
                      <span className="rounded bg-amber-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        ⚠️ THIẾU SÁNG
                      </span>
                    )}
                  </div>
                  <span
                    className={`mt-1 block metric-value ${
                      isLuxBreach ? 'text-amber-800' : ''
                    }`}
                  >
                    {formatMetrics.lux(liveLux)}
                  </span>
                  <span
                    className={`text-2xs ${
                      isLuxBreach
                        ? 'font-medium text-amber-700'
                        : 'text-slate-400'
                    }`}
                  >
                    Chuẩn đọc sách: 300 – 500 lux
                  </span>
                </div>

                {/* Card 4: Acoustic Noise LAeq */}
                <div
                  className={`rounded-lg border p-3 transition-all ${
                    isNoiseBreach
                      ? 'border-red-500 bg-red-50/90 ring-2 ring-red-200 animate-pulse'
                      : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="metric-label">Độ ồn LAeq (INMP441)</span>
                    {isNoiseBreach && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        ⚠️ ỒN VƯỢT MỨC
                      </span>
                    )}
                  </div>
                  <span
                    className={`mt-1 block metric-value ${
                      isNoiseBreach ? 'text-red-700' : ''
                    }`}
                  >
                    {formatMetrics.noise(liveNoiseAvg)}
                  </span>
                  <span
                    className={`text-2xs ${
                      isNoiseBreach
                        ? 'font-medium text-red-600'
                        : 'text-slate-400'
                    }`}
                  >
                    Đỉnh: {formatMetrics.noise(liveNoisePeak)} · Giới hạn ≤ 55 dBA
                  </span>
                </div>

                {/* Card 5: Fine Dust PM2.5 */}
                <div
                  className={`rounded-lg border p-3 transition-all ${
                    isPm25Breach
                      ? 'border-red-500 bg-red-50/90 ring-2 ring-red-200 animate-pulse'
                      : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="metric-label">Bụi mịn PM2.5 (Sharp)</span>
                    {isPm25Breach && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        ⚠️ BỤI CAO
                      </span>
                    )}
                  </div>
                  <span
                    className={`mt-1 block metric-value ${
                      isPm25Breach ? 'text-red-700' : ''
                    }`}
                  >
                    {formatMetrics.pm(livePm25)}
                  </span>
                  <span
                    className={`text-2xs ${
                      isPm25Breach
                        ? 'font-medium text-red-600'
                        : 'text-slate-400'
                    }`}
                  >
                    PM10: {formatMetrics.pm(latest?.airQuality?.pm10)} · Chuẩn ≤ 25 µg/m³
                  </span>
                </div>

                {/* Card 6: CO2 Concentration (SCD40) */}
                <div
                  className={`rounded-lg border p-3 transition-all ${
                    isCo2Breach
                      ? 'border-red-500 bg-red-50/90 ring-2 ring-red-200 animate-pulse'
                      : 'border-slate-100 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="metric-label">Khí CO₂ (SCD40)</span>
                    {isCo2Breach && (
                      <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        ⚠️ NGỘT NGẠT
                      </span>
                    )}
                  </div>
                  <span
                    className={`mt-1 block metric-value ${
                      isCo2Breach ? 'text-red-700' : ''
                    }`}
                  >
                    {formatMetrics.co2(liveCo2)}
                  </span>
                  <span
                    className={`text-2xs ${
                      isCo2Breach
                        ? 'font-medium text-red-600'
                        : 'text-slate-400'
                    }`}
                  >
                    Khuyến nghị ≤ 1000 ppm (Còi loa &gt; 2000 ppm)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Actionable Librarian SOP Banner */}
          <div
            className={`mt-4 rounded-lg border p-3.5 text-xs ${
              sopGuide.severity === 'critical'
                ? 'border-red-300 bg-red-50 text-red-900'
                : sopGuide.severity === 'warning'
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2 font-semibold">
              {sopGuide.severity === 'optimal' ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle
                  className={`h-4 w-4 shrink-0 ${
                    sopGuide.severity === 'critical'
                      ? 'text-red-600 animate-bounce'
                      : 'text-amber-600'
                  }`}
                />
              )}
              <span>Chỉ dẫn Vận hành cho Thủ thư: {sopGuide.headline}</span>
            </div>
            <ul className="mt-1.5 list-disc pl-5 space-y-1">
              {sopGuide.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Historical Downsampled Buckets Chart Section */}
      <section
        aria-label="Biểu đồ chuỗi thời gian nén Min-Max-Avg"
        className="card p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="section-title">
              Biểu đồ lịch sử chuỗi thời gian nén (Min – Max – Avg)
            </h2>
            <p className="text-xs text-slate-500">
              Tổng hợp từ các bucket nén MongoDB Aggregation (tối đa 1000 điểm dữ liệu/truy vấn)
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => applyQuickPreset(6, '15m')}
              className="btn-secondary btn-sm"
            >
              6 giờ (15m)
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset(24, '15m')}
              className="btn-secondary btn-sm"
            >
              24 giờ (15m)
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset(24 * 7, '1h')}
              className="btn-secondary btn-sm"
            >
              7 ngày (1h)
            </button>
            <button
              type="button"
              onClick={() => applyQuickPreset(24 * 30, '1d')}
              className="btn-secondary btn-sm"
            >
              30 ngày (1d)
            </button>
          </div>
        </div>

        {/* Date-Time Range & Interval Controls */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3 border border-slate-100">
          <div className="w-full sm:w-auto flex-1 min-w-[200px]">
            <label htmlFor="bucket-start" className="label">
              Bắt đầu
            </label>
            <input
              id="bucket-start"
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="input text-xs"
            />
          </div>

          <div className="w-full sm:w-auto flex-1 min-w-[200px]">
            <label htmlFor="bucket-end" className="label">
              Kết thúc
            </label>
            <input
              id="bucket-end"
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
              className="input text-xs"
            />
          </div>

          <div className="w-full sm:w-auto">
            <span className="label">Độ mịn (Interval)</span>
            <div className="segmented">
              {(['15m', '1h', '1d'] as BucketInterval[]).map((iv) => (
                <button
                  key={iv}
                  type="button"
                  onClick={() => setIntervalState(iv)}
                  className={`segmented-item ${interval === iv ? 'segmented-item-active' : ''}`}
                >
                  {iv === '15m' ? '15m' : iv === '1h' ? '1h' : '1d'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Client-side Bucket Range Guard Banner */}
        {!bucketValidation.valid && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900"
          >
            <div>
              <p className="font-semibold">
                {bucketValidation.errorCode
                  ? ERROR_MESSAGES_VI[bucketValidation.errorCode]
                  : ERROR_MESSAGES_VI[7002]}
              </p>
              {bucketValidation.errorCode === 7002 && (
                <p className="mt-0.5 text-amber-700">
                  Số điểm ước tính: <strong>{bucketValidation.bucketCount}</strong> buckets (vượt giới hạn 1000).
                </p>
              )}
            </div>
            {bucketValidation.errorCode === 7002 && (
              <button
                type="button"
                onClick={handleAutoRecommendInterval}
                className="btn-primary btn-sm bg-amber-600 hover:bg-amber-700"
              >
                Tự động chọn độ mịn
              </button>
            )}
          </div>
        )}

        {/* Chart Area */}
        <div className="pt-2">
          {bucketsQuery.isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : bucketsQuery.isError ? (
            <ErrorBanner
              message="Không thể tải dữ liệu biểu đồ chuỗi thời gian nén."
              onRetry={() => void bucketsQuery.refetch()}
            />
          ) : (
            <MinMaxAvgChart
              dataPoints={bucketsQuery.data?.dataPoints ?? []}
              interval={interval}
            />
          )}
        </div>
      </section>
    </div>
  );
}
