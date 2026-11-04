# BÁO CÁO ĐÁNH GIÁ TEST SUITE & HỢP ĐỒNG API (04_CONTRACT.MD)

- **Dự án**: Spring Boot AIoTLibTQB (IoT Giám sát Môi trường & Không gian Thư viện Thông minh)
- **Người thực hiện**: Worker R4 (Test Suite & API Contracts Analyst)
- **Thời điểm hoàn thành**: 2026-10-21
- **Trạng thái thực thi**: 100% hoàn thành theo yêu cầu R4 tại `ORIGINAL_REQUEST.md`

---

## 1. KHẢO SÁT 19 FILE TEST TRONG `src/test/java/`

### 1.1 Tổng quan Kiến trúc Kiểm thử và Phân loại Kiểm thử
Dự án hiện có tổng cộng **19 tệp kiểm thử** với **124 phương thức kiểm thử (`@Test`)** trong thư mục `src/test/java/com/example/AIoTLibTQB/` [XÁC NHẬN: lệnh `./mvnw test` thực thi 124 tests, 0 failures, 0 errors, 0 skipped trong 10.680s].

Dựa trên phân tích mã nguồn kiểm thử thực tế:
- **Unit Test (Kiểm thử đơn vị)**: **19/19 tệp (100%)**, bao gồm toàn bộ 124 ca kiểm thử [XÁC NHẬN: toàn bộ test case khởi tạo qua Mockito `@ExtendWith(MockitoExtension.class)` hoặc khởi tạo đối tượng Java thuần (POJO), sử dụng mock dependencies].
- **Slice Test (Kiểm thử phân tầng Spring)**: **0/19 tệp (0%)** [XÁC NHẬN: không tìm thấy bất kỳ annotation nào như `@WebMvcTest`, `@DataMongoTest`, `@JsonTest`, hay cấu hình MockMvc để kiểm tra tầng Controller/Web layer].
- **Integration Test (Kiểm thử tích hợp)**: **0/19 tệp (0%)** [XÁC NHẬN: không có `@SpringBootTest`, không tích hợp Embedded MongoDB, không dùng Testcontainers (MongoDB hay Mosquitto MQTT Broker), và không kiểm tra tương tác cơ sở dữ liệu thật].

### 1.2 Bảng Thống kê Chi tiết 19 File Test

| STT | Đường dẫn Tệp Test | Phân lớp | Số Test | Kỹ thuật Mock / Assert | Trọng tâm Kiểm thử & Mục tiêu Nghiệp vụ |
|:---:|:---|:---:|:---:|:---|:---|
| 1 | `src/test/java/com/example/AIoTLibTQB/configuration/ApplicationInitConfigTest.java` | Config | 4 | Mockito (`@Mock` UserRepository, RoleRepository, PermissionRepository, Environment), `ArgumentCaptor` | Kiểm tra luồng khởi tạo dữ liệu ban đầu (Seeding): tạo 14 permissions chuẩn, đồng bộ 7 roles, sinh mật khẩu tạm thời cho admin trên môi trường Dev và chặn khởi động nếu thiếu mật khẩu admin trên Prod [XÁC NHẬN: line 32-169]. |
| 2 | `src/test/java/com/example/AIoTLibTQB/configuration/CustomJwtDecoderTest.java` | Config / Security | 5 | Mockito (`@Mock` InvalidatedTokenRepository), Nimbus-JOSE-JWT | Giải mã và xác thực chữ ký HMAC-SHA256 của JWT, kiểm tra token hết hạn, kiểm tra token nằm trong danh sách đen (Blacklist) [XÁC NHẬN: line 28-138]. |
| 3 | `src/test/java/com/example/AIoTLibTQB/configuration/JwtAuthenticationEntryPointTest.java` | Config / Security | 2 | `MockHttpServletRequest`, `MockHttpServletResponse`, ObjectMapper | Xử lý lỗi khi request không có hoặc sai Bearer Token: trả về HTTP 401, header `WWW-Authenticate`, định dạng JSON UTF-8 theo chuẩn `ApiResponse` [XÁC NHẬN: line 14-61]. |
| 4 | `src/test/java/com/example/AIoTLibTQB/configuration/RateLimitFilterTest.java` | Config / Filter | 6 | `MockHttpServletRequest`, `MockHttpServletResponse`, Mockito FilterChain | Kiểm tra Bucket4j Rate Limiting: cho phép tối đa 10 request login/phút từ cùng 1 IP, chặn từ request thứ 11 với HTTP 429 Too Many Requests và header `Retry-After` [XÁC NHẬN: line 14-168]. |
| 5 | `src/test/java/com/example/AIoTLibTQB/controller/PermissionControllerTest.java` | Controller | 4 | Mockito (`@Mock` PermissionService), Reflection Assert | Kiểm tra Java reflection annotation `@PreAuthorize("hasAuthority('ADMIN')")` ở cấp độ Class và kiểm tra ủy quyền (delegation) các phương thức `create`, `getAll`, `delete` sang Service [XÁC NHẬN: line 21-83]. |
| 6 | `src/test/java/com/example/AIoTLibTQB/controller/RoleControllerTest.java` | Controller | 5 | Mockito (`@Mock` RoleService), Reflection Assert | Kiểm tra annotation bảo vệ `@PreAuthorize("hasAuthority('ADMIN')")` ở Class-level và kiểm tra ủy quyền gọi sang RoleService (`create`, `getAll`, `update`, `delete`) [XÁC NHẬN: line 22-98]. |
| 7 | `src/test/java/com/example/AIoTLibTQB/exception/GlobalExceptionHandlerTest.java` | Exception | 5 | Mockito, JUnit 5 | Bắt ngoại lệ tập trung: `Exception` chung -> HTTP 500 (`UNCATEGORIZED_EXCEPTION`), `AppException` -> mã lỗi tương ứng, `AccessDeniedException` -> HTTP 403, `MethodArgumentNotValidException` -> HTTP 400 [XÁC NHẬN: line 22-106]. |
| 8 | `src/test/java/com/example/AIoTLibTQB/service/AuthenticationServiceTest.java` | Service / Auth | 10 | Mockito (`@Mock` UserRepository, PasswordEncoder, InvalidatedTokenRepository, IntrospectService) | Kiểm thử đăng nhập người dùng (thành công, sai mật khẩu, tài khoản vô hiệu hóa, tài khoản không tồn tại), thu hồi token khi Logout, và cơ chế Refresh Token Rotation (RTR) chặn tái sử dụng Access Token [XÁC NHẬN: line 44-263]. |
| 9 | `src/test/java/com/example/AIoTLibTQB/service/ComfortScoreServiceTest.java` | Service / IoT | 13 | JUnit 5 thuần, AssertJ | Tính toán chỉ số tiện nghi tổng hợp (Comfort Score) theo thang điểm 100 và xếp hạng (A, B, C, D, F) từ 4 thành phần: Âm học (Acoustic), Không khí (AirQuality), Nhiệt ẩm (Thermal), Ánh sáng (Light) [XÁC NHẬN: line 20-269]. |
| 10 | `src/test/java/com/example/AIoTLibTQB/service/DeviceServiceTest.java` | Service / IoT | 8 | Mockito (`@Mock` DeviceRepository, RoomRepository, SecurityContext) | Đăng ký thiết bị IoT mới (sinh API key), cập nhật thiết bị, kiểm tra phân quyền truy cập theo Zone (`ZONE_MANAGER` chỉ xem thiết bị trong khu vực phân công), và cập nhật `lastSeenAt` [XÁC NHẬN: line 41-249]. |
| 11 | `src/test/java/com/example/AIoTLibTQB/service/DiscoveredDeviceServiceTest.java` | Service / IoT | 3 | In-memory Cache test | Ghi nhận thiết bị IoT lạ phát sóng chưa đăng ký vào Caffeine cache, cập nhật RSSI và thời điểm phát hiện lần cuối [XÁC NHẬN: line 12-55]. |
| 12 | `src/test/java/com/example/AIoTLibTQB/service/IntrospectServiceTest.java` | Service / Auth | 4 | Mockito (`@Mock` InvalidatedTokenRepository), SignedJWT | Kiểm tra tính hợp lệ của Token JWT (hợp lệ, sai chữ ký, hết hạn, nằm trong danh sách thu hồi) [XÁC NHẬN: line 29-123]. |
| 13 | `src/test/java/com/example/AIoTLibTQB/service/MqttMessageDispatcherServiceTest.java` | Service / Ingestion | 9 | Mockito (`@Mock` TelemetrySanitizerService, MongoTemplate, TelemetryRepository, DeviceRepository) | Điều phối bản tin MQTT: xử lý trạng thái online/offline, chống giả mạo Hardware ID, chuẩn hóa timestamp (10-chữ số và 13-chữ số), lọc bỏ bản tin rỗng, và lưu bản ghi telemetry vào MongoDB TimeSeries [XÁC NHẬN: line 34-321]. |
| 14 | `src/test/java/com/example/AIoTLibTQB/service/PermissionServiceTest.java` | Service / Auth | 6 | Mockito (`@Mock` PermissionRepository, RoleRepository, PermissionMapper) | Tạo quyền mới, lấy danh sách quyền, và ràng buộc toàn vẹn dữ liệu DATA-01 (không cho phép xóa quyền đang được gán cho một hoặc nhiều Role) [XÁC NHẬN: line 26-135]. |
| 15 | `src/test/java/com/example/AIoTLibTQB/service/RoleServiceTest.java` | Service / Auth | 6 | Mockito (`@Mock` RoleRepository, UserRepository, MongoTemplate) | Tạo Role, cập nhật Role và kích hoạt đồng bộ hàng loạt quyền trong User qua MongoTemplate `updateMulti` (tối ưu O(1) PERF-02), xóa Role [XÁC NHẬN: line 39-193]. |
| 16 | `src/test/java/com/example/AIoTLibTQB/service/RoomServiceTest.java` | Service / Space | 10 | Mockito (`@Mock` RoomRepository, RoomMapper) | Tạo không gian/phòng đọc, cập nhật tọa độ đa giác tường (`Point2D`), lọc danh sách phòng theo tầng (`floor`), tìm theo mã phòng (`code`), và xóa phòng [XÁC NHẬN: line 28-214]. |
| 17 | `src/test/java/com/example/AIoTLibTQB/service/TelemetrySanitizerServiceTest.java` | Service / IoT | 6 | JUnit 5 thuần, AssertJ | Làm sạch và chuẩn hóa dữ liệu cảm biến: lọc ngưỡng dị thường (out-of-bounds), cơ chế lấp đầy forward-fill với bộ nhớ đệm Caffeine Cache có giới hạn, loại trừ `noisePeak` khỏi forward-fill [XÁC NHẬN: line 10-134]. |
| 18 | `src/test/java/com/example/AIoTLibTQB/service/TelemetryServiceTest.java` | Service / IoT | 3 | Mockito (`@Mock` TelemetryRepository, DeviceRepository, UserRepository) | Truy vấn bản tin đo đạc mới nhất (Latest) theo thiết bị/phòng, truy vấn lịch sử (History) theo khoảng thời gian `start` - `end`, kiểm tra quyền hạn theo Zone [XÁC NHẬN: line 38-102]. |
| 19 | `src/test/java/com/example/AIoTLibTQB/service/UserServiceTest.java` | Service / IAM | 15 | Mockito (`@Mock` UserRepository, UserMapper, PasswordEncoder, RoleRepository) | Toàn bộ vòng đời tài khoản người dùng: đăng ký, phân quyền tự động, lấy thông tin cá nhân (`getMyInfo`), phân trang danh sách (`getAll`), cập nhật thông tin, bật/tắt trạng thái hoạt động (`toggleStatus`), và xóa tài khoản [XÁC NHẬN: line 47-400]. |

