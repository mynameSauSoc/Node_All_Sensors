# BÁO CÁO TỔNG HỢP KỸ THUẬT PHASE 1: HỆ THỐNG AIoTLibTQB
> **Đơn vị thực hiện**: Lead Agent / Worker R5 Synthesis | **Mã tài liệu**: `PHASE1-SUMMARY-05`  
> **Thời điểm**: 2026-10-21 | **Nguyên tắc**: Dữ liệu thực chứng 100%, bảo mật credentials (che ***)  
> **Quy ước nhãn chứng cứ**: `[XÁC NHẬN]` (mã nguồn/hạ tầng thực tế) | `[SUY LUẬN]` (phân tích logic) | `[CHƯA RÕ]` (thiếu dữ liệu)

## 1. Tổng quan Dự án (Project Overview)
AIoTLibTQB (tiền thân Listen_Project) là hệ sinh thái IoT chuyên dụng nhằm giám sát vi khí hậu và âm học trong không gian thư viện thông minh và phòng học học thuật `[XÁC NHẬN: IOT_SYSTEM_SPECIFICATION.md:8]`. Hệ thống tự động thu thập chuỗi thời gian vật lý từ các trạm vi điều khiển ESP32-S3 qua giao thức MQTT để đánh giá chỉ số tiện nghi không gian học tập (Library Comfort Score - LCS).
- **Mục tiêu & Phạm vi**: Đo đạc 9 chỉ số môi trường (nhiệt độ, độ ẩm, ánh sáng, bụi mịn PM1.0, PM2.5, PM4.0, PM10, độ ồn trung bình, xung âm đỉnh); cảnh báo bất thường; trực quan hóa bản đồ nhiệt floorplan.
- **Backend Core**: Spring Boot 3.5.8 vận hành trên nền Java 21 LTS `[XÁC NHẬN: pom.xml:8-22]`.
- **Đa luồng Bất đồng bộ**: Java 21 Virtual Threads (`Executors.newVirtualThreadPerTaskExecutor()`) trên kênh Spring Integration MQTT Inbound `[XÁC NHẬN: MqttConfig.java:42-44]`.
- **Cơ sở Dữ liệu TimeSeries**: MongoDB 8.0 với Native TimeSeries Collection (`telemetry_records`, timeField: `timestamp`, metaField: `metadata`, granularity: `SECONDS`, TTL 90 ngày) `[XÁC NHẬN: docker-compose.yml:5, TelemetryRecord.java:16-38]`.
- **Message Broker Ngoại vi**: Eclipse Mosquitto 2.0 (TCP 1883, mật khẩu SHA512-PBKDF2, ACL phân quyền theo trạm `%u`, cấm nặc danh `allow_anonymous false`) `[XÁC NHẬN: docker-compose.yml:45, mosquitto/config/mosquitto.conf:14]`.
- **Bảo mật & Điều tiết Tải**: JWT HMAC-SHA512 (Nimbus JOSE), Token Blacklisting (MongoDB TTL), Rate Limiting Bucket4j kết hợp bộ đệm Caffeine Cache `[XÁC NHẬN: CustomJwtDecoder.java:23, RateLimitFilter.java:29-51]`.

## 2. Danh mục Các Nhóm Chức Năng Chính (Functional Groups Catalog)
1. **IAM & RBAC (Quản lý Định danh & Phân quyền)**:
   - Cơ chế xác thực: Stateless JWT (Access Token 1h, Refresh Token 24h với Refresh Token Rotation - RTR) `[XÁC NHẬN: AuthenticationService.java:63-162]`.
   - Cơ chế an ninh: Thu hồi token tức thời qua blacklist MongoDB TTL; băm mật khẩu BCrypt độ mạnh 10; Rate limiting 10 req/phút tại login/device auth `[XÁC NHẬN: SecurityConfig.java:63-101]`.
   - Kiểm soát truy cập: Phân quyền theo 14 Quyền nguyên tử, 7 Vai trò hệ thống; kiểm soát phân vùng quản lý `user.assignedZones` `[XÁC NHẬN: ApplicationInitConfig.java:42-177]`.
