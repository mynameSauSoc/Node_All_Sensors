# BÁO CÁO PHÂN TÍCH KIẾN TRÚC MÃ NGUỒN (CODE ARCHITECTURE REPORT)
**Dự án**: Spring Boot AIoTLibTQB — Hệ thống IoT Giám sát Môi trường & Tiện nghi Thư viện Thông minh  
**Người thực hiện**: Worker R1 (Code Architecture Analyst)  
**Thời điểm phân tích**: 2026-10-21  
**Mã phân tích**: PHASE1-R1-CODE  

---

## 1. TỔNG QUAN KIẾN TRÚC MÃ NGUỒN & CẤU TRÚC PHÂN LỚP

### 1.1. Cấu trúc Package và Tổ chức Module
Dự án được tổ chức theo mô hình đơn khối (Monolithic Modular Layered Architecture) chuẩn Spring Boot trong package gốc `com.example.AIoTLibTQB` [XÁC NHẬN: `AIoTLibTQBApplication.java:1`]:

- `com.example.AIoTLibTQB`
  - `configuration`: Chứa các cấu hình hệ thống: Security (`SecurityConfig.java`), JWT Decoder (`CustomJwtDecoder.java`), JWT EntryPoint (`JwtAuthenticationEntryPoint.java`), Rate Limiting (`RateLimitFilter.java`), MQTT Adapter (`MqttConfig.java`, `MqttProperties.java`), Khởi tạo dữ liệu ban đầu (`ApplicationInitConfig.java`).
  - `controller`: Tầng tiếp nhận HTTP Request và ánh xạ REST API (7 Controller: `AuthenticationController`, `UserController`, `RoleController`, `PermissionController`, `RoomController`, `DeviceController`, `TelemetryController`).
  - `service`: Tầng nghiệp vụ xử lý logic và điều phối dữ liệu (12 Service: `AuthenticationService`, `IntrospectService`, `UserService`, `RoleService`, `PermissionService`, `RoomService`, `DeviceService`, `DiscoveredDeviceService`, `TelemetryService`, `TelemetrySanitizerService`, `ComfortScoreService`, `MqttMessageDispatcherService`).
  - `repository`: Tầng giao tiếp MongoDB qua Spring Data MongoRepository (8 Repository: `UserRepository`, `RoleRepository`, `PermissionRepository`, `InvalidatedTokenRepository`, `RoomRepository`, `DeviceRepository`, `TelemetryRepository`, `AlertRepository`).
  - `document`: Tầng dữ liệu Entity/Document của MongoDB (14 Document classes: `User`, `Role`, `Permission`, `InvalidatedToken`, `Room`, `Device`, `Point2D`, `TelemetryRecord`, `TelemetryMetadata`, `AcousticMetrics`, `AirQualityMetrics`, `EnvironmentMetrics`, `ComfortScoreRecord`, `Alert`).
  - `dto`: Tầng đối tượng truyền tải dữ liệu (Data Transfer Objects), chia làm 3 gói con:
    - `dto.request` (14 DTO tiếp nhận yêu cầu từ client)
    - `dto.response` (12 DTO chuẩn hóa dữ liệu trả về client)
    - `dto.mqtt` (2 DTO ánh xạ bản tin MQTT: `TelemetryPayload`, `StatusPayload`)
  - `enums`: Định nghĩa các hằng số phân loại nghiệp vụ (`Role`, `Permission`, `RoomType`, `AlertType`, `AlertStatus`, `ErrorCode`).
  - `exception`: Xử lý ngoại lệ tập trung (`AppException.java`, `GlobalExceptionHandler.java`).
  - `mapper`: Chuyển đổi giữa Entity và DTO sử dụng MapStruct (`UserMapper.java`, `RoleMapper.java`, `PermissionMapper.java`).

### 1.2. Kiến trúc Phân lớp (Layered Architecture)
Kiến trúc luồng xử lý dữ liệu tuân thủ nghiêm ngặt mô hình phân tầng đơn hướng:
$$\text{Client / MQTT Broker} \longrightarrow \text{Controller / MQTT Handler} \longrightarrow \text{Service Layer} \longrightarrow \text{Repository Layer} \longrightarrow \text{MongoDB}$$

```
+-----------------------------------------------------------------------------------+
|                                  INBOUND TRAFFIC                                  |
|   HTTP REST API (Port 8080)                       MQTT Broker (tcp://localhost:1883)  |
+--------------------------+------------------------------------+-------------------+
                           |                                    |
                           v                                    v
+--------------------------------------+     +--------------------------------------+
|            REST CONTROLLERS          |     |          SPRING INTEGRATION          |
| AuthenticationController             |     | MqttPahoMessageDrivenChannelAdapter  |
| UserController, RoleController       |     | ExecutorSubscribableChannel          |
| PermissionController, RoomController |     |   (VirtualThreadPerTaskExecutor)     |
| DeviceController, TelemetryController|     +------------------+-------------------+
+------------------+-------------------+                        |
                   |                                            v
                   |                         +--------------------------------------+
                   |                         |     MQTT MESSAGE DISPATCHER          |
                   |                         | MqttMessageDispatcherService         |
                   |                         |   -> Topic matcher (status/telemetry)|
                   |                         |   -> TelemetrySanitizerService       |
                   |                         |   -> ComfortScoreService             |
                   |                         +------------------+-------------------+
                   |                                            |
                   +---------------------+----------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                                   SERVICE LAYER                                   |
| AuthenticationService, UserService, RoleService, PermissionService,               |
| RoomService, DeviceService, DiscoveredDeviceService, TelemetryService             |
| Cache Layer: In-memory Caffeine Caches (RateLimit, LastSeen, FieldSanitize, Room)|
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                              DATA REPOSITORY LAYER                                |
| UserRepository, RoleRepository, PermissionRepository, InvalidatedTokenRepository,  |
| RoomRepository, DeviceRepository, TelemetryRepository, AlertRepository            |
+----------------------------------------+------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                                 MONGODB DATABASE                                  |
| Standard Collections: users, roles, permissions, invalidated_tokens, rooms,       |
|                       devices, alerts                                             |
| TimeSeries Collection: telemetry_records (timeField: timestamp, meta: metadata)   |
+-----------------------------------------------------------------------------------+
```

### 1.3. Mô hình Dữ liệu MongoDB (Domain Entity / Documents)
Hệ thống sử dụng cơ sở dữ liệu phi quan hệ MongoDB kết hợp cả hai mô hình quan hệ: **Tài liệu nhúng (Embedded Document)** và **Khóa tham chiếu (Reference Key)** [XÁC NHẬN]:

1. **Collection `users`** [XÁC NHẬN: `User.java:15-48`]:
   - Khóa chính: `id` (`String`).
   - Khóa duy nhất: `username` (`@Indexed(unique = true)`).
   - Trường dữ liệu: `password`, `phone`, `email`, `isActive` (`boolean`, default: `true`).
   - Auditing: `createdAt` (`@CreatedDate Instant`), `updatedAt` (`@LastModifiedDate Instant`).
   - Quan hệ vai trò: `Set<Role> roles = new HashSet<>()` — **Lưu nhúng (Embedded)** toàn bộ tài liệu Role cùng danh sách Permission bên trong User Document, không dùng `@DBRef`.
   - Phân vùng quản lý: `Set<String> assignedZones = new HashSet<>()` — Danh sách mã zone gán cho tài khoản (dành cho vai trò `ZONE_MANAGER`).

2. **Collection `roles`** [XÁC NHẬN: `Role.java:11-27`]:
   - Khóa chính: `name` (`String`, ví dụ: `ADMIN`, `LIBRARIAN`, ...).
   - Trường dữ liệu: `description`.
   - Quan hệ quyền hạn: `Set<Permission> permissions = new HashSet<>()` — **Lưu nhúng (Embedded)** danh sách Permission bên trong Role Document.

3. **Collection `permissions`** [XÁC NHẬN: `Permission.java:8-21`]:
   - Khóa chính: `name` (`String`, ví dụ: `READ_SENSOR_DATA`, `MANAGE_DEVICES`, ...).
   - Trường dữ liệu: `description`.

4. **Collection `invalidated_tokens`** [XÁC NHẬN: `InvalidatedToken.java:11-25`]:
   - Khóa chính: `id` (`String`, lưu JWT ID / JTI UUID).
   - Tự động xóa (TTL Index): `expiryTime` (`Date`) với chú thích `@Indexed(expireAfter = "0s")`. Khi thời gian hiện tại của MongoDB vượt qua `expiryTime`, MongoDB daemon tự động thu hồi tài liệu.

5. **Collection `rooms`** [XÁC NHẬN: `Room.java:15-50`]:
   - Khóa chính: `id` (`String`).
   - Khóa nghiệp vụ duy nhất: `code` (`@Indexed(unique = true)`).
   - Trường dữ liệu: `name`, `floor` (`Integer`), `capacity` (`Integer`), `description`, `targetComfortScore` (`Double`), `type` (`RoomType` enum: `STUDY_ROOM`, `BOOK_STORAGE`, `CIRCULATION_HALL`).
   - Hình học không gian: `boundaryPolygon` (`List<Point2D>`) lưu danh sách các đỉnh tọa độ $(X, Y)$ trên bản đồ mặt bằng.
   - Auditing: `createdAt`, `updatedAt` (`Instant`).

6. **Collection `devices`** [XÁC NHẬN: `Device.java:13-60`]:
   - Khóa chính: `id` (`String`).
   - Khóa phần cứng duy nhất: `hardwareId` (`@Indexed(unique = true)`).
   - Bảo mật thiết bị: `apiKeyHash` (`String`, băm BCrypt 10 rounds).
   - Liên kết không gian:
     - `zoneId` (`String`): Mã khu vực.
     - `roomId` (`String`): Mã phòng mà thiết bị được lắp đặt.
     - `posX`, `posY` (`Double`): Tọa độ vật lý 2D của thiết bị trong phòng.
   - Thông tin vận hành: `deviceType`, `location`, `firmwareVersion`, `isActive` (`boolean`), `connectionState` (`ONLINE`/`OFFLINE`), `lastSeenAt` (`Instant`), `lastOfflineAt` (`Instant`).
   - Auditing: `createdAt`, `updatedAt` (`Instant`).