### 1.3 Phân tích Độ bao phủ và Các Module Còn Trống Test

#### A. Module Đã Có Test
- **Tầng Service (Nghiệp vụ cốt lõi)**: Đạt độ bao phủ **100% (12/12 Services đều có tệp test riêng)** [XÁC NHẬN: từ `AuthenticationServiceTest` đến `UserServiceTest`]. Logic nghiệp vụ nội tại của từng service được cô lập và kiểm tra chặt chẽ qua mock dependencies.
- **Tầng Exception Handling**: Được kiểm tra đầy đủ qua `GlobalExceptionHandlerTest` (5 test case) [XÁC NHẬN].
- **Cấu hình Security & Filter then chốt**: `ApplicationInitConfigTest`, `CustomJwtDecoderTest`, `JwtAuthenticationEntryPointTest`, `RateLimitFilterTest` bao phủ được logic giải mã token, xử lý từ chối xác thực và chặn brute-force/DDoS ở mức filter servlet [XÁC NHẬN].

#### B. Module Còn Trống Test (Test Gaps)
1. **Tầng Controller bị bỏ trống nghiêm trọng**:
   - Trong 7 Controller của hệ thống, chỉ có **2 Controller** có test (`PermissionControllerTest`, `RoleControllerTest`) [XÁC NHẬN: 5/7 Controller còn lại hoàn toàn không có test].
   - **5 Controller hoàn toàn chưa có tệp test**:
     + `AuthenticationController.java` [XÁC NHẬN: thiếu test tầng web cho `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/introspect`].
     + `DeviceController.java` [XÁC NHẬN: thiếu test cho 11 endpoints quản lý thiết bị IoT].
     + `RoomController.java` [XÁC NHẬN: thiếu test cho 6 endpoints quản lý không gian/phòng].
     + `TelemetryController.java` [XÁC NHẬN: thiếu test cho 4 endpoints truy vấn dữ liệu cảm biến].
     + `UserController.java` [XÁC NHẬN: thiếu test cho 7 endpoints quản lý tài khoản người dùng].
   - Đáng lưu ý: Ngay cả 2 tệp test Controller hiện có (`PermissionControllerTest`, `RoleControllerTest`) cũng **không phải Slice Test (không dùng `MockMvc`)**; chúng chỉ khởi tạo class Java thuần và dùng Reflection để đọc chuỗi `@PreAuthorize` [XÁC NHẬN: `PermissionControllerTest.java:32-36`]. Do đó, luồng thực thi HTTP thực tế (HTTP status code, JSON deserialization/serialization, kích hoạt Spring Validator `@Valid`, xử lý MediaType) hoàn toàn chưa được kiểm thử tự động.
2. **Tầng Repository (Truy vấn MongoDB) hoàn toàn trống (0/8 Repositories)**:
   - Các truy vấn quan trọng như:
     + `TelemetryRepository.findByMetadataDeviceIdAndTimestampBetweenOrderByTimestampDesc` [XÁC NHẬN: `TelemetryRepository.java:18`]
     + `AlertRepository.findTopByDeviceIdAndTypeAndStatusOrderByStartedAtDesc` [XÁC NHẬN: `AlertRepository.java:23`]
     + `DeviceRepository.findByZoneId` [XÁC NHẬN: `DeviceRepository.java:13`]
     + `UserRepository.existsByUsername` [XÁC NHẬN: `UserRepository.java:13`]
     hoàn toàn không có bài kiểm tra tích hợp để xác thực tính đúng đắn của cú pháp Derived Query Method, Spring Data MongoDB mapping và hiệu năng đánh chỉ mục (Index).
