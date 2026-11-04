import { describe, expect, it, vi } from 'vitest';
import { createHttpClient, registerAuthTokenAccessor, unwrapEnvelope } from '@/lib/http/client';
import { ApiError, getFriendlyErrorMessage } from '@/lib/http/error-mapper';
import { SingleFlightRefreshCoordinator } from '@/lib/http/refresh-queue';
import { ERROR_MESSAGES_VI } from '@/messages/vi';
import { decodeJwtScope, parseScopeString } from '@/lib/rbac/scope-parser';
import { buildCapabilities } from '@/lib/rbac/capabilities';
import {
  computeBucketCount,
  escapeCsvCell,
  formatBottleneckReasonVi,
  formatMetrics,
  recommendIntervalForRange,
  validateBucketRange,
} from '@/lib/format/metrics';
import { formatRelativeTimeVi } from '@/lib/format/datetime';
import {
  getGradeStyle,
  getMetricColorHex,
  resolveGradeFromScore,
  type HeatmapLayerMetric,
} from '@/config/thresholds';
import { computeIdwValue } from '@/lib/floorplan/idw';
import {
  computeVisualPolygonCenter,
  isPointInPolygon,
  validateBoundaryPolygon,
} from '@/lib/floorplan/polygon';
import {
  WEATHER_PALETTES,
  computeAdaptiveSigma,
  computeRoomBlindspotRatio,
  getContinuousMetricColor,
} from '@/lib/floorplan/weatherPalette';
import {
  TQB_BUILDING_ASPECT_RATIO,
  TQB_ROOM_PRESETS,
  computeWayfindingPath,
  resolveRoomPreset,
  synthesizeAnonymousMicroZones,
} from '@/config/tqb-floorplan-presets';
import {
  extractLayerMetricValue,
  formatLayerMetricValue,
} from '@/features/floorplan/components/FloorplanCanvas';
import { normalizedToPixel, pixelToNormalized } from '@/lib/floorplan/coords';
import {
  mergeRealtimeTelemetry,
  upsertRealtimeAlertList,
} from '@/lib/realtime/stomp-client';
import { useAuthStore } from '@/features/auth/store';
import type { AlertResponse, TelemetryResponse } from '@/types/api';

describe('1. HTTP Envelope & ErrorCode Mapper (FE-API-02, FE-API-03)', () => {
  it('unwraps result when code === 1000', () => {
    const res = unwrapEnvelope({ code: 1000, result: { ok: true } }, 200);
    expect(res).toEqual({ ok: true });
  });

  it('throws ApiError with Vietnamese message when code !== 1000', () => {
    expect(() =>
      unwrapEnvelope(
        { code: 5006, message: 'Cannot delete room with associated devices' },
        400
      )
    ).toThrowError(ApiError);

    try {
      unwrapEnvelope({ code: 5006 }, 400);
    } catch (e) {
      const err = e as ApiError;
      expect(err.code).toBe(5006);
      expect(err.message).toBe(ERROR_MESSAGES_VI[5006]);
    }
  });

  it('covers all registered ErrorCodes in ERROR_MESSAGES_VI', () => {
    const allCodes = [
      1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010,
      1011, 1012, 1013, 1014, 1015,
      2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008,
      3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008,
      4029, 4031,
      5001, 5002, 5003, 5004, 5005, 5006,
      6001,
      7001, 7002, 7003,
      9001, 9002,
      9999,
    ];
    for (const c of allCodes) {
      expect(getFriendlyErrorMessage(c)).toBeTruthy();
      expect(getFriendlyErrorMessage(c)).not.toContain('Uncategorized');
    }
  });
});

