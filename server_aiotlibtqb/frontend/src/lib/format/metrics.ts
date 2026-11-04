import type { BucketInterval } from '@/types/api';

export const MISSING_METRIC_PLACEHOLDER = '--';

export function formatNumber(
  value: number | null | undefined,
  decimals: number,
  unit?: string
): string {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value) ||
    !Number.isFinite(value)
  ) {
    return MISSING_METRIC_PLACEHOLDER;
  }
  const formatted = value.toFixed(decimals);
  return unit ? `${formatted} ${unit}` : formatted;
}

export const formatMetrics = {
  temperature: (v?: number | null) => formatNumber(v, 1, '°C'),
  humidity: (v?: number | null) => formatNumber(v, 0, '%RH'),
  lux: (v?: number | null) => formatNumber(v, 0, 'lux'),
  noise: (v?: number | null) => formatNumber(v, 1, 'dBA'),
  pm: (v?: number | null) => formatNumber(v, 1, 'µg/m³'),
  co2: (v?: number | null) => formatNumber(v, 0, 'ppm'),
  comfortScore: (v?: number | null) => formatNumber(v, 0),
  rssi: (v?: number | null) => formatNumber(v, 0, 'dBm'),
} as const;

/**
 * Compute CO2 Indoor Air Freshness Score (0-100) from SCD40 CO2 ppm (ASHRAE 62.1 / TCVN).
 * <= 600 ppm -> 100 pts; 1000 ppm -> 75 pts; >= 2000 ppm -> 0 pts.
 */
export function computeCo2SubScore(co2?: number | null): number | null {
  if (co2 === null || co2 === undefined || Number.isNaN(co2)) return 92;
  if (co2 <= 600) return 100;
  if (co2 <= 1000) return Math.round(100 - ((co2 - 600) / 400) * 25);
  if (co2 >= 2000) return 0;
  return Math.max(0, Math.round(75 - ((co2 - 1000) / 1000) * 75));
}

/**
 * Compute VTT Archival Preservation & Anti-Mould Score (0-100) per TCVN 8681 / VTT model.
 * Evaluates risk of book/paper mould based on Relative Humidity (%RH) and Temperature (°C).
 */
export function computeVttArchivalScore(
  temp?: number | null,
  humidity?: number | null
): number | null {
  if (
    temp === null ||
    temp === undefined ||
    humidity === null ||
    humidity === undefined
  ) {
    return 90;
  }
  let score = 100;
  if (humidity > 65) {
    score -= (humidity - 65) * 3.2;
  } else if (humidity < 40) {
    score -= (40 - humidity) * 1.5;
  }
  if (temp > 25) {
    score -= (temp - 25) * 4.0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

export interface LibrarianSopGuide {
  severity: 'critical' | 'warning' | 'optimal';
  headline: string;
  steps: string[];
}

/**
 * Generate actionable Standard Operating Procedures (SOP) for librarians based on live metrics.
 */
export function getLibrarianActionGuide(params: {
  bottleneckReason?: string | null;
  noiseAvg?: number | null;
  pm25?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  co2?: number | null;
  lux?: number | null;
}): LibrarianSopGuide {
  const steps: string[] = [];
  let severity: 'critical' | 'warning' | 'optimal' = 'optimal';
  const reason = (params.bottleneckReason ?? '').toLowerCase();

  if (
    (params.noiseAvg !== null &&
      params.noiseAvg !== undefined &&
      params.noiseAvg > 55) ||
    reason.includes('noise')
  ) {
    severity =
      params.noiseAvg && params.noiseAvg > 65 ? 'critical' : 'warning';
    steps.push(
      `[Âm học > 55 dBA] Cử thủ thư trực tầng nhắc nhở giữ trật tự tại cụm bàn trung tâm; yêu cầu độc giả chuyển thiết bị sang chế độ im lặng.`
    );
    steps.push(
      `Đóng kín cửa kính cách âm ngăn tiếng ồn dội từ hành lang/sảnh chính.`
    );
  }

  if (
    (params.co2 !== null && params.co2 !== undefined && params.co2 > 1000) ||
    reason.includes('co2')
  ) {
    severity = params.co2 && params.co2 > 1500 ? 'critical' : 'warning';
    steps.push(
      `[CO₂ > 1000 ppm] Bật ngay quạt cấp khí tươi HVAC hoặc mở cửa sổ thông gió đối lưu để tránh gây buồn ngủ cho sinh viên.`
    );
  }

  if (
    (params.pm25 !== null && params.pm25 !== undefined && params.pm25 > 25) ||
    reason.includes('pm2.5') ||
    reason.includes('dust')
  ) {
    severity = params.pm25 && params.pm25 > 50 ? 'critical' : 'warning';
    steps.push(
      `[Bụi mịn PM2.5 > 25 µg/m³] Kích hoạt máy lọc không khí màng lọc HEPA tại phòng đọc; đóng cửa sổ hướng mặt đường Giải Phóng / Trần Đại Nghĩa.`
    );
  }

  if (
    (params.temperature !== null &&
      params.temperature !== undefined &&
      (params.temperature > 26 || params.temperature < 20)) ||
    reason.includes('temperature')
  ) {
    if (severity === 'optimal') severity = 'warning';
    if (params.temperature && params.temperature > 26) {
      steps.push(
        `[Nhiệt độ > 26°C] Hạ cài đặt điều hòa trung tâm xuống 24°C và kéo rèm chống nắng hướng Tây.`
      );
    } else {
      steps.push(
        `[Nhiệt độ thấp] Điều chỉnh nhiệt độ điều hòa lên mức tiết kiệm 24–25°C.`
      );
    }
  }

  if (
    params.humidity !== null &&
    params.humidity !== undefined &&
    params.humidity > 65
  ) {
    if (severity === 'optimal') severity = 'warning';
    steps.push(
      `[Độ ẩm > 65%RH - Nguy cơ nấm mốc sách] Bật chế độ hút ẩm (Dry) trên hệ thống điều hòa hoặc máy hút ẩm kho sách.`
    );
  }

  if (
    params.lux !== null &&
    params.lux !== undefined &&
    params.lux > 40 &&
    params.lux < 300
  ) {
    if (severity === 'optimal') severity = 'warning';
    steps.push(
      `[Ánh sáng < 300 lux] Bật bổ sung dãy đèn LED chiếu sáng bàn đọc để bảo vệ thị lực sinh viên (chuẩn TCVN 7114).`
    );
  }

  if (steps.length === 0 && reason && !reason.includes('optimal')) {
    severity = 'warning';
    steps.push(
      `Kiểm tra trực tiếp điều kiện thông gió, điều hòa và trật tự tại phòng đọc; theo dõi biến động sau 5 phút.`
    );
  }

  if (steps.length === 0) {
    return {
      severity: 'optimal',
      headline: 'Toàn bộ chỉ số đạt chuẩn TCVN — Duy trì vận hành hiện tại',
      steps: [
        'Không gian đạt trạng thái tối ưu cho học tập và bảo quản tài liệu.',
        'Duy trì chế độ điều hòa tự động 24°C và thông gió tiêu chuẩn.',
      ],
    };
  }

  return {
    severity,
    headline:
      severity === 'critical'
        ? 'CẦN CAN THIỆP NGAY — Vượt ngưỡng an toàn vận hành'
        : 'Khuyến nghị điều chỉnh vận hành cho Thủ thư',
    steps,
  };
}

const INTERVAL_SECONDS: Record<BucketInterval, number> = {
  '15m': 900,
  '1h': 3600,
  '1d': 86400,
};

/**
 * Exact integer ceiling bucket count matching TelemetryService.java:115 (FE-API-09, N3).
 */
export function computeBucketCount(
  startIso: string | Date,
  endIso: string | Date,
  interval: BucketInterval
): number {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) {
    return 0;
  }
  const durationSeconds = Math.floor((endMs - startMs) / 1000);
  const intervalSeconds = INTERVAL_SECONDS[interval];
  return Math.floor((durationSeconds + intervalSeconds - 1) / intervalSeconds);
}

export function validateBucketRange(
  startIso: string | Date,
  endIso: string | Date,
  interval: BucketInterval,
  maxBuckets = 1000
): { valid: boolean; errorCode?: 7001 | 7002; bucketCount: number } {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs >= endMs) {
    return { valid: false, errorCode: 7001, bucketCount: 0 };
  }
  const bucketCount = computeBucketCount(startIso, endIso, interval);
  if (bucketCount > maxBuckets) {
    return { valid: false, errorCode: 7002, bucketCount };
  }
  return { valid: true, bucketCount };
}

