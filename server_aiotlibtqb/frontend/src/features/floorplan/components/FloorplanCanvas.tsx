'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TQB_BUILDING_ASPECT_RATIO,
  computeWayfindingPath,
  getFloorCadSvgPath,
  getFloorLandmarks,
  resolveRoomPolygon,
  resolveRoomPreset,
  synthesizeAnonymousMicroZones,
  type AnonymousMicroZone,
  type TqbLandmark,
} from '@/config/tqb-floorplan-presets';
import { type HeatmapLayerMetric } from '@/config/thresholds';
import {
  normalizedToPixel,
  pixelToNormalized,
} from '@/lib/floorplan/coords';
import { type IdwSamplePoint } from '@/lib/floorplan/idw';
import {
  computePolygonSignedArea,
  computeVisualPolygonCenter,
  isPointInPolygon,
} from '@/lib/floorplan/polygon';
import {
  computeRoomBlindspotRatio,
  getContinuousMetricColorCss,
  renderWeatherDiffusionHeatmap,
} from '@/lib/floorplan/weatherPalette';
import { formatMetrics } from '@/lib/format/metrics';
import type {
  DeviceResponse,
  Point2D,
  RoomResponse,
  TelemetryResponse,
} from '@/types/api';

export function extractLayerMetricValue(
  telemetry: TelemetryResponse | null | undefined,
  layer: HeatmapLayerMetric
): number | null {
  if (!telemetry) return null;
  switch (layer) {
    case 'comfortScore':
      return telemetry.comfortScore?.overall ?? null;
    case 'noiseAvg':
      return telemetry.acoustics?.noiseAvg ?? null;
    case 'pm2_5':
      return telemetry.airQuality?.pm2_5 ?? null;
    case 'temperature':
      return telemetry.environment?.temperature ?? null;
    case 'humidity':
      return telemetry.environment?.humidity ?? null;
    case 'lux':
      return telemetry.environment?.lux ?? null;
    case 'wifiRssi':
      return telemetry.wifiRssi ?? null;
  }
}

export function formatLayerMetricValue(
  value: number | null | undefined,
  layer: HeatmapLayerMetric
): string {
  switch (layer) {
    case 'comfortScore':
      return formatMetrics.comfortScore(value);
    case 'noiseAvg':
      return formatMetrics.noise(value);
    case 'pm2_5':
      return formatMetrics.pm(value);
    case 'temperature':
      return formatMetrics.temperature(value);
    case 'humidity':
      return formatMetrics.humidity(value);
    case 'lux':
      return formatMetrics.lux(value);
    case 'wifiRssi':
      return formatMetrics.rssi(value);
  }
}

function resolveDeviceTelemetry(
  dev: DeviceResponse,
  deviceTelemetryMap: Record<string, TelemetryResponse | null | undefined>,
  roomTelemetryMap: Record<string, TelemetryResponse | null | undefined>,
  roomDeviceCount: number
): TelemetryResponse | null | undefined {
  const direct = deviceTelemetryMap[dev.id];
  if (direct) return direct;
  if (!dev.roomId) return undefined;
  const roomLatest = roomTelemetryMap[dev.roomId];
  if (!roomLatest) return undefined;
  if (roomLatest.metadata?.deviceId === dev.id || roomDeviceCount <= 1) {
    return roomLatest;
  }
  return undefined;
}

function computePolygonCentroid(vertices: readonly Point2D[]): Point2D {
  return computeVisualPolygonCenter(vertices);
}

export interface FloorplanCanvasProps {
  rooms: RoomResponse[];
  devices: DeviceResponse[];
  roomTelemetryMap: Record<string, TelemetryResponse | null | undefined>;
  deviceTelemetryMap?: Record<string, TelemetryResponse | null | undefined>;
  layer: HeatmapLayerMetric;
  selectedRoomId: string | null;
  onSelectRoom: (room: RoomResponse) => void;
  onSelectDevice?: (device: DeviceResponse, room?: RoomResponse) => void;
  /** Bật/tắt chế độ Phóng đại Cấp 2 (Room Focus Zoom) */
  zoomedRoomId?: string | null;
  onZoomRoomChange?: (roomId: string | null) => void;
  /** Phân khu bàn đọc đang được chọn / gợi ý (dành cho Smart Study Spot Finder) */
  selectedBayId?: string | null;
  onSelectBay?: (bay: AnonymousMicroZone, room: RoomResponse) => void;
  /** Hiển thị lộ trình dẫn đường từ Thang máy / Cầu thang gần nhất */
  showWayfinding?: boolean;
  /** Hiển thị vùng mù cảm biến (fieldPresence < 0.25) cho Role MAINTENANCE */
  showBlindspots?: boolean;
  /** Hiển thị lớp chẩn đoán kỹ thuật (chênh nhiệt cục bộ ΔT, RSSI, % vùng mù) */
  showTechOverlay?: boolean;
  /** Danh sách mã Zone phụ trách của ZONE_MANAGER để làm nổi bật */
  highlightedZoneIds?: readonly string[];
}