2. **Space & Room Management (Quản lý Không gian & Phòng đọc)**:
   - Quản trị phòng đọc: CRUD thông tin phòng; kiểm soát mã phòng duy nhất (`code`), tầng (`floor`), sức chứa, phân loại phòng (`RoomType`) `[XÁC NHẬN: RoomController.java:24-66]`.
   - Dữ liệu hình học: Lưu trữ danh sách tọa độ đỉnh đa giác ranh giới tường (`boundaryPolygon: List<Point2D>`) phục vụ canvas clipping `[XÁC NHẬN: Room.java:15-50]`.
3. **Device Management & Discovery (Quản lý Thiết bị & Dò tìm Tự động)**:
   - Vòng đời thiết bị IoT: Đăng ký cấp `rawApiKey` 32-hex một lần duy nhất (lưu băm BCrypt); xác thực thiết bị cấp Device JWT 8h `[XÁC NHẬN: DeviceService.java:46-85]`.
   - Dò tìm tự động (Discovery): Đưa các hardwareId chưa đăng ký vào hàng đợi bộ nhớ RAM tạm thời với TTL 10 phút `[XÁC NHẬN: DiscoveredDeviceService.java:25-57]`.
   - Giám sát sống còn: Nhận heartbeat, cập nhật `lastSeenAt`, tính toán động trạng thái online/offline theo ngưỡng 5 phút `[XÁC NHẬN: DeviceService.java:231-234]`.
4. **MQTT Ingestion & TimeSeries (Tiếp nhận Dữ liệu & Chuỗi Thời gian)**:
   - Pipeline Ingestion: Spring Integration QoS 1; cơ chế chống giả mạo danh tính hardwareId giữa topic và payload `[XÁC NHẬN: MqttMessageDispatcherService.java:101-106]`.
   - Chuẩn hóa thời gian: Hỗ trợ epoch 10/13 digits, bảo toàn timestamp lịch sử store-and-forward, kẹp trôi dạt tương lai `[XÁC NHẬN: MqttMessageDispatcherService.java:216-241]`.
   - Làm sạch số liệu: Lọc ngưỡng vật lý, bù lấp Forward-Fill 30s loại trừ xung đỉnh `noisePeak`, hủy bản ghi rỗng `[XÁC NHẬN: TelemetrySanitizerService.java:20-179]`.
   - Giảm tải ghi CSDL: Bóp tần suất cập nhật `lastSeenAt` bằng Caffeine Cache cửa sổ 30 giây `[XÁC NHẬN: MqttMessageDispatcherService.java:166-175]`.
5. **Comfort Score Engine (Động cơ Điểm Tiện Nghi Môi trường LCS)**:
   - Thuật toán LCS: Chuẩn hóa thang điểm $[0, 100]$ theo 3 cấu hình phòng (`STUDY_ROOM`, `BOOK_STORAGE`, `CIRCULATION_HALL`) `[XÁC NHẬN: ComfortScoreService.java:69-230]`.
   - Nguyên lý Liebig Bottleneck: Giới hạn phi tuyến tính khi có chỉ số suy thoái nghiêm trọng; tự động tái phân bổ trọng số khi thiếu cảm biến `[XÁC NHẬN: ComfortScoreService.java:140-145]`.
   - Phân hạng tiện nghi: Đánh giá 5 mức Platinum, Gold, Silver, Bronze, Poor; tích hợp tính toán và lưu trực tiếp kèm telemetry `[XÁC NHẬN: MqttMessageDispatcherService.java:191]`.
6. **Alerting & Observability (Cảnh báo & Giám sát Vận hành)**:
   - Hạ tầng thực thể: Đã khai báo Document `Alert`, `AlertRepository`, Enums (`AlertType`, `AlertStatus`) và mã lỗi `[XÁC NHẬN: Alert.java:14-52, AlertRepository.java:13-25]`.
   - Giám sát vận hành: Mở các Spring Boot Actuator endpoints (`/actuator/health`, `/info`, `/metrics`) có phân quyền `[XÁC NHẬN: SecurityConfig.java:57]`.