3. **Pipeline Ingestion MQTT & Cấu hình Hạ tầng**:
   - `MqttConfig.java` [XÁC NHẬN: không có test xác minh cấu hình luồng Inbound Adapter, Service Activator, kênh `mqttInputChannel`, ThreadPoolExecutor].
   - `SecurityConfig.java` [XÁC NHẬN: không có bài test tích hợp kiểm tra toàn diện chuỗi lọc `SecurityFilterChain`, CORS headers, phân quyền HTTP method theo URL pattern].

### 1.4 Đánh giá Rủi ro Kỹ thuật từ Hiện trạng Kiểm thử
- **Rủi ro 1: Rung lắc tích hợp tầng HTTP (HTTP Integration Regressions)**: Do thiếu MockMvc / Slice Test, các lỗi như quên gắn `@Valid` ở tham số `@RequestBody`, cấu hình sai `@PathVariable`, hoặc lỗi tuần tự hóa JSON date/time (Instant vs ISO-8601 string) sẽ không bị phát hiện bởi bộ test tự động hiện tại [SUY LUẬN].
- **Rủi ro 2: Sai lệch hành vi truy vấn MongoDB thực tế**: Các chỉ mục hợp số (Compound Indexes) và cơ chế TimeSeries bucket của MongoDB không được kiểm chứng qua Testcontainers, khiến việc suy giảm hiệu năng truy vấn chỉ bộc lộ khi đưa vào chạy môi trường thực [SUY LUẬN].

---

## 2. PHÂN TÍCH OPENAPI/SWAGGER VÀ ĐỐI CHIẾU POSTMAN COLLECTION

### 2.1 Hiện trạng OpenAPI / Swagger trong Hệ thống
- **Tình trạng cấu hình phụ thuộc**: Tệp `pom.xml` **hoàn toàn không chứa** dependency `springdoc-openapi-starter-webmvc-ui` hay bất kỳ thư viện sinh tài liệu OpenAPI/Swagger nào [XÁC NHẬN: `pom.xml` chỉ có các starters: web, validation, data-mongodb, oauth2-resource-server, actuator, integration, websocket, test].
- **Mã nguồn Controllers/DTOs**: Không có bất kỳ annotation Swagger chuẩn nào như `@Tag`, `@Operation`, `@ApiResponse`, `@Schema`, `@Parameter` trên toàn bộ 7 Controller và 14 Request DTO [XÁC NHẬN: grep toàn bộ dự án không có kết quả cho các annotation này].
- **Khả năng truy cập UI**: Các đường dẫn chuẩn `/swagger-ui.html`, `/swagger-ui/index.html`, `/v3/api-docs` sẽ trả về lỗi HTTP 404 Not Found [SUY LUẬN].
- **Đánh giá**: Dự án hiện phụ thuộc 100% vào tài liệu viết tay (`docs/business/`) và tệp Postman Collection làm đặc tả giao tiếp API cho các bên tích hợp.

### 2.2 Cấu trúc và Quy mô Postman Collection (`AIoTLibTQB_Postman_Collection.json`)
- **Tệp nguồn**: `AIoTLibTQB_Postman_Collection.json` (~62.2 KB, 1,954 dòng JSON) nằm tại thư mục gốc dự án [XÁC NHẬN: `AIoTLibTQB_Postman_Collection.json:1-1954`].
- **Quy mô**: Gồm **47 yêu cầu HTTP** được cấu trúc thành **7 thư mục nghiệp vụ (Folders)**, đi kèm script kiểm thử JavaScript tự động (`pm.test`, kiểm tra Status Code, trích xuất biến môi trường `accessToken`, `refreshToken`, `deviceId`, `roomId`):
  1. `01. Authentication & Token Management` (5 requests)
  2. `02. User Management` (7 requests)
  3. `03. Role & Permission Management (Audit P0, P1, P2)` (10 requests)
  4. `04. IoT Device Management` (11 requests)
  5. `05. Space & Room Management (Mặt bằng & Đa giác tường)` (7 requests)
  6. `06. Telemetry Ingestion & Query (Dữ liệu Cảm biến)` (4 requests)
  7. `07. System Actuator & Health Check (Audit P1 SEC-02)` (3 requests)

### 2.3 Ma trận Đối chiếu Chéo (Cross-Reference Matrix): Postman vs. Controllers Thực tế

Dưới đây là bảng đối chiếu chi tiết toàn bộ 47 Postman requests với 39 Controller Endpoints thực tế trong mã nguồn Java:

| Thư mục Postman | Tên Yêu cầu trong Postman | Method | URL Path trong Postman | Controller Tương ứng trong Mã nguồn | Method & Dòng trong Controller | Phân quyền (@PreAuthorize / Security) | Đánh giá Khớp nối |
|:---|:---|:---:|:---|:---|:---|:---|:---:|
| **01. Auth** | 1.1 Login as Admin | POST | `/api/auth/login` | `AuthenticationController` | `login()` (line 30) | Public (`SecurityConfig:30`) | **Khớp hoàn toàn** |
| | 1.2 Refresh Token Rotation | POST | `/api/auth/refresh` | `AuthenticationController` | `refresh()` (line 52) | Public (`SecurityConfig:33`) | **Khớp hoàn toàn** |
| | 1.3 [Test AUTH-01] Reject Access Token at Refresh | POST | `/api/auth/refresh` | `AuthenticationController` | `refresh()` (line 52) | Public (Test case phủ định: mong đợi HTTP 401) | **Khớp hoàn toàn** |
| | 1.4 Introspect Token | POST | `/api/auth/introspect` | `AuthenticationController` | `introspect()` (line 37) | Public (`SecurityConfig:31`) | **Khớp hoàn toàn** |
| | 1.5 Logout (Blacklist token) | POST | `/api/auth/logout` | `AuthenticationController` | `logout()` (line 45) | Public (`SecurityConfig:32`) | **Khớp hoàn toàn** |
| **02. User** | 2.1 Register New User | POST | `/api/users` | `UserController` | `create()` (line 28) | Public (`SecurityConfig:29`) | **Khớp hoàn toàn** |
| | 2.2 Get My Profile | GET | `/api/users/myInfo` | `UserController` | `getMyInfo()` (line 52) | Authenticated (`SecurityConfig:61`) | **Khớp hoàn toàn** |
| | 2.3 Get All Users with Pagination | GET | `/api/users?page=0&size=10...` | `UserController` | `getAll()` (line 35) | `ADMIN` (`UserService:68`) | **Khớp hoàn toàn** |
| | 2.4 Get User by ID | GET | `/api/users/{{createdUserId}}` | `UserController` | `getById()` (line 59) | `ADMIN` hoặc chính chủ (`UserService:82`) | **Khớp hoàn toàn** |
| | 2.5 Update User Profile | PUT | `/api/users/{{createdUserId}}` | `UserController` | `update()` (line 66) | `ADMIN` hoặc chính chủ (`UserService:89`) | **Khớp hoàn toàn** |
| | 2.6 Toggle User Active Status | PATCH | `/api/users/{{createdUserId}}/status` | `UserController` | `toggleStatus()` (line 75) | `ADMIN` (`UserService:117`) | **Khớp hoàn toàn** |
| | 2.7 Delete User | DELETE | `/api/users/{{createdUserId}}` | `UserController` | `deleteById()` (line 84) | `ADMIN` (`UserService:125`) | **Khớp hoàn toàn** |
| **03. Role & Perm** | 3.1 [Test SEC-01] GET /api/roles unauth -> 401 | GET | `/api/roles` | `RoleController` | `getAll()` (line 32) | `ADMIN` (`RoleController:19`) | **Khớp hoàn toàn** |
| | 3.2 [Test SEC-01] GET /api/permissions unauth -> 401 | GET | `/api/permissions` | `PermissionController` | `getAll()` (line 32) | `ADMIN` (`PermissionController:19`) | **Khớp hoàn toàn** |
| | 3.3 Create New Permission | POST | `/api/permissions` | `PermissionController` | `create()` (line 25) | `ADMIN` (`PermissionController:19`) | **Khớp hoàn toàn** |
| | 3.4 Get All Permissions | GET | `/api/permissions` | `PermissionController` | `getAll()` (line 32) | `ADMIN` (`PermissionController:19`) | **Khớp hoàn toàn** |
| | 3.5 Create New Role | POST | `/api/roles` | `RoleController` | `create()` (line 25) | `ADMIN` (`RoleController:19`) | **Khớp hoàn toàn** |
| | 3.6 Get All Roles | GET | `/api/roles` | `RoleController` | `getAll()` (line 32) | `ADMIN` (`RoleController:19`) | **Khớp hoàn toàn** |
| | 3.7 [Test PERF-02] Update Role | PUT | `/api/roles/{{testRoleName}}` | `RoleController` | `update()` (line 39) | `ADMIN` (`RoleController:19`) | **Khớp hoàn toàn** |
| | 3.8 [Test DATA-01] Delete Permission in use -> 400 | DELETE | `/api/permissions/{{testPerm}}` | `PermissionController` | `delete()` (line 39) | `ADMIN` (Test case phủ định: mong đợi HTTP 400) | **Khớp hoàn toàn** |
| | 3.9 Delete Role | DELETE | `/api/roles/{{testRoleName}}` | `RoleController` | `delete()` (line 46) | `ADMIN` (`RoleController:19`) | **Khớp hoàn toàn** |
| | 3.10 Delete Permission sau khi xóa Role | DELETE | `/api/permissions/{{testPerm}}` | `PermissionController` | `delete()` (line 39) | `ADMIN` (`PermissionController:19`) | **Khớp hoàn toàn** |
| **04. IoT Device** | 4.1 Register New IoT Device | POST | `/api/v1/devices/register` | `DeviceController` | `register()` (line 38) | `ADMIN, LIBRARIAN` (`DeviceService:46`) | **Khớp hoàn toàn** [Lưu ý alias `POST /api/v1/devices`] |
| | 4.2 Authenticate IoT Device | POST | `/api/v1/devices/authenticate` | `DeviceController` | `authenticate()` (line 62) | Public (`SecurityConfig:34`) | **Khớp hoàn toàn** |
| | 4.3 Device Heartbeat | POST | `/api/v1/devices/{{id}}/heartbeat` | `DeviceController` | `heartbeat()` (line 56) | Authenticated | **Khớp hoàn toàn** |
| | 4.4 Get All Devices | GET | `/api/v1/devices` | `DeviceController` | `getAll()` (line 70) | `ADMIN, LIBRARIAN, ZONE_MANAGER, MAINTENANCE` (`DeviceService:94`) | **Khớp hoàn toàn** |
| | 4.5 Get Device by ID | GET | `/api/v1/devices/{{id}}` | `DeviceController` | `getById()` (line 77) | `ADMIN, LIBRARIAN, ZONE_MANAGER` (`DeviceService:99`) | **Khớp hoàn toàn** |
| | 4.6 Get Devices by Zone | GET | `/api/v1/devices/zone/ZONE_A` | `DeviceController` | `getByZone()` (line 84) | `ADMIN, LIBRARIAN` (`DeviceService:122`) | **Khớp hoàn toàn** |
| | 4.7 Update Device Metadata | PUT | `/api/v1/devices/{{id}}` | `DeviceController` | `update()` (line 47) | `ADMIN, LIBRARIAN` (`DeviceService:58`) | **Khớp hoàn toàn** |
| | 4.8 Regenerate Device API Key | POST | `/api/v1/devices/{{id}}/regenerate-key` | `DeviceController` | `regenerateKey()` (line 91) | `ADMIN, LIBRARIAN` (`DeviceService:87`) | **Khớp hoàn toàn** |
| | 4.9 Toggle Device Active Status | PATCH | `/api/v1/devices/{{id}}/status?active=false` | `DeviceController` | `toggleStatus()` (line 98) | `ADMIN, LIBRARIAN` (`DeviceService:154`) | **Khớp hoàn toàn** |
| | 4.10 Delete Device | DELETE | `/api/v1/devices/{{id}}` | `DeviceController` | `delete()` (line 107) | `ADMIN` (`DeviceService:161`) | **Khớp hoàn toàn** |
| | 4.11 Get Discovered Devices | GET | `/api/v1/devices/discovered` | `DeviceController` | `getDiscovered()` (line 32) | `ADMIN, LIBRARIAN` (`DeviceController:30`) | **Khớp hoàn toàn** |
| **05. Room** | 5.1 Create New Room | POST | `/api/v1/rooms` | `RoomController` | `create()` (line 25) | `ADMIN, LIBRARIAN` (`RoomService:29`) | **Khớp hoàn toàn** |
| | 5.2 Get All Rooms | GET | `/api/v1/rooms` | `RoomController` | `getAll()` (line 32) | Authenticated | **Khớp hoàn toàn** |
| | 5.3 Get Rooms by Floor | GET | `/api/v1/rooms?floor=1` | `RoomController` | `getAll()` (line 32) | Authenticated | **Khớp hoàn toàn** |
| | 5.4 Get Room by ID | GET | `/api/v1/rooms/{{id}}` | `RoomController` | `getById()` (line 40) | Authenticated | **Khớp hoàn toàn** |
| | 5.5 Get Room by Code | GET | `/api/v1/rooms/code/{{code}}` | `RoomController` | `getByCode()` (line 47) | Authenticated | **Khớp hoàn toàn** |
| | 5.6 Update Room | PUT | `/api/v1/rooms/{{id}}` | `RoomController` | `update()` (line 54) | `ADMIN, LIBRARIAN` (`RoomService:74`) | **Khớp hoàn toàn** |
| | 5.7 Delete Room | DELETE | `/api/v1/rooms/{{id}}` | `RoomController` | `delete()` (line 63) | `ADMIN` (`RoomService:105`) | **Khớp hoàn toàn** |
| **06. Telemetry** | 6.1 Get Latest Telemetry by Device ID | GET | `/api/v1/telemetry/device/{{id}}/latest` | `TelemetryController` | `getLatestByDeviceId()` (line 26) | `ADMIN, LIBRARIAN, ZONE_MANAGER, USER, VIEWER` (`TelemetryController:20`) | **Khớp hoàn toàn** |
| | 6.2 Get Latest Telemetry by Room ID | GET | `/api/v1/telemetry/room/{{id}}/latest` | `TelemetryController` | `getLatestByRoomId()` (line 33) | Cùng trên | **Khớp hoàn toàn** |
| | 6.3 Get Historical Telemetry by Device ID | GET | `/api/v1/telemetry/device/{{id}}` | `TelemetryController` | `getHistoryByDeviceId()` (line 40) | Cùng trên | **Khớp hoàn toàn** |
| | 6.4 Get Historical Telemetry by Room ID | GET | `/api/v1/telemetry/room/{{id}}` | `TelemetryController` | `getHistoryByRoomId()` (line 50) | Cùng trên | **Khớp hoàn toàn** |
| **07. Actuator** | 7.1 [Test SEC-02] Public Health Check | GET | `/actuator/health` | Spring Boot Actuator | `HealthEndpoint` | Public (`SecurityConfig:57`, che chi tiết DB) | **Khớp hoàn toàn** |
| | 7.2 [Test SEC-02] Authorized Health Check | GET | `/actuator/health` | Spring Boot Actuator | `HealthEndpoint` | Bearer Token (hiển thị chi tiết MongoDB) | **Khớp hoàn toàn** |
| | 7.3 Actuator Info | GET | `/actuator/info` | Spring Boot Actuator | `InfoEndpoint` | Public (`SecurityConfig:57`) | **Khớp hoàn toàn** |

