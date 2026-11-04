import type { HeatmapLayerMetric } from '@/config/thresholds';
import type { Point2D } from '@/types/api';
import { type IdwSamplePoint } from './idw';
import {
  computePolygonSignedArea,
  isPointInPolygon,
} from './polygon';

export interface ColorStop {
  val: number;
  r: number;
  g: number;
  b: number;
  a: number;
  label?: string;
}

/**
 * High-contrast, indoor-calibrated continuous meteorological & building-physics palettes
 * across all 7 telemetry metrics of Ta Quang Buu Library (TQB).
 */
export const WEATHER_PALETTES: Record<HeatmapLayerMetric, ColorStop[]> = {
  temperature: [
    { val: 20.8, r: 30, g: 64, b: 175, a: 0.94, label: '≤ 21°C Lạnh (AC)' },        // Deep Blue
    { val: 21.8, r: 6, g: 182, b: 212, a: 0.92, label: '21.8°C Mát mẻ' },         // Bright Cyan
    { val: 22.8, r: 34, g: 197, b: 94, a: 0.90, label: '22.8°C Chuẩn lý tưởng' }, // Emerald Green (Ideal)
    { val: 23.6, r: 132, g: 204, b: 22, a: 0.92, label: '23.6°C Hơi ấm' },        // Lime
    { val: 24.2, r: 234, g: 179, b: 8, a: 0.94, label: '24.2°C Ấm' },             // Radiant Yellow
    { val: 24.8, r: 249, g: 115, b: 22, a: 0.95, label: '24.8°C Khá nóng' },       // Vibrant Orange
    { val: 25.5, r: 239, g: 68, b: 68, a: 0.96, label: '≥ 25.5°C Nóng (Cửa sổ)' },// Hot Red
  ],
  noiseAvg: [
    { val: 36.0, r: 67, g: 56, b: 202, a: 0.94, label: '≤ 36 dBA Rất yên tĩnh' },  // Deep Indigo
    { val: 42.0, r: 2, g: 132, b: 199, a: 0.92, label: '42 dBA Thì thầm khẽ' },   // Sky Blue
    { val: 48.0, r: 22, g: 163, b: 74, a: 0.90, label: '48 dBA Tiêu chuẩn học' }, // Emerald Green
    { val: 53.0, r: 202, g: 138, b: 4, a: 0.92, label: '53 dBA Xao nhãng nhẹ' },  // Amber Yellow
    { val: 58.0, r: 234, g: 88, b: 12, a: 0.94, label: '58 dBA Thảo luận' },      // Bright Orange
    { val: 64.0, r: 220, g: 38, b: 38, a: 0.96, label: '64 dBA Ồn' },             // Coral Red
    { val: 70.0, r: 153, g: 27, b: 27, a: 0.98, label: '≥ 70 dBA Cần nhắc nhở' },  // Deep Crimson
  ],
  pm2_5: [
    { val: 8.0, r: 2, g: 132, b: 199, a: 0.92, label: '≤ 8 Rất trong lành' },     // Sky Blue
    { val: 14.0, r: 22, g: 163, b: 74, a: 0.90, label: '14 Đạt chuẩn sạch' },     // Emerald Green
    { val: 20.0, r: 202, g: 138, b: 4, a: 0.92, label: '20 Trung bình' },         // Yellow
    { val: 26.0, r: 234, g: 88, b: 12, a: 0.94, label: '26 Hơi bí khí' },         // Orange
    { val: 32.0, r: 220, g: 38, b: 38, a: 0.96, label: '≥ 32 Bụi cao' },          // Red
  ],
  comfortScore: [
    { val: 65.0, r: 220, g: 38, b: 38, a: 0.96, label: '< 65 Kém' },              // Red
    { val: 73.0, r: 234, g: 88, b: 12, a: 0.94, label: '73 Trung bình' },         // Orange
    { val: 80.0, r: 202, g: 138, b: 4, a: 0.92, label: '80 Khá' },                // Yellow
    { val: 87.0, r: 101, g: 163, b: 13, a: 0.90, label: '87 Tốt' },               // Lime
    { val: 93.0, r: 22, g: 163, b: 74, a: 0.92, label: '93 Rất tốt' },            // Emerald Green
    { val: 98.0, r: 13, g: 148, b: 136, a: 0.95, label: '≥ 98 Tối ưu' },          // Teal
  ],
  humidity: [
    { val: 38.0, r: 217, g: 119, b: 6, a: 0.92, label: '≤ 38% Khô (Hanh)' },       // Dry Amber
    { val: 46.0, r: 14, g: 165, b: 233, a: 0.90, label: '46% Thoáng khô' },        // Sky Cyan
    { val: 54.0, r: 16, g: 185, b: 129, a: 0.90, label: '54% Chuẩn bảo quản' },    // Ideal Emerald
    { val: 60.0, r: 234, g: 179, b: 8, a: 0.93, label: '60% Ngưỡng Kho sách' },    // Caution Yellow
    { val: 67.0, r: 249, g: 115, b: 22, a: 0.95, label: '67% Ẩm cao' },            // Warning Orange
    { val: 75.0, r: 220, g: 38, b: 38, a: 0.97, label: '≥ 75% Nguy cơ mốc sách' }, // Mold Risk Red
  ],
  lux: [
    { val: 120.0, r: 67, g: 56, b: 202, a: 0.93, label: '≤ 120 lx Thiếu sáng' },   // Dim Indigo
    { val: 240.0, r: 2, g: 132, b: 199, a: 0.91, label: '240 lx Ánh sáng dịu' },   // Soft Sky
    { val: 380.0, r: 16, g: 185, b: 129, a: 0.90, label: '380 lx Chuẩn đọc sách' },// Optimal Green
    { val: 520.0, r: 132, g: 204, b: 22, a: 0.91, label: '520 lx Sáng rõ' },       // Bright Lime
    { val: 680.0, r: 234, g: 179, b: 8, a: 0.94, label: '680 lx Nắng cửa sổ' },    // Glare Yellow
    { val: 850.0, r: 239, g: 68, b: 68, a: 0.96, label: '≥ 850 lx Chói gắt' },     // Glare Red
  ],
  wifiRssi: [
    { val: -84.0, r: 220, g: 38, b: 38, a: 0.96, label: '≤ -84 dBm Mất sóng' },    // Dead-zone Red
    { val: -75.0, r: 249, g: 115, b: 22, a: 0.94, label: '-75 dBm Suy hao BTCT' }, // Weak Orange
    { val: -67.0, r: 234, g: 179, b: 8, a: 0.92, label: '-67 dBm Trung bình' },    // Fair Yellow
    { val: -58.0, r: 34, g: 197, b: 94, a: 0.90, label: '-58 dBm Sóng tốt' },      // Good Green
    { val: -46.0, r: 6, g: 182, b: 212, a: 0.93, label: '≥ -46 dBm Rất mạnh' },    // Strong Cyan
  ],
};