## 3. Ma trận Mức độ Hoàn thiện Hệ thống (System Maturity Matrix)
| Phân hệ / Cụm chức năng | Trạng thái Hiện tại | File Minh chứng Mã nguồn | Điểm nghẽn / Khuyết thiếu Chính |
| :--- | :---: | :--- | :--- |
| **IAM & Bảo mật RBAC** | **Production-Ready** | `AuthenticationController.java:29-57`, `RateLimitFilter.java:29-115` `[XÁC NHẬN]` | Thiếu validation `@Valid` trên một số Request DTO (`AuthenticationRequest.java:12-14` `[XÁC NHẬN]`). |
| **Quản lý Không gian & Phòng** | **Production-Ready** | `RoomController.java:24-66`, `RoomService.java:29-112` `[XÁC NHẬN]` | Chưa kiểm tra ràng buộc toàn vẹn thiết bị khi xóa phòng (`RoomService.java:105-112` `[XÁC NHẬN]`). |
| **Quản lý Thiết bị & Discovery** | **Production-Ready** | `DeviceController.java:30-110`, `DeviceService.java:46-174` `[XÁC NHẬN]` | Discovery cache dùng `ConcurrentHashMap` vô hạn kích thước (`DiscoveredDeviceService.java:25` `[XÁC NHẬN]`). |
| **MQTT Ingestion & TimeSeries** | **Production-Ready** | `MqttConfig.java:42-60`, `MqttMessageDispatcherService.java:59-241` `[XÁC NHẬN]` | Virtual Threads không giới hạn; chưa cache tra cứu metadata thiết bị (`MqttConfig.java:43` `[XÁC NHẬN]`). |
| **Comfort Score Engine** | **Production-Ready** | `ComfortScoreService.java:1-450`, `ComfortScoreRecord.java:1-35` `[XÁC NHẬN]` | Hoạt động hoàn chỉnh, đạt 100% qua 13 unit tests (`ComfortScoreServiceTest.java` `[XÁC NHẬN]`). |
| **Phân hệ Cảnh báo (Alerts)** | **Stub / Dang dở** | `Alert.java:14-52`, `AlertRepository.java:13-25` `[XÁC NHẬN]` | **Thiếu AlertService, AlertController**, và rule so ngưỡng trong pipeline MQTT `[XÁC NHẬN]`. |
| **Truyền tin Realtime (Web)** | **Chưa có (Dead Dep)** | `pom.xml:108-111` `[XÁC NHẬN]` | Khai báo `spring-boot-starter-websocket` nhưng không có code cấu hình; thiếu SSE `[XÁC NHẬN]`. |
| **Thống kê & Tổng hợp (Analytics)**| **Chưa có** | `TelemetryController.java:39-57` `[XÁC NHẬN]` | Chỉ có API query thô, hoàn toàn thiếu Aggregation Pipeline theo giờ/ngày/tuần `[XÁC NHẬN]`. |

## 4. Các Rủi ro Kỹ thuật Trọng yếu (Top 5 Key Technical Risks)
1. **Phân hệ Cảnh báo Mồ côi (Orphaned Alert Subsystem)**:
   - *Bằng chứng*: Đã có Document `Alert`, `AlertRepository` và quyền RBAC, nhưng hoàn toàn thiếu `AlertService`, `AlertController` và logic kiểm tra ngưỡng trong luồng MQTT Ingestion `[XÁC NHẬN: AlertRepository.java:13, MqttMessageDispatcherService.java:141-214]`.
   - *Rủi ro*: Màn hình chuông thông báo và lịch sử sự cố trên UI không có API để hoạt động; không phát hiện được vi phạm ngưỡng môi trường `[SUY LUẬN]`.
2. **Thiếu Cơ chế Đẩy Dữ liệu Realtime (Dead WebSocket Dependency)**:
   - *Bằng chứng*: `spring-boot-starter-websocket` trong `pom.xml:108-111` là dead dependency (không có `@EnableWebSocketMessageBroker` hay STOMP handler); không có SSE `[XÁC NHẬN: pom.xml:108-111, 01_code.md:494-498]`.
   - *Rủi ro*: Frontend bắt buộc phải dùng REST Polling định kỳ, gây trễ hiển thị và tạo tải truy vấn lặp lại không cần thiết lên CSDL `[SUY LUẬN]`.