export function FloorplanCanvas({
  rooms,
  devices,
  roomTelemetryMap,
  deviceTelemetryMap = {},
  layer,
  selectedRoomId,
  onSelectRoom,
  onSelectDevice,
  zoomedRoomId: controlledZoomedRoomId,
  onZoomRoomChange,
  selectedBayId,
  onSelectBay,
  showWayfinding = false,
  showBlindspots = false,
  showTechOverlay = false,
  highlightedZoneIds,
}: FloorplanCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState<{
    width: number;
    height: number;
  }>({
    width: 960,
    height: Math.round(960 * TQB_BUILDING_ASPECT_RATIO),
  });
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null);
  const [hoveredBayId, setHoveredBayId] = useState<string | null>(null);
  const [displayValues, setDisplayValues] = useState<Record<string, number>>(
    {}
  );
  const [internalZoomedRoomId, setInternalZoomedRoomId] = useState<
    string | null
  >(null);
  const [showCadUnderlay, setShowCadUnderlay] = useState<boolean>(true);
  const [cadImageLoadedFloor, setCadImageLoadedFloor] = useState<number | null>(
    null
  );

  const zoomedRoomId =
    controlledZoomedRoomId !== undefined
      ? controlledZoomedRoomId
      : internalZoomedRoomId;

  const setZoomedRoomId = (nextId: string | null) => {
    setInternalZoomedRoomId(nextId);
    onZoomRoomChange?.(nextId);
  };

  // Xác định tầng hiện tại từ danh sách phòng
  const activeFloor = useMemo(() => {
    if (rooms.length === 0) return 1;
    const f = rooms[0].floor;
    return f === 0 ? 1 : f;
  }, [rooms]);

  // Cache ảnh SVG lớp nền kiến trúc CAD TQB theo tầng
  const cadImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const svgPath = getFloorCadSvgPath(activeFloor);
    if (cadImagesRef.current.has(svgPath)) {
      setCadImageLoadedFloor(activeFloor);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      cadImagesRef.current.set(svgPath, img);
      setCadImageLoadedFloor(activeFloor);
    };
    img.src = svgPath;
  }, [activeFloor]);

  // Chuẩn hóa danh sách phòng kèm đa giác TQB thực tế và phân khu bàn đọc (readingBays)
  const enrichedRooms = useMemo(() => {
    return rooms
      .map((room, idx) => {
        const preset = resolveRoomPreset(room, idx);
        const polygon = resolveRoomPolygon(room, idx);
        const roomLatest = roomTelemetryMap[room.id];
        const microZones = synthesizeAnonymousMicroZones(
          room,
          roomLatest,
          idx
        );
        return {
          room,
          idx,
          preset,
          polygon,
          microZones,
        };
      })
      .filter(
        (
          item
        ): item is typeof item & {
          polygon: readonly Point2D[];
        } => Boolean(item.polygon && item.polygon.length >= 3)
      );
  }, [rooms, roomTelemetryMap]);

  const roomById = useMemo(() => {
    const map = new Map<string, RoomResponse>();
    for (const r of rooms) {
      map.set(r.id, r);
    }
    return map;
  }, [rooms]);

  // Tính toán khung nhìn Phóng đại 2 cấp (Level 1: Toàn tầng 1.0x <-> Level 2: Phóng to phòng 2.15x)
  const zoomViewport = useMemo(() => {
    if (!zoomedRoomId) {
      return { scale: 1, tx: 0, ty: 0, isZoomed: false };
    }
    const target = enrichedRooms.find((er) => er.room.id === zoomedRoomId);
    if (!target) {
      return { scale: 1, tx: 0, ty: 0, isZoomed: false };
    }

    let minX = 1;
    let maxX = 0;
    let minY = 1;
    let maxY = 0;
    for (const pt of target.polygon) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }

    // Mở rộng vùng nhìn để bao gồm cả hành lang & thang máy/cầu thang dẫn vào phòng
    const route = computeWayfindingPath(target.room, null, target.idx);
    if (route) {
      minX = Math.min(minX, route.fromLandmark.position.x - 0.04);
      maxX = Math.max(maxX, route.fromLandmark.position.x + 0.04);
      minY = Math.min(minY, route.fromLandmark.position.y - 0.04);
      maxY = Math.max(maxY, route.fromLandmark.position.y + 0.04);
    }

    const spanX = Math.max(0.28, (maxX - minX) * 1.45);
    const spanY = Math.max(0.28, (maxY - minY) * 1.45);
    const scale = Math.max(1.65, Math.min(2.65, 1 / Math.max(spanX, spanY)));

    const centerX = ((minX + maxX) * 0.5) * canvasSize.width;
    const centerY = ((minY + maxY) * 0.5) * canvasSize.height;

    const rawTx = canvasSize.width * 0.5 - centerX * scale;
    const rawTy = canvasSize.height * 0.5 - centerY * scale;

    const minTx = canvasSize.width * (1 - scale);
    const minTy = canvasSize.height * (1 - scale);

    return {
      scale,
      tx: Math.max(minTx, Math.min(0, rawTx)),
      ty: Math.max(minTy, Math.min(0, rawTy)),
      isZoomed: true,
    };
  }, [zoomedRoomId, enrichedRooms, canvasSize.width, canvasSize.height]);

  const toScreenPx = (normPt: Point2D): Point2D => {
    const base = normalizedToPixel(normPt, canvasSize.width, canvasSize.height);
    return {
      x: base.x * zoomViewport.scale + zoomViewport.tx,
      y: base.y * zoomViewport.scale + zoomViewport.ty,
    };
  };

  // Animated smooth values map for gliding transitions (FE-VIZ-04: Anti-flicker temporal smoothstep)
  interface AnimDeviceState {
    current: number;
    from: number;
    target: number;
    startTime: number;
    duration: number;
  }
  const animValuesRef = useRef<Map<string, AnimDeviceState>>(new Map());
  const prevLayerRef = useRef(layer);
  const lastDisplayUpdateRef = useRef<number>(0);

  // Sync new incoming telemetry targets into animated values map
  useEffect(() => {
    const layerChanged = prevLayerRef.current !== layer;
    prevLayerRef.current = layer;

    const now = performance.now();
    const roomCounts = new Map<string, number>();
    for (const d of devices) {
      if (d.roomId) {
        roomCounts.set(d.roomId, (roomCounts.get(d.roomId) ?? 0) + 1);
      }
    }
    for (const dev of devices) {
      const devTel = resolveDeviceTelemetry(
        dev,
        deviceTelemetryMap,
        roomTelemetryMap,
        dev.roomId ? (roomCounts.get(dev.roomId) ?? 1) : 1
      );
      const targetVal = extractLayerMetricValue(devTel, layer);
      if (targetVal !== null && Number.isFinite(targetVal)) {
        const existing = animValuesRef.current.get(dev.id);
        if (!existing || layerChanged) {
          animValuesRef.current.set(dev.id, {
            current: targetVal,
            from: targetVal,
            target: targetVal,
            startTime: now,
            duration: 2600,
          });
        } else if (Math.abs(existing.target - targetVal) > 0.005) {
          existing.from = existing.current;
          existing.target = targetVal;
          existing.startTime = now;
          existing.duration = 2600;
        }
      }
    }
  }, [devices, deviceTelemetryMap, roomTelemetryMap, layer]);

  // Observe container resize for responsive HiDPI rendering with exact TQB aspect ratio (76.0m x 57.2m -> 0.7526)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(
        400,
        Math.floor(width * TQB_BUILDING_ASPECT_RATIO)
      );
      setCanvasSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height }
      );
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    window.addEventListener('resize', updateSize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  // Dual-Layer Canvas Rendering with CAD Underlay, 2-Level Zoom, Adaptive Sigma & Multi-Scale Labels
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId = 0;
    let isCancelled = false;

    const render = () => {
      if (isCancelled) return;

      const now = performance.now();
      let isTransitioning = false;
      for (const state of animValuesRef.current.values()) {
        const elapsed = now - state.startTime;
        if (elapsed < state.duration) {
          const p = Math.max(0, Math.min(1, elapsed / state.duration));
          const s = p * p * (3 - 2 * p);
          state.current = state.from + (state.target - state.from) * s;
          isTransitioning = true;
        } else {
          state.current = state.target;
        }
      }

      if (isTransitioning) {
        if (now - lastDisplayUpdateRef.current >= 80) {
          lastDisplayUpdateRef.current = now;
          const newDisplays: Record<string, number> = {};
          for (const [id, state] of animValuesRef.current.entries()) {
            newDisplays[id] = Math.round(state.current * 10) / 10;
          }
          setDisplayValues(newDisplays);
        }
      } else if (lastDisplayUpdateRef.current !== 0) {
        lastDisplayUpdateRef.current = 0;
        const newDisplays: Record<string, number> = {};
        for (const [id, state] of animValuesRef.current.entries()) {
          newDisplays[id] = Math.round(state.target * 10) / 10;
        }
        setDisplayValues(newDisplays);
      }

      const dpr =
        typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const { width, height } = canvasSize;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Architectural Blueprint Background (Full viewport)
      ctx.fillStyle = '#0B1120';
      ctx.fillRect(0, 0, width, height);

      // Apply 2-Level Zoom Camera Transform
      ctx.save();
      ctx.translate(zoomViewport.tx, zoomViewport.ty);
      ctx.scale(zoomViewport.scale, zoomViewport.scale);

      // Subtle architectural coordinate grid (10m x 10m reference)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1 / zoomViewport.scale;
      const gridStepX = width / 7.6; // 10m intervals across 76.0m
      const gridStepY = height / 5.72; // 10m intervals across 57.2m
      for (let gx = gridStepX; gx < width; gx += gridStepX) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = gridStepY; gy < height; gy += gridStepY) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // 2. Render Central Atrium Void (Giếng trời thông tầng 417.87 m² trên Tầng 2-5)
      if (activeFloor >= 2) {
        const atriumX = 0.312 * width;
        const atriumY = 0.405 * height;
        const atriumW = 0.376 * width;
        const atriumH = 0.254 * height;
        const radius = Math.min(atriumW, atriumH) * 0.46;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(atriumX, atriumY, atriumW, atriumH, radius);
        ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
        ctx.fill();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 1.4 / zoomViewport.scale;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = `600 ${Math.max(9, Math.round(11 / Math.sqrt(zoomViewport.scale)))}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          'GIẾNG TRỜI THÔNG TẦNG (417.87 m²)',
          0.5 * width,
          0.532 * height
        );
        ctx.restore();
      }

      // 3. Render each room polygon with strict ctx.clip() & area-adaptive Gaussian diffusion
      for (const {
        room,
        idx,
        preset,
        polygon,
        microZones,
      } of enrichedRooms) {
        const pixelVertices = polygon.map((pt) =>
          normalizedToPixel(pt, width, height)
        );

        const roomDevices = devices.filter((d) => d.roomId === room.id);
        const onlineDevices = roomDevices.filter(
          (d) => d.online || d.connectionState === 'ONLINE'
        );
        const roomLatest = roomTelemetryMap[room.id];
        const roomMetricValue = extractLayerMetricValue(roomLatest, layer);

        // Build sample points from ONLINE devices using smooth animated values
        const idwSamples: IdwSamplePoint[] = [];
        for (const dev of onlineDevices) {
          if (typeof dev.posX === 'number' && typeof dev.posY === 'number') {
            const devTel = resolveDeviceTelemetry(
              dev,
              deviceTelemetryMap,
              roomTelemetryMap,
              roomDevices.length
            );
            const val = extractLayerMetricValue(devTel, layer);
            const animEntry = animValuesRef.current.get(dev.id);
            const smoothVal = animEntry ? animEntry.current : val;

            if (smoothVal !== null && Number.isFinite(smoothVal)) {
              idwSamples.push({
                x: dev.posX,
                y: dev.posY,
                value: smoothVal,
                online: true,
              });
            }
          }
        }

        // FE-VIZ-09 Compliant Anonymous Micro-zone Diffusion for USER / VIEWER:
        // When device hardware list is restricted (devices.length === 0) or room only has room-level telemetry,
        // synthesize spatial micro-zones across reading bays so students see realistic Case C gradients!
        if (
          idwSamples.length === 0 &&
          roomMetricValue !== null &&
          roomDevices.length === 0 &&
          microZones.length > 0
        ) {
          for (const bay of microZones) {
            const bayVal = bay.metrics[layer];
            if (typeof bayVal === 'number' && Number.isFinite(bayVal)) {
              idwSamples.push({
                x: bay.posX,
                y: bay.posY,
                value: bayVal,
                online: true,
              });
            }
          }
        }

        const hasOnlineTelemetry =
          (roomDevices.length === 0 && roomMetricValue !== null) ||
          (onlineDevices.length > 0 &&
            (idwSamples.length > 0 || roomMetricValue !== null)) ||
          roomMetricValue !== null;

        // Render Meteorological Continuous Gaussian RBF Diffusion Heatmap with Adaptive Sigma & Blindspots
        renderWeatherDiffusionHeatmap(
          ctx,
          pixelVertices,
          idwSamples,
          layer,
          width,
          height,
          roomMetricValue,
          0.26,
          {
            normalizedPolygon: polygon,
            showBlindspots,
          }
        );

        // 4. Draw Architectural Wall Stroke, BTCT Columns, Door & Multi-Scale Label
        const isSelected = room.id === selectedRoomId;
        const isZoomTarget = room.id === zoomedRoomId;
        const isZoneHighlighted =
          highlightedZoneIds &&
          highlightedZoneIds.length > 0 &&
          preset &&
          highlightedZoneIds.includes(preset.zoneCode);

        const primaryValue =
          idwSamples.length > 0
            ? idwSamples.reduce((sum, s) => sum + s.value, 0) /
              idwSamples.length
            : roomMetricValue;
        const wallColor = !hasOnlineTelemetry
          ? '#64748B'
          : getContinuousMetricColorCss(layer, primaryValue);

        ctx.save();
        ctx.beginPath();
        pixelVertices.forEach((p, vIdx) => {
          if (vIdx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();

        if (isSelected || isZoomTarget) {
          ctx.lineWidth = 3.2 / Math.sqrt(zoomViewport.scale);
          ctx.strokeStyle = '#38BDF8';
        } else if (isZoneHighlighted) {
          ctx.lineWidth = 2.6 / Math.sqrt(zoomViewport.scale);
          ctx.strokeStyle = '#F59E0B';
        } else {
          ctx.lineWidth = 1.8 / Math.sqrt(zoomViewport.scale);
          ctx.strokeStyle = wallColor;
        }
        ctx.stroke();

        // Render Structural Columns (BTCT) & Door Opening (CUA) when zoomed in or for large halls
        if (preset?.structuralColumns && (zoomViewport.isZoomed || preset.areaM2 >= 250)) {
          for (const colPt of preset.structuralColumns) {
            const colPx = normalizedToPixel(colPt, width, height);
            ctx.beginPath();
            ctx.arc(colPx.x, colPx.y, 4.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
            ctx.fill();
            ctx.lineWidth = 1.2 / zoomViewport.scale;
            ctx.strokeStyle = '#F8FAFC';
            ctx.stroke();
          }
        }

        if (preset?.doorPosition && (zoomViewport.isZoomed || isSelected)) {
          const doorPx = normalizedToPixel(preset.doorPosition, width, height);
          ctx.beginPath();
          ctx.arc(doorPx.x, doorPx.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#38BDF8';
          ctx.fill();
          ctx.lineWidth = 1.5 / zoomViewport.scale;
          ctx.strokeStyle = '#0F172A';
          ctx.stroke();
        }

        // Level 2 Focus Details: Draw Reading Bay (Micro-zone) dashed boundaries inside the focused room
        if (isZoomTarget && microZones.length > 1) {
          for (const bay of microZones) {
            const bayPx = normalizedToPixel(
              { x: bay.posX, y: bay.posY },
              width,
              height
            );
            const isBaySelected = bay.bayId === selectedBayId;
            ctx.save();
            ctx.beginPath();
            ctx.arc(bayPx.x, bayPx.y, isBaySelected ? 34 : 26, 0, Math.PI * 2);
            ctx.setLineDash([4, 3]);
            ctx.lineWidth = (isBaySelected ? 2 : 1.2) / zoomViewport.scale;
            ctx.strokeStyle = isBaySelected
              ? '#38BDF8'
              : 'rgba(226, 232, 240, 0.45)';
            ctx.stroke();
            ctx.restore();
          }
        }

        // Multi-scale Room Label (Compact Pill for small group rooms < 65m²; Rich Card for large halls >= 65m²)
        const centroidNorm = computePolygonCentroid(polygon);
        const centroidPx = normalizedToPixel(centroidNorm, width, height);
        const areaM2 =
          preset?.areaM2 ??
          Math.round(Math.abs(computePolygonSignedArea(polygon)) * 4347.2);
        const isSmallGroupRoom = areaM2 < 65;

        const codeLabel = preset?.code ?? room.code;
        const metricLabel = hasOnlineTelemetry
          ? formatLayerMetricValue(primaryValue, layer)
          : 'Offline';

        if (isSmallGroupRoom && !isZoomTarget) {
          // Compact Pill for Floor 5 Small Group Study Rooms (25.97 - 41.47 m²) so 8 rooms never collide
          const shortCode = codeLabel.replace(/^TQB_/, 'P.');
          const compactText = `${shortCode} · ${metricLabel}`;
          ctx.font = 'bold 10px JetBrains Mono, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const pillW = Math.max(54, ctx.measureText(compactText).width + 12);
          const pillH = 20;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
          ctx.strokeStyle = isSelected
            ? '#38BDF8'
            : 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(
            centroidPx.x - pillW / 2,
            centroidPx.y - pillH / 2,
            pillW,
            pillH,
            5
          );
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#F8FAFC';
          ctx.fillText(compactText, centroidPx.x, centroidPx.y);
        } else {
          // Rich Label for Large Reading / Multimedia / Storage Rooms (showing Room Code, Area, Avg & Min-Max spread)
          const values = idwSamples.map((s) => s.value);
          const minVal = values.length > 1 ? Math.min(...values) : null;
          const maxVal = values.length > 1 ? Math.max(...values) : null;
          const spreadText =
            minVal !== null &&
            maxVal !== null &&
            Math.abs(maxVal - minVal) >= 0.3
              ? `${minVal.toFixed(1)}–${maxVal.toFixed(1)}`
              : `${areaM2.toFixed(0)} m²`;

          // Detect local HVAC thermal imbalance for Maintenance Tech Overlay
          let techWarningText: string | null = null;
          if (showTechOverlay) {
            const blindspot = computeRoomBlindspotRatio(polygon, idwSamples);
            if (blindspot.isUnderCovered) {
              techWarningText = `⚠ Vùng mù ${Math.round(blindspot.blindspotRatio * 100)}%`;
            } else if (
              layer === 'temperature' &&
              minVal !== null &&
              maxVal !== null &&
              maxVal - minVal >= 2.2
            ) {
              techWarningText = `⚠ Lệch nhiệt ΔT ${(maxVal - minVal).toFixed(1)}°C`;
            }
          }

          ctx.font = 'bold 12px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const titleLine = `${codeLabel} (${areaM2.toFixed(0)}m²)`;
          const subLine = `${metricLabel} · [${spreadText}]`;

          const pillWidth =
            Math.max(
              ctx.measureText(titleLine).width,
              ctx.measureText(subLine).width,
              techWarningText ? ctx.measureText(techWarningText).width : 0
            ) + 18;
          const pillHeight = techWarningText ? 48 : 36;

          ctx.fillStyle = 'rgba(15, 23, 42, 0.80)';
          ctx.strokeStyle = isSelected
            ? '#38BDF8'
            : techWarningText
              ? '#F59E0B'
              : 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1.2 / Math.sqrt(zoomViewport.scale);
          ctx.beginPath();
          ctx.roundRect(
            centroidPx.x - pillWidth / 2,
            centroidPx.y - pillHeight / 2,
            pillWidth,
            pillHeight,
            6
          );
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#F8FAFC';
          ctx.fillText(
            titleLine,
            centroidPx.x,
            centroidPx.y - (techWarningText ? 13 : 7)
          );

          ctx.font = '600 10.5px JetBrains Mono, monospace';
          ctx.fillStyle = hasOnlineTelemetry ? '#38BDF8' : '#94A3B8';
          ctx.fillText(
            subLine,
            centroidPx.x,
            centroidPx.y + (techWarningText ? 1 : 8)
          );

          if (techWarningText) {
            ctx.font = 'bold 9.5px Inter, system-ui, sans-serif';
            ctx.fillStyle = '#FBBF24';
            ctx.fillText(techWarningText, centroidPx.x, centroidPx.y + 15);
          }
        }

        ctx.restore();
      }

      // 5. Overlay Authentic TQB Architectural CAD Underlay (TUONG, CUA, BTCT, THANG, NOITHAT)
      if (showCadUnderlay) {
        const svgPath = getFloorCadSvgPath(activeFloor);
        const cadImg = cadImagesRef.current.get(svgPath);
        if (cadImg) {
          ctx.save();
          ctx.globalAlpha = zoomViewport.isZoomed ? 0.62 : 0.42;
          ctx.drawImage(cadImg, 0, 0, width, height);
          ctx.restore();
        }
      }

      // 6. Render Wayfinding Path (Lộ trình dẫn đường từ Thang máy / Cầu thang gần nhất vào Phòng / Bàn đọc)
      const activeRoomEntry = enrichedRooms.find(
        (er) => er.room.id === (zoomedRoomId ?? selectedRoomId)
      );
      if ((showWayfinding || zoomViewport.isZoomed) && activeRoomEntry) {
        const selectedBay = activeRoomEntry.microZones.find(
          (b) => b.bayId === selectedBayId
        );
        const targetPt = selectedBay
          ? { x: selectedBay.posX, y: selectedBay.posY }
          : null;
        const route = computeWayfindingPath(
          activeRoomEntry.room,
          targetPt,
          activeRoomEntry.idx
        );

        if (route && route.waypoints.length >= 2) {
          ctx.save();
          ctx.beginPath();
          route.waypoints.forEach((wp, idx) => {
            const px = normalizedToPixel(wp, width, height);
            if (idx === 0) ctx.moveTo(px.x, px.y);
            else ctx.lineTo(px.x, px.y);
          });
          ctx.setLineDash([8, 5]);
          ctx.lineWidth = 3 / Math.sqrt(zoomViewport.scale);
          ctx.strokeStyle = '#38BDF8';
          ctx.shadowColor = '#38BDF8';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw start & target wayfinding markers
          const startPx = normalizedToPixel(route.waypoints[0], width, height);
          const endPx = normalizedToPixel(
            route.waypoints[route.waypoints.length - 1],
            width,
            height
          );

          ctx.beginPath();
          ctx.arc(startPx.x, startPx.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#10B981';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(endPx.x, endPx.y, 6, 0, Math.PI * 2);
          ctx.fillStyle = '#38BDF8';
          ctx.fill();

          // Distance label along route
          const midPt = route.waypoints[1];
          const midPx = normalizedToPixel(midPt, width, height);
          const distLabel = `🚶 ~${route.distanceMeters}m từ ${route.fromLandmark.shortLabel}`;
          ctx.font = 'bold 10.5px Inter, system-ui, sans-serif';
          const dw = ctx.measureText(distLabel).width + 14;
          ctx.fillStyle = 'rgba(14, 116, 144, 0.92)';
          ctx.beginPath();
          ctx.roundRect(midPx.x - dw / 2, midPx.y - 11, dw, 22, 10);
          ctx.fill();
          ctx.fillStyle = '#F8FAFC';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(distLabel, midPx.x, midPx.y);
          ctx.restore();
        }
      }

      ctx.restore(); // End zoom camera transform
      ctx.restore(); // End HiDPI scale

      if (isTransitioning) {
        rafId = window.requestAnimationFrame(render);
      }
    };

    rafId = window.requestAnimationFrame(render);

    return () => {
      isCancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [
    canvasSize,
    enrichedRooms,
    devices,
    roomTelemetryMap,
    deviceTelemetryMap,
    layer,
    selectedRoomId,
    zoomedRoomId,
    selectedBayId,
    showWayfinding,
    showBlindspots,
    showTechOverlay,
    showCadUnderlay,
    cadImageLoadedFloor,
    activeFloor,
    zoomViewport,
    highlightedZoneIds,
  ]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rawClickPx: Point2D = {
      x: (e.clientX - rect.left - zoomViewport.tx) / zoomViewport.scale,
      y: (e.clientY - rect.top - zoomViewport.ty) / zoomViewport.scale,
    };
    const normPt = pixelToNormalized(
      rawClickPx,
      canvasSize.width,
      canvasSize.height
    );

    for (const { room, polygon } of enrichedRooms) {
      if (isPointInPolygon(normPt, polygon)) {
        onSelectRoom(room);
        return;
      }
    }
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const rawClickPx: Point2D = {
      x: (e.clientX - rect.left - zoomViewport.tx) / zoomViewport.scale,
      y: (e.clientY - rect.top - zoomViewport.ty) / zoomViewport.scale,
    };
    const normPt = pixelToNormalized(
      rawClickPx,
      canvasSize.width,
      canvasSize.height
    );

    for (const { room, polygon } of enrichedRooms) {
      if (isPointInPolygon(normPt, polygon)) {
        onSelectRoom(room);
        setZoomedRoomId(zoomedRoomId === room.id ? null : room.id);
        return;
      }
    }
  };

  // Devices that have normalized coordinates on this floor (Role ADMIN / LIBRARIAN / MAINTENANCE)
  const positionedDevices = useMemo(
    () =>
      devices.filter(
        (d) =>
          d.roomId &&
          roomById.has(d.roomId) &&
          typeof d.posX === 'number' &&
          typeof d.posY === 'number'
      ),
    [devices, roomById]
  );

  // Wayfinding architectural landmarks on this floor (Stairs, Elevators, WC, Gate)
  const floorLandmarks = useMemo(
    () =>
      getFloorLandmarks(activeFloor).filter((lm) => lm.kind !== 'ATRIUM'),
    [activeFloor]
  );

  // Anonymous Reading Bays to display as interactive pills when hardware devices are hidden (FE-VIZ-09) or when zoomed into a room
  const visibleAnonymousBays = useMemo(() => {
    const items: Array<{ bay: AnonymousMicroZone; room: RoomResponse }> = [];
    for (const { room, preset, microZones } of enrichedRooms) {
      const roomHasDevices = positionedDevices.some(
        (d) => d.roomId === room.id
      );
      const isFocused = room.id === zoomedRoomId || room.id === selectedRoomId;
      const isLargeRoom = (preset?.areaM2 ?? 100) >= 120;

      // Show reading bays if:
      // 1) User has no device visibility (USER/VIEWER role) and room is large or selected
      // 2) Room is zoomed in (Level 2 Focus) and has no raw device pin at the exact same spot
      if (!roomHasDevices && (isLargeRoom || isFocused)) {
        for (const bay of microZones) {
          items.push({ bay, room });
        }
      }
    }
    return items;
  }, [enrichedRooms, positionedDevices, zoomedRoomId, selectedRoomId]);

  const landmarkIcon = (kind: TqbLandmark['kind']) => {
    switch (kind) {
      case 'ELEVATOR':
        return '🛗';
      case 'STAIRS':
        return '🪜';
      case 'WC':
        return '🚻';
      case 'ENTRANCE':
        return '🚪';
      default:
        return '📍';
    }
  };

  const selectedRoomObj = selectedRoomId
    ? roomById.get(selectedRoomId) ?? null
    : null;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-inner"
    >
      {/* Top Floating Controls: CAD Layer Toggle & 2-Level Zoom Controls */}
      <div className="pointer-events-auto absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowCadUnderlay((v) => !v)}
          className={`rounded-lg border px-2.5 py-1 text-xs font-medium shadow-md backdrop-blur transition-colors ${
            showCadUnderlay
              ? 'border-sky-500/60 bg-slate-900/90 text-sky-300'
              : 'border-slate-700 bg-slate-900/75 text-slate-400 hover:text-slate-200'
          }`}
          title="Bật/tắt lớp bản vẽ kỹ thuật AutoCAD Tạ Quang Bửu (Tường, Cửa, Cột BTCT, Cầu thang)"
        >
          📐 Nền CAD TQB 1:100 ({showCadUnderlay ? 'Bật' : 'Tắt'})
        </button>

        {zoomViewport.isZoomed ? (
          <button
            type="button"
            onClick={() => setZoomedRoomId(null)}
            className="flex items-center gap-1.5 rounded-lg border border-amber-400/70 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200 shadow-md backdrop-blur hover:bg-amber-500/30"
          >
            <span>🗺️ Thu nhỏ về Toàn mặt bằng Tầng {activeFloor}</span>
          </button>
        ) : (
          selectedRoomObj && (
            <button
              type="button"
              onClick={() => setZoomedRoomId(selectedRoomObj.id)}
              className="flex items-center gap-1.5 rounded-lg border border-sky-400/60 bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-200 shadow-md backdrop-blur hover:bg-sky-500/30"
            >
              <span>🔍 Phóng to Chi tiết {selectedRoomObj.code} (Cấp 2)</span>
            </button>
          )
        )}
      </div>

      {/* Compass & Scale Badge (Top Right) */}
      <div className="pointer-events-none absolute right-3 top-3 z-20 hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/85 px-2.5 py-1 text-2xs font-mono text-slate-300 backdrop-blur sm:flex">
        <span className="text-sky-400 font-bold">⬆ BẮC</span>
        <span>·</span>
        <span>Khung thực 76.0m × 57.2m</span>
        <span>·</span>
        <span>
          {zoomViewport.isZoomed
            ? `Zoom ${zoomViewport.scale.toFixed(1)}x (Cấp 2)`
            : 'Toàn tầng (Cấp 1)'}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onDoubleClick={handleCanvasDoubleClick}
        className="block cursor-pointer select-none"
        aria-label="Bản đồ không gian mặt bằng và Heatmap 2D Thư viện Tạ Quang Bửu"
      />

      {/* Layer 2A: Architectural Wayfinding Landmarks (Stairs, Elevators, WC, Entrance) */}
      <div className="pointer-events-none absolute inset-0">
        {floorLandmarks.map((lm) => {
          const px = toScreenPx(lm.position);
          if (
            px.x < -20 ||
            px.x > canvasSize.width + 20 ||
            px.y < -20 ||
            px.y > canvasSize.height + 20
          ) {
            return null;
          }
          return (
            <div
              key={lm.id}
              style={{ left: `${px.x}px`, top: `${px.y}px` }}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
              title={lm.labelVi}
            >
              <div className="flex items-center gap-1 rounded-full border border-slate-700/90 bg-slate-900/90 px-1.5 py-0.5 text-2xs font-medium text-slate-300 shadow-sm backdrop-blur">
                <span aria-hidden="true">{landmarkIcon(lm.kind)}</span>
                <span className="hidden md:inline">{lm.shortLabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Layer 2B: Anonymous Reading Bay Micro-zones for USER / VIEWER (FE-VIZ-09 hardware-safe!) */}
      <div className="pointer-events-none absolute inset-0">
        {visibleAnonymousBays.map(({ bay, room }) => {
          const px = toScreenPx({ x: bay.posX, y: bay.posY });
          if (
            px.x < 0 ||
            px.x > canvasSize.width ||
            px.y < 0 ||
            px.y > canvasSize.height
          ) {
            return null;
          }
          const bayVal = bay.metrics[layer];
          const colorCss = getContinuousMetricColorCss(layer, bayVal);
          const isSelectedBay = bay.bayId === selectedBayId;
          const isHoveredBay = bay.bayId === hoveredBayId;

          return (
            <div
              key={bay.bayId}
              style={{ left: `${px.x}px`, top: `${px.y}px` }}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
            >
              <button
                type="button"
                onMouseEnter={() => setHoveredBayId(bay.bayId)}
                onMouseLeave={() => setHoveredBayId(null)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectRoom(room);
                  onSelectBay?.(bay, room);
                }}
                aria-label={`Phân khu bàn đọc ${bay.nameVi} (${room.name})`}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-semibold shadow-md transition-transform hover:scale-110 ${
                  isSelectedBay
                    ? 'scale-110 border-sky-300 bg-sky-950/95 text-sky-100 ring-2 ring-sky-400'
                    : 'border-white/40 bg-slate-900/90 text-slate-100'
                }`}
                style={{
                  boxShadow: `0 0 10px ${colorCss}`,
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: colorCss }}
                />
                <span>{bay.shortLabel}</span>
                <span className="font-mono text-sky-300">
                  {formatLayerMetricValue(bayVal, layer)}
                </span>
              </button>

              {isHoveredBay && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-8 left-1/2 z-30 w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 shadow-xl"
                >
                  <p className="font-semibold text-slate-900">{bay.nameVi}</p>
                  <p className="mt-0.5 text-2xs text-slate-500">
                    {bay.descriptionVi}
                  </p>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 border-t border-slate-100 pt-1.5 font-mono text-2xs text-slate-700">
                    <span>Tiện nghi: {bay.metrics.comfortScore}</span>
                    <span>Sức chứa: {bay.seatCapacity} chỗ</span>
                    <span>Nhiệt: {bay.metrics.temperature}°C</span>
                    <span>Ồn: {bay.metrics.noiseAvg} dBA</span>
                    <span>Sáng: {bay.metrics.lux} lx</span>
                    <span>Ẩm: {bay.metrics.humidity}%RH</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Layer 2C: Interactive Hardware Device Pins Overlay (Only when devices are provided for authorized roles) */}
      <div className="pointer-events-none absolute inset-0">
        {positionedDevices.map((device) => {
          const px = toScreenPx({ x: device.posX!, y: device.posY! });
          if (
            px.x < -10 ||
            px.x > canvasSize.width + 10 ||
            px.y < -10 ||
            px.y > canvasSize.height + 10
          ) {
            return null;
          }
          const room = device.roomId ? roomById.get(device.roomId) : undefined;
          const roomDeviceCount = device.roomId
            ? devices.filter((d) => d.roomId === device.roomId).length
            : 1;
          const devTel = resolveDeviceTelemetry(
            device,
            deviceTelemetryMap,
            roomTelemetryMap,
            roomDeviceCount
          );
          const rawMetricVal = extractLayerMetricValue(devTel, layer);
          const activeVal = displayValues[device.id] ?? rawMetricVal;
          const colorHex = device.online
            ? getContinuousMetricColorCss(layer, activeVal)
            : '#64748B';
          const isHovered = hoveredDeviceId === device.id;

          const isAbnormal =
            device.online &&
            ((layer === 'temperature' &&
              typeof activeVal === 'number' &&
              activeVal >= 24.5) ||
              (layer === 'noiseAvg' &&
                typeof activeVal === 'number' &&
                activeVal >= 50.0) ||
              (layer === 'pm2_5' &&
                typeof activeVal === 'number' &&
                activeVal >= 22.0) ||
              (layer === 'humidity' &&
                typeof activeVal === 'number' &&
                activeVal >= 60.0) ||
              (layer === 'wifiRssi' &&
                typeof activeVal === 'number' &&
                activeVal <= -75.0));

          return (
            <div
              key={device.id}
              style={{
                left: `${px.x}px`,
                top: `${px.y}px`,
              }}
              className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
            >
              {isAbnormal && (
                <span
                  className="pointer-events-none absolute -inset-2 animate-ping rounded-full opacity-60"
                  style={{ backgroundColor: colorHex }}
                />
              )}
              <button
                type="button"
                onMouseEnter={() => setHoveredDeviceId(device.id)}
                onMouseLeave={() => setHoveredDeviceId(null)}
                onFocus={() => setHoveredDeviceId(device.id)}
                onBlur={() => setHoveredDeviceId(null)}
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (room) onSelectRoom(room);
                  onSelectDevice?.(device, room);
                }}
                aria-label={`Trạm cảm biến ${device.name} (${device.hardwareId}) - ${
                  device.online ? 'Trực tuyến' : 'Mất kết nối'
                }`}
                className={`relative group flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all hover:scale-125 focus:scale-125 focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                  device.online
                    ? 'border-2 border-white shadow-lg'
                    : 'border-2 border-dashed border-slate-400 bg-slate-800/90 text-slate-300 opacity-85'
                }`}
                style={
                  device.online
                    ? {
                        backgroundColor: colorHex,
                        color: '#0F172A',
                        boxShadow: `0 0 14px ${colorHex}, 0 2px 4px rgba(0,0,0,0.6)`,
                        transition:
                          'background-color 0.4s ease-out, box-shadow 0.4s ease-out',
                      }
                    : undefined
                }
              >
                <span aria-hidden="true">{device.online ? '●' : '✕'}</span>
              </button>

              {activeVal !== null && (
                <div
                  className="pointer-events-none mt-1 -translate-x-0 rounded border px-1.5 py-0.5 text-center font-mono text-2xs font-bold shadow-md"
                  style={{
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    borderColor: device.online ? colorHex : '#64748B',
                    color: '#F8FAFC',
                    whiteSpace: 'nowrap',
                    transition: 'border-color 0.4s ease-out',
                  }}
                >
                  {formatLayerMetricValue(activeVal, layer)}
                </div>
              )}

              {isHovered && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute bottom-9 left-1/2 z-30 w-56 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 shadow-lg"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-slate-900">
                      {device.name}
                    </span>
                    <span
                      className={`badge ${
                        device.online ? 'badge-success' : 'badge-neutral'
                      }`}
                    >
                      {device.online ? 'Trực tuyến' : 'Mất kết nối'}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-2xs text-slate-400">
                    {device.hardwareId}
                  </p>
                  {room && (
                    <p className="mt-0.5 truncate text-2xs text-slate-500">
                      {room.code} — {room.name}
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-1 border-t border-slate-100 pt-1.5 font-mono text-2xs text-slate-600">
                    <span>
                      Điểm:{' '}
                      {formatMetrics.comfortScore(
                        devTel?.comfortScore?.overall
                      )}
                    </span>
                    <span>
                      Ồn: {formatMetrics.noise(devTel?.acoustics?.noiseAvg)}
                    </span>
                    <span>
                      PM2.5: {formatMetrics.pm(devTel?.airQuality?.pm2_5)}
                    </span>
                    <span>
                      Nhiệt:{' '}
                      {formatMetrics.temperature(
                        devTel?.environment?.temperature
                      )}
                    </span>
                    <span>
                      Ẩm:{' '}
                      {formatMetrics.humidity(devTel?.environment?.humidity)}
                    </span>
                    <span>
                      Sáng: {formatMetrics.lux(devTel?.environment?.lux)}
                    </span>
                    <span className="col-span-2">
                      Wi-Fi RSSI: {formatMetrics.rssi(devTel?.wifiRssi)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