/**
 * Linearly interpolates continuous RGBA components for any arbitrary floating value.
 */
export function getContinuousMetricColor(
  layer: HeatmapLayerMetric,
  value: number | null | undefined
): [number, number, number, number] {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return [100, 116, 139, 0.40]; // Slate neutral #64748B
  }

  const stops = WEATHER_PALETTES[layer] || WEATHER_PALETTES.temperature;
  if (value <= stops[0].val) {
    const s = stops[0];
    return [s.r, s.g, s.b, s.a];
  }
  if (value >= stops[stops.length - 1].val) {
    const s = stops[stops.length - 1];
    return [s.r, s.g, s.b, s.a];
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i];
    const s2 = stops[i + 1];
    if (value >= s1.val && value <= s2.val) {
      const t = (value - s1.val) / (s2.val - s1.val);
      const r = Math.round(s1.r + (s2.r - s1.r) * t);
      const g = Math.round(s1.g + (s2.g - s1.g) * t);
      const b = Math.round(s1.b + (s2.b - s1.b) * t);
      const a = s1.a + (s2.a - s1.a) * t;
      return [r, g, b, a];
    }
  }

  return [100, 116, 139, 0.40];
}

export function getContinuousMetricColorCss(
  layer: HeatmapLayerMetric,
  value: number | null | undefined
): string {
  const [r, g, b, a] = getContinuousMetricColor(layer, value);
  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

/**
 * Creates CSS linear-gradient string for building continuous weather radar legends.
 */
export function getPaletteCssGradient(layer: HeatmapLayerMetric): string {
  const stops = WEATHER_PALETTES[layer] || WEATHER_PALETTES.temperature;
  const gradientStops = stops
    .map((s, idx) => {
      const pct = Math.round((idx / (stops.length - 1)) * 100);
      return `rgb(${s.r}, ${s.g}, ${s.b}) ${pct}%`;
    })
    .join(', ');
  return `linear-gradient(to right, ${gradientStops})`;
}

/**
 * Tính bán kính khuếch tán Gaussian thích ứng theo diện tích đa giác phòng (`adaptiveSigma`).
 * - Phòng làm việc nhóm nhỏ (25.97 – 41.47 m² Tầng 5, diện tích chuẩn hóa ~0.006–0.009): sigma nhỏ (~0.055–0.075) giữ vùng nhiệt gọn trong phòng.
 * - Phòng đọc / Multimedia lớn (301.30 – 570.57 m², diện tích chuẩn hóa ~0.065–0.125): sigma lớn (~0.135–0.195) giúp các dãy bàn đọc giao thoa mượt mà.
 */
export function computeAdaptiveSigma(
  normalizedPolygon: readonly Point2D[] | undefined | null,
  sampleCount: number,
  baseCoverageRadius = 0.26
): number {
  if (!normalizedPolygon || normalizedPolygon.length < 3) {
    return Math.max(0.08, baseCoverageRadius * 0.60);
  }
  const polyArea = Math.abs(computePolygonSignedArea(normalizedPolygon));
  if (polyArea <= 0.0001) {
    return Math.max(0.08, baseCoverageRadius * 0.60);
  }

  const effectiveSamples = Math.max(1, sampleCount);
  const characteristicSpan = Math.sqrt(polyArea / effectiveSamples);
  const rawSigma = characteristicSpan * 0.78;

  // Co giãn mềm theo diện tích phòng thực tế: phòng nhóm nhỏ < 0.012 nhận cận dưới 0.052, phòng đọc lớn nhận tới 0.21
  const minSigma = polyArea < 0.015 ? 0.052 : 0.085;
  const maxSigma = polyArea < 0.02 ? 0.095 : 0.215;

  return Math.max(minSigma, Math.min(maxSigma, rawSigma));
}

export interface RoomBlindspotAnalysis {
  /** Tỷ lệ diện tích bên trong đa giác phòng có fieldPresence < 0.25 (0.0 -> 1.0) */
  readonly blindspotRatio: number;
  /** Cảnh báo phòng thiếu độ phủ cảm biến khi blindspotRatio >= 0.22 */
  readonly isUnderCovered: boolean;
  readonly effectiveSigma: number;
}

/**
 * Đánh giá tỷ lệ Vùng mù Cảm biến (`Coverage Blindspots`, `fieldPresence < 0.25`) bên trong đa giác phòng
 * phục vụ Role `MAINTENANCE` kiểm tra vị trí lắp đặt trạm ESP32.
 */
export function computeRoomBlindspotRatio(
  normalizedPolygon: readonly Point2D[],
  idwSamples: readonly IdwSamplePoint[],
  aspectFactor = 57.2 / 76.0,
  sigmaOverride?: number
): RoomBlindspotAnalysis {
  if (!normalizedPolygon || normalizedPolygon.length < 3) {
    return { blindspotRatio: 0, isUnderCovered: false, effectiveSigma: 0.156 };
  }
  const effectiveSigma =
    sigmaOverride ?? computeAdaptiveSigma(normalizedPolygon, idwSamples.length);

  if (idwSamples.length === 0) {
    return { blindspotRatio: 1, isUnderCovered: true, effectiveSigma };
  }

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  for (const pt of normalizedPolygon) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const steps = 20;
  const dxStep = (maxX - minX) / steps;
  const dyStep = (maxY - minY) / steps;
  if (dxStep <= 0 || dyStep <= 0) {
    return { blindspotRatio: 0, isUnderCovered: false, effectiveSigma };
  }

  const twoSigmaSq = 2 * effectiveSigma * effectiveSigma;
  let insideCount = 0;
  let blindCount = 0;

  for (let iy = 0; iy <= steps; iy++) {
    const ny = minY + iy * dyStep;
    for (let ix = 0; ix <= steps; ix++) {
      const nx = minX + ix * dxStep;
      if (!isPointInPolygon({ x: nx, y: ny }, normalizedPolygon)) continue;
      insideCount++;

      let sumWeight = 0;
      for (let i = 0; i < idwSamples.length; i++) {
        const s = idwSamples[i];
        const dx = nx - s.x;
        const dy = (ny - s.y) * aspectFactor;
        const distSq = dx * dx + dy * dy;
        sumWeight += Math.exp(-distSq / twoSigmaSq);
      }
      const fieldPresence = 1 - Math.exp(-2.2 * sumWeight);
      if (fieldPresence < 0.25) {
        blindCount++;
      }
    }
  }

  const blindspotRatio = insideCount > 0 ? +(blindCount / insideCount).toFixed(3) : 0;
  return {
    blindspotRatio,
    isUnderCovered: blindspotRatio >= 0.22,
    effectiveSigma,
  };
}

export interface RenderHeatmapOptions {
  readonly normalizedPolygon?: readonly Point2D[];
  readonly showBlindspots?: boolean;
}

let sharedOffscreenCanvas: HTMLCanvasElement | null = null;

function getSharedOffscreenCanvas(
  width: number,
  height: number
): HTMLCanvasElement {
  if (!sharedOffscreenCanvas) {
    sharedOffscreenCanvas = document.createElement('canvas');
  }
  if (sharedOffscreenCanvas.width !== width) {
    sharedOffscreenCanvas.width = width;
  }
  if (sharedOffscreenCanvas.height !== height) {
    sharedOffscreenCanvas.height = height;
  }
  return sharedOffscreenCanvas;
}

export function renderWeatherDiffusionHeatmap(
  ctx: CanvasRenderingContext2D,
  pixelVertices: readonly Point2D[],
  idwSamples: readonly IdwSamplePoint[],
  layer: HeatmapLayerMetric,
  canvasWidth: number,
  canvasHeight: number,
  fallbackValue: number | null,
  coverageRadius = 0.26,
  options?: RenderHeatmapOptions
): void {
  // 1. Calculate polygon bounding box
  let minX = canvasWidth;
  let maxX = 0;
  let minY = canvasHeight;
  let maxY = 0;
  for (const pv of pixelVertices) {
    if (pv.x < minX) minX = pv.x;
    if (pv.x > maxX) maxX = pv.x;
    if (pv.y < minY) minY = pv.y;
    if (pv.y > maxY) maxY = pv.y;
  }

  const roomW = Math.max(10, Math.ceil(maxX - minX));
  const roomH = Math.max(10, Math.ceil(maxY - minY));

  // 2. Setup Polygon Clipping (Strict barrier prevents leaking outside room walls)
  ctx.save();
  ctx.beginPath();
  pixelVertices.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.clip();

  // Semi-translucent dark background within room so the CAD architectural underlay remains visible
  ctx.fillStyle = 'rgba(11, 17, 32, 0.72)';
  ctx.fillRect(minX, minY, roomW, roomH);

  // Subtle architectural desk tile grid inside room
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;
  const tileStep = 24;
  for (let tx = minX; tx <= maxX; tx += tileStep) {
    ctx.beginPath();
    ctx.moveTo(tx, minY);
    ctx.lineTo(tx, maxY);
    ctx.stroke();
  }
  for (let ty = minY; ty <= maxY; ty += tileStep) {
    ctx.beginPath();
    ctx.moveTo(minX, ty);
    ctx.lineTo(maxX, ty);
    ctx.stroke();
  }

  // Case A: No online devices and no telemetry -> neutral dark slate
  if (idwSamples.length === 0 && fallbackValue === null) {
    ctx.fillStyle = options?.showBlindspots ? 'rgba(245, 158, 11, 0.28)' : '#64748B';
    ctx.globalAlpha = options?.showBlindspots ? 0.55 : 0.25;
    ctx.fillRect(minX, minY, roomW, roomH);
    ctx.restore();
    return;
  }

  // Case B: No desk sensors, but room-level telemetry exists
  if (idwSamples.length === 0 && fallbackValue !== null) {
    const [r, g, b, a] = getContinuousMetricColor(layer, fallbackValue);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a * 0.48})`;
    ctx.fillRect(minX, minY, roomW, roomH);
    ctx.restore();
    return;
  }

  // Case C: 1 or more desk sensors / reading bays -> Multi-source continuous Gaussian RBF diffusion field
  const gridW = Math.max(45, Math.min(130, Math.round(roomW / 3.0)));
  const gridH = Math.max(35, Math.min(95, Math.round(roomH / 3.0)));

  const offscreen = getSharedOffscreenCanvas(gridW, gridH);
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) {
    ctx.restore();
    return;
  }

  const imgData = offCtx.createImageData(gridW, gridH);
  const data = imgData.data;

  const stepX = roomW / (gridW - 1);
  const stepY = roomH / (gridH - 1);
  const aspectFactor = canvasHeight / canvasWidth;

  // Area-adaptive Gaussian spread parameter (adaptiveSigma)
  const sigma = options?.normalizedPolygon
    ? computeAdaptiveSigma(options.normalizedPolygon, idwSamples.length, coverageRadius)
    : Math.max(0.08, coverageRadius * 0.60);
  const twoSigmaSq = 2 * sigma * sigma;
  const showBlindspots = Boolean(options?.showBlindspots);

  let ptr = 0;
  for (let gy = 0; gy < gridH; gy++) {
    const curPy = minY + gy * stepY;
    const curNy = curPy / canvasHeight;

    for (let gx = 0; gx < gridW; gx++) {
      const curPx = minX + gx * stepX;
      const curNx = curPx / canvasWidth;

      let sumWeight = 0;
      let sumVal = 0;

      for (let i = 0; i < idwSamples.length; i++) {
        const s = idwSamples[i];
        const dx = curNx - s.x;
        const dy = (curNy - s.y) * aspectFactor;
        const distSq = dx * dx + dy * dy;
        const w = Math.exp(-distSq / twoSigmaSq);
        sumWeight += w;
        sumVal += w * s.value;
      }

      // Infinitely smooth Gaussian field presence (naturally decays to 0 in unmonitored zones)
      const fieldPresence = 1 - Math.exp(-2.2 * sumWeight);

      if (showBlindspots && fieldPresence < 0.25) {
        // Highlight sensor coverage blindspot (< 0.25 fieldPresence) with diagnostic amber-crimson stipple
        const stripe = (gx + gy) % 3 === 0 ? 1.0 : 0.55;
        data[ptr] = 245;
        data[ptr + 1] = 158;
        data[ptr + 2] = 11;
        data[ptr + 3] = Math.round(145 * stripe);
      } else if (fieldPresence > 0.01 && sumWeight > 0.0001) {
        const val = sumVal / sumWeight;
        const [r, g, b, a] = getContinuousMetricColor(layer, val);

        data[ptr] = r;
        data[ptr + 1] = g;
        data[ptr + 2] = b;
        data[ptr + 3] = Math.round(a * fieldPresence * 240);
      } else {
        data[ptr] = 0;
        data[ptr + 1] = 0;
        data[ptr + 2] = 0;
        data[ptr + 3] = 0;
      }
      ptr += 4;
    }
  }

  offCtx.putImageData(imgData, 0, 0);

  // 3. Render smoothly into main canvas with bilinear scaling + fluid diffusion
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const hasFilter = typeof ctx.filter === 'string';
  const blurPx = sigma < 0.09 ? 10 : 16;
  if (hasFilter) {
    ctx.filter = `blur(${blurPx}px)`;
  }

  const pad = blurPx;
  ctx.drawImage(offscreen, minX - pad, minY - pad, roomW + pad * 2, roomH + pad * 2);

  if (hasFilter) {
    ctx.filter = 'none';
  }

  ctx.restore();
}