3. **Nguy cơ OOM & Treo Trình duyệt khi Query TimeSeries Thô**:
   - *Bằng chứng*: `GET /api/v1/telemetry/device/{id}` và `.../room/{id}` trả về danh sách thô `List<TelemetryResponse>` không phân trang `[XÁC NHẬN: TelemetryController.java:39-57]`.
   - *Rủi ro*: Truy vấn dải thời gian rộng (7 ngày = >60,000 bản ghi) sẽ tải toàn bộ vào RAM, đe dọa OOM heap JVM và làm đơ thư viện biểu đồ client `[SUY LUẬN]`.
4. **Bất nhất Phân trang, Phân phiên bản API & Lỗ hổng Validation**:
   - *Bằng chứng*: Duy nhất `GET /api/users` có phân trang `PageResponse`; `devices`, `rooms`, `telemetry` đều unpaginated `[XÁC NHẬN: UserController.java:35, DeviceController.java:70]`. Tiền tố URI bị phân mảnh giữa `/api/...` (IAM) và `/api/v1/...` (IoT) `[XÁC NHẬN: 04_contract.md:257-268]`. DTO đăng nhập thiếu validation `@Valid` `[XÁC NHẬN: AuthenticationRequest.java:12-14]`.
   - *Rủi ro*: Frontend khó cấu hình baseURL chuẩn; rủi ro payload rỗng lọt vào Service; tải danh sách lớn chậm chạp `[SUY LUẬN]`.
5. **Khoảng trống Kiểm thử Tầng Controller & Tích hợp**:
   - *Bằng chứng*: 100% test case (19/19 files, 124 tests) là Unit Test mock dependencies `[XÁC NHẬN: 04_contract.md:12-19]`. Có **0% Slice Test** (`@WebMvcTest`), **0% Integration Test** (`@SpringBootTest`, Testcontainers), và 5/7 Controllers không hề có bài test nào bảo vệ hợp đồng HTTP.
   - *Rủi ro*: Các lỗi phân tích cú pháp JSON, sai lệch mã HTTP, hoặc trôi dạt cú pháp query MongoDB thực tế sẽ không bị phát hiện bởi CI/CD `[SUY LUẬN]`.