7. **Collection TimeSeries `telemetry_records`** [XÁC NHẬN: `TelemetryRecord.java:15-53`]:
   - Được định nghĩa đặc biệt với chú thích `@TimeSeries`:
     - `timeField = "timestamp"`: Cột mốc thời gian đo lường.
     - `metaField = "metadata"`: Chứa thông tin ngữ cảnh (`deviceId`, `hardwareId`, `roomId`).
     - `granularity = Granularity.SECONDS`: Độ chi tiết cấp giây cho cơ chế gom cụm bucket nén dữ liệu của MongoDB.
   - TTL Retention: `@Indexed(expireAfterSeconds = 7776000)` (90 ngày) tự động dọn dẹp dữ liệu lịch sử quá hạn.
   - Chỉ mục hợp thành tối ưu hóa truy vấn dải (Compound Indexes):
     - `telemetry_device_time_idx`: `{'metadata.deviceId': 1, 'timestamp': -1}`
     - `telemetry_room_time_idx`: `{'metadata.roomId': 1, 'timestamp': -1}`
   - Dữ liệu con nhúng (Sub-documents):
     - `acoustics` (`AcousticMetrics`): `noiseAvg`, `noisePeak` (dBA).
     - `airQuality` (`AirQualityMetrics`): `pm1_0`, `pm2_5`, `pm4_0`, `pm10` ($\mu g/m^3$).
     - `environment` (`EnvironmentMetrics`): `temperature` ($^\circ C$), `humidity` ($\%RH$), `lux` (Lux).
     - `comfortScore` (`ComfortScoreRecord`): `overall`, `grade`, `acousticScore`, `airScore`, `thermalScore`, `lightScore`.
     - `wifiRssi` (`Integer`): Cường độ tín hiệu Wi-Fi (dBm).

8. **Collection `alerts`** [XÁC NHẬN: `Alert.java:14-52`]:
   - Khóa chính: `id` (`String`).
   - Chỉ mục tìm kiếm: `@Indexed deviceId`, `@Indexed roomId`.
   - Phân loại: `type` (`AlertType`: `NOISE_EXCEEDED`, `AIR_UNHEALTHY`, `DEVICE_OFFLINE`, `SENSOR_MALFUNCTION`), `status` (`AlertStatus`: `PENDING`, `FIRING`, `ACKNOWLEDGED`, `RESOLVED`).
   - Thông số vi phạm: `currentValue` (`Double`), `threshold` (`Double`), `message` (`String`).
   - Vòng đời: `startedAt` (`Instant`), `acknowledgedAt` (`Instant`), `resolvedAt` (`Instant`), `acknowledgedBy` (`String`).

### 1.4. Lớp DTO và Cơ chế Ánh xạ (Mappers)
- **Chuẩn hóa Envelope Response**: Tất cả API endpoints đều bao bọc dữ liệu trả về qua `ApiResponse<T>` [XÁC NHẬN: `ApiResponse.java:13-21`]:
  ```json
  {
    "code": 1000,
    "message": "...",
    "result": { ... }
  }
  ```
  Nếu thành công, `code = 1000` mặc định. Khi có lỗi nghiệp vụ hoặc hệ thống, `GlobalExceptionHandler` bắt và chuyển thành mã lỗi tương ứng trong `ErrorCode` [XÁC NHẬN: `GlobalExceptionHandler.java:21-75`].
- **Ánh xạ Entity - DTO**: Sử dụng thư viện MapStruct với `componentModel = "spring"`:
  - `UserMapper.java`: Chuyển đổi giữa `UserCreationRequest`, `UserUpdateRequest` và `User`, `UserResponse`.
  - `RoleMapper.java`: Chuyển đổi giữa `RoleRequest` và `Role`, `RoleResponse`.
  - `PermissionMapper.java`: Chuyển đổi giữa `PermissionRequest` và `Permission`, `PermissionResponse`.
  - Riêng `DeviceService`, `RoomService`, `TelemetryService` thực hiện ánh xạ thủ công (manual builder conversion) trong code service để kiểm soát logic tạo API Key và tính toán trạng thái online [XÁC NHẬN: `DeviceService.java:210-254`, `RoomService.java:120`, `TelemetryService.java:124-135`].

---

## 2. PHÂN TÍCH CƠ CHẾ SECURITY & KIỂM SOÁT TRUY CẬP (AUTHENTICATION & RBAC)

### 2.1. Luồng Xác thực Người dùng (User Authentication Flow)
Luồng xác thực tài khoản diễn ra theo quy trình chuẩn Stateless JWT [XÁC NHẬN: `AuthenticationService.java:63-79`]:

```
+--------+                    +--------------------------+                    +-----------------------+
| Client |                    |  AuthenticationService   |                    |    UserRepository     |
+----+---+                    +------------+-------------+                    +-----------+-----------+
     |                                     |                                              |
     | 1. POST /api/auth/login             |                                              |
     |    {username, password}             |                                              |
     +------------------------------------>|                                              |
     |                                     | 2. findByUsername(username)                  |
     |                                     +--------------------------------------------->|
     |                                     |<---------------------------------------------+
     |                                     | 3. passwordEncoder.matches(pass, hash)       |
     |                                     | 4. Kiểm tra user.isActive()                  |
     |                                     | 5. generateAccessToken(user) (1h)            |
     |                                     | 6. generateRefreshToken(user) (24h)          |
     | 7. Trả về ApiResponse:              |                                              |
     |    {token, refreshToken}            |                                              |
     |<------------------------------------+                                              |
```

- Băm mật khẩu: Sử dụng BCrypt với hệ số tải (strength) 10: `new BCryptPasswordEncoder(10)` [XÁC NHẬN: `SecurityConfig.java:87`].
- Kiểm tra trạng thái kích hoạt: Nếu `isActive == false`, hệ thống chặn truy cập ngay tại tầng xác thực với lỗi `USER_INACTIVE` (HTTP 403) [XÁC NHẬN: `AuthenticationService.java:71-73`].

### 2.2. Luồng Xác thực Thiết bị IoT (Device Authentication Flow)
Thiết bị IoT (ESP32-S3) không sử dụng tài khoản người dùng mà có cơ chế xác thực chuyên dụng bằng Hardware ID và API Key [XÁC NHẬN: `DeviceService.java:67-85`]:
1. Client/Device gửi `POST /api/v1/devices/authenticate` với `{ "hardwareId": "...", "apiKey": "..." }`.
2. `DeviceService` tìm thiết bị theo `hardwareId` trong CSDL.
3. Kiểm tra cờ `device.isActive()`, nếu false từ chối với mã lỗi `DEVICE_INACTIVE` (HTTP 403).
4. Kiểm tra khớp API Key qua `passwordEncoder.matches(apiKey, device.getApiKeyHash())`. API Key sinh ngẫu nhiên 32 ký tự UUID và được lưu băm BCrypt trong MongoDB.
5. Nếu hợp lệ, hệ thống cập nhật `device.lastSeenAt = Instant.now()` và phát hành JWT riêng cho thiết bị qua `authenticationService.generateDeviceToken(device)`.

### 2.3. Cấu trúc Token JWT & Thuật toán Ký
Dự án sử dụng thư viện Nimbus JOSE JWT (`com.nimbusds:nimbus-jose-jwt`) với thuật toán ký đối xứng **HMAC-SHA512 (HS512)** [XÁC NHẬN: `AuthenticationService.java:116`, `CustomJwtDecoder.java:23-26`]:

1. **Access Token (Người dùng)** [XÁC NHẬN: `AuthenticationService.java:115-138`]:
   - Header: `{"alg": "HS512", "typ": "JWT"}`
   - Claims Payload:
     - `sub`: `username` của người dùng.
     - `iss`: Giá trị từ `${jwt.issuer}` (mặc định: `AIoTLibTQB.com`).
     - `iat`: Thời điểm phát hành (`new Date()`).
     - `exp`: Hết hạn sau `${jwt.expiration-hours}` (mặc định: 1 giờ).
     - `jti`: Mã định danh duy nhất của token (`UUID.randomUUID().toString()`).
     - `userId`: MongoDB Object ID dạng String của User.
     - `tokenType`: `"ACCESS"`.
     - `scope`: Chuỗi các quyền và vai trò cách nhau bởi dấu cách (ví dụ: `"ADMIN READ_SENSOR_DATA READ_SENSOR_DETAIL ..."`).
2. **Refresh Token (Người dùng)** [XÁC NHẬN: `AuthenticationService.java:140-162`]:
   - Claims Payload:
     - `sub`: `username`.
     - `exp`: Hết hạn sau `${jwt.refreshable-hours}` (mặc định: 24 giờ).
     - `jti`: UUID ngẫu nhiên.
     - `userId`: ID của User.
     - `tokenType`: `"REFRESH"`.
     - **Không chứa claim `scope`**: Ngăn chặn kẻ tấn công sử dụng Refresh Token để gọi các API tài nguyên.
3. **Device Token (IoT Node)** [XÁC NHẬN: `AuthenticationService.java:168-194`]:
   - Claims Payload:
     - `sub`: `device.getHardwareId()`.
     - `exp`: Cố định 8 giờ (`Instant.now().plus(8, ChronoUnit.HOURS)`).
     - `tokenType`: `"DEVICE"`.
     - `scope`: Cố định `"DEVICE WRITE_SENSOR_DATA"`.
     - `deviceId`: ID của thiết bị trong MongoDB.
     - `zoneId`: Mã khu vực gán cho thiết bị.
     - `deviceType`: Loại thiết bị phần cứng.

### 2.4. Bộ lọc JWT & Cơ chế Vô hiệu hóa (Token Blacklisting & Revocation)
Hệ thống sử dụng cơ chế Resource Server của Spring Security kết hợp bộ giải mã tùy biến `CustomJwtDecoder` [XÁC NHẬN: `CustomJwtDecoder.java:15-56`]:
- **Kiểm tra chữ ký số**: Sử dụng `NimbusJwtDecoder` với khóa bí mật HS512 cấu hình qua `${jwt.secret-key}` (giá trị được bảo mật, mã hóa/che ***).
- **Bộ xác thực Blacklist (`blacklistValidator`)**:
  Mỗi khi có HTTP Request gửi kèm Bearer Token, `CustomJwtDecoder` trích xuất claim `jti` (JWT ID). Nếu `jti` tồn tại trong collection `invalidated_tokens`, token bị từ chối ngay lập tức với lỗi `OAuth2Error("invalid_token", "Token has been invalidated")`.
- **Bộ xác thực Loại Token (`tokenTypeValidator`)**:
  Chặn triệt để việc dùng Refresh Token để gọi API nghiệp vụ: Nếu `tokenType == "REFRESH"`, decoder từ chối với lỗi `"Refresh token cannot be used as an access token"`.