### 2.4 Điểm Khác biệt & Bất đối xứng giữa Postman và Controller
1. **Toàn bộ 39 Controller Endpoints đều được bao phủ bởi Postman**: 100% endpoint trong mã nguồn Java đều có request tương ứng trong Postman Collection [XÁC NHẬN].
2. **Postman chứa các Test Case bảo mật/ràng buộc bổ sung**: Postman thiết kế 8 request đặc thù kiểm thử biên bảo mật (P0 SEC-01 kiểm tra không gửi token bị 401; P1 AUTH-01 kiểm tra gửi Access Token vào refresh bị 401; P1 DATA-01 kiểm tra xóa Permission đang dùng bị 400; P2 PERF-02 kích hoạt updateMulti O(1); SEC-02 kiểm tra che giấu health details khi chưa đăng nhập) [XÁC NHẬN: Postman items 1.3, 3.1, 3.2, 3.7, 3.8, 7.1, 7.2].
3. **Bất đối xứng đường dẫn đăng ký thiết bị**:
   - `DeviceController.java:38` hỗ trợ cả 2 path: `@PostMapping({"", "/register"})`. Tức là cả `POST /api/v1/devices` và `POST /api/v1/devices/register` đều hợp lệ.
   - Postman Collection mục 4.1 chỉ gọi `POST /api/v1/devices/register`.
4. **Tham số phân trang**:
   - `UserController.java:35-39` hỗ trợ 4 query params: `page`, `size`, `sortBy`, `sortDir`.
   - Postman item 2.3 sử dụng trực tiếp các query param này: `/api/users?page=0&size=10&sortBy=createdAt&sortDir=desc`.
   - Không có Controller nào khác trong hệ thống hỗ trợ query param phân trang.

---

## 3. CHUẨN HÓA ĐẶC TẢ HỢP ĐỒNG API

### 3.1 Cấu trúc Envelope Response/Error Chuẩn

#### A. Chuẩn Envelope Thành công (Success Response)
Tất cả endpoint trả về cấu trúc bọc `ApiResponse<T>` [XÁC NHẬN: `dto/response/ApiResponse.java:13-20`]:
```json
{
  "code": 1000,
  "result": { ... }
}
```
- `code` (integer, mặc định `1000`): Quy ước mã trạng thái nội bộ thể hiện giao dịch nghiệp vụ thành công.
- `message` (string): Thường là `null` trong response thành công và được Jackson bỏ qua (không serialize ra JSON) nhờ cấu hình `@JsonInclude(JsonInclude.Include.NON_NULL)` [XÁC NHẬN: `ApiResponse.java:12`].
- `result` (generic `T`): Dữ liệu trả về (DTO đơn thể, danh sách `List<T>`, hoặc đối tượng phân trang `PageResponse<T>`).
- Với các thao tác không trả về payload (như `logout`, `delete`, `heartbeat`), kiểu generic là `ApiResponse<Void>`, JSON trả về chỉ gồm:
```json
{
  "code": 1000
}
```
*(Ngoại lệ: `UserController.deleteById` trả về `ApiResponse<String>` với chuỗi text `result: "User with id: ... has been deleted"` [XÁC NHẬN: `UserController.java:86-88`]. Đây là điểm chưa đồng nhất với các thao tác DELETE khác vốn trả về `ApiResponse<Void>`)*.

#### B. Chuẩn Envelope Lỗi (Error Response)
Được chuẩn hóa tập trung qua `GlobalExceptionHandler.java:14-76`, `JwtAuthenticationEntryPoint.java:50-55`, và `RateLimitFilter.java:84-89`:
```json
{
  "code": 1005,
  "message": "User does not exist"
}
```
- `code` (integer): Mã định danh lỗi nghiệp vụ định nghĩa trong `enums/ErrorCode.java`.
- `message` (string): Mô tả lỗi bằng tiếng Anh dễ hiểu.
- `result`: Bị triệt tiêu (`null`), không hiển thị trong JSON.
- **HTTP Status Code tương ứng trên Response Header**: Đồng bộ với định nghĩa trong `ErrorCode` (ví dụ `1005` đi kèm HTTP 404 Not Found, `1006` đi kèm HTTP 401 Unauthorized, `1007` đi kèm HTTP 403 Forbidden, `4029` đi kèm HTTP 429 Too Many Requests, `9999` đi kèm HTTP 500 Internal Server Error).

### 3.2 Cơ chế Phân trang (Pagination) và Sự Thiếu Nhất Quán

#### A. Cấu trúc Đối tượng Phân trang `PageResponse<T>`
Dự án đã định nghĩa DTO phân trang chuẩn tại `dto/response/PageResponse.java:13-26`:
```json
{
  "code": 1000,
  "result": {
    "content": [ ... ],
    "page": 0,
    "size": 10,
    "totalElements": 45,
    "totalPages": 5,
    "last": false
  }
}
```
- Các trường: `content` (mảng đối tượng), `page` (chỉ số trang bắt đầu từ 0), `size` (kích thước trang), `totalElements` (tổng số bản ghi), `totalPages` (tổng số trang), `last` (cờ boolean báo hiệu trang cuối cùng).

#### B. Phân tích Sự Thiếu Nhất Quán Nghiêm trọng trong Toàn Hệ Thống
1. **Chỉ duy nhất 1 Endpoint áp dụng phân trang**:
   - `GET /api/users` là endpoint duy nhất sử dụng `PageResponse<UserResponse>` [XÁC NHẬN: `UserController.java:35` và `UserService.java:69`].
2. **Tất cả các Endpoint danh sách khác đều trả về `List<T>` không giới hạn (Unpaginated)**:
   - `GET /api/v1/devices`: trả về `ApiResponse<List<DeviceResponse>>` [XÁC NHẬN: `DeviceController.java:70`]. Khi số lượng cảm biến IoT lên hàng trăm/nghìn, việc load toàn bộ document vào RAM sẽ gây nghẽn mạng và lag giao diện.
   - `GET /api/v1/devices/zone/{zoneId}`: trả về `ApiResponse<List<DeviceResponse>>` [XÁC NHẬN: `DeviceController.java:84`].
   - `GET /api/v1/rooms`: trả về `ApiResponse<List<RoomResponse>>` [XÁC NHẬN: `RoomController.java:32`].
   - `GET /api/roles`: trả về `ApiResponse<List<RoleResponse>>` [XÁC NHẬN: `RoleController.java:32`].
   - `GET /api/permissions`: trả về `ApiResponse<List<PermissionResponse>>` [XÁC NHẬN: `PermissionController.java:32`].
3. **Rủi ro cạn kiệt bộ nhớ tại Endpoint Lịch sử Cảm biến (`TelemetryController`)**:
   - `GET /api/v1/telemetry/device/{deviceId}` và `GET /api/v1/telemetry/room/{roomId}`: Trả về `ApiResponse<List<TelemetryResponse>>` [XÁC NHẬN: `TelemetryController.java:40, 50`].
   - Nếu client truyền `start` cách đây 7 ngày và `end` là hiện tại, với tần suất IoT gửi 10 giây/lần, query sẽ kéo ra hơn **60,000 documents**, tạo ra 60,000 đối tượng DTO và serialize chuỗi JSON hàng chục Megabytes, có nguy cơ gây OutOfMemoryError (OOM) cho JVM backend và làm đơ trình duyệt Frontend [SUY LUẬN].

### 3.3 Đặc tả Ràng buộc Dữ liệu (Validation Annotations)