describe('2. Single-Flight Refresh Queue (FE-AUTH-03)', () => {
  it('triggers /auth/refresh exactly ONCE when 5 concurrent requests receive 401', async () => {
    let accessToken = 'expired-token';
    let refreshToken = 'valid-refresh-token';
    let refreshCallCount = 0;

    registerAuthTokenAccessor({
      getAccessToken: () => accessToken,
      getRefreshToken: () => refreshToken,
      setTokens: (a, r) => {
        accessToken = a;
        refreshToken = r;
      },
      clearSession: () => {
        accessToken = '';
        refreshToken = '';
      },
    });

    const mockFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        refreshCallCount++;
        await new Promise((r) => setTimeout(r, 25));
        return new Response(
          JSON.stringify({
            code: 1000,
            result: { token: 'new-access-token', refreshToken: 'new-refresh-token' },
          }),
          { status: 200 }
        );
      }

      const authHeader = new Headers(init?.headers).get('Authorization');
      if (authHeader === 'Bearer expired-token') {
        return new Response(
          JSON.stringify({ code: 1006, message: 'Unauthenticated' }),
          { status: 401 }
        );
      }

      return new Response(
        JSON.stringify({ code: 1000, result: { data: url } }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const coordinator = new SingleFlightRefreshCoordinator();
    const client = createHttpClient(mockFetch, coordinator);

    const results = await Promise.all([
      client.get<{ data: string }>('/rooms'),
      client.get<{ data: string }>('/devices'),
      client.get<{ data: string }>('/alerts'),
      client.get<{ data: string }>('/telemetry/overview/summary'),
      client.get<{ data: string }>('/users/myInfo'),
    ]);

    expect(refreshCallCount).toBe(1);
    expect(results).toHaveLength(5);
    expect(accessToken).toBe('new-access-token');
  });

  it('calls clearSession and rejects all queued requests when refresh fails with 1006', async () => {
    let cleared = 0;
    registerAuthTokenAccessor({
      getAccessToken: () => 'expired-token',
      getRefreshToken: () => 'expired-refresh',
      setTokens: () => {},
      clearSession: () => {
        cleared++;
      },
    });

    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ code: 1006, message: 'Unauthenticated' }),
        { status: 401 }
      );
    }) as unknown as typeof fetch;

    const coordinator = new SingleFlightRefreshCoordinator();
    const client = createHttpClient(mockFetch, coordinator);

    const settled = await Promise.allSettled([
      client.get('/rooms'),
      client.get('/devices'),
      client.get('/alerts'),
    ]);

    expect(settled.every((s) => s.status === 'rejected')).toBe(true);
    expect(cleared).toBe(1);
  });
});