- **Xử lý Đăng xuất (`POST /api/auth/logout`)**:
  Trích xuất `jti` và `expirationTime` của token gửi lên, lưu vào collection `invalidated_tokens`. Token này sẽ bị coi là vô hiệu vĩnh viễn [XÁC NHẬN: `AuthenticationService.java:81-88`, `230-236`].
- **Xử lý Làm mới phiên (`POST /api/auth/refresh`)**:
  Áp dụng mô hình **Refresh Token Rotation**:
  1. Kiểm tra chữ ký, thời hạn 24 giờ của token gửi lên.
  2. Kiểm tra bắt buộc `tokenType == "REFRESH"`.
  3. Lập tức đưa Refresh Token cũ vào `invalidated_tokens` (blacklist).
  4. Cấp một cặp `token` (Access Token mới) và `refreshToken` (Refresh Token mới) [XÁC NHẬN: `AuthenticationService.java:90-113`].
- **Cơ chế Xử lý Lỗi Xác thực (`JwtAuthenticationEntryPoint`)**:
  Bắt tất cả lỗi không xác thực từ tầng lọc, trả về mã HTTP 401 với Header `WWW-Authenticate: Bearer error="invalid_token"` và JSON body chuẩn `ApiResponse` [XÁC NHẬN: `JwtAuthenticationEntryPoint.java:30-57`].

### 2.5. Bộ lọc Giới hạn Tần suất (Rate Limiting Filter)
Để phòng chống tấn công brute-force mật khẩu và DoS endpoint nhạy cảm, dự án cài đặt `RateLimitFilter` [XÁC NHẬN: `RateLimitFilter.java:29-115`]:
- **Vị trí**: Đứng trước `UsernamePasswordAuthenticationFilter` trong Security Filter Chain [XÁC NHẬN: `SecurityConfig.java:69`].
- **Phạm vi bảo vệ**: Áp dụng cho các endpoint POST nhạy cảm:
  - `POST /api/auth/login`
  - `POST /api/v1/devices/authenticate`
- **Công nghệ**: Thư viện Bucket4j (`io.github.bucket4j`) kết hợp Caffeine In-memory Cache:
  - Cache: `Cache<String, Bucket> ipBuckets` với dung lượng tối đa 10,000 mục, TTL trôi (expireAfterAccess) 10 phút.
  - Ngưỡng: Tối đa **10 requests/phút** cho mỗi địa chỉ IP (`Bandwidth.builder().capacity(10).refillGreedy(10, Duration.ofMinutes(1)).build()`).
  - Khi vượt ngưỡng: Trả về HTTP 429 Too Many Requests, kèm Header `Retry-After: <số giây>`, và JSON `ApiResponse` với mã lỗi `ErrorCode.TOO_MANY_REQUESTS` (4029).
  - Khả năng nhận diện IP qua Proxy: Có logic phân tích Header `X-Forwarded-For` với điều kiện IP nguồn phải thuộc dải Private/Loopback tin cậy (`127.0.0.1`, `10.*`, `192.168.*`, `172.16-31.*`).

### 2.6. Mô hình Phân quyền RBAC (Role-Based Access Control)
Hệ thống kết hợp RBAC cấp độ vai trò (Role) và cấp độ thẩm quyền chi tiết (Permission):

1. **Khởi tạo và Đồng bộ Dữ liệu RBAC ban đầu** [XÁC NHẬN: `ApplicationInitConfig.java:42-177`]:
   Khi ứng dụng khởi động, `ApplicationInitConfig` đồng bộ vào MongoDB **14 Quyền (Permissions)** và **7 Vai trò (Roles)**:

   | STT | Tên Quyền (Permission) | Mô tả Nghiệp vụ |
   |:---:|:---|:---|
   | 1 | `READ_SENSOR_DATA` | Xem dữ liệu sensor (latest value, summary dashboard) |
   | 2 | `READ_SENSOR_DETAIL` | Xem raw data đầy đủ, query lịch sử với resolution cao |
   | 3 | `WRITE_SENSOR_DATA` | Ghi telemetry data — dành riêng cho IoT device (ESP32-S3) |
   | 4 | `VIEW_ALERTS` | Xem danh sách cảnh báo hiện tại và lịch sử |
   | 5 | `ACKNOWLEDGE_ALERT` | Xác nhận đã biết/đang xử lý một cảnh báo |
   | 6 | `MANAGE_ALERT_CONFIG` | Cấu hình ngưỡng cảnh báo: threshold, cooldown, severity |
   | 7 | `MANAGE_DEVICES` | Đăng ký, cấu hình, thu hồi API key của thiết bị IoT |
   | 8 | `VIEW_DEVICE_STATUS` | Xem trạng thái online/offline, RSSI, firmware version |
   | 9 | `MANAGE_ZONES` | Tạo, sửa, xóa zone (phòng/khu vực) và gán node vào zone |
   | 10 | `VIEW_ZONE_SUMMARY` | Xem dashboard tóm tắt toàn zone |
   | 11 | `GENERATE_REPORT` | Xuất báo cáo định kỳ dạng PDF/CSV theo chuẩn TCVN 8681 |
   | 12 | `VIEW_ANALYTICS` | Xem biểu đồ trend, phân tích thống kê, VTT Mould Index |
   | 13 | `MANAGE_USERS` | Tạo/sửa/xóa tài khoản người dùng |
   | 14 | `MANAGE_ROLES` | Tạo/sửa/xóa role và permission — dành riêng ADMIN |

2. **Ma trận Phân quyền các Role mặc định**:
   - `ADMIN`: Sở hữu toàn bộ 14 quyền (Toàn quyền quản trị hệ thống, IT/DevOps).
   - `LIBRARIAN` (10 quyền): `READ_SENSOR_DATA`, `READ_SENSOR_DETAIL`, `VIEW_ALERTS`, `ACKNOWLEDGE_ALERT`, `MANAGE_ALERT_CONFIG`, `MANAGE_DEVICES`, `VIEW_DEVICE_STATUS`, `VIEW_ZONE_SUMMARY`, `GENERATE_REPORT`, `VIEW_ANALYTICS`.
   - `ZONE_MANAGER` (8 quyền): `READ_SENSOR_DATA`, `READ_SENSOR_DETAIL`, `VIEW_ALERTS`, `ACKNOWLEDGE_ALERT`, `VIEW_DEVICE_STATUS`, `VIEW_ZONE_SUMMARY`, `GENERATE_REPORT`, `VIEW_ANALYTICS` (Bị giới hạn trong các zone được gán tại `user.assignedZones`).
   - `MAINTENANCE` (6 quyền): `READ_SENSOR_DATA`, `VIEW_ALERTS`, `ACKNOWLEDGE_ALERT`, `VIEW_DEVICE_STATUS`, `VIEW_ZONE_SUMMARY`, `VIEW_ANALYTICS` (Không có quyền đọc raw sensor detail hay cấu hình thiết bị).
   - `VIEWER` (3 quyền): `READ_SENSOR_DATA`, `VIEW_ALERTS`, `VIEW_ZONE_SUMMARY` (Read-only công khai).
   - `USER` (0 quyền): Người dùng web cơ bản (chỉ xem profile cá nhân).
   - `DEVICE` (1 quyền): `WRITE_SENSOR_DATA` (Dành riêng cho IoT Node ghi nhận dữ liệu).

3. **Cơ chế Chuyển đổi Quyền của Spring Security**:
   Trong `SecurityConfig.java:76-83`, `JwtGrantedAuthoritiesConverter.setAuthorityPrefix("")` được cấu hình để **bỏ tiền tố mặc định** (`SCOPE_` hoặc `ROLE_`). Do đó, danh sách quyền được nạp trực tiếp vào SecurityContext dưới dạng chính xác: `ADMIN`, `LIBRARIAN`, `READ_SENSOR_DATA`, v.v.

4. **Kiểm soát Truy cập Phân vùng (Zone-based Access Control)**:
   Tại `TelemetryService.java:72-122` và `DeviceService.java:100-116`, hệ thống cài đặt kiểm tra đặc thù cho `ZONE_MANAGER`:
   - Nếu người dùng có vai trò `ADMIN` hoặc `LIBRARIAN`, quyền truy cập được cấp trên toàn hệ thống.
   - Nếu là `ZONE_MANAGER`, hệ thống trích xuất username từ SecurityContext, tra cứu `user.assignedZones`, và kiểm tra xem thiết bị/phòng truy vấn có thuộc danh sách zone được giao hay không. Nếu không thuộc, ném ngoại lệ `AppException(ErrorCode.ZONE_ACCESS_DENIED)` (HTTP 403).

---

## 3. PHÂN TÍCH XỬ LÝ BẤT ĐỒNG BỘ, BACKGROUND SCHEDULER, EVENT & PIPELINE INGESTION

### 3.1. Xử lý Bất đồng bộ & Background Schedulers
- **Kích hoạt lập lịch**: Tại lớp khởi động chính `AIoTLibTQBApplication.java:9`, ứng dụng được gán chú thích `@EnableScheduling` [XÁC NHẬN].
- **Các tác vụ Scheduler trong mã nguồn**:
  Qua khảo sát toàn bộ codebase bằng targeted grep `@Scheduled`, hệ thống **chỉ có duy nhất 01 Background Scheduler** hoạt động định kỳ:
  - **Dọn dẹp Token Hết hạn (`cleanExpiredTokens`)** [XÁC NHẬN: `AuthenticationService.java:238-242`]:
    - Biểu thức Cron: `@Scheduled(cron = "0 0 2 * * ?")` — Kích hoạt vào lúc 02:00:00 AM mỗi ngày.
    - Chức năng: Gọi `invalidatedTokenRepository.deleteByExpiryTimeBefore(new Date())` để xóa các bản ghi JWT ID đã hết hạn trong MongoDB collection `invalidated_tokens`.
    - Đánh giá kiến trúc: Bản thân MongoDB đã có TTL Index trên trường `expiryTime` (`@Indexed(expireAfter = "0s")` tại `InvalidatedToken.java:22`). Scheduler này đóng vai trò như một cơ chế phòng vệ thứ cấp (defense-in-depth) đề phòng trường hợp tiến trình ngầm TTL của MongoDB hoạt động trễ.
