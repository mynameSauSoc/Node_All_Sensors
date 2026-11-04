// ============================================================================
// AIoTLibTQB — Canonical Frontend API & Domain DTO Types
// Synchronized 100% with Backend MVP v1.0 & FRONTEND_STANDARD.md (Appendix A)
// ============================================================================

export interface ApiResponse<T> {
  code: number;
  message?: string;
  result?: T;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// ----------------------------------------------------------------------------
// 1. Authentication & Session
// ----------------------------------------------------------------------------

export interface AuthenticationRequest {
  username: string;
  password: string;
}

export interface AuthenticationResponse {
  token: string;
  refreshToken: string;
}

export interface RefreshRequest {
  token: string;
}

export interface LogoutRequest {
  token?: string;
  refreshToken?: string;
}

export interface IntrospectRequest {
  token: string;
}

export interface IntrospectResponse {
  valid: boolean;
}

// ----------------------------------------------------------------------------
// 2. Identity & Access Management (Users, Roles, Permissions)
// ----------------------------------------------------------------------------

export type RoleName =
  | 'ADMIN'
  | 'LIBRARIAN'
  | 'ZONE_MANAGER'
  | 'MAINTENANCE'
  | 'VIEWER'
  | 'USER'
  | 'DEVICE';

export type PermissionName =
  | 'READ_SENSOR_DATA'
  | 'READ_SENSOR_DETAIL'
  | 'WRITE_SENSOR_DATA'
  | 'VIEW_ALERTS'
  | 'ACKNOWLEDGE_ALERT'
  | 'MANAGE_ALERT_CONFIG'
  | 'MANAGE_DEVICES'
  | 'VIEW_DEVICE_STATUS'
  | 'MANAGE_ZONES'
  | 'VIEW_ZONE_SUMMARY'
  | 'GENERATE_REPORT'
  | 'VIEW_ANALYTICS'
  | 'MANAGE_USERS'
  | 'MANAGE_ROLES';

export interface PermissionResponse {
  name: string;
  description: string;
}

export interface PermissionRequest {
  name: string;
  description: string;
}

export interface RoleResponse {
  name: string;
  description: string;
  permissions: PermissionResponse[];
}

export interface RoleRequest {
  name: string;
  description: string;
  permissions: string[];
}

export interface UserResponse {
  id: string;
  username: string;
  phone?: string;
  email?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  roles: RoleResponse[];
  assignedZones: string[];
}

export interface UserCreationRequest {
  username: string;
  password: string;
  phone?: string;
  email?: string;
  roles?: string[];
  assignedZones?: string[];
}

export interface UserUpdateRequest {
  password?: string;
  phone?: string;
  email?: string;
  roles?: string[];
  assignedZones?: string[];
}

export interface UserStatusRequest {
  active: boolean;
}

export interface PasswordChangeRequest {
  oldPassword: string;
  newPassword: string;
}

// ----------------------------------------------------------------------------
// 3. Rooms & Spatial Polygons (Normalized [0.0, 1.0] Coordinates)
// ----------------------------------------------------------------------------

export type RoomType = 'STUDY_ROOM' | 'BOOK_STORAGE' | 'CIRCULATION_HALL';

export interface Point2D {
  x: number;
  y: number;
}

export interface RoomResponse {
  id: string;
  code: string;
  name: string;
  floor: number;
  capacity?: number;
  description?: string;
  targetComfortScore?: number;
  type?: RoomType;
  boundaryPolygon?: Point2D[];
  createdAt?: string;
  updatedAt?: string;
}

export interface RoomCreationRequest {
  code: string;
  name: string;
  floor: number;
  capacity?: number;
  description?: string;
  targetComfortScore?: number;
  type?: RoomType;
  boundaryPolygon?: Point2D[];
}

export interface RoomUpdateRequest {
  name?: string;
  floor?: number;
  capacity?: number;
  description?: string;
  targetComfortScore?: number;
  type?: RoomType;
  boundaryPolygon?: Point2D[];
}

// ----------------------------------------------------------------------------
// 4. IoT Devices & Auto-Discovery
// ----------------------------------------------------------------------------

export type ConnectionState = 'ONLINE' | 'OFFLINE';

export interface DeviceResponse {
  id: string;
  name: string;
  hardwareId: string;
  zoneId: string;
  roomId?: string | null;
  posX?: number | null;
  posY?: number | null;
  deviceType: string;
  location?: string | null;
  firmwareVersion?: string | null;
  active: boolean;
  lastSeenAt: string | null;
  connectionState: ConnectionState | string;
  lastOfflineAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  online: boolean;
}

export interface DeviceRegistrationRequest {
  name: string;
  hardwareId: string;
  zoneId: string;
  roomId?: string;
  posX?: number;
  posY?: number;
  deviceType: string;
  location?: string;
  firmwareVersion?: string;
}

export interface DeviceUpdateRequest {
  name?: string;
  zoneId?: string;
  roomId?: string;
  posX?: number;
  posY?: number;
  deviceType?: string;
  location?: string;
  firmwareVersion?: string;
}

export interface DeviceRegistrationResponse {
  id: string;
  name: string;
  hardwareId: string;
  zoneId: string;
  roomId?: string | null;
  posX?: number | null;
  posY?: number | null;
  deviceType: string;
  location?: string | null;
  firmwareVersion?: string | null;
  active: boolean;
  createdAt?: string;
  rawApiKey: string | null;
  alreadyExisted: boolean;
}

export interface DiscoveredDeviceResponse {
  hardwareId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  messageCount: number;
  lastWifiRssi: number | null;
}

// ----------------------------------------------------------------------------
// 5. Telemetry, Downsampling Buckets & Overview Summary
// ----------------------------------------------------------------------------

export type ComfortGrade = 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Poor';

export interface TelemetryMetadata {
  deviceId: string;
  hardwareId: string;
  roomId: string;
}

export interface AcousticMetrics {
  noiseAvg: number | null;
  noisePeak: number | null;
}

export interface AirQualityMetrics {
  pm1_0: number | null;
  pm2_5: number | null;
  pm4_0: number | null;
  pm10: number | null;
}

export interface EnvironmentMetrics {
  temperature: number | null;
  humidity: number | null;
  lux: number | null;
  co2?: number | null;
}

export interface ComfortScoreRecord {
  overall: number | null;
  grade: ComfortGrade | null;
  acousticScore: number | null;
  airScore: number | null;
  thermalScore: number | null;
  lightScore: number | null;
}

export interface TelemetryResponse {
  id: string;
  timestamp: string;
  metadata: TelemetryMetadata;
  acoustics?: AcousticMetrics | null;
  airQuality?: AirQualityMetrics | null;
  environment?: EnvironmentMetrics | null;
  comfortScore?: ComfortScoreRecord | null;
  wifiRssi: number | null;
}

export interface RoomSummaryInfo {
  roomId: string;
  roomName: string; // Equals roomId in RAM summary; join with rooms cache on UI
  comfortScore: number | null;
  grade: ComfortGrade | null;
  temperature: number | null;
  humidity: number | null;
  noiseAvg: number | null;
  pm25: number | null;
  bottleneckReason: string | null;
}

export interface TelemetrySummaryResponse {
  totalRooms: number;
  optimalRoomsCount: number;
  averageComfortScore: number;
  overallGrade: ComfortGrade | 'N/A';
  bestRoom: RoomSummaryInfo | null;
  attentionRoom: RoomSummaryInfo | null;
  worstRoom: RoomSummaryInfo | null;
}

export type BucketInterval = '15m' | '1h' | '1d';

export interface BucketDataPoint {
  bucketTime: string;
  sampleCount?: number;
  comfortScoreAvg?: number;
  comfortScoreMin?: number;
  comfortScoreMax?: number;
  tempAvg?: number;
  tempMin?: number;
  tempMax?: number;
  humidityAvg?: number;
  humidityMin?: number;
  humidityMax?: number;
  noiseAvg?: number;
  noiseMin?: number;
  noiseMax?: number;
  pm25Avg?: number;
  pm25Min?: number;
  pm25Max?: number;
  luxAvg?: number;
  luxMin?: number;
  luxMax?: number;
}

export interface TelemetryBucketResponse {
  roomId: string;
  interval: BucketInterval;
  dataPoints?: BucketDataPoint[];
}

// ----------------------------------------------------------------------------
// 6. Alerts & Finite State Machine (FSM)
// ----------------------------------------------------------------------------

export type AlertType =
  | 'NOISE_EXCEEDED'
  | 'AIR_UNHEALTHY'
  | 'DEVICE_OFFLINE'
  | 'SENSOR_MALFUNCTION';

export type AlertStatus = 'PENDING' | 'FIRING' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface AlertResponse {
  id: string;
  deviceId: string;
  hardwareId: string;
  roomId: string | null;
  type: AlertType;
  status: AlertStatus;
  currentValue: number | null;
  threshold: number | null;
  message: string;
  startedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  acknowledgedBy: string | null;
}