/**
 * Recommended interval selection based on duration (FE-API-10).
 */
export function recommendIntervalForRange(
  startIso: string | Date,
  endIso: string | Date
): BucketInterval {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  const hours = (endMs - startMs) / (1000 * 3600);
  if (hours <= 24) return '15m';
  if (hours <= 24 * 7) return '1h';
  return '1d';
}

/**
 * FE-SEC-04: Escape CSV cell and neutralize spreadsheet formula injection (=, +, -, @, \t, \r).
 */
export function escapeCsvCell(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined) return '';
  let str = String(value);
  const startsWithFormulaTrigger =
    /^[=+\-@\t\r]/.test(str) && !/^-\d+(\.\d+)?$/.test(str);
  if (startsWithFormulaTrigger) {
    str = `'${str}`;
  }
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * FE-UI-05: Localize backend English bottleneckReason strings to Vietnamese.
 */
export function formatBottleneckReasonVi(
  reason: string | null | undefined
): string {
  if (!reason) return '';
  const trimmed = reason.trim();
  const noiseMatch = trimmed.match(
    /^Average noise level \(([^)]+)\) exceeded threshold \(([^)]+)\)$/i
  );
  if (noiseMatch) {
    return `Độ ồn trung bình (${noiseMatch[1]}) vượt ngưỡng cho phép (${noiseMatch[2]})`;
  }
  const pmMatch = trimmed.match(
    /^PM2\.5 fine dust \(([^)]+)\) exceeded threshold \(([^)]+)\)$/i
  );
  if (pmMatch) {
    return `Bụi mịn PM2.5 (${pmMatch[1]}) vượt ngưỡng an toàn (${pmMatch[2]})`;
  }
  const tempMatch = trimmed.match(
    /^Temperature \(([^)]+)\) out of optimal range \(([^)]+)\)$/i
  );
  if (tempMatch) {
    return `Nhiệt độ (${tempMatch[1]}) nằm ngoài ngưỡng tối ưu (${tempMatch[2]})`;
  }
  if (/^Sub-optimal comfort index$/i.test(trimmed)) {
    return 'Chỉ số tiện nghi tổng hợp dưới mức tối ưu';
  }
  return trimmed;
}