- **Xác định trạng thái Ngoại tuyến của Thiết bị (Device Offline Detection)** [XÁC NHẬN & SUY LUẬN]:
  - Trong mã nguồn **KHÔNG CÓ Scheduler ngầm nào quét định kỳ để cập nhật trạng thái thiết bị thành OFFLINE** [XÁC NHẬN].
  - Cơ chế nhận diện offline hiện tại dựa trên 2 cách:
    1. **Bản tin MQTT Trạng thái chủ động**: Khi broker Mosquitto nhận tín hiệu ngắt kết nối (hoặc MQTT Last Will and Testament - LWT) gửi tới topic `devices/{hardwareId}/status` với body `{"status": "offline"}`, `MqttMessageDispatcherService:112-115` sẽ cập nhật `connectionState = OFFLINE` và `lastOfflineAt = Instant.now()`.
    2. **Đánh giá Động tại Thời điểm Đọc (Query-time dynamic calculation)** [XÁC NHẬN: `DeviceService.java:231-234`]:
       ```java
       boolean online = !"OFFLINE".equalsIgnoreCase(device.getConnectionState()) &&
               device.getLastSeenAt() != null &&
               device.getLastSeenAt().isAfter(
                       Instant.now().minus(ONLINE_THRESHOLD_MINUTES, ChronoUnit.MINUTES));
       ```
       Trạng thái `online` (boolean) trong `DeviceResponse` được suy ra bằng cách kiểm tra xem `lastSeenAt` có nằm trong vòng 5 phút trở lại đây hay không.

### 3.2. Hệ thống Event (Spring ApplicationEvent)
- Qua kiểm tra grep các chú thích `@EventListener`, `@TransactionalEventListener` và lớp `ApplicationEventPublisher`, mã nguồn hiện tại **HOÀN TOÀN CHƯA SỬ DỤNG** cơ chế Spring Event nội bộ để decouple giữa các service [XÁC NHẬN].
- Các tương tác dữ liệu từ MQTT Ingestion tới Sanitizer, Comfort Engine, và Repository đều là các lệnh gọi phương thức đồng bộ trực tiếp (direct method invocations).

### 3.3. Pipeline Ingestion qua Spring Integration & MQTT Message Handlers

#### A. Cấu hình Inbound Channel & Virtual Threads
Quy trình tiếp nhận luồng dữ liệu IoT qua MQTT được cấu hình trong `MqttConfig.java` [XÁC NHẬN: `MqttConfig.java:26-61`]:
- **Kết nối Broker (Paho Client Factory)**:
  - Broker URL: `${mqtt.broker-url}` (Mặc định: `tcp://localhost:1883`).
  - Client ID: `${mqtt.client-id}` (`aiot_backend_consumer`).
  - Xác thực: Username `${mqtt.username}` (`aiot_backend`), Password `${mqtt.password}` (giá trị được bảo mật, mã hóa/che ***).
  - Tùy chọn: `cleanSession = true`, `automaticReconnect = true`, `keepAliveInterval = 30s`, `connectionTimeout = 10s`.
- **Inbound Topics**: Lắng nghe đồng thời 2 topic pattern:
  - `devices/+/telemetry`: Tiếp nhận chuỗi dữ liệu đo từ các cảm biến.
  - `devices/+/status`: Tiếp nhận thông báo trạng thái kết nối mạng của thiết bị.
  - Mức chất lượng dịch vụ: `QoS = 1` (At least once delivery).
- **Kênh thông điệp & Thực thi Đa luồng Ảo (Virtual Threads Executor)** [XÁC NHẬN: `MqttConfig.java:42-44`]:
  ```java
  @Bean
  public MessageChannel mqttInboundChannel() {
      return new ExecutorSubscribableChannel(Executors.newVirtualThreadPerTaskExecutor());
  }
  ```
  Backend cấu hình kênh thuê bao `ExecutorSubscribableChannel` chạy trên nền tảng **Java 21 Virtual Threads** (`newVirtualThreadPerTaskExecutor`). Mỗi thông điệp MQTT được tiếp nhận và xử lý trên một luồng ảo riêng biệt, giúp giải phóng hoàn toàn Platform/OS Thread pool, ngăn ngừa hiện tượng cạn kiệt luồng (thread starvation) khi mạng sensor gửi dồn dập hàng ngàn bản tin mỗi giây.

#### B. Cơ chế Phân phối Bản tin (`MqttMessageDispatcherService`)
Lớp `MqttMessageDispatcherService` đăng ký lắng nghe trên kênh `mqttInboundChannel` qua chú thích `@ServiceActivator` [XÁC NHẬN: `MqttMessageDispatcherService.java:59-94`]:
1. **Kiểm tra Topic Regex**:
   - `^devices/([^/]+)/status$`: Điều hướng tới `handleStatusMessage()`.
   - `^devices/([^/]+)/telemetry$`: Điều hướng tới `handleTelemetryMessage()`.
2. **Cơ chế Chống giả mạo Định danh (Hardware ID Anti-Spoofing)** [XÁC NHẬN: `MqttMessageDispatcherService.java:101-106`, `146-151`]:
   Hệ thống trích xuất `topicHardwareId` từ topic path và đối chiếu với `hardwareId` bên trong JSON payload. Nếu phát hiện có sự sai lệch (mismatch), hệ thống ghi log cảnh báo và hủy bản tin ngay lập tức nhằm ngăn ngừa thiết bị này gửi mạo danh dữ liệu của thiết bị khác.
3. **Phát hiện Thiết bị Chưa Đăng ký (Device Discovery Queue)** [XÁC NHẬN: `MqttMessageDispatcherService.java:133-134`, `155-159`]:
   Nếu `hardwareId` chưa từng được đăng ký trong collection `devices`, bản tin telemetry sẽ bị hủy ghi vào CSDL time-series, đồng thời `DiscoveredDeviceService` sẽ đưa thiết bị vào hàng đợi bộ nhớ đệm RAM (`ConcurrentHashMap` với TTL 10 phút) để quản trị viên có thể xem và thực hiện đăng ký nhanh qua API `GET /api/v1/devices/discovered`.

#### C. Bộ lọc & Làm sạch Dữ liệu Cảm biến (`TelemetrySanitizerService`)
Dữ liệu thô từ cảm biến vật lý đi qua bộ lọc `TelemetrySanitizerService` [XÁC NHẬN: `TelemetrySanitizerService.java:20-179`]:
- **Ngưỡng chặn Vật lý (Physical Out-of-bounds Rejection)**:
  - Âm thanh: `noiseAvg` $\in [30.0, 110.0]$ dBA; `noisePeak` $\in [30.0, 130.0]$ dBA.
  - Bụi mịn: `pm1_0`, `pm2_5`, `pm4_0`, `pm10` $\in [0.0, 1000.0]$ $\mu g/m^3$.
  - Nhiệt độ: `temperature` $\in [0.0, 60.0]$ $^\circ C$.
  - Độ ẩm: `humidity` $\in [0.0, 100.0]$ $\%RH$.
  - Ánh sáng: `lux` $\in [0.0, 65535.0]$ Lux.
- **Cơ chế Điền khuyết Giữ giá trị Trước (Forward-Fill Fallback)**:
  - Sử dụng bộ đệm Caffeine RAM Cache (`fieldCache`) có giới hạn an toàn bộ nhớ: `maximumSize = 50,000`, `expireAfterAccess = 10 phút`.
  - Khóa cache: `deviceId:fieldKey` (ví dụ: `652f...:env.temperature`).
  - Khi một giá trị cảm biến gửi lên bị null hoặc nằm ngoài ngưỡng vật lý: Hệ thống kiểm tra giá trị hợp lệ gần nhất trong cache. Nếu khoảng cách thời gian $\le 30$ giây (`FORWARD_FILL_WINDOW = Duration.ofSeconds(30)`), hệ thống lấy giá trị cũ điền vào bản ghi để tránh đứt gãy chuỗi thời gian. Nếu quá 30 giây, trả về `null`.
- **Quy tắc An toàn Âm học (Peak Acoustic Rule)** [XÁC NHẬN: `TelemetrySanitizerService.java:82`, `94-106`]:
  Riêng chỉ số xung âm thanh đột biến `noisePeak` được xử lý qua phương thức riêng `sanitizePeakWithoutForwardFill`: **Tuyệt đối KHÔNG áp dụng forward-fill**. Nếu bản tin tiếp theo không có xung âm thanh, `noisePeak` sẽ trả về `null`, không để một tiếng động tức thời (tiếng rơi sách, tiếng đóng cửa) bị kéo dài sai lệch sang các chu kỳ đo sau.
- **Lọc bỏ Bản ghi Trống (Empty Record Filtering)** [XÁC NHẬN: `MqttMessageDispatcherService.java:181-185`, `243-250`]:
  Nếu sau bước làm sạch, cả 3 cụm thông số `acoustics`, `airQuality`, `environment` đều là `null`, bản tin sẽ bị hủy ngay, không lưu vào collection `telemetry_records`.

#### D. Chuẩn hóa Thời gian & Bảo toàn Dữ liệu Lưu-Chuyển tiếp (Store-and-Forward Preservation)
Tại `MqttMessageDispatcherService.java:216-241` [XÁC NHẬN]:
- **Hỗ trợ đa định dạng Timestamp**:
  - Nếu `rawTimestamp >= 100_000_000_000L` (13 chữ số): Nhận diện là Epoch Milliseconds (`Instant.ofEpochMilli`).
  - Ngược lại (10 chữ số): Nhận diện là Epoch Seconds (`Instant.ofEpochSecond`).
- **Bảo toàn Dữ liệu Lịch sử Buffered**:
  Khi mạng chập chờn, ESP32 lưu bản tin vào Flash/SD và gửi lại sau nhiều giờ. Backend tôn trọng mốc thời gian lịch sử này, không ép về thời gian hiện tại (`Instant.now()`), giúp bảo toàn tính toàn vẹn của chuỗi dữ liệu lịch sử.
- **Kẹp lệch Thời gian Bất thường**:
  - Nếu timestamp nhỏ hơn `2020-01-01T00:00:00Z` (do đồng hồ RTC phần cứng bị reset về 1970 khi mất nguồn), hoặc lớn hơn `now + 60s` (lệch giờ tương lai): Hệ thống kẹp về thời gian máy chủ `now`.

#### E. Giảm thiểu Ghi CSDL (Write Amplification Throttling)
- Tại `MqttMessageDispatcherService.java:166-175`, trường `lastSeenAt` của `Device` được cập nhật nguyên tử bằng MongoDB `$set` thông qua `MongoTemplate`.
- Áp dụng bộ đệm Caffeine Cache `lastSeenThrottleCache` với cửa sổ **30 giây** (`Duration.ofSeconds(30)`). Trong vòng 30 giây, các bản tin telemetry kế tiếp từ cùng một thiết bị sẽ không phát sinh truy vấn cập nhật `lastSeenAt` vào MongoDB, giảm tải hơn 90% số lượng lệnh ghi cập nhật bảng thiết bị.

