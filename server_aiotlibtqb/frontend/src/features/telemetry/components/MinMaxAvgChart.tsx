'use client';

import React, { useMemo, useState } from 'react';
import type { BucketDataPoint, BucketInterval } from '@/types/api';
import { formatNumber, MISSING_METRIC_PLACEHOLDER } from '@/lib/format/metrics';
import { formatVietnamDateTime } from '@/lib/format/datetime';
import { EmptyState } from '@/components/ui/primitives';

export type ChartMetricKey =
  | 'comfortScore'
  | 'noise'
  | 'pm25'
  | 'temp'
  | 'humidity'
  | 'lux';

interface MetricConfig {
  key: ChartMetricKey;
  label: string;
  unit: string;
  decimals: number;
  colorHex: string;
  bandFill: string;
  avgField: keyof BucketDataPoint;
  minField: keyof BucketDataPoint;
  maxField: keyof BucketDataPoint;
  thresholdValue: number;
  thresholdLabel: string;
}

export const CHART_METRICS: Record<ChartMetricKey, MetricConfig> = {
  comfortScore: {
    key: 'comfortScore',
    label: 'Điểm tiện nghi',
    unit: 'điểm',
    decimals: 0,
    colorHex: '#4F46E5', // brand-600
    bandFill: 'rgba(79, 70, 229, 0.10)',
    avgField: 'comfortScoreAvg',
    minField: 'comfortScoreMin',
    maxField: 'comfortScoreMax',
    thresholdValue: 75,
    thresholdLabel: 'Ngưỡng chuẩn Tối ưu (75 điểm)',
  },
  noise: {
    key: 'noise',
    label: 'Độ ồn',
    unit: 'dBA',
    decimals: 1,
    colorHex: '#E11D48', // rose-600
    bandFill: 'rgba(225, 29, 72, 0.10)',
    avgField: 'noiseAvg',
    minField: 'noiseMin',
    maxField: 'noiseMax',
    thresholdValue: 55,
    thresholdLabel: 'Ngưỡng ồn cho phép (55 dBA)',
  },
  pm25: {
    key: 'pm25',
    label: 'Bụi mịn PM2.5',
    unit: 'µg/m³',
    decimals: 1,
    colorHex: '#D97706', // amber-600
    bandFill: 'rgba(217, 119, 6, 0.10)',
    avgField: 'pm25Avg',
    minField: 'pm25Min',
    maxField: 'pm25Max',
    thresholdValue: 25,
    thresholdLabel: 'Giới hạn an toàn WHO (25 µg/m³)',
  },
  temp: {
    key: 'temp',
    label: 'Nhiệt độ',
    unit: '°C',
    decimals: 1,
    colorHex: '#0284C7', // sky-600
    bandFill: 'rgba(2, 132, 199, 0.10)',
    avgField: 'tempAvg',
    minField: 'tempMin',
    maxField: 'tempMax',
    thresholdValue: 26,
    thresholdLabel: 'Ngưỡng cảnh báo nóng (26 °C)',
  },
  humidity: {
    key: 'humidity',
    label: 'Độ ẩm',
    unit: '%RH',
    decimals: 0,
    colorHex: '#7C3AED', // violet-600
    bandFill: 'rgba(124, 58, 237, 0.10)',
    avgField: 'humidityAvg',
    minField: 'humidityMin',
    maxField: 'humidityMax',
    thresholdValue: 65,
    thresholdLabel: 'Ngưỡng chống nấm mốc sách (65%RH)',
  },
  lux: {
    key: 'lux',
    label: 'Ánh sáng',
    unit: 'lux',
    decimals: 0,
    colorHex: '#CA8A04', // yellow-600
    bandFill: 'rgba(202, 138, 4, 0.10)',
    avgField: 'luxAvg',
    minField: 'luxMin',
    maxField: 'luxMax',
    thresholdValue: 300,
    thresholdLabel: 'Độ rọi đọc sách tối thiểu (300 lux)',
  },
};

export interface MinMaxAvgChartProps {
  dataPoints?: BucketDataPoint[];
  interval: BucketInterval;
  defaultMetric?: ChartMetricKey;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v) && Number.isFinite(v);
}

/**
 * Interactive SVG Min-Max Shaded Band + Avg Line Chart (FE-VIZ-01, FE-API-06, D16).
 */
