'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Compass,
  Droplets,
  Eye,
  Layers,
  Navigation,
  Radio,
  ShieldAlert,
  Sparkles,
  Sun,
  Thermometer,
  Users,
  Volume2,
  Wifi,
  Wind,
  Wrench,
  X,
} from 'lucide-react';
import {
  TQB_ROOM_PRESETS,
  computeWayfindingPath,
  getFloorRoomPresets,
  resolveRoomPolygon,
  resolveRoomPreset,
  synthesizeAnonymousMicroZones,
  type AnonymousMicroZone,
} from '@/config/tqb-floorplan-presets';
import { type HeatmapLayerMetric } from '@/config/thresholds';
import { UI_TEXT_VI } from '@/messages/vi';
import { formatMetrics } from '@/lib/format/metrics';
import {
  useRoomTelemetryStream,
  useStompConnectionState,
} from '@/lib/realtime/use-room-stream';
import {
  ConnectionBadge,
  EmptyState,
  ErrorBanner,
  GradeBadge,
  Skeleton,
} from '@/components/ui/primitives';
import {
  useAcknowledgeAlertMutation,
  useAlertsQuery,
  useResolveAlertMutation,
} from '@/features/alerts/queries';
import { useAuthStore } from '@/features/auth/store';
import { useRoomsQuery } from '@/features/rooms/queries';
import { useDevicesQuery } from '@/features/devices/queries';
import { telemetryKeys } from '@/features/telemetry/queries';
import { telemetryApi } from '@/features/telemetry/api';
import {
  FloorplanCanvas,
  extractLayerMetricValue,
  formatLayerMetricValue,
} from '@/features/floorplan/components/FloorplanCanvas';
import {
  WEATHER_PALETTES,
  computeRoomBlindspotRatio,
  getPaletteCssGradient,
} from '@/lib/floorplan/weatherPalette';
import type {
  AlertResponse,
  DeviceResponse,
  RoleName,
  RoomResponse,
  TelemetryResponse,
} from '@/types/api';

const FLOOR_OPTIONS = [1, 2, 3, 4, 5, 0];

const LAYER_OPTIONS: Array<{
  key: HeatmapLayerMetric;
  label: string;
  shortLabel: string;
  unitLabel: string;
}> = [
  {
    key: 'comfortScore',
    label: 'Điểm tiện nghi',
    shortLabel: 'Tiện nghi',
    unitLabel: '0–100',
  },
  {
    key: 'noiseAvg',
    label: 'Độ ồn TB (LAeq)',
    shortLabel: 'Độ ồn',
    unitLabel: 'dBA',
  },
  {
    key: 'temperature',
    label: 'Nhiệt độ phòng',
    shortLabel: 'Nhiệt độ',
    unitLabel: '°C',
  },
  {
    key: 'humidity',
    label: 'Độ ẩm (Kho sách)',
    shortLabel: 'Độ ẩm',
    unitLabel: '%RH',
  },
  {
    key: 'lux',
    label: 'Độ rọi sáng',
    shortLabel: 'Ánh sáng',
    unitLabel: 'lux',
  },
  {
    key: 'pm2_5',
    label: 'Bụi mịn PM2.5',
    shortLabel: 'PM2.5',
    unitLabel: 'µg/m³',
  },
  {
    key: 'wifiRssi',
    label: 'Sóng Wi-Fi (RSSI)',
    shortLabel: 'Wi-Fi RSSI',
    unitLabel: 'dBm',
  },
];

type StudyFilterMode = 'quiet' | 'group' | 'bright_cool' | 'multimedia';

type EffectiveRoleView = 'ADMIN' | 'LIBRARIAN' | 'MAINTENANCE' | 'USER';

function RoomStreamSubscriber({ roomId }: { roomId: string }) {
  // Only subscribe to real backend MongoDB ObjectId rooms (not synthetic preset preview rooms)
  if (roomId.startsWith('PRESET_')) return null;
  return <RoomStreamInner roomId={roomId} />;
}

function RoomStreamInner({ roomId }: { roomId: string }) {
  useRoomTelemetryStream(roomId);
  return null;
}

/**
 * Tạo Telemetry mẫu thực tế theo đặc trưng từng phòng TQB cho các phòng Preset chưa có bản ghi trực tiếp từ Backend
 * để đảm bảo mọi tầng (Tầng 1, 3, 5) đều hiển thị đầy đủ trường nhiệt động học đa chiều.
 */
function buildPresetFallbackTelemetry(
  room: RoomResponse,
  indexOnFloor: number
): TelemetryResponse {
  const preset = resolveRoomPreset(room, indexOnFloor);
  const isStorage = (preset?.roomType ?? room.type) === 'BOOK_STORAGE';
  const isHall = (preset?.roomType ?? room.type) === 'CIRCULATION_HALL';
  const isGroup = (preset?.areaM2 ?? 100) < 60;

  const seed = (indexOnFloor + 1) * 1.7 + room.floor * 0.9;
  const temp = isStorage
    ? 21.8 + (seed % 1.4)
    : isGroup
      ? 22.4 + (seed % 1.6)
      : 22.6 + (seed % 2.1);
  const humidity = isStorage ? 55.0 + (seed % 6.5) : 52.0 + (seed % 7.0);
  const noiseAvg = isStorage
    ? 36.5 + (seed % 4.0)
    : isHall
      ? 48.0 + (seed % 6.0)
      : isGroup
        ? 45.5 + (seed % 6.5)
        : 39.2 + (seed % 5.5);
  const lux = isStorage ? 240 + ((seed * 30) % 80) : 390 + ((seed * 45) % 160);
  const pm25 = 11.5 + (seed % 7.5);
  const overall = Math.round(
    Math.max(68, Math.min(96, 92 - (noiseAvg - 38) * 0.6 - Math.abs(temp - 22.8) * 3))
  );

  return {
    id: `SYNTH_TEL_${room.id}`,
    timestamp: new Date().toISOString(),
    metadata: {
      deviceId: `SYNTH_DEV_${room.id}`,
      hardwareId: `TQB_SIM_${room.code}`,
      roomId: room.id,
    },
    acoustics: {
      noiseAvg: +noiseAvg.toFixed(1),
      noisePeak: +(noiseAvg + 5.2).toFixed(1),
    },
    airQuality: {
      pm1_0: +(pm25 * 0.65).toFixed(1),
      pm2_5: +pm25.toFixed(1),
      pm4_0: +(pm25 * 1.25).toFixed(1),
      pm10: +(pm25 * 1.55).toFixed(1),
    },
    environment: {
      temperature: +temp.toFixed(1),
      humidity: +humidity.toFixed(1),
      lux: Math.round(lux),
    },
    comfortScore: {
      overall,
      grade: overall >= 90 ? 'Platinum' : overall >= 75 ? 'Gold' : 'Silver',
      acousticScore: Math.round(Math.max(60, 100 - (noiseAvg - 35) * 1.4)),
      airScore: Math.round(Math.max(70, 100 - pm25 * 0.9)),
      thermalScore: Math.round(Math.max(65, 100 - Math.abs(temp - 22.5) * 7)),
      lightScore: 90,
    },
    wifiRssi: Math.round(-54 - ((seed * 4) % 18)),
  };
}