#### F. Động cơ Tính điểm Tiện nghi Môi trường (`ComfortScoreService`)
Được tích hợp trực tiếp vào pipeline xử lý dữ liệu trước khi lưu vào MongoDB [XÁC NHẬN: `ComfortScoreService.java:1-450`]:
- **3 Cấu hình Tiêu chuẩn Không gian**:
  1. `STUDY_ROOM` (Phòng tự học, phòng đọc): Ưu tiên âm học (35%) và chất lượng không khí (30%).
  2. `BOOK_STORAGE` (Kho bảo quản tài liệu): Ưu tiên nhiệt ẩm (50%) và không khí (30%), giảm tỷ trọng âm học (5%).
  3. `CIRCULATION_HALL` (Sảnh mượn trả & tra cứu): Cân bằng giữa âm học (20%), không khí (30%), nhiệt ẩm (25%), ánh sáng (25%).
- **Nguyên lý Thùng gỗ Liebig (Non-linear Gating Formula)** [XÁC NHẬN: `ComfortScoreService.java:140-145`]:
  $$\text{bottleneckRatio} = \frac{\min(\text{SubScores})}{\text{WeightedSum}}$$
  $$\text{LCS}_{\text{raw}} = \text{WeightedSum} \times (0.30 + 0.70 \times \text{bottleneckRatio})$$
  Nếu một yếu tố môi trường xuống mức nguy hại (ví dụ: tiếng ồn quá lớn hoặc ô nhiễm bụi nặng), điểm tiện nghi tổng thể sẽ bị kéo tụt xuống theo yếu tố nút thắt đó, không để điểm số các yếu tố khác bù đắp sai lệch.
- **Tái phân bổ Trọng số Động (Dynamic Re-weighting)**: Khi cảm biến thiếu một số chỉ số đo, tổng trọng số chỉ tính trên các yếu tố sẵn có, đảm bảo thang điểm luôn chuẩn hóa về $[0, 100]$.
- **Phân hạng Tiện nghi (Grade)**:
  - $\ge 90.0$: `Platinum`
  - $\ge 75.0$: `Gold`
  - $\ge 60.0$: `Silver`
  - $\ge 45.0$: `Bronze`
  - $< 45.0$: `Poor`

---

## 4. BẢNG MA TRẬN TOÀN BỘ ENDPOINTS HỆ THỐNG

### 4.1. Bảng Ma trận Chi tiết REST API Endpoints
Tổng số: **26 REST Endpoints** (thuộc 7 REST Controllers) + **3 Spring Boot Actuator Endpoints** [XÁC NHẬN]:

| STT | HTTP Method | Endpoint Path | Input DTO / Params | Output DTO / Status | Role / Quyền Yêu Cầu | Trạng Thái Hoàn Thiện | File Tham Chiếu (Code Citation) |
|:---:|:---:|:---|:---|:---|:---|:---:|:---|
| **I** | **AUTH** | **`/api/auth`** | | | | | `AuthenticationController.java` |
| 1 | `POST` | `/api/auth/login` | Body: `AuthenticationRequest` (`username`, `password`) | `ApiResponse<AuthenticationResponse>` (`token`, `refreshToken`) | **Public** (PermitAll; Rate limit 10 req/phút) | **Hoàn chỉnh** | `AuthenticationController.java:29-34` |
| 2 | `POST` | `/api/auth/introspect` | Body: `IntrospectRequest` (`token`) | `ApiResponse<IntrospectResponse>` (`valid`) | **Public** (PermitAll) | **Hoàn chỉnh** | `AuthenticationController.java:36-42` |
| 3 | `POST` | `/api/auth/logout` | Body: `LogoutRequest` (`token`) | `ApiResponse<Void>` | **Public** (PermitAll) | **Hoàn chỉnh** | `AuthenticationController.java:44-49` |
| 4 | `POST` | `/api/auth/refresh` | Body: `RefreshRequest` (`token`) | `ApiResponse<AuthenticationResponse>` (`token`, `refreshToken`) | **Public** (PermitAll) | **Hoàn chỉnh** | `AuthenticationController.java:51-57` |
| **II** | **USERS** | **`/api/users`** | | | | | `UserController.java` |
| 5 | `POST` | `/api/users` | Body: `@Valid UserCreationRequest` (`username`, `password`, `phone`, `email`) | `ApiResponse<UserResponse>` | **Public** (PermitAll - tự đăng ký tài khoản `USER`) | **Hoàn chỉnh** | `UserController.java:27-32` |
| 6 | `GET` | `/api/users` | Params: `page` (def 0), `size` (def 10), `sortBy` (def "createdAt"), `sortDir` (def "desc") | `ApiResponse<PageResponse<UserResponse>>` | `ADMIN` (`@PreAuthorize("hasAuthority('ADMIN')")`) | **Hoàn chỉnh** | `UserController.java:34-49`, `UserService.java:68-80` |
| 7 | `GET` | `/api/users/myInfo` | None (lấy từ SecurityContext JWT) | `ApiResponse<UserResponse>` | **Authenticated** (Bất kỳ user hợp lệ) | **Hoàn chỉnh** | `UserController.java:51-56`, `UserService.java:61-66` |
| 8 | `GET` | `/api/users/{userId}` | Path: `userId` (`String`) | `ApiResponse<UserResponse>` | `ADMIN` hoặc chính chủ (`@PostAuthorize("hasAuthority('ADMIN') or returnObject.username == authentication.name")`) | **Hoàn chỉnh** | `UserController.java:58-63`, `UserService.java:82-87` |
| 9 | `PUT` | `/api/users/{userId}` | Path: `userId`, Body: `@Valid UserUpdateRequest` | `ApiResponse<UserResponse>` | `ADMIN` hoặc chính chủ (chỉ `ADMIN` mới gán được `roles`, `assignedZones`) | **Hoàn chỉnh** | `UserController.java:65-72`, `UserService.java:89-115` |
| 10 | `PATCH` | `/api/users/{userId}/status` | Path: `userId`, Body: `UserStatusRequest` (`active`) | `ApiResponse<UserResponse>` | `ADMIN` (`@PreAuthorize("hasAuthority('ADMIN')")`) | **Hoàn chỉnh** | `UserController.java:74-81`, `UserService.java:117-123` |
| 11 | `DELETE` | `/api/users/{userId}` | Path: `userId` (`String`) | `ApiResponse<String>` | `ADMIN` (`@PreAuthorize("hasAuthority('ADMIN')")`) | **Hoàn chỉnh** | `UserController.java:83-89`, `UserService.java:125-128` |
| **III** | **ROLES** | **`/api/roles`** | | | `@PreAuthorize("hasAuthority('ADMIN')")` toàn Controller | | `RoleController.java` |
| 12 | `POST` | `/api/roles` | Body: `RoleRequest` (`name`, `description`, `permissions`) | `ApiResponse<RoleResponse>` | `ADMIN` | **Hoàn chỉnh** | `RoleController.java:24-29`, `RoleService.java:41-54` |
| 13 | `GET` | `/api/roles` | None | `ApiResponse<List<RoleResponse>>` | `ADMIN` | **Hoàn chỉnh** | `RoleController.java:31-36`, `RoleService.java:56-58` |
| 14 | `PUT` | `/api/roles/{name}` | Path: `name`, Body: `RoleRequest` | `ApiResponse<RoleResponse>` | `ADMIN` (tự động sync role vào các user liên quan) | **Hoàn chỉnh** | `RoleController.java:38-43`, `RoleService.java:60-78` |
| 15 | `DELETE` | `/api/roles/{name}` | Path: `name` | `ApiResponse<Void>` | `ADMIN` | **Hoàn chỉnh** | `RoleController.java:45-49`, `RoleService.java:80-82` |
| **IV** | **PERMS** | **`/api/permissions`** | | | `@PreAuthorize("hasAuthority('ADMIN')")` toàn Controller | | `PermissionController.java` |
| 16 | `POST` | `/api/permissions` | Body: `PermissionRequest` (`name`, `description`) | `ApiResponse<PermissionResponse>` | `ADMIN` | **Hoàn chỉnh** | `PermissionController.java:24-29`, `PermissionService.java:27-33` |
| 17 | `GET` | `/api/permissions` | None | `ApiResponse<List<PermissionResponse>>` | `ADMIN` | **Hoàn chỉnh** | `PermissionController.java:31-36`, `PermissionService.java:35-37` |
| 18 | `DELETE` | `/api/permissions/{name}` | Path: `name` | `ApiResponse<Void>` | `ADMIN` (chặn xóa nếu quyền đang được gán cho role) | **Hoàn chỉnh** | `PermissionController.java:38-42`, `PermissionService.java:39-47` |
| **V** | **ROOMS** | **`/api/v1/rooms`** | | | | | `RoomController.java` |
| 19 | `POST` | `/api/v1/rooms` | Body: `@Valid RoomCreationRequest` | `ApiResponse<RoomResponse>` | `ADMIN`, `LIBRARIAN` | **Hoàn chỉnh** | `RoomController.java:24-29`, `RoomService.java:29-50` |
| 20 | `GET` | `/api/v1/rooms` | Param: `floor` (`Integer`, tùy chọn) | `ApiResponse<List<RoomResponse>>` | **Authenticated** | **Hoàn chỉnh** | `RoomController.java:31-37`, `RoomService.java:52-56`, `68-72` |
| 21 | `GET` | `/api/v1/rooms/{id}` | Path: `id` | `ApiResponse<RoomResponse>` | **Authenticated** | **Hoàn chỉnh** | `RoomController.java:39-44`, `RoomService.java:58-60` |
| 22 | `GET` | `/api/v1/rooms/code/{code}` | Path: `code` | `ApiResponse<RoomResponse>` | **Authenticated** | **Hoàn chỉnh** | `RoomController.java:46-51`, `RoomService.java:62-66` |
| 23 | `PUT` | `/api/v1/rooms/{id}` | Path: `id`, Body: `@Valid RoomUpdateRequest` | `ApiResponse<RoomResponse>` | `ADMIN`, `LIBRARIAN` | **Hoàn chỉnh** | `RoomController.java:53-60`, `RoomService.java:74-103` |
| 24 | `DELETE` | `/api/v1/rooms/{id}` | Path: `id` | `ApiResponse<Void>` | `ADMIN` | **Hoàn chỉnh** | `RoomController.java:62-66`, `RoomService.java:105-112` |
| **VI** | **DEVICES** | **`/api/v1/devices`** | | | | | `DeviceController.java` |
| 25 | `GET` | `/api/v1/devices/discovered` | None | `ApiResponse<List<DiscoveredDeviceResponse>>` | `ADMIN`, `LIBRARIAN` | **Hoàn chỉnh** | `DeviceController.java:30-36`, `DiscoveredDeviceService.java:51-57` |
| 26 | `POST` | `/api/v1/devices` và `/register` | Body: `@Valid DeviceRegistrationRequest` | `ApiResponse<DeviceRegistrationResponse>` | `ADMIN`, `LIBRARIAN` | **Hoàn chỉnh** | `DeviceController.java:38-44`, `DeviceService.java:46-56` |
| 27 | `PUT` | `/api/v1/devices/{id}` | Path: `id`, Body: `DeviceUpdateRequest` | `ApiResponse<DeviceResponse>` | `ADMIN`, `LIBRARIAN` | **Hoàn chỉnh** | `DeviceController.java:46-53`, `DeviceService.java:122-152` |
| 28 | `POST` | `/api/v1/devices/{id}/heartbeat` | Path: `id` | `ApiResponse<Void>` | **Authenticated** | **Hoàn chỉnh** | `DeviceController.java:55-59`, `DeviceService.java:169-174` |
| 29 | `POST` | `/api/v1/devices/authenticate` | Body: `@Valid DeviceAuthRequest` | `ApiResponse<AuthenticationResponse>` (`token`) | **Public** (Rate limit 10 req/phút) | **Hoàn chỉnh** | `DeviceController.java:61-67`, `DeviceService.java:67-85` |
| 30 | `GET` | `/api/v1/devices` | None | `ApiResponse<List<DeviceResponse>>` | `ADMIN`, `LIBRARIAN` | **Hoàn chỉnh** | `DeviceController.java:69-74`, `DeviceService.java:87-92` |
| 31 | `GET` | `/api/v1/devices/{id}` | Path: `id` | `ApiResponse<DeviceResponse>` | `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER`, `MAINTENANCE` | **Hoàn chỉnh** | `DeviceController.java:76-81`, `DeviceService.java:94-97` |
| 32 | `GET` | `/api/v1/devices/zone/{zoneId}` | Path: `zoneId` | `ApiResponse<List<DeviceResponse>>` | `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER` (kiểm tra `assignedZones`) | **Hoàn chỉnh** | `DeviceController.java:83-88`, `DeviceService.java:99-120` |
| 33 | `POST` | `/api/v1/devices/{id}/regenerate-key` | Path: `id` | `ApiResponse<DeviceRegistrationResponse>` | `ADMIN`, `LIBRARIAN` | **Hoàn chỉnh** | `DeviceController.java:90-95`, `DeviceService.java:58-65` |
| 34 | `PATCH` | `/api/v1/devices/{id}/status` | Path: `id`, Param: `active` (`boolean`) | `ApiResponse<DeviceResponse>` | `ADMIN`, `LIBRARIAN` | **Hoàn chỉnh** | `DeviceController.java:97-104`, `DeviceService.java:154-159` |
| 35 | `DELETE` | `/api/v1/devices/{id}` | Path: `id` | `ApiResponse<Void>` | `ADMIN` | **Hoàn chỉnh** | `DeviceController.java:106-110`, `DeviceService.java:161-167` |
| **VII** | **TELEMETRY** | **`/api/v1/telemetry`** | | | `@PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN', 'ZONE_MANAGER', 'USER', 'VIEWER')")` | | `TelemetryController.java` |
| 36 | `GET` | `/api/v1/telemetry/device/{deviceId}/latest` | Path: `deviceId` | `ApiResponse<TelemetryResponse>` | `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER` (kiểm tra zone), `USER`, `VIEWER` | **Hoàn chỉnh** | `TelemetryController.java:25-30`, `TelemetryService.java:36-41` |
| 37 | `GET` | `/api/v1/telemetry/room/{roomId}/latest` | Path: `roomId` | `ApiResponse<TelemetryResponse>` | `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER` (kiểm tra zone), `USER`, `VIEWER` | **Hoàn chỉnh** | `TelemetryController.java:32-37`, `TelemetryService.java:43-48` |
| 38 | `GET` | `/api/v1/telemetry/device/{deviceId}` | Path: `deviceId`, Params: `start`, `end` (`Instant` ISO) | `ApiResponse<List<TelemetryResponse>>` | `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER` (kiểm tra zone), `USER`, `VIEWER` | **Hoàn chỉnh** | `TelemetryController.java:39-47`, `TelemetryService.java:50-59` |
| 39 | `GET` | `/api/v1/telemetry/room/{roomId}` | Path: `roomId`, Params: `start`, `end` (`Instant` ISO) | `ApiResponse<List<TelemetryResponse>>` | `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER` (kiểm tra zone), `USER`, `VIEWER` | **Hoàn chỉnh** | `TelemetryController.java:49-57`, `TelemetryService.java:61-70` |
| **VIII** | **ACTUATOR** | **`/actuator`** | | | | | `SecurityConfig.java:57` |
| 40 | `GET` | `/actuator/health` | None | Health Status JSON | **Public** (PermitAll) | **Hoàn chỉnh** | `SecurityConfig.java:57` |
| 41 | `GET` | `/actuator/info` | None | Application Info JSON | **Public** (PermitAll) | **Hoàn chỉnh** | `SecurityConfig.java:57` |
| 42 | `GET` | `/actuator/metrics` | None | Metrics JSON | **Authenticated** | **Hoàn chỉnh** | `application.yaml:18` |