Cơ chế validation của hệ thống sử dụng `jakarta.validation` kết hợp ánh xạ mã lỗi qua `GlobalExceptionHandler.handleValidationException`: khi vi phạm, Spring ném `MethodArgumentNotValidException`, trích xuất `fieldError.getDefaultMessage()` làm key của `ErrorCode.valueOf(...)`.

Tuy nhiên, mức độ áp dụng validation giữa các Request DTO và Controller rất không đồng đều:

| Request DTO | Vị trí Dùng trong Controller | Có `@Valid` ở Controller? | Các Annotation Ràng buộc trên DTO | Đánh giá Tính Toàn Vẹn |
|:---|:---|:---:|:---|:---:|
| `UserCreationRequest` | `UserController.create` | **CÓ** (`UserController:28`) | `@Size(min=6, message="USERNAME_INVALID")` trên username, `@Size(min=8, message="PASSWORD_INVALID")` trên password [XÁC NHẬN: line 14, 17] | **Tốt**, nhưng thiếu kiểm tra định dạng `@Email` trên email và regex trên phone |
| `UserUpdateRequest` | `UserController.update` | **CÓ** (`UserController:67`) | `@Size(min=8, message="PASSWORD_INVALID")` trên password [XÁC NHẬN: line 16] | Khá, cho phép password null/blank khi không đổi mật khẩu |
| `UserStatusRequest` | `UserController.toggleStatus` | **KHÔNG** (`UserController:76`) | Không có annotation nào (chỉ có `boolean active`) | Chấp nhận được do là kiểu boolean nguyên thủy |
| `AuthenticationRequest` | `AuthenticationController.login` | **KHÔNG** (`AuthenticationController:30`) | **KHÔNG CÓ ANNOTATION NÀO** [XÁC NHẬN: `AuthenticationRequest.java:12-14`] | **Lỗ hổng kiểm tra**: Request body rỗng hoặc username/password null vẫn lọt vào Service, chỉ bị chặn khi DB query null |
| `DeviceAuthRequest` | `DeviceController.authenticate` | **CÓ** (`DeviceController:63`) | `@NotBlank(message="HARDWARE_ID_REQUIRED")`, `@NotBlank(message="API_KEY_REQUIRED")` [XÁC NHẬN: `DeviceAuthRequest.java:14, 17`] | **Tốt**, bắt buộc đủ hardwareId và apiKey |
| `DeviceRegistrationRequest` | `DeviceController.register` | **CÓ** (`DeviceController:40`) | `@NotBlank` cho deviceName, hardwareId, zoneId, deviceType [XÁC NHẬN: line 15, 18, 21, 30] | **Tốt**, dữ liệu đăng ký IoT chặt chẽ |
| `DeviceUpdateRequest` | `DeviceController.update` | **KHÔNG** (`DeviceController:49`) | **KHÔNG CÓ ANNOTATION NÀO** [XÁC NHẬN: `DeviceUpdateRequest.java:14-16`] | **Lỏng lẻo**: Cho phép gửi payload rỗng khi cập nhật thiết bị |
| `RoomCreationRequest` | `RoomController.create` | **CÓ** (`RoomController:25`) | `@NotBlank` cho code, name; `@NotNull` cho floor [XÁC NHẬN: line 19, 22, 25] | **Tốt**, bắt buộc định danh phòng và số tầng |
| `RoomUpdateRequest` | `RoomController.update` | **CÓ** (`RoomController:56`) | **KHÔNG CÓ ANNOTATION NÀO TRÊN DTO** [XÁC NHẬN: `RoomUpdateRequest.java:15-30`] | `@Valid` ở Controller bị vô hiệu hóa vì DTO không chứa quy tắc nào |
| `RoleRequest` | `RoleController.create, update` | **KHÔNG** (`RoleController:25, 39`) | **KHÔNG CÓ ANNOTATION NÀO** [XÁC NHẬN: `RoleRequest.java:13-17`] | **Lỏng lẻo**: Cho phép tạo Role có tên null/rỗng |
| `PermissionRequest` | `PermissionController.create` | **KHÔNG** (`PermissionController:25`) | **KHÔNG CÓ ANNOTATION NÀO** [XÁC NHẬN: `PermissionRequest.java:12-15`] | **Lỏng lẻo**: Cho phép tạo Permission tên rỗng |
| `IntrospectRequest` | `AuthenticationController.introspect` | **KHÔNG** (`AuthenticationController:37`) | Không có annotation nào | Cần thêm `@NotBlank` cho trường `token` |
| `LogoutRequest` | `AuthenticationController.logout` | **KHÔNG** (`AuthenticationController:45`) | Không có annotation nào | Cần thêm `@NotBlank` cho trường `token` |
| `RefreshRequest` | `AuthenticationController.refresh` | **KHÔNG** (`AuthenticationController:52`) | Không có annotation nào | Cần thêm `@NotBlank` cho trường `token` |

### 3.4 Chiến lược API Versioning: Mâu thuẫn Kiến trúc và Đề xuất Chuẩn hóa

#### A. Hiện trạng Mâu thuẫn
Đang tồn tại sự bất nhất hoàn toàn trong cấu trúc URI của backend:
1. **Nhóm IAM & Người dùng (Authentication, Users, Roles, Permissions)**: Sử dụng tiền tố không phiên bản `/api/`:
   - `/api/auth/...` [XÁC NHẬN: `AuthenticationController.java:21`]
   - `/api/users/...` [XÁC NHẬN: `UserController.java:20`]
   - `/api/roles/...` [XÁC NHẬN: `RoleController.java:16`]
   - `/api/permissions/...` [XÁC NHẬN: `PermissionController.java:16`]
2. **Nhóm Nghiệp vụ IoT & Không gian (Devices, Rooms, Telemetry)**: Sử dụng tiền tố có phiên bản `/api/v1/`:
   - `/api/v1/devices/...` [XÁC NHẬN: `DeviceController.java:22`]
   - `/api/v1/rooms/...` [XÁC NHẬN: `RoomController.java:17`]
   - `/api/v1/telemetry/...` [XÁC NHẬN: `TelemetryController.java:17`]

#### B. Đánh giá Tác động & Đề xuất Chuẩn hóa cho Frontend
- **Tác động**: Khi lập trình Frontend (React/Vue), đội ngũ UI không thể cấu hình một `baseURL` đồng nhất kiểu `http://server:8080/api/v1` mà phải cấu hình `baseURL: http://server:8080` rồi tự ghép nối tay tiền tố `/api` hoặc `/api/v1` tùy endpoint, rất dễ gây nhầm lẫn đường dẫn [SUY LUẬN].
- **Đề xuất Chuẩn hóa (Kiến nghị cho Phase 2)**:
  - Đồng bộ toàn bộ hệ thống sang chiến lược URI Versioning chuẩn: `/api/v1/...`.
  - Giữ lại mapping cũ `/api/auth`, `/api/users`, `/api/roles`, `/api/permissions` dưới dạng deprecated aliases hoặc redirect 308 để tương thích ngược.

---

## 4. ĐÁNH GIÁ TÍNH SẴN SÀNG PHỤC VỤ GIAO DIỆN FRONTEND

### 4.1 Hợp đồng Dữ liệu Realtime (WebSocket / SSE / Polling Contracts)
- **Đánh giá Thư viện & Cấu hình**:
  - `pom.xml:109` có khai báo dependency `spring-boot-starter-websocket` [XÁC NHẬN].
  - Tuy nhiên, qua rà soát toàn bộ mã nguồn Java: **KHÔNG CÓ BẤT KỲ CẤU HÌNH WEBSOCKET NÀO** [XÁC NHẬN: không có class nào chứa `@EnableWebSocket`, `@EnableWebSocketMessageBroker`, `WebSocketConfigurer`, `SimpMessagingTemplate`].
  - **KHÔNG CÓ SERVER-SENT EVENTS (SSE)**: Không có endpoint nào trả về `SseEmitter` hoặc `MediaType.TEXT_EVENT_STREAM_VALUE` [XÁC NHẬN: grep `SseEmitter` ra 0 kết quả].