describe('3. RBAC Scope Parser & Capability Matrix (FE-RBAC-02, FE-RBAC-03)', () => {
  it('parses JWT scope and builds exact capabilities for LIBRARIAN, MAINTENANCE, and USER', () => {
    const libScope = parseScopeString(
      'LIBRARIAN READ_SENSOR_DATA VIEW_ALERTS ACKNOWLEDGE_ALERT MANAGE_ALERT_CONFIG MANAGE_DEVICES',
      'lib01'
    );
    const libCap = buildCapabilities(libScope);
    expect(libCap.isLibrarian).toBe(true);
    expect(libCap.canManageRooms).toBe(true);
    expect(libCap.canDeleteRoom).toBe(false);
    expect(libCap.canResolveAlert).toBe(true);
    expect(libCap.canManageUsers).toBe(false);

    const mntScope = parseScopeString(
      'MAINTENANCE READ_SENSOR_DATA VIEW_ALERTS ACKNOWLEDGE_ALERT VIEW_DEVICE_STATUS',
      'tech01'
    );
    const mntCap = buildCapabilities(mntScope);
    expect(mntCap.canViewDashboard).toBe(true);
    expect(mntCap.canViewDevices).toBe(true);
    expect(mntCap.canManageDevices).toBe(false);
    expect(mntCap.canAcknowledgeAlert).toBe(true);
    expect(mntCap.canResolveAlert).toBe(false);

    const userScope = parseScopeString('USER', 'student01');
    const userCap = buildCapabilities(userScope);
    expect(userCap.canViewDashboard).toBe(true);
    expect(userCap.canViewAlerts).toBe(false);
    expect(userCap.canViewDevices).toBe(false);
  });

  it('decodes base64url JWT payload safely', () => {
    const payload = Buffer.from(
      JSON.stringify({ sub: 'admin', scope: 'ADMIN MANAGE_USERS VIEW_ALERTS' })
    ).toString('base64url');
    const token = `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
    const decoded = decodeJwtScope(token);
    expect(decoded.username).toBe('admin');
    expect(decoded.roles.has('ADMIN')).toBe(true);
    expect(decoded.permissions.has('MANAGE_USERS')).toBe(true);
  });
});

describe('4. Metrics, Grades, and Bucket Count Validation (FE-API-06, FE-API-09, FE-UI-04)', () => {
  it('formats nullable metrics with "--" placeholder', () => {
    expect(formatMetrics.temperature(24.56)).toBe('24.6 °C');
    expect(formatMetrics.temperature(null)).toBe('--');
    expect(formatMetrics.noise(43.2)).toBe('43.2 dBA');
  });

  it('maps ComfortScore to Platinum/Gold/Silver/Bronze/Poor/N/A', () => {
    expect(resolveGradeFromScore(92)).toBe('Platinum');
    expect(resolveGradeFromScore(80)).toBe('Gold');
    expect(resolveGradeFromScore(65)).toBe('Silver');
    expect(resolveGradeFromScore(50)).toBe('Bronze');
    expect(resolveGradeFromScore(30)).toBe('Poor');
    expect(resolveGradeFromScore(null)).toBe('N/A');
    expect(getGradeStyle('Platinum').hex).toBe('#10B981');
  });

  it('enforces max 1000 buckets and start < end', () => {
    const start = '2026-10-01T00:00:00Z';
    const end30Days = '2026-10-31T00:00:00Z';
    // 30 days at 15m = 2880 buckets > 1000
    const check15m = validateBucketRange(start, end30Days, '15m');
    expect(check15m.valid).toBe(false);
    expect(check15m.errorCode).toBe(7002);

    // 30 days at 1h = 720 buckets <= 1000
    const check1h = validateBucketRange(start, end30Days, '1h');
    expect(check1h.valid).toBe(true);
    expect(check1h.bucketCount).toBe(720);

    expect(recommendIntervalForRange(start, end30Days)).toBe('1d');
    expect(computeBucketCount(end30Days, start, '1h')).toBe(0);
    expect(formatRelativeTimeVi(null)).toBe('Chưa từng kết nối');
  });
});

describe('5. Spatial Floorplan IDW & Polygon Geometry (FE-VIZ-04, FE-VIZ-05, FE-VIZ-08)', () => {
  it('computes IDW interpolation accurately and ignores OFFLINE devices', () => {
    const samples = [
      { x: 0.2, y: 0.2, value: 40, online: true },
      { x: 0.8, y: 0.8, value: 80, online: true },
      { x: 0.2, y: 0.2, value: 999, online: false }, // offline ignored
    ];
    // Midpoint (0.5, 0.5) has equal distance to both online sensors -> average = 60
    const midVal = computeIdwValue(0.5, 0.5, samples);
    expect(midVal).toBeCloseTo(60, 3);

    // Exact sensor coordinate returns exact value
    expect(computeIdwValue(0.2, 0.2, samples)).toBeCloseTo(40, 4);
  });

  it('validates polygon vertices, self-intersection, and point-in-polygon', () => {
    const validRect = [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.1 },
      { x: 0.5, y: 0.5 },
      { x: 0.1, y: 0.5 },
    ];
    expect(validateBoundaryPolygon(validRect).valid).toBe(true);
    expect(isPointInPolygon({ x: 0.3, y: 0.3 }, validRect)).toBe(true);
    expect(isPointInPolygon({ x: 0.8, y: 0.8 }, validRect)).toBe(false);

    // Bowtie self-intersecting polygon
    const selfIntersecting = [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.1 },
      { x: 0.1, y: 0.5 },
    ];
    expect(validateBoundaryPolygon(selfIntersecting).valid).toBe(false);

    const px = normalizedToPixel({ x: 0.5, y: 0.25 }, 800, 600);
    expect(px).toEqual({ x: 400, y: 150 });
    expect(pixelToNormalized(px, 800, 600)).toEqual({ x: 0.5, y: 0.25 });
  });
});

describe('6. STOMP Realtime Reducers (FE-RT-05, FE-RT-06)', () => {
  it('ignores out-of-order telemetry frames with older timestamps', () => {
    const newer: TelemetryResponse = {
      id: '2',
      timestamp: '2026-10-22T10:00:05Z',
      metadata: { deviceId: 'd1', hardwareId: 'hw1', roomId: 'r1' },
      wifiRssi: -50,
    };
    const older: TelemetryResponse = {
      id: '1',
      timestamp: '2026-10-22T10:00:01Z',
      metadata: { deviceId: 'd1', hardwareId: 'hw1', roomId: 'r1' },
      wifiRssi: -70,
    };
    expect(mergeRealtimeTelemetry(newer, older)).toBe(newer);
    expect(mergeRealtimeTelemetry(older, newer)).toBe(newer);
  });

  it('upserts alert by id without duplicating entries', () => {
    const a1: AlertResponse = {
      id: 'alert-1',
      deviceId: 'd1',
      hardwareId: 'hw1',
      roomId: 'r1',
      type: 'NOISE_EXCEEDED',
      status: 'FIRING',
      currentValue: 68,
      threshold: 60,
      message: 'Noise high',
      startedAt: '2026-10-22T10:00:00Z',
      acknowledgedAt: null,
      resolvedAt: null,
      acknowledgedBy: null,
    };
    const a1Ack: AlertResponse = { ...a1, status: 'ACKNOWLEDGED', acknowledgedBy: 'lib01' };

    const list1 = upsertRealtimeAlertList([], a1);
    expect(list1).toHaveLength(1);

    const list2 = upsertRealtimeAlertList(list1, a1Ack);
    expect(list2).toHaveLength(1);
    expect(list2[0].status).toBe('ACKNOWLEDGED');
  });
});

describe('7. Remediation Verification: Kiosk Refresh, Custom RBAC, CSV Hygiene & Concave Geometry', () => {
  it('preserves isKioskSession across silent token rotations (FE-SEC-01)', () => {
    useAuthStore.getState().clearSession();
    useAuthStore.getState().setTokens('kiosk-access-1', 'kiosk-refresh-1', true);
    expect(useAuthStore.getState().isKioskSession).toBe(true);

    // Silent refresh calls setTokens(access, refresh) without 3rd argument
    useAuthStore.getState().setTokens('kiosk-access-2', 'kiosk-refresh-2');
    expect(useAuthStore.getState().isKioskSession).toBe(true);
    expect(useAuthStore.getState().refreshToken).toBe('kiosk-refresh-2');
    useAuthStore.getState().clearSession();
  });

  it('honors fine-grained permissions for custom roles and stripped permissions (FE-RBAC-01)', () => {
    const customScope = parseScopeString(
      'CUSTOM_OPERATOR READ_SENSOR_DATA READ_SENSOR_DETAIL MANAGE_ZONES VIEW_DEVICE_STATUS MANAGE_USERS',
      'custom01'
    );
    const customCap = buildCapabilities(customScope);
    expect(customCap.canViewDashboard).toBe(true);
    expect(customCap.canViewRawTelemetry).toBe(true);
    expect(customCap.canManageRooms).toBe(true);
    expect(customCap.canViewDevices).toBe(true);
    expect(customCap.canManageUsers).toBe(true);
    expect(customCap.canViewAlerts).toBe(false);

    // Role with VIEW_ALERTS stripped should not have canViewAlerts
    const strippedLib = parseScopeString('LIBRARIAN READ_SENSOR_DATA', 'lib02');
    expect(buildCapabilities(strippedLib).canViewAlerts).toBe(false);
  });

  it('neutralizes CSV formula injection and localizes English bottleneck strings (FE-SEC-04, FE-UI-05)', () => {
    expect(escapeCsvCell('=CMD|\' /C calc\'!A0')).toBe("'=CMD|' /C calc'!A0");
    expect(escapeCsvCell('+SUM(A1:A10)')).toBe("'+SUM(A1:A10)");
    expect(escapeCsvCell('@HYPERLINK("http://evil")')).toBe(
      '"\'@HYPERLINK(""http://evil"")"'
    );
    expect(escapeCsvCell(-24.5)).toBe('-24.5');

    expect(
      formatBottleneckReasonVi(
        'Average noise level (68.4 dBA) exceeded threshold (65.0 dBA)'
      )
    ).toBe('Độ ồn trung bình (68.4 dBA) vượt ngưỡng cho phép (65.0 dBA)');
  });

  it('rejects collinear zero-area or duplicate-vertex polygons and finds interior center for L-shapes (FE-GEO-01, FE-GEO-02)', () => {
    const collinear = [
      { x: 0.1, y: 0.1 },
      { x: 0.3, y: 0.3 },
      { x: 0.5, y: 0.5 },
    ];
    expect(validateBoundaryPolygon(collinear).valid).toBe(false);

    const duplicateVertex = [
      { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.1 },
      { x: 0.5, y: 0.1 },
      { x: 0.1, y: 0.5 },
    ];
    expect(validateBoundaryPolygon(duplicateVertex).valid).toBe(false);

    // Concave L-shaped polygon where bounding-box center lies outside
    const lShape = [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.1 },
      { x: 0.2, y: 0.8 },
      { x: 0.9, y: 0.8 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ];
    expect(validateBoundaryPolygon(lShape).valid).toBe(true);
    const center = computeVisualPolygonCenter(lShape);
    expect(isPointInPolygon(center, lShape)).toBe(true);
  });
});

describe('8. TQB CAD 1:100 Floorplan Presets, 7-Layer Weather Palettes, Adaptive Sigma & Anonymous Micro-Zones', () => {
  it('validates 100% of TQB_ROOM_PRESETS boundary polygons and ensures readingBays sit inside room boundaries', () => {
    expect(TQB_BUILDING_ASPECT_RATIO).toBeCloseTo(57.2 / 76.0, 4);
    expect(TQB_ROOM_PRESETS.length).toBeGreaterThanOrEqual(24);

    for (const preset of TQB_ROOM_PRESETS) {
      const validation = validateBoundaryPolygon(preset.boundaryPolygon);
      expect(validation.valid, `Preset ${preset.code} failed polygon validation: ${validation.error}`).toBe(true);

      const visualCenter = computeVisualPolygonCenter(preset.boundaryPolygon);
      expect(
        isPointInPolygon(visualCenter, preset.boundaryPolygon),
        `Preset ${preset.code} visual center lies outside polygon`
      ).toBe(true);

      for (const bay of preset.readingBays) {
        expect(
          isPointInPolygon({ x: bay.posX, y: bay.posY }, preset.boundaryPolygon),
          `Reading bay ${bay.id} in ${preset.code} lies outside room polygon`
        ).toBe(true);
      }
    }
  });

  it('supports all 7 HeatmapLayerMetric layers across WEATHER_PALETTES, thresholds, and FloorplanCanvas formatters', () => {
    const allMetrics: HeatmapLayerMetric[] = [
      'comfortScore',
      'noiseAvg',
      'pm2_5',
      'temperature',
      'humidity',
      'lux',
      'wifiRssi',
    ];

    const sampleTelemetry: TelemetryResponse = {
      id: 'tel-1',
      timestamp: '2026-11-04T00:00:00Z',
      metadata: {
        deviceId: 'dev-1',
        roomId: 'room-301',
        zoneId: 'zone-3',
      },
      environment: {
        temperature: 24.5,
        humidity: 56.2,
        lux: 420,
      },
      acoustics: {
        noiseAvg: 44.8,
        noiseMax: 52.0,
      },
      airQuality: {
        pm2_5: 14.3,
        pm10: 25.0,
      },
      wifiRssi: -58,
      comfortScore: {
        overall: 86,
        grade: 'GOOD',
      },
    };

    for (const metric of allMetrics) {
      expect(WEATHER_PALETTES[metric].length).toBeGreaterThanOrEqual(5);
      const val = extractLayerMetricValue(sampleTelemetry, metric);
      expect(val).not.toBeNull();
      const [r, g, b] = getContinuousMetricColor(val!, metric);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(255);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(getMetricColorHex(metric, val!)).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(formatLayerMetricValue(val!, metric).length).toBeGreaterThan(0);
    }
  });

  it('computes smaller adaptiveSigma for small Floor 5 group study rooms than for large Multimedia halls', () => {
    const smallGroupRoom = resolveRoomPreset({
      code: 'TQB_508',
      name: 'Phòng Học Nhóm 508',
      floor: 5,
      boundaryPolygon: null,
    })!;
    const largeMultimediaRoom = resolveRoomPreset({
      code: 'TQB_301',
      name: 'Phòng Multimedia Tầng 3',
      floor: 3,
      boundaryPolygon: null,
    })!;

    expect(smallGroupRoom).not.toBeNull();
    expect(largeMultimediaRoom).not.toBeNull();

    const sigmaSmall = computeAdaptiveSigma(smallGroupRoom.boundaryPolygon, 1);
    const sigmaLarge = computeAdaptiveSigma(largeMultimediaRoom.boundaryPolygon, 3);

    expect(sigmaSmall).toBeGreaterThanOrEqual(0.042);
    expect(sigmaLarge).toBeGreaterThan(sigmaSmall);
    expect(sigmaLarge).toBeLessThanOrEqual(0.165);
  });

  it('synthesizes hardware-safe anonymous reading bay micro-zones (FE-VIZ-09) and computes blindspots & wayfinding', () => {
    const multimediaPreset = resolveRoomPreset({
      code: 'TQB_301',
      name: 'Phòng Multimedia Tầng 3',
      floor: 3,
      boundaryPolygon: null,
    })!;
    const mockRoom = {
      id: 'room-301',
      code: multimediaPreset.code,
      name: multimediaPreset.name,
      floor: multimediaPreset.floor,
      roomType: multimediaPreset.roomType,
      capacity: multimediaPreset.capacity,
      zoneId: 'zone-3',
      boundaryPolygon: [...multimediaPreset.boundaryPolygon],
    };
    const baseTel: TelemetryResponse = {
      id: 'tel-301',
      timestamp: '2026-11-04T00:00:00Z',
      metadata: {
        deviceId: 'room-aggregate',
        roomId: 'room-301',
        zoneId: 'zone-3',
      },
      environment: {
        temperature: 25.0,
        humidity: 55.0,
        lux: 410,
      },
      acoustics: {
        noiseAvg: 46.0,
        noiseMax: 55.0,
      },
      airQuality: {
        pm2_5: 15.0,
        pm10: 28.0,
      },
      wifiRssi: -60,
      comfortScore: {
        overall: 82,
        grade: 'GOOD',
      },
    };

    const microZones = synthesizeAnonymousMicroZones(mockRoom, baseTel);
    expect(microZones.length).toBeGreaterThanOrEqual(2);
    // Ensure distinct spatial values so Case C diffusion renders multi-bay thermal gradients
    const values = new Set(microZones.map((z) => z.metrics.comfortScore));
    expect(values.size).toBeGreaterThan(1);

    const blindspotFull = computeRoomBlindspotRatio(
      multimediaPreset.boundaryPolygon,
      microZones.map((z) => ({ x: z.posX, y: z.posY }))
    );
    const blindspotNoSensor = computeRoomBlindspotRatio(multimediaPreset.boundaryPolygon, []);
    expect(blindspotNoSensor.blindspotRatio).toBe(1);
    expect(blindspotNoSensor.isUnderCovered).toBe(true);
    expect(blindspotFull.blindspotRatio).toBeLessThan(1);

    const wayfinding = computeWayfindingPath(mockRoom, multimediaPreset.doorPosition);
    expect(wayfinding).not.toBeNull();
    expect(wayfinding!.waypoints.length).toBeGreaterThanOrEqual(2);
    expect(wayfinding!.distanceMeters).toBeGreaterThan(0);
  });
});