---

### 4.2. Bảng Ma trận MQTT Message Handlers (IoT Ingestion Handlers)
| STT | MQTT Topic Pattern | QoS | Payload Schema (Input DTO) | Hành động Nghiệp vụ Xử lý | Trạng Thái Hoàn Thiện | File Tham Chiếu |
|:---:|:---|:---:|:---|:---|:---:|:---|
| 1 | `devices/+/telemetry` | 1 | `TelemetryPayload` (`hardwareId`, `timestamp`, `wifiRssi`, `data: {acoustics, airQuality, environment}`) | 1. Anti-spoofing kiểm tra hardwareId.<br>2. Kiểm tra thiết bị tồn tại (nếu chưa gán -> đưa vào hàng đợi discovery).<br>3. Kiểm tra thiết bị kích hoạt (`isActive`).<br>4. Throttling ghi `lastSeenAt` (30s) bằng Caffeine Cache.<br>5. Làm sạch số liệu qua `TelemetrySanitizerService` (ngưỡng vật lý, forward-fill 30s, loại trừ `noisePeak`).<br>6. Lọc bỏ record rỗng (nếu cả 3 metrics rỗng).<br>7. Chuẩn hóa timestamp (hỗ trợ 10/13 digits, bảo toàn history).<br>8. Tính toán Comfort Score theo profile phòng (`STUDY_ROOM`, `BOOK_STORAGE`, `CIRCULATION_HALL`).<br>9. Lưu bản ghi vào TimeSeries collection `telemetry_records`. | **Hoàn chỉnh** | `MqttMessageDispatcherService.java:141-214` |
| 2 | `devices/+/status` | 1 | `StatusPayload` (`hardwareId`, `status`, `reason`, `firmwareVersion`, `uptimeSeconds`, `timestamp`) | 1. Anti-spoofing kiểm tra hardwareId.<br>2. Cập nhật `connectionState` (`ONLINE`/`OFFLINE`), `firmwareVersion`, và `lastOfflineAt` (nếu offline) hoặc `lastSeenAt` (nếu online).<br>3. Nếu thiết bị chưa đăng ký -> ghi nhận vào `discoveredDeviceService`. | **Hoàn chỉnh** | `MqttMessageDispatcherService.java:96-139` |

---

### 4.3. Bảng Tổng hợp Các Phân hệ Còn Dang dở / Chưa có / TODO
| STT | Phân hệ / Nhóm Chức Năng | Thành phần Đã có trong Code | Thành phần Còn Thiếu trong Code | Đánh Giá Trạng Thái | Ảnh Hưởng Tới Giao Diện Frontend |
|:---:|:---|:---|:---|:---:|:---|
| 1 | **Quản lý Cảnh báo (Alerts)** | - `Alert.java` (Document trong MongoDB)<br>- `AlertRepository.java` (MongoRepository)<br>- `AlertType.java`, `AlertStatus.java`<br>- Quyền: `VIEW_ALERTS`, `ACKNOWLEDGE_ALERT`, `MANAGE_ALERT_CONFIG` | - **KHÔNG CÓ `AlertService`**<br>- **KHÔNG CÓ `AlertController`**<br>- **KHÔNG CÓ Endpoint** truy vấn lịch sử cảnh báo hay xác nhận (acknowledge) cảnh báo.<br>- Pipeline MQTT ingestion **KHÔNG CÓ LOGIC** sinh Alert khi thông số vượt ngưỡng. | **Dang dở / Stub** (Chỉ có Model & Repo, chưa có Service/Controller) | **Rất cao**: Màn hình "Lịch sử cảnh báo" và "Chuông thông báo" trên giao diện hiện tại **KHÔNG CÓ API để gọi**. |
| 2 | **Dữ liệu Thống kê & Phân tích (Analytics & Aggregations)** | - Dữ liệu TimeSeries chi tiết đã lưu trong `telemetry_records`<br>- Quyền `VIEW_ANALYTICS` trong Seed RBAC | - **KHÔNG CÓ Endpoint** tổng hợp dữ liệu theo giờ/ngày/tháng.<br>- **KHÔNG CÓ Pipeline Aggregation** tính giá trị Min, Max, Avg, VTT Mould Index. | **Chưa có (Thiếu hoàn toàn)** | **Rất cao**: Màn hình Dashboard biểu đồ xu hướng 24h/7 ngày buộc phải fetch hàng ngàn bản ghi thô hoặc không thể vẽ biểu đồ nén. |
| 3 | **Quản lý Phân vùng Không gian (Zone Management)** | - Trường `zoneId` trong `Device`, `assignedZones` trong `User`<br>- Quyền `MANAGE_ZONES`, `VIEW_ZONE_SUMMARY`<br>- Endpoint `GET /api/v1/devices/zone/{zoneId}` | - **KHÔNG CÓ Document `Zone`** riêng.<br>- **KHÔNG CÓ `ZoneRepository`** hay `ZoneController`.<br>- Không có API quản lý CRUD Zone (tên khu vực, mô tả, bản đồ tầng, diện tích). | **Dang dở (Thiếu thực thể quản lý độc lập)** | **Trung bình**: Frontend phải tự quản lý danh sách chuỗi string zoneId hoặc hardcode danh sách zone. |
| 4 | **Báo cáo Tiện nghi Định kỳ (Reports)** | - Quyền `GENERATE_REPORT` trong Seed RBAC | - Không có controller, service, hay template xuất báo cáo (PDF, CSV). | **Chưa có (Thiếu hoàn toàn)** | **Thấp**: Chức năng xuất file báo cáo chưa sẵn sàng. |