export default function FloorplanPage() {
  const [selectedFloor, setSelectedFloor] = useState<number>(3);
  const [selectedLayer, setSelectedLayer] =
    useState<HeatmapLayerMetric>('comfortScore');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [zoomedRoomId, setZoomedRoomId] = useState<string | null>(null);
  const [focusedDeviceId, setFocusedDeviceId] = useState<string | null>(null);
  const [selectedBayId, setSelectedBayId] = useState<string | null>(null);
  const [studyFilter, setStudyFilter] = useState<StudyFilterMode>('quiet');
  const [showWayfinding, setShowWayfinding] = useState<boolean>(true);
  const [showBlindspots, setShowBlindspots] = useState<boolean>(true);
  const [onlyAssignedZones, setOnlyAssignedZones] = useState<boolean>(false);
  const [includeTqbArchitecturePresets, setIncludeTqbArchitecturePresets] =
    useState<boolean>(true);
  const [adminRoleOverride, setAdminRoleOverride] =
    useState<EffectiveRoleView | null>(null);

  const capabilities = useAuthStore((s) => s.capabilities);
  const currentUser = useAuthStore((s) => s.user);
  const stompConnected = useStompConnectionState();

  // Xác định góc nhìn Role đang kích hoạt (cho phép ADMIN chuyển đổi góc nhìn 4 Role ngay trên thanh công cụ)
  const defaultRoleView: EffectiveRoleView = useMemo(() => {
    if (capabilities.isAdmin) return 'ADMIN';
    if (capabilities.isMaintenance) return 'MAINTENANCE';
    if (capabilities.isLibrarian || capabilities.isZoneManager) {
      return 'LIBRARIAN';
    }
    return 'USER';
  }, [capabilities]);

  const effectiveRole: EffectiveRoleView = capabilities.isAdmin
    ? (adminRoleOverride ?? defaultRoleView)
    : defaultRoleView;

  const isStudentView = effectiveRole === 'USER';
  const isLibrarianView =
    effectiveRole === 'LIBRARIAN' || effectiveRole === 'ADMIN';
  const isMaintenanceView = effectiveRole === 'MAINTENANCE';

  const roomsQuery = useRoomsQuery({
    page: 0,
    size: 50,
    floor: selectedFloor,
  });

  // FE-VIZ-09: Khi ở góc nhìn USER/VIEWER, tuyệt đối không hiển thị danh sách thiết bị phần cứng
  const devicesQuery = useDevicesQuery(
    { page: 0, size: 100 },
    capabilities.canViewDevices && !isStudentView
  );

  // Tích hợp danh sách Cảnh báo thời gian thực (Alert FSM) cho LIBRARIAN / ZONE_MANAGER / MAINTENANCE / ADMIN
  const alertsQuery = useAlertsQuery(
    { page: 0, size: 50 },
    capabilities.canViewAlerts && !isStudentView
  );
  const ackAlertMutation = useAcknowledgeAlertMutation();
  const resolveAlertMutation = useResolveAlertMutation();

  const backendFloorRooms = useMemo(
    () => roomsQuery.data?.content ?? [],
    [roomsQuery.data]
  );

  // Kết hợp phòng từ Backend DB với mặt bằng kiến trúc chuẩn TQB (`Mat bang Thu vien TQB.pdf`)
  // để các tầng đại diện (Tầng 1, 2, 3, 4, 5) luôn hiển thị đầy đủ các phòng đọc, kho sách và cụm 8 phòng nhóm Tầng 5
  const floorRooms: RoomResponse[] = useMemo(() => {
    const presetsOnFloor = getFloorRoomPresets(selectedFloor);
    const enrichedBackend = backendFloorRooms.map((r, idx) => {
      const poly = resolveRoomPolygon(r, idx);
      const preset = resolveRoomPreset(r, idx);
      return {
        ...r,
        type: r.type ?? preset?.roomType ?? 'STUDY_ROOM',
        capacity: r.capacity ?? preset?.capacity ?? 60,
        boundaryPolygon: poly ? [...poly] : r.boundaryPolygon,
      };
    });

    if (!includeTqbArchitecturePresets) {
      return enrichedBackend;
    }

    const matchedPresetCodes = new Set<string>();
    enrichedBackend.forEach((r, idx) => {
      const matched = resolveRoomPreset(r, idx);
      if (matched) matchedPresetCodes.add(matched.code);
    });

    const missingPresets: RoomResponse[] = presetsOnFloor
      .filter((p) => !matchedPresetCodes.has(p.code))
      .map((p) => ({
        id: `PRESET_${p.code}`,
        code: p.code,
        name: p.name,
        floor: selectedFloor,
        capacity: p.capacity,
        type: p.roomType,
        targetComfortScore: p.roomType === 'BOOK_STORAGE' ? 90 : 85,
        description: `Không gian chuẩn kiến trúc TQB (${p.areaM2} m² · Phân khu ${p.zoneCode})`,
        boundaryPolygon: [...p.boundaryPolygon],
      }));

    return [...enrichedBackend, ...missingPresets];
  }, [backendFloorRooms, selectedFloor, includeTqbArchitecturePresets]);

  // Lọc theo assignedZones nếu là ZONE_MANAGER và đang bật chế độ lọc phân khu phụ trách
  const assignedZones = useMemo(
    () =>
      currentUser?.assignedZones && currentUser.assignedZones.length > 0
        ? currentUser.assignedZones
        : ['ZONE_A', 'ZONE_B'],
    [currentUser]
  );

  const visibleFloorRooms = useMemo(() => {
    if (!onlyAssignedZones) return floorRooms;
    return floorRooms.filter((r, idx) => {
      const preset = resolveRoomPreset(r, idx);
      return preset ? assignedZones.includes(preset.zoneCode) : true;
    });
  }, [floorRooms, onlyAssignedZones, assignedZones]);

  const allDevices = useMemo(
    () => (isStudentView ? [] : (devicesQuery.data?.content ?? [])),
    [devicesQuery.data, isStudentView]
  );

  const floorRoomIds = useMemo(
    () => new Set(floorRooms.map((r) => r.id)),
    [floorRooms]
  );

  const floorDevices = useMemo(
    () => allDevices.filter((d) => d.roomId && floorRoomIds.has(d.roomId)),
    [allDevices, floorRoomIds]
  );

  const realFloorRooms = useMemo(
    () => floorRooms.filter((r) => !r.id.startsWith('PRESET_')),
    [floorRooms]
  );

  const roomLatestQueries = useQueries({
    queries: realFloorRooms.map((room) => ({
      queryKey: telemetryKeys.roomLatest(room.id),
      queryFn: () => telemetryApi.getRoomLatest(room.id),
      refetchInterval: stompConnected ? (false as const) : 15000,
    })),
  });

  const deviceLatestQueries = useQueries({
    queries: floorDevices.map((device) => ({
      queryKey: telemetryKeys.deviceLatest(device.id),
      queryFn: () => telemetryApi.getDeviceLatest(device.id),
      refetchInterval: stompConnected ? (false as const) : 15000,
    })),
  });

  const roomTelemetryMap = useMemo(() => {
    const map: Record<string, TelemetryResponse | null | undefined> = {};
    const realMap = new Map<string, TelemetryResponse | null>();
    realFloorRooms.forEach((room, index) => {
      realMap.set(room.id, roomLatestQueries[index]?.data ?? null);
    });

    floorRooms.forEach((room, idx) => {
      const realTel = realMap.get(room.id);
      if (realTel) {
        map[room.id] = realTel;
      } else if (room.id.startsWith('PRESET_')) {
        map[room.id] = buildPresetFallbackTelemetry(room, idx);
      } else {
        map[room.id] = null;
      }
    });
    return map;
  }, [floorRooms, realFloorRooms, roomLatestQueries]);

  const deviceTelemetryMap = useMemo(() => {
    const map: Record<string, TelemetryResponse | null | undefined> = {};
    floorDevices.forEach((device, index) => {
      map[device.id] = deviceLatestQueries[index]?.data ?? null;
    });
    return map;
  }, [floorDevices, deviceLatestQueries]);

  const unconfiguredRooms = useMemo(
    () =>
      backendFloorRooms.filter(
        (r) => !Array.isArray(r.boundaryPolygon) || r.boundaryPolygon.length < 3
      ),
    [backendFloorRooms]
  );

  const selectedRoom: RoomResponse | null = useMemo(
    () => floorRooms.find((r) => r.id === selectedRoomId) ?? null,
    [floorRooms, selectedRoomId]
  );

  const selectedRoomIdx = useMemo(
    () =>
      selectedRoom
        ? Math.max(
            0,
            floorRooms.findIndex((r) => r.id === selectedRoom.id)
          )
        : 0,
    [floorRooms, selectedRoom]
  );

  const selectedRoomPreset = useMemo(
    () =>
      selectedRoom ? resolveRoomPreset(selectedRoom, selectedRoomIdx) : null,
    [selectedRoom, selectedRoomIdx]
  );

  const selectedRoomTelemetry = selectedRoom
    ? roomTelemetryMap[selectedRoom.id]
    : null;

  const selectedRoomMicroZones = useMemo(
    () =>
      selectedRoom
        ? synthesizeAnonymousMicroZones(
            selectedRoom,
            selectedRoomTelemetry,
            selectedRoomIdx
          )
        : [],
    [selectedRoom, selectedRoomTelemetry, selectedRoomIdx]
  );

  const selectedRoomWayfinding = useMemo(() => {
    if (!selectedRoom) return null;
    const bay = selectedRoomMicroZones.find((b) => b.bayId === selectedBayId);
    return computeWayfindingPath(
      selectedRoom,
      bay ? { x: bay.posX, y: bay.posY } : null,
      selectedRoomIdx
    );
  }, [selectedRoom, selectedRoomMicroZones, selectedBayId, selectedRoomIdx]);

  const selectedRoomDevices = useMemo(
    () =>
      selectedRoom
        ? floorDevices.filter((d) => d.roomId === selectedRoom.id)
        : [],
    [selectedRoom, floorDevices]
  );

  // Active Backend Alerts (FIRING / ACKNOWLEDGED) on this floor and for the selected room
  const activeAlerts = useMemo(() => {
    const all = alertsQuery.data?.content ?? [];
    return all.filter(
      (a) => a.status === 'FIRING' || a.status === 'ACKNOWLEDGED'
    );
  }, [alertsQuery.data]);

  const selectedRoomAlerts: AlertResponse[] = useMemo(() => {
    if (!selectedRoom) return [];
    return activeAlerts.filter((a) => a.roomId === selectedRoom.id);
  }, [activeAlerts, selectedRoom]);

  // ============================================================================
  // ROLE 1 (USER / VIEWER): Smart Study Spot Finder ("Tìm Chỗ Ngồi Học Lý Tưởng")
  // ============================================================================
  const studyRecommendations = useMemo(() => {
    const candidates: Array<{
      room: RoomResponse;
      bay: AnonymousMicroZone;
      areaM2: number;
      score: number;
      reasonVi: string;
      routeMeters: number;
      fromLandmarkLabel: string;
    }> = [];

    visibleFloorRooms.forEach((room, idx) => {
      const preset = resolveRoomPreset(room, idx);
      const roomType = preset?.roomType ?? room.type ?? 'STUDY_ROOM';
      // Không gợi ý kho sách đóng kín cho sinh viên tự học
      if (roomType === 'BOOK_STORAGE') return;

      const tel = roomTelemetryMap[room.id];
      const bays = synthesizeAnonymousMicroZones(room, tel, idx);
      const areaM2 = preset?.areaM2 ?? 120;

      for (const bay of bays) {
        const route = computeWayfindingPath(
          room,
          { x: bay.posX, y: bay.posY },
          idx
        );
        const routeMeters = route?.distanceMeters ?? 18;
        const fromLandmarkLabel =
          route?.fromLandmark.shortLabel ?? 'Thang trung tâm';

        let matchScore = bay.metrics.comfortScore;
        let reasonVi = `${bay.metrics.temperature}°C · ${bay.metrics.noiseAvg} dBA · ${bay.metrics.lux} lx`;

        if (studyFilter === 'quiet') {
          if (bay.metrics.noiseAvg <= 42) matchScore += 25;
          else if (bay.metrics.noiseAvg <= 46) matchScore += 10;
          else matchScore -= 20;
          if (bay.tags.includes('quiet')) matchScore += 15;
          reasonVi = `Yên tĩnh ${bay.metrics.noiseAvg} dBA (< 42 dBA) · ${bay.metrics.temperature}°C · ${bay.seatCapacity} chỗ`;
        } else if (studyFilter === 'group') {
          if (bay.tags.includes('group') || areaM2 <= 60) matchScore += 35;
          else matchScore -= 15;
          reasonVi = `Thảo luận nhóm (${bay.seatCapacity} chỗ) · Cách âm tốt · Wi-Fi ${bay.metrics.wifiRssi} dBm`;
        } else if (studyFilter === 'bright_cool') {
          if (
            bay.metrics.lux >= 300 &&
            bay.metrics.lux <= 580 &&
            bay.metrics.temperature <= 23.5
          ) {
            matchScore += 28;
          }
          if (bay.tags.includes('window') || bay.tags.includes('ac_cool')) {
            matchScore += 12;
          }
          reasonVi = `Sáng chuẩn ${bay.metrics.lux} lx · Mát ${bay.metrics.temperature}°C · Ẩm ${bay.metrics.humidity}%`;
        } else if (studyFilter === 'multimedia') {
          if (
            bay.tags.includes('multimedia') ||
            room.name.toLowerCase().includes('multimedia')
          ) {
            matchScore += 32;
          }
          reasonVi = `Tra cứu CSDL & PC · Wi-Fi ${bay.metrics.wifiRssi} dBm · ${bay.metrics.temperature}°C`;
        }

        candidates.push({
          room,
          bay,
          areaM2,
          score: matchScore,
          reasonVi,
          routeMeters,
          fromLandmarkLabel,
        });
      }
    });

    return candidates.sort((a, b) => b.score - a.score).slice(0, 4);
  }, [visibleFloorRooms, roomTelemetryMap, studyFilter]);

  // ============================================================================
  // ROLE 2 (LIBRARIAN / ZONE_MANAGER): RoomType-Aware Operational Alerts (Book Storage Humidity, Study Room Noise/Heat)
  // ============================================================================
  const librarianAdvisories = useMemo(() => {
    const list: Array<{
      id: string;
      roomId: string;
      deviceId?: string;
      roomCode: string;
      roomName: string;
      roomType: string;
      zoneCode: string;
      category: 'mold_humidity' | 'noise' | 'heat' | 'air';
      badgeText: string;
      valueText: string;
      recommendation: string;
      targetLayer: HeatmapLayerMetric;
    }> = [];

    visibleFloorRooms.forEach((room, idx) => {
      const preset = resolveRoomPreset(room, idx);
      const roomType = preset?.roomType ?? room.type ?? 'STUDY_ROOM';
      const zoneCode = preset?.zoneCode ?? 'ZONE_A';
      const tel = roomTelemetryMap[room.id];
      if (!tel) return;

      const hum = tel.environment?.humidity;
      const noise = tel.acoustics?.noiseAvg;
      const temp = tel.environment?.temperature;
      const pm25 = tel.airQuality?.pm2_5;

      // 1. BOOK_STORAGE (Kho sách 264.7 m² & Phòng Truyền thống 225 m²): Cảnh báo ẩm mốc nghiêm ngặt (> 58%RH)
      if (
        roomType === 'BOOK_STORAGE' &&
        typeof hum === 'number' &&
        hum >= 57.5
      ) {
        list.push({
          id: `adv-hum-${room.id}`,
          roomId: room.id,
          roomCode: room.code,
          roomName: room.name,
          roomType,
          zoneCode,
          category: 'mold_humidity',
          badgeText: 'Bảo quản Kho sách (Độ ẩm)',
          valueText: `${hum.toFixed(1)}%RH`,
          recommendation: `Kho tài liệu "${room.name}" có độ ẩm tiến sát/vượt ngưỡng 60%RH. Kích hoạt máy hút ẩm để chống nấm mốc giấy.`,
          targetLayer: 'humidity',
        });
      }

      // 2. STUDY_ROOM: Kiểm tra tiếng ồn (> 48 dBA) và nhiệt độ (> 24.2°C)
      if (roomType === 'STUDY_ROOM' && typeof noise === 'number' && noise >= 48.0) {
        list.push({
          id: `adv-noise-${room.id}`,
          roomId: room.id,
          roomCode: room.code,
          roomName: room.name,
          roomType,
          zoneCode,
          category: 'noise',
          badgeText: 'Nhắc nhở trật tự phòng đọc',
          valueText: `${noise.toFixed(1)} dBA`,
          recommendation: `Phòng đọc "${room.name}" vượt ngưỡng yên tĩnh. Nhắc độc giả chuyển sang cụm phòng nhóm Tầng 5 nếu cần thảo luận.`,
          targetLayer: 'noiseAvg',
        });
      }

      if (typeof temp === 'number' && temp >= 24.3) {
        list.push({
          id: `adv-heat-${room.id}`,
          roomId: room.id,
          roomCode: room.code,
          roomName: room.name,
          roomType,
          zoneCode,
          category: 'heat',
          badgeText: 'Điều chỉnh làm mát bức xạ kính',
          valueText: `${temp.toFixed(1)}°C`,
          recommendation: `Khu vực bàn sát vách kính "${room.name}" ấm lên do bức xạ mặt trời. Hạ rèm chắn nắng hoặc tăng gió lạnh.`,
          targetLayer: 'temperature',
        });
      }

      if (typeof pm25 === 'number' && pm25 >= 21.0) {
        list.push({
          id: `adv-air-${room.id}`,
          roomId: room.id,
          roomCode: room.code,
          roomName: room.name,
          roomType,
          zoneCode,
          category: 'air',
          badgeText: 'Tăng cấp khí tươi AHU',
          valueText: `${pm25.toFixed(1)} µg/m³`,
          recommendation: `Mật độ bụi mịn PM2.5 tại "${room.name}" tăng cao. Bật quạt cấp khí tươi hành lang.`,
          targetLayer: 'pm2_5',
        });
      }
    });

    return list;
  }, [visibleFloorRooms, roomTelemetryMap]);

  // ============================================================================
  // ROLE 3 (MAINTENANCE): Infrastructure, Wi-Fi RSSI, Sensor Blindspots & HVAC Imbalance Diagnostics
  // ============================================================================
  const maintenanceDiagnostics = useMemo(() => {
    const onlineCount = floorDevices.filter(
      (d) => d.online || d.connectionState === 'ONLINE'
    ).length;
    const offlineDevices = floorDevices.filter(
      (d) => !d.online && d.connectionState !== 'ONLINE'
    );
    const weakWifiRooms: Array<{ room: RoomResponse; rssi: number }> = [];
    const hvacImbalanceRooms: Array<{
      room: RoomResponse;
      deltaT: number;
      minT: number;
      maxT: number;
    }> = [];
    const blindspotRooms: Array<{
      room: RoomResponse;
      blindspotPct: number;
    }> = [];

    visibleFloorRooms.forEach((room, idx) => {
      const tel = roomTelemetryMap[room.id];
      const polygon = resolveRoomPolygon(room, idx);
      const bays = synthesizeAnonymousMicroZones(room, tel, idx);

      const rssi = tel?.wifiRssi ?? -58;
      if (rssi <= -72) {
        weakWifiRooms.push({ room, rssi });
      }

      if (bays.length >= 2) {
        const temps = bays.map((b) => b.metrics.temperature);
        const minT = Math.min(...temps);
        const maxT = Math.max(...temps);
        const deltaT = +(maxT - minT).toFixed(1);
        if (deltaT >= 1.5) {
          hvacImbalanceRooms.push({ room, deltaT, minT, maxT });
        }
      }

      if (polygon && polygon.length >= 3) {
        const samples = bays.map((b) => ({
          x: b.posX,
          y: b.posY,
          value: b.metrics.temperature,
          online: true,
        }));
        const bs = computeRoomBlindspotRatio(polygon, samples);
        if (bs.blindspotRatio >= 0.15) {
          blindspotRooms.push({
            room,
            blindspotPct: Math.round(bs.blindspotRatio * 100),
          });
        }
      }
    });

    return {
      totalDevices: floorDevices.length,
      onlineCount,
      offlineDevices,
      weakWifiRooms,
      hvacImbalanceRooms,
      blindspotRooms,
    };
  }, [floorDevices, visibleFloorRooms, roomTelemetryMap]);

  return (
    <div className="page">
      {/* Background STOMP Subscribers */}
      {realFloorRooms.map((r) => (
        <RoomStreamSubscriber key={r.id} roomId={r.id} />
      ))}

      {/* Admin Role View Switcher Bar (Allows ADMIN to preview & verify all 4 Role Operational Modes) */}
      {capabilities.isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-indigo-950">
            <Eye className="h-4 w-4 text-indigo-600 shrink-0" />
            <span className="font-semibold">
              Chế độ Góc nhìn Tác nghiệp theo Role (Admin Preview):
            </span>
            <span className="hidden text-indigo-700 sm:inline">
              Kiểm thử giao diện chuyên biệt của từng nhóm người dùng ngay trên mặt bằng TQB
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                {
                  role: 'USER',
                  label: '🎓 Độc giả / Sinh viên (Tìm chỗ học)',
                },
                {
                  role: 'LIBRARIAN',
                  label: '📚 Thủ thư & Quản lý Khu (Xử lý Alert)',
                },
                {
                  role: 'MAINTENANCE',
                  label: '🔧 Kỹ thuật Bảo trì (ĐHKK / Vùng mù / RSSI)',
                },
                {
                  role: 'ADMIN',
                  label: '🛡️ Quản trị Hệ thống (Toàn quyền)',
                },
              ] as const
            ).map((item) => (
              <button
                key={item.role}
                type="button"
                onClick={() => {
                  setAdminRoleOverride(item.role);
                  if (item.role === 'MAINTENANCE') {
                    setShowBlindspots(true);
                  } else {
                    setShowBlindspots(false);
                  }
                }}
                className={`rounded-lg px-2.5 py-1 text-2xs font-semibold transition-all ${
                  effectiveRole === item.role
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-indigo-900 hover:bg-indigo-100 border border-indigo-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="page-header">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">
              Bản đồ Không gian & Heatmap 2D — Thư viện Tạ Quang Bửu
            </h1>
            <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-2xs font-semibold text-sky-800">
              CAD 1:100 · 76.0m × 57.2m
            </span>
          </div>
          <p className="page-subtitle">
            Mặt bằng kiến trúc AutoCAD đa tỷ lệ kết hợp nội suy trường nhiệt động học Gaussian thích ứng diện tích phòng (`adaptiveSigma`)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Floor Selector */}
          <div>
            <span className="sr-only">Chọn tầng</span>
            <div className="segmented">
              {FLOOR_OPTIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setSelectedFloor(f);
                    setSelectedRoomId(null);
                    setZoomedRoomId(null);
                    setFocusedDeviceId(null);
                    setSelectedBayId(null);
                  }}
                  className={`segmented-item ${
                    selectedFloor === f ? 'segmented-item-active' : ''
                  }`}
                >
                  {f === 0
                    ? 'Tầng Trệt (0)'
                    : f === 1
                      ? 'Tầng 1 (Sảnh/Kho)'
                      : f === 3
                        ? 'Tầng 3 (Multimedia)'
                        : f === 5
                          ? 'Tầng 5 (P.Nhóm)'
                          : `Tầng ${f}`}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Sensor Coverage Radius & Blindspots */}
          <button
            type="button"
            onClick={() => setShowBlindspots((v) => !v)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              showBlindspots
                ? 'border-rose-400 bg-rose-600 text-white shadow-sm'
                : 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
            title="Hiển thị vòng tròn bán kính cảm biến (R = 6m) của từng Node và vùng mù chưa phủ sóng"
          >
            📡 Vùng phủ Node (R=6m) &amp; Điểm mù: {showBlindspots ? 'BẬT' : 'TẮT'}
          </button>

          {/* Toggle Full TQB Architectural Rooms */}
          <button
            type="button"
            onClick={() => setIncludeTqbArchitecturePresets((v) => !v)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              includeTqbArchitecturePresets
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title="Hiển thị đầy đủ các phòng đọc, kho sách và cụm phòng nhóm từ bản vẽ CAD Thư viện Tạ Quang Bửu"
          >
            🏛️ Đầy đủ Phòng Bản vẽ TQB ({visibleFloorRooms.length})
          </button>
        </div>
      </div>

      {/* Multi-level Mezzanine & Sensor Node Coverage Density Bar */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 text-xs space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Radio className="h-4 w-4 text-brand-600" />
            <span>
              Kiểm toán Mật độ Node Cảm biến, Bán kính Phủ sóng (R = 6.0m) &amp; Cấu trúc Phân tầng (Tầng {selectedFloor})
            </span>
          </div>
          <div className="flex items-center gap-3 text-2xs text-slate-600">
            <span>
              💡 <strong>Quy chuẩn lắp đặt công nghiệp:</strong> Tọa độ Node (X, Y) được chuẩn hóa từ bản vẽ hoàn công CAD (&lt;5cm) tại mục{' '}
              <Link href="/admin/devices" className="font-semibold text-brand-600 underline hover:text-brand-700">
                Quản lý Thiết bị &amp; Tọa độ
              </Link>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {visibleFloorRooms.slice(0, 4).map((room, idx) => {
            const preset = resolveRoomPreset(room, idx);
            const areaM2 = preset?.areaM2 ?? 120;
            const roomDevices = floorDevices.filter((d) => d.roomId === room.id);
            const nodeCount = Math.max(1, roomDevices.length);
            const recommendedNodes = Math.max(1, Math.ceil(areaM2 / 90));
            const coveragePct = Math.min(
              100,
              Math.round(((nodeCount * 113) / Math.max(50, areaM2)) * 100)
            );
            const hasMezzanine =
              room.floor === 1 ||
              room.type === 'BOOK_STORAGE' ||
              room.name.toLowerCase().includes('kho') ||
              room.name.toLowerCase().includes('mượn');

            return (
              <div
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs hover:border-brand-400 transition"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-slate-900 truncate">
                    {room.name}
                  </span>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700">
                    {areaM2} m²
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold ${
                      nodeCount >= recommendedNodes
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {nodeCount}/{recommendedNodes} Node · Phủ ~{coveragePct}%
                  </span>
                  {hasMezzanine && (
                    <span className="rounded bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800">
                      2 Cao độ: Sàn T1 (Mượn) + Tầng lửng (Kho sách)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7-Layer Metric Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 pl-1">
          <Layers className="h-4 w-4 text-brand-600" />
          <span>7 Lớp Chỉ số Vi khí hậu & Hạ tầng:</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {LAYER_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSelectedLayer(opt.key)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                selectedLayer === opt.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{opt.label}</span>
              <span className="font-mono text-2xs opacity-75">
                ({opt.unitLabel})
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================
          ROLE-SPECIFIC OPERATIONAL PANEL
          1. USER / VIEWER: Smart Study Spot Finder ("Tìm Chỗ Ngồi Học Lý Tưởng")
          2. MAINTENANCE: Tech & HVAC Diagnostics ("Chẩn đoán Kỹ thuật & Hạ tầng")
          3. LIBRARIAN / ZONE_MANAGER / ADMIN: Operations & Live Alert FSM Dispatch
         ======================================================================== */}
      {isStudentView ? (
        <div className="card border-sky-200/80 bg-gradient-to-r from-sky-50/60 via-white to-emerald-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm">
                <Compass className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Tìm Chỗ Ngồi Học Lý Tưởng (Smart Study Spot Finder)
                </h2>
                <p className="text-2xs text-slate-600">
                  Chọn nhu cầu học tập để hệ thống định vị dãy bàn tối ưu nhất và vẽ lộ trình đi bộ từ thang máy/cầu thang
                </p>
              </div>
            </div>

            {/* 4 Quick Study Filter Modes */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setStudyFilter('quiet');
                  setSelectedLayer('noiseAvg');
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  studyFilter === 'quiet'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                🤫 Cần yên tĩnh tuyệt đối (&lt; 42 dBA)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudyFilter('group');
                  if (selectedFloor !== 5) {
                    setSelectedFloor(5);
                    setZoomedRoomId(null);
                  }
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  studyFilter === 'group'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                👥 Thảo luận nhóm (Cụm P.Nhóm Tầng 5)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudyFilter('bright_cool');
                  setSelectedLayer('lux');
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  studyFilter === 'bright_cool'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                ☀️ Đủ sáng & Mát mẻ (300–550 lx, ≤ 23.5°C)
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudyFilter('multimedia');
                  setSelectedLayer('comfortScore');
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  studyFilter === 'multimedia'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                💻 Multimedia / Tra cứu CSDL
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {studyRecommendations.map((rec, idx) => {
              const isChosen =
                selectedRoomId === rec.room.id &&
                selectedBayId === rec.bay.bayId;
              return (
                <button
                  key={rec.bay.bayId}
                  type="button"
                  onClick={() => {
                    setSelectedRoomId(rec.room.id);
                    setSelectedBayId(rec.bay.bayId);
                    setZoomedRoomId(rec.room.id);
                    setShowWayfinding(true);
                  }}
                  className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-all ${
                    isChosen
                      ? 'border-sky-600 bg-sky-50/90 ring-2 ring-sky-500/20'
                      : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-sm'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-2xs font-bold text-emerald-800">
                        #{idx + 1} Đề xuất tối ưu
                      </span>
                      <span className="font-mono text-xs font-bold text-sky-700">
                        {rec.bay.metrics.comfortScore} điểm
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-xs font-bold text-slate-900">
                      {rec.bay.nameVi}
                    </h3>
                    <p className="text-2xs font-medium text-slate-500">
                      {rec.room.code} — {rec.room.name}
                    </p>
                    <p className="mt-1 text-2xs text-slate-600">
                      {rec.reasonVi}
                    </p>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-2xs font-semibold text-sky-700">
                    <span>
                      🚶 ~{rec.routeMeters}m từ {rec.fromLandmarkLabel}
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <span>Dẫn đường</span>
                      <Navigation className="h-3 w-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : isMaintenanceView ? (
        <div className="card border-amber-200/90 bg-amber-50/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-600 text-white shadow-sm">
                <Wrench className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Chẩn đoán Kỹ thuật, Độ phủ Sóng & Cân bằng Nhiệt ĐHKK (Maintenance Tech Overlay)
                </h2>
                <p className="text-2xs text-slate-600">
                  Giám sát suy hao sóng Wi-Fi qua vách BTCT, phát hiện vùng mù cảm biến (`fieldPresence &lt; 0.25`) và lệch nhiệt nhánh ống gió FCU
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBlindspots((v) => !v)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                  showBlindspots
                    ? 'border-amber-600 bg-amber-600 text-white shadow-sm'
                    : 'border-amber-300 bg-white text-amber-900 hover:bg-amber-100'
                }`}
              >
                📡 Hiển thị Vùng mù Cảm biến (fieldPresence &lt; 0.25):{' '}
                {showBlindspots ? 'ĐANG BẬT' : 'TẮT'}
              </button>
              <button
                type="button"
                onClick={() => setSelectedLayer('wifiRssi')}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                📶 Chuyển sang Bản đồ Suy hao Wi-Fi (RSSI)
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-2xs font-medium text-slate-500">
                Trạng thái Trạm ESP32 trên tầng
              </span>
              <p className="mt-1 text-base font-bold text-slate-900">
                {maintenanceDiagnostics.onlineCount} /{' '}
                {maintenanceDiagnostics.totalDevices} Trực tuyến
              </p>
              <p className="mt-0.5 text-2xs text-slate-500">
                {maintenanceDiagnostics.offlineDevices.length > 0
                  ? `${maintenanceDiagnostics.offlineDevices.length} trạm mất kết nối cần kiểm tra nguồn`
                  : '100% trạm đo hoạt động ổn định'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-2xs font-medium text-slate-500">
                Cân bằng Nhiệt ĐHKK Nội phòng (ΔT)
              </span>
              <p className="mt-1 text-base font-bold text-amber-700">
                {maintenanceDiagnostics.hvacImbalanceRooms.length} phòng lệch
                nhiệt nhẹ
              </p>
              <p className="mt-0.5 text-2xs text-slate-500">
                {maintenanceDiagnostics.hvacImbalanceRooms[0]
                  ? `${maintenanceDiagnostics.hvacImbalanceRooms[0].room.code}: chênh ΔT ${maintenanceDiagnostics.hvacImbalanceRooms[0].deltaT}°C (${maintenanceDiagnostics.hvacImbalanceRooms[0].minT}–${maintenanceDiagnostics.hvacImbalanceRooms[0].maxT}°C)`
                  : 'Các nhánh FCU phân phối nhiệt đồng đều'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-2xs font-medium text-slate-500">
                Phân tích Vùng mù Cảm biến (Blindspots)
              </span>
              <p className="mt-1 text-base font-bold text-slate-900">
                {maintenanceDiagnostics.blindspotRooms.length} phòng lớn cần bổ
                sung node
              </p>
              <p className="mt-0.5 text-2xs text-slate-500">
                {maintenanceDiagnostics.blindspotRooms[0]
                  ? `${maintenanceDiagnostics.blindspotRooms[0].room.code} có ~${maintenanceDiagnostics.blindspotRooms[0].blindspotPct}% diện tích ngoài bán kính phủ chính`
                  : 'Độ phủ Gaussian bao phủ tốt toàn tầng'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-2xs font-medium text-slate-500">
                Suy hao Tín hiệu Wi-Fi qua Vách BTCT
              </span>
              <p className="mt-1 text-base font-bold text-emerald-700">
                {maintenanceDiagnostics.weakWifiRooms.length === 0
                  ? 'Tín hiệu Tốt (> -70 dBm)'
                  : `${maintenanceDiagnostics.weakWifiRooms.length} vùng sóng yếu`}
              </p>
              <p className="mt-0.5 text-2xs text-slate-500">
                Kiểm tra suy hao qua lõi thang máy & vách kho sách
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* ROLE 2 (LIBRARIAN / ZONE_MANAGER / ADMIN): Operations & Alert FSM Dispatch */
        <div className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <h2 className="text-xs font-semibold text-slate-900">
                Điều phối Vận hành Thủ thư & Kiểm soát Vi khí hậu theo Loại phòng (RoomType)
              </h2>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-2xs font-medium text-slate-600">
                Tầng {selectedFloor}
              </span>
              {activeAlerts.length > 0 && (
                <span className="rounded bg-rose-100 px-2 py-0.5 text-2xs font-bold text-rose-700">
                  {activeAlerts.length} Cảnh báo FSM đang mở
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyAssignedZones((v) => !v)}
                className={`rounded-md border px-2.5 py-1 text-2xs font-semibold transition-colors ${
                  onlyAssignedZones
                    ? 'border-amber-500 bg-amber-50 text-amber-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                🎯 Chỉ hiện Phân khu phụ trách ({assignedZones.join(', ')})
              </button>
              <span className="text-2xs text-slate-500">
                {librarianAdvisories.length > 0
                  ? `${librarianAdvisories.length} khuyến nghị vận hành`
                  : 'Môi trường ổn định'}
              </span>
            </div>
          </div>

          {librarianAdvisories.length === 0 ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
              <CheckCircle2
                className="h-4 w-4 text-emerald-600 shrink-0"
                aria-hidden="true"
              />
              <span>
                Tất cả Kho sách (&lt; 60%RH), Phòng đọc và Sảnh lưu thông trên tầng đang duy trì chỉ số trong ngưỡng tiêu chuẩn.
              </span>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {librarianAdvisories.slice(0, 3).map((item) => {
                const Icon =
                  item.category === 'mold_humidity'
                    ? Droplets
                    : item.category === 'noise'
                      ? Volume2
                      : item.category === 'heat'
                        ? Thermometer
                        : Wind;
                const isSelected = selectedRoomId === item.roomId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedRoomId(item.roomId);
                      setZoomedRoomId(item.roomId);
                      setSelectedLayer(item.targetLayer);
                    }}
                    className={`group flex flex-col justify-between rounded-lg border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50/80 ring-1 ring-slate-900/10'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              item.category === 'mold_humidity'
                                ? 'bg-purple-600'
                                : item.category === 'noise'
                                  ? 'bg-amber-500'
                                  : item.category === 'heat'
                                    ? 'bg-rose-500'
                                    : 'bg-sky-500'
                            }`}
                            aria-hidden="true"
                          />
                          <Icon
                            className="h-3.5 w-3.5 text-slate-600 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="truncate text-xs font-semibold text-slate-900">
                            {item.badgeText}
                          </span>
                        </div>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-2xs font-semibold text-slate-800 tabular-nums shrink-0">
                          {item.valueText}
                        </span>
                      </div>

                      <p className="mt-1.5 text-2xs leading-relaxed text-slate-600 line-clamp-2">
                        {item.recommendation}
                      </p>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-2xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-700">
                        {item.roomCode} · {item.roomType}
                      </span>
                      <span className="inline-flex items-center gap-0.5 font-medium text-slate-700 group-hover:text-slate-950">
                        <span>Định vị & Xử lý</span>
                        <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reconnecting Alert */}
      {!stompConnected && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900"
        >
          {UI_TEXT_VI.wsReconnectingBanner}
        </div>
      )}

      {/* Error State */}
      {roomsQuery.isError && (
        <ErrorBanner
          message="Không thể tải danh sách phòng đọc của tầng này."
          onRetry={() => void roomsQuery.refetch()}
        />
      )}

      {/* Loading or Canvas */}
      {roomsQuery.isLoading ? (
        <Skeleton className="h-[540px] w-full" />
      ) : visibleFloorRooms.length === 0 ? (
        <EmptyState
          title={UI_TEXT_VI.emptyRoomsFloor}
          description="Tầng này chưa có phòng đọc nào thuộc phân khu đang lọc."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Main Canvas Area */}
          <div
            className={
              selectedRoom
                ? 'space-y-3.5 xl:col-span-8'
                : 'space-y-3.5 xl:col-span-12'
            }
          >
            <div className="card overflow-hidden">
              <FloorplanCanvas
                rooms={visibleFloorRooms}
                devices={floorDevices}
                roomTelemetryMap={roomTelemetryMap}
                deviceTelemetryMap={deviceTelemetryMap}
                layer={selectedLayer}
                selectedRoomId={selectedRoomId}
                onSelectRoom={(room) => {
                  setSelectedRoomId(room.id);
                  setFocusedDeviceId(null);
                }}
                onSelectDevice={(device, room) => {
                  if (room) setSelectedRoomId(room.id);
                  setFocusedDeviceId(device.id);
                }}
                zoomedRoomId={zoomedRoomId}
                onZoomRoomChange={setZoomedRoomId}
                selectedBayId={selectedBayId}
                onSelectBay={(bay, room) => {
                  setSelectedRoomId(room.id);
                  setSelectedBayId(bay.bayId);
                }}
                showWayfinding={showWayfinding || isStudentView}
                showBlindspots={showBlindspots}
                showTechOverlay={isMaintenanceView}
                highlightedZoneIds={onlyAssignedZones ? assignedZones : undefined}
              />
            </div>

            {/* Meteorological Radar Color Scale Legend */}
            <div className="card space-y-2 p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">
                    Thang màu nội suy ({LAYER_OPTIONS.find((l) => l.key === selectedLayer)?.label}):
                  </span>
                  <span className="badge badge-primary text-2xs font-normal">
                    Bán kính khuếch tán thích ứng diện tích phòng (Adaptive Sigma RBF)
                  </span>
                </div>
                <span className="text-2xs text-slate-400">
                  Nhấp đúp (Double-click) vào phòng bất kỳ để Phóng to Cấp 2 & Xem đường đi
                </span>
              </div>

              <div className="relative pt-1">
                <div
                  className="h-3.5 w-full rounded-full border border-slate-200 shadow-inner dark:border-slate-700"
                  style={{
                    background: getPaletteCssGradient(selectedLayer),
                  }}
                  aria-hidden="true"
                />

                <div className="mt-1.5 flex justify-between text-2xs font-medium text-slate-600">
                  {WEATHER_PALETTES[selectedLayer]?.map((stop, idx) => (
                    <span key={idx} className="flex flex-col items-center">
                      <span className="mb-0.5 h-1 w-px bg-slate-300" />
                      <span>{stop.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Unconfigured Rooms Callout */}
            {unconfiguredRooms.length > 0 && !isStudentView && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold text-amber-900">
                    Phòng DB chưa lưu đa giác tùy chỉnh — Đang tự động áp dụng Đa giác Kiến trúc TQB ({unconfiguredRooms.length})
                  </h2>
                </div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {unconfiguredRooms.map((room) => (
                    <div
                      key={room.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-white p-2 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {room.code} — {room.name}
                        </p>
                      </div>
                      {capabilities.canManageRooms && (
                        <Link
                          href={`/admin/rooms/${room.id}/polygon`}
                          className="btn-primary btn-sm h-6 px-2 text-2xs"
                        >
                          Chuẩn hóa CAD
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Slide-Over Panel (Tailored to Active Role) */}
          {selectedRoom && (
            <aside
              aria-label={`Chi tiết phòng ${selectedRoom.name}`}
              className="card space-y-4 p-5 xl:col-span-4"
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-2xs font-bold text-brand-600">
                      {selectedRoom.code} · Tầng {selectedRoom.floor}
                    </span>
                    {selectedRoomPreset && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-2xs text-slate-600">
                        {selectedRoomPreset.areaM2} m² ·{' '}
                        {selectedRoomPreset.roomType}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-0.5 text-base font-semibold text-slate-900">
                    {selectedRoom.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoomId(null);
                    setZoomedRoomId(null);
                    setFocusedDeviceId(null);
                  }}
                  aria-label="Đóng bảng chi tiết"
                  className="btn-icon"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 2-Level Zoom & Wayfinding Quick Bar */}
              <div className="flex items-center justify-between gap-2 rounded-lg border border-sky-100 bg-sky-50/70 p-2.5 text-xs">
                <div className="min-w-0">
                  <p className="font-semibold text-sky-950">
                    {selectedRoomWayfinding
                      ? `🚶 Cách ${selectedRoomWayfinding.fromLandmark.labelVi} ~${selectedRoomWayfinding.distanceMeters}m`
                      : 'Định vị không gian phòng'}
                  </p>
                  <p className="text-2xs text-sky-700">
                    Sức chứa: {selectedRoom.capacity ?? selectedRoomPreset?.capacity ?? 60} chỗ ngồi
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setZoomedRoomId(
                      zoomedRoomId === selectedRoom.id ? null : selectedRoom.id
                    )
                  }
                  className="shrink-0 rounded-md bg-sky-600 px-2.5 py-1.5 text-2xs font-semibold text-white shadow-sm hover:bg-sky-700"
                >
                  {zoomedRoomId === selectedRoom.id
                    ? 'Thu nhỏ (Cấp 1)'
                    : '🔍 Phóng to Phòng'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <GradeBadge
                  grade={selectedRoomTelemetry?.comfortScore?.grade}
                  score={selectedRoomTelemetry?.comfortScore?.overall}
                />
                <span className="font-semibold text-xl tabular text-slate-900">
                  {formatMetrics.comfortScore(
                    selectedRoomTelemetry?.comfortScore?.overall
                  )}{' '}
                  <span className="text-xs font-normal text-slate-400">
                    /100
                  </span>
                </span>
              </div>

              {/* All 6 Environmental & Infrastructure Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                  <span className="text-2xs text-slate-500">
                    Độ ồn (LAeq / Peak)
                  </span>
                  <p className="mt-0.5 font-semibold tabular text-slate-800">
                    {formatMetrics.noise(
                      selectedRoomTelemetry?.acoustics?.noiseAvg
                    )}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                  <span className="text-2xs text-slate-500">
                    Nhiệt độ phòng
                  </span>
                  <p className="mt-0.5 font-semibold tabular text-slate-800">
                    {formatMetrics.temperature(
                      selectedRoomTelemetry?.environment?.temperature
                    )}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                  <span className="text-2xs text-slate-500">
                    Độ ẩm tương đối
                  </span>
                  <p className="mt-0.5 font-semibold tabular text-slate-800">
                    {formatMetrics.humidity(
                      selectedRoomTelemetry?.environment?.humidity
                    )}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                  <span className="text-2xs text-slate-500">
                    Độ rọi sáng (Lux)
                  </span>
                  <p className="mt-0.5 font-semibold tabular text-slate-800">
                    {formatMetrics.lux(selectedRoomTelemetry?.environment?.lux)}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                  <span className="text-2xs text-slate-500">Bụi mịn PM2.5</span>
                  <p className="mt-0.5 font-semibold tabular text-slate-800">
                    {formatMetrics.pm(
                      selectedRoomTelemetry?.airQuality?.pm2_5
                    )}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5">
                  <span className="text-2xs text-slate-500">
                    Cường độ Wi-Fi
                  </span>
                  <p className="mt-0.5 font-semibold tabular text-slate-800">
                    {formatMetrics.rssi(selectedRoomTelemetry?.wifiRssi)}
                  </p>
                </div>
              </div>

              {/* LIVE ALERT FSM PANEL FOR LIBRARIAN / ZONE_MANAGER / MAINTENANCE / ADMIN */}
              {!isStudentView && selectedRoomAlerts.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                      <ShieldAlert className="h-4 w-4 text-rose-600" />
                      <span>
                        Cảnh báo Trực tiếp tại Phòng ({selectedRoomAlerts.length})
                      </span>
                    </span>
                  </div>
                  <div className="space-y-2">
                    {selectedRoomAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="rounded-lg border border-rose-200 bg-white p-2.5 text-xs shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-2xs font-bold text-rose-700">
                            {alert.type} · {alert.status}
                          </span>
                          <span className="font-mono text-2xs text-slate-400">
                            {alert.hardwareId}
                          </span>
                        </div>
                        <p className="mt-1 text-2xs text-slate-700">
                          {alert.message}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          {alert.status === 'FIRING' &&
                            capabilities.canAcknowledgeAlert && (
                              <button
                                type="button"
                                disabled={ackAlertMutation.isPending}
                                onClick={() => ackAlertMutation.mutate(alert.id)}
                                className="rounded bg-amber-500 px-2.5 py-1 text-2xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                              >
                                Tiếp nhận (ACK)
                              </button>
                            )}
                          {(alert.status === 'FIRING' ||
                            alert.status === 'ACKNOWLEDGED') &&
                            capabilities.canResolveAlert && (
                              <button
                                type="button"
                                disabled={resolveAlertMutation.isPending}
                                onClick={() =>
                                  resolveAlertMutation.mutate(alert.id)
                                }
                                className="rounded bg-emerald-600 px-2.5 py-1 text-2xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Giải quyết (RESOLVE)
                              </button>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reading Bays (Micro-zones) Breakdown inside Room — Hardware-safe for ALL roles */}
              {selectedRoomMicroZones.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <h3 className="mb-2 text-xs font-semibold text-slate-900">
                    Phân khu Bàn đọc trong phòng ({selectedRoomMicroZones.length}{' '}
                    dãy bàn)
                  </h3>
                  <div className="space-y-1.5">
                    {selectedRoomMicroZones.map((bay) => {
                      const isBayActive = bay.bayId === selectedBayId;
                      return (
                        <button
                          key={bay.bayId}
                          type="button"
                          onClick={() => {
                            setSelectedBayId(bay.bayId);
                            setZoomedRoomId(selectedRoom.id);
                          }}
                          className={`w-full rounded-lg border p-2.5 text-left text-xs transition-all ${
                            isBayActive
                              ? 'border-sky-500 bg-sky-50/70'
                              : 'border-slate-100 bg-slate-50/50 hover:bg-slate-100/70'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-900">
                              {bay.nameVi}
                            </span>
                            <span className="rounded bg-white px-1.5 py-0.5 font-mono text-2xs font-bold text-sky-700 border border-slate-200">
                              {formatLayerMetricValue(
                                bay.metrics[selectedLayer],
                                selectedLayer
                              )}
                            </span>
                          </div>
                          <p className="mt-0.5 text-2xs text-slate-500">
                            {bay.descriptionVi}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-2xs text-slate-600">
                            <span>💺 {bay.seatCapacity} chỗ</span>
                            <span>·</span>
                            <span>🌡️ {bay.metrics.temperature}°C</span>
                            <span>·</span>
                            <span>🔊 {bay.metrics.noiseAvg} dBA</span>
                            <span>·</span>
                            <span>☀️ {bay.metrics.lux} lx</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Hardware Devices in this room (STRICT FE-VIZ-09: Only shown when !isStudentView and capabilities.canViewDevices) */}
              {!isStudentView && capabilities.canViewDevices && (
                <div className="border-t border-slate-100 pt-3">
                  <h3 className="mb-2 text-xs font-semibold text-slate-900">
                    Trạm cảm biến ESP32 gắn kèm ({selectedRoomDevices.length})
                  </h3>
                  {selectedRoomDevices.length === 0 ? (
                    <p className="text-2xs italic text-slate-400">
                      Phòng đang hiển thị theo mô hình nội suy Phân khu Bàn đọc TQB.
                    </p>
                  ) : (
                    <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                      {selectedRoomDevices.map((d) => {
                        const devTel = deviceTelemetryMap[d.id];
                        const devVal = extractLayerMetricValue(
                          devTel,
                          selectedLayer
                        );
                        return (
                          <div
                            key={d.id}
                            onClick={() => setFocusedDeviceId(d.id)}
                            className={`flex cursor-pointer items-center justify-between rounded-md border p-2 text-xs transition-colors ${
                              focusedDeviceId === d.id
                                ? 'border-brand-500 bg-brand-50/50'
                                : 'border-slate-100 bg-slate-50/40 hover:bg-slate-100/60'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="truncate font-semibold text-slate-800">
                                {d.name}
                              </p>
                              <p className="font-mono text-2xs text-slate-400">
                                {d.hardwareId}
                              </p>
                              {d.location && (
                                <p className="mt-0.5 truncate text-2xs text-slate-500">
                                  📍 {d.location}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <ConnectionBadge online={d.online} />
                              {devVal !== null && (
                                <span className="font-mono text-2xs font-semibold tabular text-slate-700">
                                  {formatLayerMetricValue(
                                    devVal,
                                    selectedLayer
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {!selectedRoom.id.startsWith('PRESET_') && (
                <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
                  <Link
                    href={`/rooms/${selectedRoom.id}`}
                    className="btn-primary btn-sm w-full text-center"
                  >
                    <span>Chi tiết & Biểu đồ lịch sử</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>

                  {capabilities.canManageRooms && !isStudentView && (
                    <Link
                      href={`/admin/rooms/${selectedRoom.id}/polygon`}
                      className="btn-secondary btn-sm w-full text-center"
                    >
                      <span>Chỉnh sửa mặt bằng phòng (M09 CAD)</span>
                    </Link>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      {/* Accessible Text Table for Screen Readers (FE-A11Y-05) */}
      <section
        aria-label="Bảng dữ liệu vi khí hậu các phòng đọc"
        className="card mt-4"
      >
        <div className="card-header">
          <h2 className="section-title">
            Bảng tổng hợp Không gian & Vi khí hậu Tầng {selectedFloor}
          </h2>
          <span className="text-2xs text-slate-400">
            {visibleFloorRooms.length} không gian phòng
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Phòng / Phân khu</th>
                <th>Diện tích</th>
                <th>
                  Lớp {LAYER_OPTIONS.find((l) => l.key === selectedLayer)?.label}
                </th>
                <th>Độ ồn TB</th>
                <th>Nhiệt độ</th>
                <th>Độ ẩm</th>
                <th>Ánh sáng</th>
                <th>Trạng thái</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleFloorRooms.map((room, idx) => {
                const tel = roomTelemetryMap[room.id];
                const preset = resolveRoomPreset(room, idx);
                const layerVal = extractLayerMetricValue(tel, selectedLayer);

                return (
                  <tr key={room.id}>
                    <td>
                      <div className="font-semibold text-slate-900">
                        {room.name}
                      </div>
                      <div className="font-mono text-2xs text-slate-400">
                        {room.code} · {preset?.roomType ?? room.type ?? 'STUDY_ROOM'}
                      </div>
                    </td>
                    <td className="font-mono text-xs tabular">
                      {preset ? `${preset.areaM2} m²` : '—'}
                    </td>
                    <td className="font-medium tabular text-slate-800">
                      {formatLayerMetricValue(layerVal, selectedLayer)}
                    </td>
                    <td className="tabular text-xs">
                      {formatMetrics.noise(tel?.acoustics?.noiseAvg)}
                    </td>
                    <td className="tabular text-xs">
                      {formatMetrics.temperature(
                        tel?.environment?.temperature
                      )}
                    </td>
                    <td className="tabular text-xs">
                      {formatMetrics.humidity(tel?.environment?.humidity)}
                    </td>
                    <td className="tabular text-xs">
                      {formatMetrics.lux(tel?.environment?.lux)}
                    </td>
                    <td>
                      <GradeBadge
                        grade={tel?.comfortScore?.grade}
                        score={tel?.comfortScore?.overall}
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRoomId(room.id);
                          setZoomedRoomId(room.id);
                        }}
                        className="btn-secondary btn-sm"
                      >
                        Định vị
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