export function MinMaxAvgChart({
  dataPoints = [],
  interval,
  defaultMetric = 'comfortScore',
}: MinMaxAvgChartProps) {
  const [selectedMetric, setSelectedMetric] =
    useState<ChartMetricKey>(defaultMetric);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const metricCfg = CHART_METRICS[selectedMetric];

  const sortedPoints = useMemo(() => {
    return [...dataPoints].sort(
      (a, b) =>
        new Date(a.bucketTime).getTime() - new Date(b.bucketTime).getTime()
    );
  }, [dataPoints]);

  const width = 860;
  const height = 280;
  const padLeft = 48;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 36;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const { yMin, yMax, segments, xCoords, hasValidData } = useMemo(() => {
    const rawValues: number[] = [];

    for (const pt of sortedPoints) {
      const avg = pt[metricCfg.avgField];
      const min = pt[metricCfg.minField];
      const max = pt[metricCfg.maxField];
      if (isFiniteNumber(avg)) rawValues.push(avg);
      if (isFiniteNumber(min)) rawValues.push(min);
      if (isFiniteNumber(max)) rawValues.push(max);
    }

    if (rawValues.length === 0 || sortedPoints.length === 0) {
      return {
        yMin: 0,
        yMax: 100,
        segments: [] as Array<{
          indices: number[];
          avgPath: string;
          bandPath: string;
          points: Array<{
            idx: number;
            x: number;
            yAvg: number;
            yMin: number;
            yMax: number;
          }>;
        }>,
        xCoords: [] as number[],
        hasValidData: false,
      };
    }

    let computedMin = Math.min(...rawValues, metricCfg.thresholdValue);
    let computedMax = Math.max(...rawValues, metricCfg.thresholdValue);

    if (selectedMetric === 'comfortScore') {
      computedMin = Math.max(0, Math.floor(computedMin - 5));
      computedMax = Math.min(100, Math.ceil(computedMax + 5));
    } else {
      const span = Math.max(1, computedMax - computedMin);
      computedMin = Math.floor(computedMin - span * 0.12);
      computedMax = Math.ceil(computedMax + span * 0.12);
    }

    if (computedMax <= computedMin) {
      computedMax = computedMin + 10;
    }

    const n = sortedPoints.length;
    const timestamps = sortedPoints.map((pt) => Date.parse(pt.bucketTime));
    const tMin = timestamps[0] ?? 0;
    const tMax = timestamps[n - 1] ?? 0;
    const hasValidTimeSpan =
      n > 1 &&
      Number.isFinite(tMin) &&
      Number.isFinite(tMax) &&
      tMax > tMin;

    const xs = sortedPoints.map((_, i) => {
      if (n === 1) return padLeft + plotWidth / 2;
      if (hasValidTimeSpan && Number.isFinite(timestamps[i])) {
        return padLeft + ((timestamps[i] - tMin) / (tMax - tMin)) * plotWidth;
      }
      return padLeft + (i / (n - 1)) * plotWidth;
    });

    // Compute median step to detect missing-bucket time gaps (FE-GEO-03)
    const stepDeltas: number[] = [];
    for (let i = 1; i < n; i++) {
      const dt = timestamps[i] - timestamps[i - 1];
      if (Number.isFinite(dt) && dt > 0) {
        stepDeltas.push(dt);
      }
    }
    stepDeltas.sort((a, b) => a - b);
    const medianStepMs =
      stepDeltas.length > 0
        ? stepDeltas[Math.floor(stepDeltas.length / 2)]
        : Number.POSITIVE_INFINITY;
    const gapThresholdMs = medianStepMs * 2.5;

    const toY = (val: number) =>
      padTop +
      plotHeight -
      ((val - computedMin) / (computedMax - computedMin)) * plotHeight;

    const builtSegments: Array<{
      indices: number[];
      avgPath: string;
      bandPath: string;
      points: Array<{
        idx: number;
        x: number;
        yAvg: number;
        yMin: number;
        yMax: number;
      }>;
    }> = [];

    let currentGroup: Array<{
      idx: number;
      x: number;
      yAvg: number;
      yMin: number;
      yMax: number;
    }> = [];

    const flushGroup = () => {
      if (currentGroup.length === 0) return;
      const avgPath = currentGroup
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yAvg.toFixed(1)}`)
        .join(' ');

      const topEdge = currentGroup
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yMax.toFixed(1)}`)
        .join(' ');
      const bottomEdge = [...currentGroup]
        .reverse()
        .map((p) => `L ${p.x.toFixed(1)} ${p.yMin.toFixed(1)}`)
        .join(' ');
      const bandPath = `${topEdge} ${bottomEdge} Z`;

      builtSegments.push({
        indices: currentGroup.map((p) => p.idx),
        avgPath,
        bandPath,
        points: currentGroup,
      });
      currentGroup = [];
    };

    sortedPoints.forEach((pt, idx) => {
      const avgVal = pt[metricCfg.avgField];
      if (!isFiniteNumber(avgVal)) {
        flushGroup();
        return;
      }
      if (
        idx > 0 &&
        currentGroup.length > 0 &&
        Number.isFinite(timestamps[idx]) &&
        Number.isFinite(timestamps[idx - 1]) &&
        timestamps[idx] - timestamps[idx - 1] > gapThresholdMs
      ) {
        flushGroup();
      }
      const minVal = isFiniteNumber(pt[metricCfg.minField])
        ? (pt[metricCfg.minField] as number)
        : avgVal;
      const maxVal = isFiniteNumber(pt[metricCfg.maxField])
        ? (pt[metricCfg.maxField] as number)
        : avgVal;

      currentGroup.push({
        idx,
        x: xs[idx],
        yAvg: toY(avgVal),
        yMin: toY(Math.min(minVal, avgVal)),
        yMax: toY(Math.max(maxVal, avgVal)),
      });
    });
    flushGroup();

    return {
      yMin: computedMin,
      yMax: computedMax,
      segments: builtSegments,
      xCoords: xs,
      hasValidData: builtSegments.length > 0,
    };
  }, [sortedPoints, metricCfg, selectedMetric, plotWidth, plotHeight]);

  const yTicks = useMemo(() => {
    const steps = 4;
    return Array.from({ length: steps + 1 }, (_, i) => {
      const val = yMin + ((yMax - yMin) * i) / steps;
      const y =
        padTop + plotHeight - ((val - yMin) / (yMax - yMin)) * plotHeight;
      return { val, y };
    });
  }, [yMin, yMax, plotHeight]);

  const hoveredPoint =
    hoverIndex !== null && sortedPoints[hoverIndex]
      ? sortedPoints[hoverIndex]
      : null;

  return (
    <div className="space-y-3.5">
      {/* Metric Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="segmented" role="tablist" aria-label="Chọn chỉ số biểu đồ">
          {(Object.keys(CHART_METRICS) as ChartMetricKey[]).map((key) => {
            const cfg = CHART_METRICS[key];
            const active = selectedMetric === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setSelectedMetric(key);
                  setHoverIndex(null);
                }}
                className={`segmented-item ${active ? 'segmented-item-active' : ''}`}
              >
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-4 rounded-xs border"
              style={{
                backgroundColor: metricCfg.bandFill,
                borderColor: metricCfg.colorHex,
              }}
            />
            Dải Min – Max
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4"
              style={{ backgroundColor: metricCfg.colorHex }}
            />
            Trung bình (Avg) · Độ mịn {interval}
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-red-600">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-red-500" />
            {metricCfg.thresholdLabel}
          </span>
        </div>
      </div>

      {!hasValidData ? (
        <EmptyState
          title="Chưa có dữ liệu chuỗi thời gian nén"
          description="Không có mẫu đo hợp lệ trong khoảng thời gian đã chọn."
        />
      ) : (
        <div className="card p-3">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-64 w-full select-none"
            role="img"
            aria-label={`Biểu đồ dải Min-Max-Avg cho ${metricCfg.label}`}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {/* Horizontal Grid Lines & Y-Axis Labels */}
            {yTicks.map((tick, idx) => (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={tick.y}
                  x2={width - padRight}
                  y2={tick.y}
                  stroke="#F1F5F9"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={tick.y + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 font-mono text-2xs"
                >
                  {formatNumber(tick.val, metricCfg.decimals)}
                </text>
              </g>
            ))}

            {/* Standard Safety / Comfort Threshold Reference Line */}
            {(() => {
              const thY =
                padTop +
                plotHeight -
                ((metricCfg.thresholdValue - yMin) / Math.max(1, yMax - yMin)) *
                  plotHeight;
              if (thY < padTop - 4 || thY > padTop + plotHeight + 4) return null;
              return (
                <g>
                  <line
                    x1={padLeft}
                    y1={thY}
                    x2={width - padRight}
                    y2={thY}
                    stroke="#EF4444"
                    strokeDasharray="6 4"
                    strokeWidth={1.75}
                  />
                  <rect
                    x={width - padRight - 195}
                    y={Math.max(padTop + 2, thY - 16)}
                    width={190}
                    height={14}
                    rx={3}
                    fill="#FEF2F2"
                    stroke="#FCA5A5"
                    strokeWidth={0.75}
                  />
                  <text
                    x={width - padRight - 100}
                    y={Math.max(padTop + 12, thY - 6)}
                    textAnchor="middle"
                    className="fill-red-600 font-sans text-[9px] font-semibold"
                  >
                    {metricCfg.thresholdLabel}
                  </text>
                </g>
              );
            })()}

            {/* Min-Max Shaded Band + Avg Polyline per contiguous segment */}
            {segments.map((seg, sIdx) => (
              <g key={sIdx}>
                <path d={seg.bandPath} fill={metricCfg.bandFill} stroke="none" />
                <path
                  d={seg.avgPath}
                  fill="none"
                  stroke={metricCfg.colorHex}
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {seg.points.map((pt) => (
                  <g key={pt.idx}>
                    {hoverIndex === pt.idx && (
                      <>
                        <line
                          x1={pt.x}
                          y1={padTop}
                          x2={pt.x}
                          y2={padTop + plotHeight}
                          stroke={metricCfg.colorHex}
                          strokeWidth={1}
                          strokeDasharray="2 2"
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.yMax}
                          r={3}
                          fill="#ffffff"
                          stroke={metricCfg.colorHex}
                          strokeWidth={1.5}
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.yMin}
                          r={3}
                          fill="#ffffff"
                          stroke={metricCfg.colorHex}
                          strokeWidth={1.5}
                        />
                      </>
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.yAvg}
                      r={hoverIndex === pt.idx ? 4 : 2}
                      fill={metricCfg.colorHex}
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                  </g>
                ))}
              </g>
            ))}

            {/* X-Axis Timestamps */}
            {sortedPoints.length > 0 &&
              Array.from(
                new Set([
                  0,
                  Math.floor((sortedPoints.length - 1) / 2),
                  sortedPoints.length - 1,
                ])
              ).map((idx) => (
                <text
                  key={idx}
                  x={xCoords[idx]}
                  y={height - 8}
                  textAnchor={
                    idx === 0
                      ? 'start'
                      : idx === sortedPoints.length - 1 && sortedPoints.length > 1
                      ? 'end'
                      : 'middle'
                  }
                  className="fill-slate-400 font-mono text-2xs"
                >
                  {formatVietnamDateTime(sortedPoints[idx].bucketTime)}
                </text>
              ))}

            {/* Invisible interactive hover columns */}
            {sortedPoints.map((_, idx) => {
              const colWidth =
                sortedPoints.length > 1
                  ? plotWidth / sortedPoints.length
                  : plotWidth;
              const colX =
                sortedPoints.length > 1
                  ? xCoords[idx] - colWidth / 2
                  : padLeft;
              return (
                <rect
                  key={idx}
                  x={Math.max(padLeft, colX)}
                  y={padTop}
                  width={colWidth}
                  height={plotHeight}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIndex(idx)}
                  onFocus={() => setHoverIndex(idx)}
                />
              );
            })}
          </svg>

          {/* Interactive Hover Readout Bar */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
            {hoveredPoint ? (
              <>
                <span className="font-medium text-slate-700">
                  Mốc thời gian: {formatVietnamDateTime(hoveredPoint.bucketTime)}
                  {hoveredPoint.sampleCount !== undefined && (
                    <span className="ml-1 text-slate-400">
                      ({hoveredPoint.sampleCount} mẫu)
                    </span>
                  )}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Min:{' '}
                    <strong className="font-semibold text-slate-800">
                      {isFiniteNumber(hoveredPoint[metricCfg.minField])
                        ? formatNumber(
                            hoveredPoint[metricCfg.minField] as number,
                            metricCfg.decimals,
                            metricCfg.unit
                          )
                        : MISSING_METRIC_PLACEHOLDER}
                    </strong>
                  </span>
                  <span>
                    Avg:{' '}
                    <strong
                      className="font-semibold"
                      style={{ color: metricCfg.colorHex }}
                    >
                      {isFiniteNumber(hoveredPoint[metricCfg.avgField])
                        ? formatNumber(
                            hoveredPoint[metricCfg.avgField] as number,
                            metricCfg.decimals,
                            metricCfg.unit
                          )
                        : MISSING_METRIC_PLACEHOLDER}
                    </strong>
                  </span>
                  <span>
                    Max:{' '}
                    <strong className="font-semibold text-slate-800">
                      {isFiniteNumber(hoveredPoint[metricCfg.maxField])
                        ? formatNumber(
                            hoveredPoint[metricCfg.maxField] as number,
                            metricCfg.decimals,
                            metricCfg.unit
                          )
                        : MISSING_METRIC_PLACEHOLDER}
                    </strong>
                  </span>
                </div>
              </>
            ) : (
              <span className="text-slate-400 text-2xs">
                Rê chuột lên biểu đồ để xem chi tiết Min – Avg – Max tại từng mốc thời gian.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