---

## 5. ĐÁNH GIÁ KHẢ NĂNG ĐÁP ỨNG GIAO DIỆN (FRONTEND READINESS)

### 5.1. Cơ chế Truyền dữ liệu Realtime (Realtime Streaming vs Polling)
- **Cơ chế Đẩy Chủ động từ Backend**:
  - **WebSocket / STOMP**: **CHƯA HỖ TRỢ** [XÁC NHẬN]. Không có dependency `spring-boot-starter-websocket`, không có cấu hình `@EnableWebSocket` hay `SimpMessagingTemplate` trong toàn bộ mã nguồn.
  - **Server-Sent Events (SSE)**: **CHƯA HỖ TRỢ** [XÁC NHẬN]. Không có bất kỳ endpoint nào trả về `SseEmitter` hay kiểu `text/event-stream`.
  - **MQTT Outbound từ Backend**: **CHƯA HỖ TRỢ** [XÁC NHẬN]. Tầng Spring Integration chỉ định nghĩa `inbound` adapter để lắng nghe MQTT từ phần cứng, hoàn toàn không có `outbound` adapter hoặc gateway để backend bắn dữ liệu ra MQTT broker phục vụ client.
- **Giải pháp Realtime Khả thi Hiện tại cho Frontend**:
  - Frontend bắt buộc phải triển khai cơ chế **REST Polling (Kéo dữ liệu định kỳ qua HTTP)** [XÁC NHẬN]:
    - Dashboard tổng quan phòng: Gọi `GET /api/v1/telemetry/room/{roomId}/latest` định kỳ mỗi **10s – 30s** (trùng với chu kỳ gửi tin của node ESP32).
    - Giám sát chi tiết thiết bị: Gọi `GET /api/v1/telemetry/device/{deviceId}/latest` hoặc `GET /api/v1/devices/{id}`.
  - *Lưu ý kỹ thuật cho Frontend*: Không nên poll với tần suất dưới 5 giây để tránh gây nghẽn kết nối MongoDB và CPU không cần thiết vì chu kỳ cập nhật dữ liệu của cảm biến môi trường thông thường là 10 – 30 giây.

### 5.2. Luồng Cảnh báo (Alerting Flow & Thresholds)
Khảo sát hiện trạng luồng cảnh báo từ mã nguồn cho thấy một lỗ hổng kiến trúc lớn giữa tầng Model và tầng Nghiệp vụ:
- **Ngưỡng cảnh báo (Thresholds) nằm ở đâu trong Code**:
  1. *Ngưỡng Hardcoded trong `ComfortScoreService.java`* [XÁC NHẬN: `ComfortScoreService.java:160-414`]:
     - Phòng tự học (`STUDY_ROOM`):
       - Tiếng ồn trung bình: An toàn $\le 35$ dBA, bắt đầu suy giảm $35-55$ dBA, suy thoái nặng $55-70$ dBA, trên $80$ dBA về $0$ điểm.
       - Tiếng ồn đỉnh (`noisePeak`): Ngưỡng phạt là $> 70$ dBA (phạt tối đa 20 điểm).
       - Bụi mịn PM2.5: Tuyệt vời $\le 10$ $\mu g/m^3$, chấp nhận được $10-35$ $\mu g/m^3$, ô nhiễm $35-55$ $\mu g/m^3$, nguy hại $> 100$ $\mu g/m^3$.
       - Nhiệt độ ASHRAE 55: Dải tiện nghi tối ưu $[23.5, 25.5]^\circ C$. Ra ngoài dải trừ 8 điểm/$^\circ C$.
       - Độ ẩm không khí: Dải tối ưu $[40, 60]\%RH$. Lệch dải trừ 2 điểm/$\%$.
       - Độ rọi ánh sáng EN 12464-1: Dải tối ưu $[400, 600]$ Lux. Thiếu sáng $< 50$ Lux: $0$ điểm; chói lóa $> 2000$ Lux: $0$ điểm.
     - Kho bảo quản sách (`BOOK_STORAGE`):
       - Âm học: Không quan trọng (ngưỡng 60 – 85 dBA, trọng số chỉ 5%).
       - Nhiệt độ bảo quản tài liệu ISO 11799: Tối ưu $[18.0, 22.0]^\circ C$. Quá $22^\circ C$ bị phạt nặng 12 điểm/$^\circ C$ (nguy cơ nấm mốc).
       - Độ ẩm bảo quản: Tối ưu $[45, 55]\%RH$. Trên $55\%$ bị trừ 6 điểm/$\%$.
       - Ánh sáng bảo quản: Tối ưu $\le 100$ Lux (tránh quang hóa làm giòn trang sách).
  2. *Ngưỡng Lọc Vật lý trong `TelemetrySanitizerService.java`* [XÁC NHẬN: `TelemetrySanitizerService.java:24-35`]:
     Các hằng số loại trừ nhiễu cảm biến: `NOISE_MIN = 30.0`, `NOISE_AVG_MAX = 110.0`, `NOISE_PEAK_MAX = 130.0`, `PM_MAX = 1000.0`, `TEMP_MAX = 60.0`, `HUMIDITY_MAX = 100.0`, `LUX_MAX = 65535.0`.
  3. *Ngưỡng trong CSDL*:
     Trường `targetComfortScore` trong `Room.java:37` (Double) cho phép quản trị viên đặt điểm kỳ vọng cho từng phòng, nhưng **chưa có code nào đọc trường này để so sánh**.
  4. *Cấu hình file `application.yaml`*:
     **KHÔNG CÓ** bất kỳ ngưỡng cảnh báo nào được khai báo trong file cấu hình.
- **Nơi lưu trữ Cảnh báo**:
  Được thiết kế lưu vào collection `alerts` [XÁC NHẬN: `Alert.java:14-52`].
- **Cơ chế Sinh và Phát đi Cảnh báo (Alert Dispatching)**:
  - **HIỆN TRẠNG MÃ NGUỒN: CHƯA HOẠT ĐỘNG (STUB / DANG DỞ)** [XÁC NHẬN].
  - Mặc dù có các thực thể `Alert`, `AlertRepository`, `AlertType`, `AlertStatus`, và `ErrorCode.ALERT_NOT_EXISTED`, nhưng:
    - Trong pipeline MQTT Ingestion (`MqttMessageDispatcherService`), sau khi tính Comfort Score, **không có câu lệnh nào kiểm tra ngưỡng vi phạm để tạo đối tượng `Alert` và lưu vào `AlertRepository`**.
    - **Không có bất kỳ Controller hay API nào** để Frontend đọc danh sách cảnh báo (`GET /api/v1/alerts`) hoặc thực hiện thao tác xác nhận (`POST /api/v1/alerts/{id}/acknowledge`).
    - Không có cơ chế gửi email, SMS, hay Webhook thông báo.

### 5.3. Phân tích Cấu hình & Yếu tố Kỹ thuật Phục vụ Giao diện

#### A. Cấu hình CORS (Cross-Origin Resource Sharing)
- Cấu hình tại `SecurityConfig.java:91-101`:
  - `allowedOrigins`: Đọc từ cấu hình `${cors.allowed-origins}` (mặc định trong `application.yaml:30` là `http://localhost:3000,http://localhost:8081`).
  - `allowedMethods`: Hỗ trợ đầy đủ các phương thức RESTful: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
  - `allowedHeaders`: `Authorization`, `Content-Type`.
  - `allowCredentials`: `true` (cho phép gửi kèm cookie và header xác thực).
  - Pre-flight Requests: Endpoint `OPTIONS /**` được `permitAll()` rõ ràng tại `SecurityConfig.java:55`.
- *Khuyến nghị cho Frontend*: Đảm bảo Frontend chạy ở `localhost:3000` (Next.js / Vite / React) hoặc `localhost:8081` trong môi trường dev; nếu deploy staging/production cần truyền biến môi trường `CORS_ALLOWED_ORIGINS` tương ứng với domain frontend.

#### B. Luồng Đăng nhập & Làm mới Phiên (Auth Flow & Token Rotation)
- **Đăng nhập**: Gọi `POST /api/auth/login`. Nhận về JSON:
  ```json
  {
    "code": 1000,
    "result": {
      "token": "eyJhbGciOiJIUzUxMiJ9...",
      "refreshToken": "eyJhbGciOiJIUzUxMiJ9..."
    }
  }
  ```
- **Thời hạn Token**:
  - `token` (Access Token): Hết hạn sau **1 giờ** (`jwt.expiration-hours: 1`). Dùng để gắn vào header `Authorization: Bearer <token>`.
  - `refreshToken`: Hết hạn sau **24 giờ** (`jwt.refreshable-hours: 24`). Dùng riêng cho việc làm mới phiên.
- **Xử lý Hết hạn Phiên (Silent Refresh)**:
  Khi Access Token hết hạn, backend trả về HTTP 401 kèm body:
  ```json
  {
    "code": 1006,
    "message": "Token expired. Please refresh your session."
  }
  ```
  Frontend Interceptor (ví dụ trong Axios/Fetch) bắt mã `1006` hoặc HTTP 401 và gọi ngay `POST /api/auth/refresh` với `{ "token": "<refreshToken>" }` để nhận cặp token mới.
- **Đăng xuất an toàn**: Khi người dùng nhấn Đăng xuất, Frontend bắt buộc gọi `POST /api/auth/logout` để backend lưu JWT ID vào blacklist (`invalidated_tokens`), ngăn chặn việc dùng lại token cũ.

#### C. Cơ chế Phân trang, Lọc và Sắp xếp (Pagination, Filtering, Sorting)
- **Tình trạng Phân trang**:
  - Endpoint **DUY NHẤT** hỗ trợ phân trang chuẩn `PageResponse<T>` trong toàn bộ hệ thống là:
    `GET /api/users` (hỗ trợ các query params: `page`, `size`, `sortBy`, `sortDir`) [XÁC NHẬN: `UserController.java:35-49`].
  - Tất cả các endpoint danh sách còn lại:
    - `GET /api/v1/devices`: Trả về toàn bộ danh sách `List<DeviceResponse>`, **không có phân trang**.
    - `GET /api/v1/rooms`: Trả về `List<RoomResponse>`, chỉ hỗ trợ lọc đơn giản qua `@RequestParam(required = false) Integer floor`, **không có phân trang**.
    - `GET /api/roles`, `GET /api/permissions`: Trả về toàn bộ danh sách.