- **Hợp đồng Khả dụng Thực tế cho Frontend**:
  - Frontend **bắt buộc phải sử dụng REST Polling** (hỏi vòng định kỳ) để lấy dữ liệu realtime [SUY LUẬN].
  - Các endpoint phục vụ Polling hiện có:
    + Cập nhật chỉ số mới nhất phòng đọc: Polling `GET /api/v1/telemetry/room/{roomId}/latest` (chu kỳ khuyến nghị: 10 - 30 giây).
    + Cập nhật trạng thái kết nối thiết bị: Polling `GET /api/v1/devices/{deviceId}` để đọc trường `connectionState` ("ONLINE" / "OFFLINE") và `lastSeenAt`.
  - **Kết luận**: Tính sẵn sàng cho dữ liệu đẩy (Push Notification / Live Telemetry Stream) đạt **0% (Chưa hỗ trợ)**. Đội ngũ phát triển cần bổ sung module WebSocket STOMP (ví dụ kênh `/topic/room/{roomId}`) ở Phase 2.

### 4.2 Khảo sát Hợp đồng cho các API Xác thực (Authentication Contracts)

Toàn bộ quy trình xác thực và quản lý phiên đã sẵn sàng phục vụ Frontend với các hợp đồng chi tiết sau:

```
[Frontend UI]                                              [Backend API]
      │                                                          │
      ├─────── 1. POST /api/auth/login (username, password) ────►│
      │◄────── Response: { token: JWT_ACCESS, refreshToken } ────┤
      │                                                          │
      ├─────── 2. GET /api/users/myInfo (Header: Bearer token) ─►│
      │◄────── Response: { username, email, roles, zones } ──────┤
      │                                                          │
      ├─────── 3. [Access Token Hết hạn (1h)] ───────────────────┤
      ├─────── 4. POST /api/auth/refresh (token: refreshToken) ──►│
      │◄────── Response: { token: NEW_ACCESS, NEW_REFRESH } ─────┤ (Old refresh token blacklisted)
      │                                                          │
      └─────── 5. POST /api/auth/logout (token: accessToken) ───►│
       ◄────── Response: { code: 1000 } ─────────────────────────┘ (Token added to Mongo TTL Blacklist)
```

1. **Đăng nhập (Login)**:
   - Endpoint: `POST /api/auth/login` [XÁC NHẬN: `AuthenticationController.java:29`]
   - Request Body: `{"username": "admin", "password": "***"}`
   - Response: `ApiResponse<AuthenticationResponse>` chứa `token` (Access Token, thời hạn mặc định 1 giờ) và `refreshToken` (thời hạn mặc định 24 giờ) [XÁC NHẬN: `application.yaml:25-26`].
   - Đặc điểm JWT: Ký thuật toán HMAC-SHA256, claim `scope` chứa danh sách Authorities/Roles của user phân cách bằng dấu cách (ví dụ `"ADMIN"` hoặc `"LIBRARIAN USER"`), claim `tokenType: "ACCESS"`, claim `sub: username`.
2. **Cấp mới Token theo cơ chế xoay vòng (Refresh Token Rotation - RTR)**:
   - Endpoint: `POST /api/auth/refresh` [XÁC NHẬN: `AuthenticationController.java:51`]
   - Request Body: `{"token": "<refreshToken>"}`
   - Ràng buộc an toàn: Backend kiểm tra chặt chẽ claim `tokenType == "REFRESH"`. Nếu gửi nhầm Access Token vào đây, hệ thống từ chối ngay lập tức với mã `1006 UNAUTHENTICATED` [XÁC NHẬN: `AuthenticationService.java:93-97`].
   - Thu hồi Refresh Token cũ: Refresh token vừa dùng sẽ được đưa ngay vào collection `invalidated_tokens` trong MongoDB với TTL Index tự động xóa sau khi hết hạn, đồng thời trả về một cặp `token` mới và `refreshToken` mới tinh [XÁC NHẬN: `AuthenticationService.java:99, 149-158`].
3. **Đăng xuất (Logout)**:
   - Endpoint: `POST /api/auth/logout` [XÁC NHẬN: `AuthenticationController.java:44`]
   - Request Body: `{"token": "<accessToken_or_refreshToken>"}`
   - Backend phân tích `jwtId` và thời gian hết hạn `expiryTime`, lưu vào MongoDB `invalidated_tokens` để vô hiệu hóa token ngay lập tức trước khi nó tự hết hạn [XÁC NHẬN: `AuthenticationService.java:81-88`].
4. **Lấy Thông tin Người dùng Đang Đăng nhập (User Profile)**:
   - Endpoint: `GET /api/users/myInfo` [XÁC NHẬN: `UserController.java:51`]
   - Header: `Authorization: Bearer <accessToken>`
   - Response: `ApiResponse<UserResponse>` gồm: `id`, `username`, `phone`, `email`, `active`, `roles` (`Set<RoleResponse>` gồm `name`, `description`, `permissions`), và `assignedZones` (`Set<String>`).
   - Phục vụ UI: Cho phép Frontend phân quyền giao diện (hiển thị/ẩn menu theo Role) và giới hạn khu vực quản trị theo `assignedZones`.

### 4.3 Hợp đồng API cho Luồng Cảnh báo (Alerting Flow)

Đây là **khoảng trống lớn nhất của hệ thống** đối với giai đoạn phát triển Frontend:

1. **Hiện trạng Tồn tại Mã nguồn liên quan đến Alert**:
   - Có Entity MongoDB: `document/Alert.java` (đầy đủ các trường: `id`, `deviceId`, `hardwareId`, `roomId`, `type`, `status`, `currentValue`, `threshold`, `message`, `startedAt`, `acknowledgedAt`, `resolvedAt`, `acknowledgedBy`) [XÁC NHẬN: line 20-51].
   - Có Repository: `repository/AlertRepository.java` (định nghĩa các method: `findByDeviceIdAndStatus`, `findByRoomIdAndStatus`, `findByStatus`, `findByRoomIdOrderByStartedAtDesc`, `findTopByDeviceIdAndTypeAndStatusOrderByStartedAtDesc`) [XÁC NHẬN: line 13-24].
   - Có Enums: `enums/AlertType.java` (ACOUSTIC_HIGH, CO2_HIGH, PM25_HIGH, TEMP_HIGH, TEMP_LOW, HUMIDITY_HIGH, DEVICE_OFFLINE), `enums/AlertStatus.java` (TRIGGERED, ACKNOWLEDGED, RESOLVED) [XÁC NHẬN].
   - Có Mã lỗi: `ErrorCode.ALERT_NOT_EXISTED(6001, "Alert does not exist", HttpStatus.NOT_FOUND)` [XÁC NHẬN: `ErrorCode.java:49`].
   - Có Quyền trong hệ thống: `ApplicationInitConfig.java` khởi tạo 3 quyền: `VIEW_ALERTS`, `ACKNOWLEDGE_ALERT`, `MANAGE_ALERT_CONFIG` [XÁC NHẬN: line 38-40].