## 5. Bảng Dữ liệu Giao diện Có thể Lấy ngay / Còn thiếu API (UI Data Readiness Table)
| Màn hình UI Dự kiến | Thành phần Giao diện | API Đã Sẵn Sàng (Endpoint URL & Dữ liệu Cung cấp) | Cần Bổ Sung / Chưa Có API |
| :--- | :--- | :--- | :--- |
| **1. Dashboard Tổng quan** | Chỉ số vi khí hậu & LCS | `GET /api/v1/telemetry/room/{roomId}/latest` (Chỉ số mới nhất: noise, pm, temp, hum, lux, LCS) `[XÁC NHẬN: TelemetryController:32]` | Kênh WebSocket STOMP / SSE đẩy dữ liệu tự động thay cho REST Polling. |
| | Danh mục phòng đọc | `GET /api/v1/rooms` (Danh sách phòng, tầng, sức chứa, targetComfortScore) `[XÁC NHẬN: RoomController:31]` | API tổng hợp toàn thư viện (tỷ lệ trạm Online/Offline, LCS trung bình toàn tòa nhà). |
| | Tình trạng hạ tầng | `GET /actuator/health` (Trạng thái máy chủ & kết nối CSDL MongoDB) `[XÁC NHẬN: SecurityConfig:57]` | Widget thống kê tổng số sensor hoạt động, cảnh báo đang kích hoạt. |
| **2. Bản đồ Không gian Thư viện** | Mặt bằng tầng & Đa giác | `GET /api/v1/rooms?floor={floor}` (Tọa độ đỉnh đa giác tường `boundaryPolygon`) `[XÁC NHẬN: RoomController:31]` | API CRUD Zone độc lập (chưa có Entity/Controller quản lý Zone). |
| | Vị trí trạm đo trên map | `GET /api/v1/devices` (Tọa độ phẳng `posX`, `posY`, trạng thái `online`, `lastSeenAt`) `[XÁC NHẬN: DeviceController:69]` | Kênh Stream dữ liệu 1Hz phục vụ render bản đồ nhiệt canvas mượt mà, chống DOM thrashing. |
| | Bản đồ nhiệt (Heatmap) | `GET /api/v1/telemetry/room/{roomId}/latest` (Giá trị nhiệt độ, ồn, bụi để nội suy nhiệt) `[XÁC NHẬN: TelemetryController:32]` | Endpoint nội suy đa điểm theo phòng phục vụ vẽ Heatmap liên tục. |
| **3. Chi tiết Thiết bị & Cảm biến** | Danh sách & Chi tiết trạm | `GET /api/v1/devices/{id}` (Thông số trạm, firmware, vị trí) `[XÁC NHẬN: DeviceController:76]` | Phân trang `PageResponse<DeviceResponse>` cho `GET /api/v1/devices`. |
| | Quản trị trạm IoT | `POST /api/v1/devices/register`, `PUT .../{id}`, `PATCH .../status`, `POST .../regenerate-key` `[XÁC NHẬN: DeviceController:38-97]` | Bộ lọc thiết bị theo trạng thái kết nối (Online/Offline) hoặc theo Phòng/Khu vực. |
| | Phát hiện trạm mới lạ | `GET /api/v1/devices/discovered` (Danh sách trạm mới phát hiện qua MQTT) `[XÁC NHẬN: DeviceController:30]` | Thao tác phê duyệt nhanh 1-click gán phòng từ hàng đợi discovery. |
| | Chuỗi số liệu mới nhất | `GET /api/v1/telemetry/device/{deviceId}/latest` (Bộ đo lường vi khí hậu chi tiết) `[XÁC NHẬN: TelemetryController:25]` | Lịch sử thay đổi trạng thái kết nối (Connection state history). |
| **4. Lịch sử Cảnh báo & Chuông Thông báo** | Danh sách cảnh báo sự cố | **HOÀN TOÀN CHƯA CÓ API NÀO KHẢ DỤNG (0% Sẵn sàng)** `[XÁC NHẬN: 01_code.md:485, 04_contract.md:342-348]` | `GET /api/v1/alerts`: Truy vấn danh sách cảnh báo (phân trang, lọc theo phòng, loại sự cố, trạng thái). |
| | Chuông thông báo header | **HOÀN TOÀN CHƯA CÓ API NÀO KHẢ DỤNG (0% Sẵn sàng)** `[XÁC NHẬN: 01_code.md:485, 04_contract.md:342-348]` | `GET /api/v1/alerts/unread-count`: Đếm cảnh báo chưa đọc cho chuông icon. |
| | Thao tác xử lý sự cố | **HOÀN TOÀN CHƯA CÓ API NÀO KHẢ DỤNG (0% Sẵn sàng)** `[XÁC NHẬN: 01_code.md:485, 04_contract.md:342-348]` | `POST /api/v1/alerts/{id}/acknowledge`: Xác nhận xử lý sự cố môi trường. |
| **5. Báo cáo Tiện nghi & Xu hướng** | Biểu đồ lịch sử đo ngắn hạn | `GET /api/v1/telemetry/device/{id}?start=...&end=...` (Dữ liệu thô dải 1h) `[XÁC NHẬN: TelemetryController:39]` | API Aggregation chuỗi thời gian nén theo mốc 15m/1h/1d (`$avg`, `$min`, `$max` nhiệt ẩm, ồn, bụi, LCS). |
| | Biểu đồ xu hướng phòng | `GET /api/v1/telemetry/room/{id}?start=...&end=...` (Dữ liệu thô dải 1h) `[XÁC NHẬN: TelemetryController:49]` | API tính toán chỉ số nguy cơ nấm mốc VTT Mould Index (`VIEW_ANALYTICS`). |
| | Xuất báo cáo định kỳ | Chưa có Controller / Service hỗ trợ xuất file `[XÁC NHẬN: 01_code.md:488]` | API xuất báo cáo PDF/CSV chuẩn TCVN 8681 (`GENERATE_REPORT`). |