- **Truy vấn Dữ liệu Lịch sử Đo (Telemetry History)**:
  - `GET /api/v1/telemetry/device/{deviceId}` và `GET /api/v1/telemetry/room/{roomId}`:
    - Nhận hai tham số: `start` và `end`.
    - Logic mặc định trong Service [XÁC NHẬN: `TelemetryService.java:52-53`, `63-64`]:
      Nếu `end == null` $\rightarrow$ gán `Instant.now()`.
      Nếu `start == null` $\rightarrow$ gán `actualEnd.minus(1, ChronoUnit.HOURS)` (truy vấn 1 giờ gần nhất).
    - Sắp xếp: Cố định theo thứ tự thời gian giảm dần (`OrderByTimestampDesc`).
    - **Thiếu Phân trang**: Endpoint trả về danh sách thô `List<TelemetryResponse>`. Nếu frontend truyền khoảng thời gian rộng (ví dụ 7 ngày với tần suất 10s/bản ghi = hơn 60,000 bản ghi), backend sẽ load toàn bộ vào RAM và trả về một JSON khổng lồ, có nguy cơ gây OutOfMemory (OOM) hoặc sập trình duyệt!

#### D. Chuẩn Định dạng Thời gian
- Định dạng thống nhất trên toàn hệ thống: **ISO 8601 UTC** [XÁC NHẬN]:
  `yyyy-MM-dd'T'HH:mm:ss'Z'` hoặc có thêm phân số giây `yyyy-MM-dd'T'HH:mm:ss.SSS'Z'`.
- Các tham số Controller nhận dạng qua chú thích `@DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant` [XÁC NHẬN: `TelemetryController.java:42-43`, `52-53`].
- Frontend khi gửi request cần format thời gian dưới dạng ISO UTC string (ví dụ: `2026-10-21T08:00:00Z`).

#### E. Hiện trạng Endpoint Phục vụ Vẽ Biểu đồ (Analytics & Aggregations)
- **ĐÁNH GIÁ: HOÀN TOÀN THIẾU CÁC ENDPOINT TỔNG HỢP BIỂU ĐỒ** [XÁC NHẬN].
- Hiện tại backend **chưa có bất kỳ endpoint nào** hỗ trợ:
  1. Tổng hợp dữ liệu theo dải thời gian định sẵn (Bucket 1 giờ, 1 ngày, 1 tuần).
  2. Tính toán các giá trị thống kê: Min, Max, Average của Nhiệt độ, Độ ẩm, Âm thanh, Bụi PM2.5.
  3. Lịch sử phân bố điểm tiện nghi (Comfort Score Trend) theo ngày.
  4. Chỉ số nguy cơ ẩm mốc VTT Mould Index (dù được nhắc đến trong mô tả Permission `VIEW_ANALYTICS` tại `ApplicationInitConfig.java:71`).
- *Tác động đến Frontend Phase 2*: Để hiển thị biểu đồ trên giao diện Dashboard, Frontend tạm thời chỉ có thể vẽ biểu đồ với dải thời gian ngắn (1 giờ) bằng dữ liệu thô, hoặc Backend phải bổ sung API sử dụng MongoDB Aggregation Framework.

---

## 6. CÂU HỎI MỞ (OPEN QUESTIONS)

Qua quá trình rà soát và đối chiếu kỹ thuật chuyên sâu trên toàn bộ mã nguồn, nhóm phân tích kiến trúc mã nguồn (Worker R1) ghi nhận các vấn đề kỹ thuật và câu hỏi mở cốt lõi cần làm rõ để định hướng cho các giai đoạn tiếp theo (đặc biệt là phát triển giao diện Frontend và tối ưu hóa hệ thống):

### Câu hỏi 1: Định hướng Hoàn thiện Phân hệ Cảnh báo (Alert Subsystem)
- **Hiện trạng**: Trong mã nguồn, các thực thể nền tảng gồm `Alert.java`, `AlertRepository.java`, `AlertType`, `AlertStatus` và quyền hạn (`VIEW_ALERTS`, `ACKNOWLEDGE_ALERT`, `MANAGE_ALERT_CONFIG`) đã được khai báo. Tuy nhiên, trong pipeline MQTT Ingestion (`MqttMessageDispatcherService`), **hoàn toàn không có logic kiểm tra ngưỡng để tạo bản ghi Alert**, và **không có `AlertController` / `AlertService`** để cung cấp API cho Frontend.
- **Câu hỏi đặt ra**:
  1. Phân hệ Cảnh báo dự kiến sẽ được kích hoạt ở thời điểm nào?
  2. Ngưỡng cảnh báo sẽ được lấy cố định từ các tiêu chuẩn phòng trong `ComfortScoreService`, hay sẽ lưu cấu hình động theo từng phòng/thiết bị trong MongoDB?
  3. Khi phát hiện cảnh báo, ngoài việc lưu vào collection `alerts`, hệ thống có yêu cầu gửi thông báo ra bên ngoài (Email, Telegram Bot, Webhook) hay không?

### Câu hỏi 2: Chiến lược Cung cấp Dữ liệu Realtime cho Giao diện Người dùng
- **Hiện trạng**: Backend hiện tại chỉ có kênh tiếp nhận MQTT Inbound từ thiết bị IoT. Không có WebSocket, STOMP, SSE hay MQTT Outbound dành cho ứng dụng Frontend. Frontend hiện tại bắt buộc phải dùng kỹ thuật REST Polling.
- **Câu hỏi đặt ra**:
  1. Frontend trong Phase 2 sẽ chấp nhận cơ chế REST Polling (với chu kỳ khuyến nghị 10s – 30s), hay yêu cầu Backend phải bổ sung giao thức truyền dữ liệu thời gian thực như **Server-Sent Events (SSE)** hoặc **Spring WebSocket / STOMP**?
  2. Nếu duy trì REST Polling, tải lượng truy cập dự kiến (số lượng người dùng đồng thời trên trang Dashboard) là bao nhiêu để tính toán cấu hình Connection Pool của MongoDB và Cache tránh nghẽn I/O?

### Câu hỏi 3: Triển khai API Tổng hợp Dữ liệu Phục vụ Biểu đồ (Analytics & Aggregations)
- **Hiện trạng**: CSDL TimeSeries đã lưu trữ đầy đủ dữ liệu đo cấp giây, nhưng Controller chỉ cung cấp API truy vấn dải thô `GET /api/v1/telemetry/device/{deviceId}?start=...&end=...`. Nếu Frontend truy vấn dải 24 giờ hoặc 7 ngày để vẽ biểu đồ xu hướng (trend charts), payload trả về sẽ chứa hàng chục ngàn phần tử, gây lãng phí băng thông mạng và quá tải bộ nhớ trình duyệt client.
- **Câu hỏi đặt ra**:
  1. Backend có cần bổ sung ngay các endpoint tổng hợp sử dụng MongoDB Aggregation Framework (ví dụ: nhóm trung bình theo từng khung giờ `$hour`, tính Min/Max/Avg nhiệt độ, độ ẩm, âm thanh, bụi mịn, và điểm tiện nghi) trước khi bàn giao cho đội Frontend không?
  2. Chỉ số nấm mốc VTT Mould Index (được đề cập trong mô tả quyền `VIEW_ANALYTICS`) sẽ được tính toán động tại thời điểm query hay tính sẵn trong ingestion pipeline?

### Câu hỏi 4: Chuẩn hóa Thực thể Phân vùng Không gian (Zone Management)
- **Hiện trạng**: Phân quyền truy cập theo phân vùng (`ZONE_MANAGER`) đã được kiểm soát nghiêm ngặt trong `TelemetryService` và `DeviceService` dựa trên danh sách `user.assignedZones` và `device.zoneId`. Tuy nhiên, hệ thống không hề có Document hay Collection `zones` trong CSDL; zone hiện tại chỉ tồn tại dưới dạng chuỗi ký tự tự do (String).
- **Câu hỏi đặt ra**:
  1. Có cần tạo mới Collection `zones` (lưu `zoneId`, tên khu vực, mô tả, danh sách phòng thuộc zone) và bộ API CRUD Zone tương ứng để quản trị viên có thể quản lý trên giao diện quản trị không?

### Câu hỏi 5: Bổ sung Cơ chế Phân trang (Pagination) Toàn diện
- **Hiện trạng**: Ngoại trừ `GET /api/users`, các endpoint danh sách phòng (`/api/v1/rooms`) và danh sách thiết bị (`/api/v1/devices`) đều trả về danh sách không phân trang (`List<T>`).
- **Câu hỏi đặt ra**:
  1. Khi quy mô thư viện mở rộng lên hàng trăm cảm biến và phòng học, việc bổ sung chuẩn phân trang `PageResponse<T>` (`page`, `size`, `sort`) cho các danh mục này có cần chuẩn hóa ngay từ Phase 1 không?

### Câu hỏi 6: Cơ chế Quét Thiết bị Ngoại tuyến Tự động (Offline Device Sweeper)
- **Hiện trạng**: Thiết bị chỉ chuyển sang trạng thái OFFLINE khi Broker nhận được bản tin ngắt kết nối MQTT (LWT). Nếu thiết bị mất nguồn hoặc đứt cáp mạng đột ngột khiến broker không kịp nhận tin LWT, CSDL `devices` vẫn ghi nhận thiết bị là ONLINE (dù khi gọi API thì logic query-time sẽ tính là offline nếu quá 5 phút).
- **Câu hỏi đặt ra**:
  1. Có nên thiết lập một Background Scheduler (ví dụ quét mỗi 5 phút) để tự động cập nhật cờ `connectionState = OFFLINE` và ghi thời điểm `lastOfflineAt` vào CSDL cho các thiết bị không có tín hiệu quá 5 phút, nhằm đảm bảo tính nhất quán dữ liệu trực tiếp trong database?

---
*Báo cáo được hoàn thành bởi Worker R1 (Code Architecture Analyst) — Tuân thủ nguyên tắc Read-only, Bảo mật thông tin nghiêm ngặt, và gắn nhãn minh chứng [XÁC NHẬN] / [SUY LUẬN] / [CHƯA RÕ] trên 100% các nhận định kỹ thuật.*