2. **Các Thành phần Bị Khuyết Thiếu Hoàn Toàn (Missing 100%)**:
   - **Không có `AlertService.java`**: Chưa có bất kỳ class service nào để quản lý vòng đời cảnh báo [XÁC NHẬN: không tìm thấy file trong `service/`].
   - **Không có `AlertController.java`**: Hoàn toàn không có REST Controller để Frontend gọi lấy danh sách cảnh báo hoặc xác nhận cảnh báo [XÁC NHẬN: không tìm thấy file trong `controller/`].
   - **Không có Logic Phát Hiện Cảnh Báo (Alert Detection Engine)**: Trong toàn bộ pipeline nhận tin MQTT (`MqttMessageDispatcherService.java`), khi dữ liệu telemetry đến, hệ thống chỉ tính điểm Comfort Score và lưu vào `telemetry`, **tuyệt đối không có đoạn code nào so sánh ngưỡng (threshold) để tạo mới bản ghi vào collection `alerts`** [XÁC NHẬN: `AlertRepository` không được inject hay gọi trong bất kỳ class nào của `src/main/java`].
3. **Đánh giá Tính sẵn sàng cho Màn hình "Lịch sử Cảnh báo / Chuông Thông báo" trên UI**:
   - **0% Sẵn sàng**. Đội ngũ Frontend hiện tại **hoàn toàn không có API** để hiển thị danh sách cảnh báo, đếm số lượng cảnh báo chưa đọc, hay thực hiện nút bấm "Xác nhận cảnh báo" (Acknowledge Alert). Cần xây dựng mới toàn bộ phân hệ này ở Phase 2.

### 4.4 Endpoint Truy vấn Chuỗi Thời gian (TimeSeries) & Vẽ Biểu đồ Dashboard

1. **Các Endpoint Hiện có**:
   - `GET /api/v1/telemetry/device/{deviceId}?start={ISO}&end={ISO}` [XÁC NHẬN: `TelemetryController.java:40`]
   - `GET /api/v1/telemetry/room/{roomId}?start={ISO}&end={ISO}` [XÁC NHẬN: `TelemetryController.java:50`]
2. **Cấu trúc Dữ liệu Phục vụ Biểu đồ**:
   Mỗi phần tử trong danh sách trả về là một `TelemetryResponse` gồm [XÁC NHẬN: `dto/response/TelemetryResponse.java:14-24`]:
   - `timestamp`: Thời điểm đo dạng ISO-8601 UTC (ví dụ `2026-10-21T15:30:00Z`).
   - `acoustics`: `noiseAvg`, `noisePeak`.
   - `airQuality`: `co2`, `tvoc`, `pm25`, `pm10`, `aqi`.
   - `environment`: `temperature`, `humidity`, `lightIntensity`, `pressure`.
   - `comfortScore`: `overall` (điểm 0-100), `grade` ("A", "B", "C", "D", "F"), `acousticScore`, `airScore`, `thermalScore`, `lightScore`.
   - `wifiRssi`: Cường độ sóng Wi-Fi của thiết bị.
3. **Phân tích Rủi ro & Hạn chế Nghiêm trọng khi Tích hợp Biểu đồ**:
   - **Thiếu Hoàn Toàn Cơ Chế Gom Cụm / Hạ Mẫu (Downsampling / Aggregation)**:
     Backend hiện tại chỉ thực hiện query thô (`findByMetadataRoomIdAndTimestampBetweenOrderByTimestampDesc`) lấy toàn bộ bản ghi gốc từ collection TimeSeries [XÁC NHẬN: `TelemetryService.java:66`]. Không có các phép tính trung bình theo khoảng thời gian (như trung bình mỗi 5 phút, 15 phút, 1 giờ).
   - **Rủi ro Tràn Bộ Nhớ & Lag Giao diện**: Nếu người dùng trên Dashboard chọn xem biểu đồ "7 ngày qua" hoặc "30 ngày qua", trình duyệt sẽ nhận hàng chục nghìn điểm dữ liệu, dẫn đến treo thư viện vẽ biểu đồ (Chart.js / ECharts / Recharts) [SUY LUẬN].
   - **Thiếu Endpoint Tổng hợp Dashboard Cấp cao**:
     Chưa có các endpoint chuyên dụng phục vụ các Widget thống kê nhanh trên Dashboard như:
     + Thống kê phân bố điểm tiện nghi các phòng trên toàn thư viện (Room Comfort Distribution).
     + Tỷ lệ thiết bị Online / Offline toàn hệ thống.
     + Nhiệt độ / Độ ồn trung bình hiện tại theo từng tầng (Floor summary).

---

## 5. CÂU HỎI MỞ (OPEN QUESTIONS)

Dưới đây là các câu hỏi mở và quyết định kỹ thuật cần được Lead Architect và các bên liên quan (Product Owner, Frontend Team) thống nhất trước khi bước vào Phase 2:

1. **Phân hệ Cảnh báo (Alerting Module)**:
   - Việc thiếu vắng hoàn toàn `AlertService`, `AlertController` và engine kiểm tra ngưỡng trong luồng MQTT là do tính năng bị bỏ dở hay nằm trong kế hoạch phát triển của Phase sau?
   - Cấu hình ngưỡng cảnh báo (Thresholds) cho từng chỉ số (Nhiệt độ > 30°C, CO2 > 1000ppm, Độ ồn > 70dB) sẽ được lưu cố định trong cấu hình YAML, hay lưu động trong MongoDB cho phép Admin chỉnh sửa trên giao diện?
2. **Kênh Đẩy Dữ liệu Realtime (Push Channel)**:
   - Thư viện `spring-boot-starter-websocket` đã có sẵn trong `pom.xml`. Đội ngũ dự án có kế hoạch kích hoạt STOMP Broker qua SockJS (`/ws`) để đẩy chỉ số cảm biến và cảnh báo tức thời ra Frontend hay không, hay sẽ tạm thời chấp nhận phương án REST Polling ở giai đoạn đầu của MVP?
3. **Cơ chế Tổng hợp Dữ liệu TimeSeries (Aggregation & Downsampling)**:
   - Nhằm phục vụ vẽ biểu đồ 24h / 7d mượt mà cho Frontend, backend có cần bổ sung endpoint tổng hợp dữ liệu theo chu kỳ (ví dụ: `GET /api/v1/telemetry/room/{id}/aggregate?interval=15m`) sử dụng MongoDB Aggregation Pipeline (`$dateTrunc`, `$group`, `$avg`) thay vì chỉ trả về dữ liệu thô như hiện tại?
4. **Chuẩn hóa API Versioning**:
   - Đội ngũ phát triển có đồng thuận việc đưa toàn bộ các endpoint IAM (`/api/auth`, `/api/users`, `/api/roles`, `/api/permissions`) về chuẩn `/api/v1/...` để đồng bộ hoàn toàn với các endpoint IoT (`/api/v1/devices`, `/api/v1/rooms`, `/api/v1/telemetry`) hay không?
5. **Mở rộng Cơ chế Phân trang (Pagination Standardization)**:
   - Có nên áp dụng `PageResponse<T>` đồng loạt cho các endpoint danh sách thiết bị (`GET /api/v1/devices`) và danh sách phòng (`GET /api/v1/rooms`) thay vì trả về `List<T>` toàn bộ bản ghi như hiện nay?
6. **Tích hợp Tự động Tài liệu OpenAPI / Swagger**:
   - Có nên bổ sung `springdoc-openapi-starter-webmvc-ui` vào `pom.xml` để tự động sinh Swagger UI tương tác tại `/swagger-ui.html` phục vụ việc debug và tích hợp nhanh cho đội ngũ Frontend, hay tiếp tục duy trì Postman Collection thủ công?
7. **Chiến lược Nâng cấp Kiểm thử Tự động (Testing Strategy)**:
   - Với hiện trạng 100% test case là Unit Test có mock, đội ngũ có kế hoạch bổ sung bộ Slice Test (`@WebMvcTest`) cho 5 Controller còn trống và bộ Integration Test (`@SpringBootTest` với Testcontainers MongoDB/Mosquitto) ở giai đoạn tới để bảo vệ tính toàn vẹn của hợp đồng API hay không?