## 6. Câu hỏi Mở (Open Questions)
1. **Triển khai Phân hệ Cảnh báo (Alert Subsystem)**:
   - *Căn cứ*: `Alert` và `AlertRepository` đã tồn tại nhưng thiếu `AlertService`/`AlertController` và rule so ngưỡng trong pipeline MQTT `[XÁC NHẬN: AlertRepository.java:13, MqttMessageDispatcherService.java:141-214]`.
   - *Câu hỏi*: Kế hoạch xây dựng phân hệ này ở Phase 2 như thế nào? Ngưỡng cảnh báo sẽ lưu động theo phòng trong MongoDB hay cấu hình cố định trong mã nguồn? `[CHƯA RÕ: 01_code.md:610-616]`.
2. **Chiến lược Realtime Push cho Frontend Dashboard**:
   - *Căn cứ*: Backend chỉ có MQTT Inbound, `spring-boot-starter-websocket` là dead dependency, thiếu SSE `[XÁC NHẬN: pom.xml:108-111, 01_code.md:494-498]`.
   - *Câu hỏi*: Phase 2 sẽ chấp nhận giải pháp tạm thời REST Polling (10s-30s), hay yêu cầu Backend hoàn thiện WebSocket STOMP (`/ws-aiot`) hoặc Server-Sent Events (SSE)? `[CHƯA RÕ: 04_contract.md:381-382]`.
3. **Xây dựng Aggregation Pipeline cho Biểu đồ Xu hướng**:
   - *Căn cứ*: Controller hiện chỉ trả về danh sách TimeSeries thô không nén, có nguy cơ gây OOM khi xem dải ngày/tuần `[XÁC NHẬN: TelemetryController.java:39-57]`.
   - *Câu hỏi*: Backend có cần bổ sung ngay các endpoint hạ mẫu TimeSeries (Downsampling `$dateTrunc`, `$avg`, `$min`, `$max`) trước khi bàn giao cho đội UI không? `[CHƯA RÕ: 04_contract.md:383-384]`.
4. **Chuẩn hóa API Versioning & Mở rộng Phân trang**:
   - *Căn cứ*: Tiền tố URI bị xé lẻ giữa `/api/...` (IAM) và `/api/v1/...` (IoT); chỉ có `GET /api/users` hỗ trợ phân trang `[XÁC NHẬN: 04_contract.md:219-228, 257-268]`.
   - *Câu hỏi*: Đội ngũ có đồng thuận chuyển toàn bộ endpoint sang `/api/v1/...` và chuẩn hóa phân trang `PageResponse<T>` cho Device, Room, Alert không? `[CHƯA RÕ: 04_contract.md:385-388]`.
5. **Giới hạn Luồng Ingestion & Cache Metadata Thiết bị**:
   - *Căn cứ*: MQTT Inbound dùng Virtual Threads không giới hạn, và `deviceRepository.findByHardwareId` bị gọi lặp trên mọi bản tin `[XÁC NHẬN: MqttConfig.java:43, MqttMessageDispatcherService.java:153]`.
   - *Câu hỏi*: Có cần cấu hình Bounded Pool/Semaphore và bổ sung Caffeine Cache cho tra cứu `Device` để chống cạn kiệt MongoDB Connection Pool khi bão dữ liệu? `[SUY LUẬN: 03_docs.md:232-240]`.
6. **Tiến trình Quét Thiết bị Ngoại tuyến (Watchdog Job)**:
   - *Căn cứ*: Chưa có Scheduled Job tự động quét offline; trạng thái trạm chỉ tính động lúc gọi API `[XÁC NHẬN: DeviceService.java:231-234]`.
   - *Câu hỏi*: Có cần thiết lập Background Watchdog Job (chu kỳ 10-15s) để tự động cập nhật cờ `connectionState = OFFLINE` vào CSDL cho trạm mất sóng? `[CHƯA RÕ: 03_docs.md:242-246]`.

---
*Báo cáo được hoàn thành bởi Worker R5 (Executive Summary Synthesizer) — Tuân thủ nguyên tắc Read-only, Bảo mật thông tin tuyệt đối (che ***), và gắn nhãn minh chứng [XÁC NHẬN] / [SUY LUẬN] / [CHƯA RÕ] trên 100% các nhận định kỹ thuật.*
