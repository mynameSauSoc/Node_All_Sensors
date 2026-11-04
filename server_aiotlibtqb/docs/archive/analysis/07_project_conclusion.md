# KẾT LUẬN TOÀN DIỆN DỰ ÁN AIoTLibTQB (PROJECT ARCHITECTURAL CONCLUSION)
> **Mã tài liệu**: `PHASE3-CONCLUSION-07` | **Hệ thống phân tích**: AIoTLibTQB (Smart Library IoT System)  
> **Thời điểm hoàn thiện**: 2026-10-21 | **Phiên bản tài liệu**: 1.0 Final  
> **Nguyên tắc thực hiện**: Dữ liệu thực chứng 100%, bảo mật credentials (che ***), chỉ đọc mã nguồn không sửa đổi  
> **Quy ước nhãn chứng cứ**: `[XÁC NHẬN]` (mã nguồn/hạ tầng thực tế) | `[SUY LUẬN]` (phân tích kỹ thuật) | `[CHƯA RÕ]` (vấn đề mở)

---

## 1. TỔNG QUAN DỰ ÁN, NGƯỜI DÙNG & GIÁ TRỊ CỐT LÕI

### 1.1. Dự án AIoTLibTQB Làm Gì?
**AIoTLibTQB** (tiền thân là *Listen_Project*) là một hệ sinh thái IoT chuyên dụng nhằm giám sát, đánh giá và tối ưu hóa vi khí hậu cùng môi trường âm học trong không gian thư viện đại học và phòng học học thuật `[XÁC NHẬN: IOT_SYSTEM_SPECIFICATION.md:8]`. Hệ thống xây dựng trên nền tảng **Spring Boot 3.5.8** kết hợp **Java 21 LTS** và **MongoDB 8.0 Native TimeSeries**, tự động thu thập chuỗi thời gian 9 chỉ số vật lý (nhiệt độ, độ ẩm, độ rọi ánh sáng, bụi mịn PM1.0, PM2.5, PM4.0, PM10, độ ồn tương đương $L_{\text{eq}}$, và xung âm thanh đỉnh) từ mạng lưới trạm cảm biến vi điều khiển **ESP32-S3** thông qua giao thức **MQTT (Mosquitto 2.0)** `[XÁC NHẬN: pom.xml:8-22, MqttConfig.java:26-61, docker-compose.yml:5-45]`. Dữ liệu sau khi làm sạch vật lý được đưa vào động cơ thuật toán phi tuyến tính theo **Nguyên lý Thùng gỗ Liebig** để chấm điểm chỉ số tiện nghi không gian học tập (**Library Comfort Score - LCS**, thang 0–100) theo từng cấu hình chuyên biệt (phòng đọc, kho bảo quản, sảnh mượn trả), đồng thời trực quan hóa không gian mặt bằng tầng (floorplan 2D canvas) và phát hiện các bất thường môi trường `[XÁC NHẬN: ComfortScoreService.java:69-230, Room.java:30-45]`.

### 1.2. Người Dùng Mục Tiêu & Phân Cấp Vai Trò (Target Users & Roles)
Hệ thống thiết kế cơ chế kiểm soát truy cập dựa trên vai trò (RBAC) với 7 Roles và 14 Quyền nguyên tử được nạp sẵn `[XÁC NHẬN: ApplicationInitConfig.java:42-177]`:
1. **System Administrator (`ADMIN`)**: Kỹ sư vận hành hệ thống CNTT nhà trường; toàn quyền quản lý tài khoản, phân vai trò, gán vùng quản lý, cấu hình hệ thống và xóa phòng/thiết bị `[XÁC NHẬN: UserController.java:34, RoleController.java:24]`.
2. **Thủ Thư / Quản Lý Thư Viện (`LIBRARIAN`)**: Cán bộ nghiệp vụ thư viện; quản lý danh mục phòng đọc, đăng ký thiết bị IoT, giám sát các chỉ số vi khí hậu và tiếp nhận xử lý các sự cố cảnh báo tiện nghi học tập `[XÁC NHẬN: RoomController.java:24, DeviceController.java:38]`.
3. **Quản Lý Khu Vực / Tầng (`ZONE_MANAGER`)**: Cán bộ phụ trách một cụm không gian cụ thể (ví dụ: Tầng 2, Khu vực Kho tài liệu quý); chỉ có quyền truy cập dữ liệu thiết bị và chỉ số phòng thuộc danh sách `user.assignedZones` được giao `[XÁC NHẬN: DeviceService.java:107-118, TelemetryService.java:37-40]`.
4. **Kỹ Thuật Viên Bảo Trì (`MAINTENANCE`)**: Đội ngũ bảo dưỡng phần cứng trạm đo; kiểm tra trạng thái sống còn (online/offline), xem mức sóng WiFi RSSI, tra cứu thông số firmware và thay thế thiết bị hỏng `[XÁC NHẬN: DeviceController.java:76-81]`.
5. **Bạn Đọc / Sinh Viên Có Tài Khoản (`USER`)**: Sinh viên, giảng viên nghiên cứu trong trường; tra cứu điểm tiện nghi LCS, tìm kiếm phòng học có không gian yên tĩnh và chất lượng không khí tối ưu `[XÁC NHẬN: TelemetryController.java:32-37]`.
6. **Người Xem Hạn Chế (`VIEWER`)**: Người dùng vãng lai nội bộ chỉ được cấp quyền xem dữ liệu cảm biến đo lường mà không có quyền cấu hình `[XÁC NHẬN: ApplicationInitConfig.java:166-173]`.
7. **Khách Công Cộng / Kiosk (`PUBLIC_GUEST`)**: *[SUY LUẬN]* Sinh viên vãng lai tra cứu nhanh qua màn hình cảm ứng Kiosk đặt tại cửa thư viện hoặc sảnh tầng (hiện tại backend chưa mở endpoint công khai riêng cho đối tượng này, đang yêu cầu JWT `[XÁC NHẬN: 06_references.md:325-327]`).

### 1.3. Giá Trị Cốt Lõi Của Hệ Thống (Core Value Propositions)
- **Bảo Vệ & Kéo Dài Tuổi Thọ Tài Liệu Quý (Document Preservation)**: Giám sát liên tục nhiệt độ ($18-22^\circ\text{C}$), độ ẩm ($45-55\%$) và độ rọi ($\le 100\text{ Lux}$) trong kho lưu trữ sách theo tiêu chuẩn ISO 11799, ngăn chặn nguy cơ nấm mốc và giòn gãy trang sách `[XÁC NHẬN: ComfortScoreService.java:271-337]`.
- **Nâng Cao Trải Nghiệm Học Tập Học Thuật (Academic Study Environment)**: Đảm bảo không gian tự học đạt tiêu chuẩn âm học yên tĩnh ($<35-45\text{ dBA}$) và không khí trong lành (PM2.5 $<10-25\,\mu\text{g/m}^3$) theo ASHRAE 55 và WHO, giúp bạn đọc tập trung tối đa `[XÁC NHẬN: ComfortScoreService.java:160-230]`.
- **Động Cơ Đánh Giá Khách Quan Phi Tuyến (Non-linear Gating Comfort Engine)**: Loại bỏ sai lệch của phép tính trung bình cộng thông thường; nếu bất kỳ yếu tố nào (như tiếng ồn tức thời hoặc bụi mịn) suy thoái nghiêm trọng, điểm LCS lập tức phản ánh đúng nút thắt cổ chai của môi trường `[XÁC NHẬN: ComfortScoreService.java:140-145]`.
- **Chủ Động Vận Hành & Khắc Phục Sự Cố (Proactive Facility Management)**: Cảnh báo thiết bị mất kết nối mạng và hỗ trợ tự động dò tìm (Auto-discovery) trạm đo mới cắm điện mà không cần cấu hình thủ công phức tạp `[XÁC NHẬN: DiscoveredDeviceService.java:25-57, DeviceService.java:231-234]`.

---

## 2. BẢN ĐỒ CHỨC NĂNG HỆ THỐNG (FUNCTIONAL CAPABILITIES MAP)

Dưới đây là ma trận ánh xạ toàn bộ chức năng hệ thống từ nghiệp vụ $\rightarrow$ endpoint/service $\rightarrow$ trạng thái $\rightarrow$ vai trò truy cập, kèm theo bằng chứng mã nguồn được xác minh trực tiếp:

| STT | Nhóm Nghiệp Vụ | Chức Năng Cụ Thể | Thành Phần Xử Lý (Endpoint / Service / Handler) | Trạng Thái Hoàn Thiện | Vai Trò / Phân Quyền | File & Dòng Minh Chứng Mã Nguồn | Nhãn Bằng Chứng |
|:---:|:---|:---|:---|:---:|:---|:---|:---:|
| **1** | **IAM & Auth** | Đăng nhập cấp cặp Access/Refresh Token | `POST /api/auth/login`<br>`AuthenticationService.authenticate()` | **Hoàn chỉnh** | Public (PermitAll)<br>*Rate limit 10 req/phút* | `AuthenticationController.java:29-34`<br>`AuthenticationService.java:63-95` | `[XÁC NHẬN]` |
| **2** | **IAM & Auth** | Kiểm tra tính hợp lệ của Token | `POST /api/auth/introspect`<br>`IntrospectService.introspect()` | **Hoàn chỉnh** | Public (PermitAll) | `AuthenticationController.java:36-42`<br>`IntrospectService.java:27-46` | `[XÁC NHẬN]` |
| **3** | **IAM & Auth** | Đăng xuất & đưa token vào Blacklist TTL | `POST /api/auth/logout`<br>`AuthenticationService.logout()` | **Hoàn chỉnh** | Public (PermitAll) | `AuthenticationController.java:44-49`<br>`AuthenticationService.java:97-123` | `[XÁC NHẬN]` |
| **4** | **IAM & Auth** | Làm mới Access Token (Token Rotation) | `POST /api/auth/refresh`<br>`AuthenticationService.refreshToken()` | **Hoàn chỉnh** | Public (PermitAll) | `AuthenticationController.java:51-57`<br>`AuthenticationService.java:125-162` | `[XÁC NHẬN]` |
| **5** | **IAM & Auth** | Scheduler dọn dẹp Token hết hạn ngầm | `@Scheduled(cron = "0 0 2 * * ?")`<br>`cleanExpiredTokens()` | **Hoàn chỉnh** | Tự động chạy ngầm 02:00 AM | `AuthenticationService.java:238-242` | `[XÁC NHẬN]` |
| **6** | **User Mgmt** | Tự đăng ký tài khoản bạn đọc (`USER`) | `POST /api/users`<br>`UserService.createUser()` | **Hoàn chỉnh** | Public (PermitAll) | `UserController.java:27-32`<br>`UserService.java:43-59` | `[XÁC NHẬN]` |
| **7** | **User Mgmt** | Tra cứu danh sách người dùng có phân trang | `GET /api/users`<br>`UserService.getUsers()` | **Hoàn chỉnh** | `ADMIN` | `UserController.java:34-49`<br>`UserService.java:68-80` | `[XÁC NHẬN]` |
| **8** | **User Mgmt** | Xem thông tin tài khoản đang đăng nhập | `GET /api/users/myInfo`<br>`UserService.getMyInfo()` | **Hoàn chỉnh** | Authenticated (Mọi User) | `UserController.java:51-56`<br>`UserService.java:61-66` | `[XÁC NHẬN]` |
| **9** | **User Mgmt** | Xem chi tiết người dùng theo ID | `GET /api/users/{userId}`<br>`UserService.getUser()` | **Hoàn chỉnh** | `ADMIN` hoặc Chính chủ | `UserController.java:58-63`<br>`UserService.java:82-87` | `[XÁC NHẬN]` |
| **10** | **User Mgmt** | Cập nhật thông tin/vai trò/assignedZones | `PUT /api/users/{userId}`<br>`UserService.updateUser()` | **Hoàn chỉnh** | `ADMIN` hoặc Chính chủ (*ADMIN mới sửa roles*) | `UserController.java:65-72`<br>`UserService.java:89-115` | `[XÁC NHẬN]` |
| **11** | **User Mgmt** | Kích hoạt / Khóa tài khoản người dùng | `PATCH /api/users/{userId}/status`<br>`UserService.updateStatus()` | **Hoàn chỉnh** | `ADMIN` | `UserController.java:74-81`<br>`UserService.java:117-123` | `[XÁC NHẬN]` |
| **12** | **User Mgmt** | Xóa vĩnh viễn tài khoản người dùng | `DELETE /api/users/{userId}`<br>`UserService.deleteUser()` | **Hoàn chỉnh** | `ADMIN` | `UserController.java:83-89`<br>`UserService.java:125-128` | `[XÁC NHẬN]` |
| **13** | **RBAC Mgmt** | Quản trị Vai trò (CRUD Role) | `/api/roles/**`<br>`RoleController` & `RoleService` | **Hoàn chỉnh** | `ADMIN` | `RoleController.java:24-49`<br>`RoleService.java:41-82` | `[XÁC NHẬN]` |
| **14** | **RBAC Mgmt** | Quản trị Quyền hạn (CRUD Permission) | `/api/permissions/**`<br>`PermissionController` | **Hoàn chỉnh** | `ADMIN` | `PermissionController.java:24-42`<br>`PermissionService.java:27-47` | `[XÁC NHẬN]` |
| **15** | **Space Mgmt** | Tạo mới phòng đọc kèm đa giác mặt bằng | `POST /api/v1/rooms`<br>`RoomService.createRoom()` | **Hoàn chỉnh** | `ADMIN`, `LIBRARIAN` | `RoomController.java:24-29`<br>`RoomService.java:29-50` | `[XÁC NHẬN]` |
| **16** | **Space Mgmt** | Lấy danh sách phòng (lọc theo tầng) | `GET /api/v1/rooms?floor={floor}`<br>`RoomService.getAllRooms()` | **Hoàn chỉnh** *(chưa phân trang)* | Authenticated | `RoomController.java:31-37`<br>`RoomService.java:52-56` | `[XÁC NHẬN]` |
| **17** | **Space Mgmt** | Tra cứu phòng theo ID hoặc Mã phòng | `GET /api/v1/rooms/{id}`<br>`GET /api/v1/rooms/code/{code}` | **Hoàn chỉnh** | Authenticated | `RoomController.java:39-51`<br>`RoomService.java:58-66` | `[XÁC NHẬN]` |
| **18** | **Space Mgmt** | Cập nhật cấu hình & ranh giới tường | `PUT /api/v1/rooms/{id}`<br>`RoomService.updateRoom()` | **Hoàn chỉnh** | `ADMIN`, `LIBRARIAN` | `RoomController.java:53-60`<br>`RoomService.java:74-103` | `[XÁC NHẬN]` |
| **19** | **Space Mgmt** | Xóa phòng đọc khỏi CSDL | `DELETE /api/v1/rooms/{id}`<br>`RoomService.deleteRoom()` | **Hoàn chỉnh** *(thiếu check liên kết)* | `ADMIN` | `RoomController.java:62-66`<br>`RoomService.java:105-112` | `[XÁC NHẬN]` |
| **20** | **Device Mgmt**| Tra cứu danh sách trạm mới phát hiện ngầm | `GET /api/v1/devices/discovered`<br>`DiscoveredDeviceService` | **Hoàn chỉnh** | `ADMIN`, `LIBRARIAN` | `DeviceController.java:30-36`<br>`DiscoveredDeviceService.java:51-57` | `[XÁC NHẬN]` |
| **21** | **Device Mgmt**| Đăng ký trạm đo mới & cấp rawApiKey 32-hex | `POST /api/v1/devices/register`<br>`DeviceService.registerDevice()` | **Hoàn chỉnh** | `ADMIN`, `LIBRARIAN` | `DeviceController.java:38-44`<br>`DeviceService.java:46-56` | `[XÁC NHẬN]` |
| **22** | **Device Mgmt**| Cập nhật vị trí tọa độ (posX, posY), firmware | `PUT /api/v1/devices/{id}`<br>`DeviceService.updateDevice()` | **Hoàn chỉnh** | `ADMIN`, `LIBRARIAN` | `DeviceController.java:46-53`<br>`DeviceService.java:122-152` | `[XÁC NHẬN]` |
| **23** | **Device Mgmt**| Gửi nhịp tim HTTP Heartbeat dự phòng | `POST /api/v1/devices/{id}/heartbeat`<br>`DeviceService.heartbeat()` | **Hoàn chỉnh** | Authenticated | `DeviceController.java:55-59`<br>`DeviceService.java:169-174` | `[XÁC NHẬN]` |
| **24** | **Device Mgmt**| Xác thực trạm đo phần cứng cấp Device JWT | `POST /api/v1/devices/authenticate`<br>`DeviceService.authenticateDevice()` | **Hoàn chỉnh** | Public (*Rate limit 10/phút*) | `DeviceController.java:61-67`<br>`DeviceService.java:67-85` | `[XÁC NHẬN]` |
| **25** | **Device Mgmt**| Lấy toàn bộ danh sách thiết bị | `GET /api/v1/devices`<br>`DeviceService.getAllDevices()` | **Hoàn chỉnh** *(chưa phân trang)* | `ADMIN`, `LIBRARIAN` | `DeviceController.java:69-74`<br>`DeviceService.java:87-92` | `[XÁC NHẬN]` |
| **26** | **Device Mgmt**| Xem thông tin chi tiết một trạm đo | `GET /api/v1/devices/{id}`<br>`DeviceService.getDeviceById()` | **Hoàn chỉnh** | `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER`, `MAINTENANCE` | `DeviceController.java:76-81`<br>`DeviceService.java:94-97` | `[XÁC NHẬN]` |
| **27** | **Device Mgmt**| Tra cứu thiết bị theo Phân vùng Không gian | `GET /api/v1/devices/zone/{zoneId}`<br>`DeviceService.getDevicesByZone()` | **Hoàn chỉnh** | `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER` (*check assignedZones*) | `DeviceController.java:83-88`<br>`DeviceService.java:99-120` | `[XÁC NHẬN]` |
| **28** | **Device Mgmt**| Thu hồi và cấp lại API Key cho thiết bị | `POST /api/v1/devices/{id}/regenerate-key`<br>`DeviceService.regenerateApiKey()` | **Hoàn chỉnh** | `ADMIN`, `LIBRARIAN` | `DeviceController.java:90-95`<br>`DeviceService.java:58-65` | `[XÁC NHẬN]` |
| **29** | **Device Mgmt**| Bật / Tắt kích hoạt trạng thái thiết bị | `PATCH /api/v1/devices/{id}/status`<br>`DeviceService.setDeviceStatus()` | **Hoàn chỉnh** | `ADMIN`, `LIBRARIAN` | `DeviceController.java:97-104`<br>`DeviceService.java:154-159` | `[XÁC NHẬN]` |
| **30** | **Device Mgmt**| Xóa hoàn toàn thiết bị khỏi hệ thống | `DELETE /api/v1/devices/{id}`<br>`DeviceService.deleteDevice()` | **Hoàn chỉnh** | `ADMIN` | `DeviceController.java:106-110`<br>`DeviceService.java:161-167` | `[XÁC NHẬN]` |
| **31** | **MQTT Intake** | Tiếp nhận & phân tích trạng thái phần cứng | Topic `devices/+/status`<br>`handleStatusMessage()` | **Hoàn chỉnh** | Broker MQTT QoS 1 | `MqttMessageDispatcherService.java:96-139` | `[XÁC NHẬN]` |
| **32** | **MQTT Intake** | Tiếp nhận & làm sạch đo lường vi khí hậu | Topic `devices/+/telemetry`<br>`handleTelemetryMessage()` | **Hoàn chỉnh** | Broker MQTT QoS 1 | `MqttMessageDispatcherService.java:141-214` | `[XÁC NHẬN]` |
| **33** | **Comfort Score**| Tính toán điểm LCS phi tuyến theo loại phòng | `ComfortScoreService.calculateScore()` | **Hoàn chỉnh** | Pipeline ngầm Ingestion | `ComfortScoreService.java:69-230` | `[XÁC NHẬN]` |
| **34** | **Telemetry**  | Lấy chỉ số vi khí hậu mới nhất của trạm | `GET /api/v1/telemetry/device/{id}/latest`<br>`TelemetryService.getLatestDeviceTelemetry()`| **Hoàn chỉnh** | `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER`, `USER`, `VIEWER` | `TelemetryController.java:25-30`<br>`TelemetryService.java:36-41` | `[XÁC NHẬN]` |
| **35** | **Telemetry**  | Lấy chỉ số vi khí hậu mới nhất của phòng | `GET /api/v1/telemetry/room/{id}/latest`<br>`TelemetryService.getLatestRoomTelemetry()`| **Hoàn chỉnh** | `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER`, `USER`, `VIEWER` | `TelemetryController.java:32-37`<br>`TelemetryService.java:43-48` | `[XÁC NHẬN]` |
| **36** | **Telemetry**  | Truy vấn lịch sử đo lường thô theo trạm | `GET /api/v1/telemetry/device/{id}`<br>`TelemetryService.getDeviceTelemetry()` | **Hoàn chỉnh** *(chưa nén/phân trang)* | `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER`, `USER`, `VIEWER` | `TelemetryController.java:39-47`<br>`TelemetryService.java:50-59` | `[XÁC NHẬN]` |
| **37** | **Telemetry**  | Truy vấn lịch sử đo lường thô theo phòng | `GET /api/v1/telemetry/room/{id}`<br>`TelemetryService.getRoomTelemetry()` | **Hoàn chỉnh** *(chưa nén/phân trang)* | `ADMIN`, `LIBRARIAN`, `ZONE_MANAGER`, `USER`, `VIEWER` | `TelemetryController.java:49-57`<br>`TelemetryService.java:61-70` | `[XÁC NHẬN]` |
| **38** | **Monitoring** | Giám sát sức khỏe ứng dụng & MongoDB | `GET /actuator/health`, `/info`, `/metrics` | **Hoàn chỉnh** | Public (`health`), Auth (`metrics`) | `SecurityConfig.java:57`<br>`application.yaml:18` | `[XÁC NHẬN]` |
| **39** | **Alert Mgmt** | Quản lý & tra cứu sự cố vượt ngưỡng | `Alert.java`, `AlertRepository.java` | **Stub / Dang dở** *(Chưa có Service/Controller)* | Đã nạp quyền RBAC (`VIEW_ALERTS`) | `AlertRepository.java:13-25`<br>`01_code.md:485` | `[XÁC NHẬN]` |
| **40** | **Realtime Push**| Đẩy dữ liệu thời gian thực ra Web UI | `spring-boot-starter-websocket` trong pom.xml | **Chưa có** *(Dead dependency, thiếu WS/SSE)* | Chưa cấu hình endpoint | `pom.xml:108-111`<br>`01_code.md:494-498` | `[XÁC NHẬN]` |
| **41** | **Analytics**  | Nén chuỗi thời gian & tính thống kê Min/Max | Phân cụm Time Buckets (15m, 1h, 1d) | **Chưa có** *(Chưa viết Aggregation Pipeline)* | Đã nạp quyền `VIEW_ANALYTICS` | `05_p1_summary.md:50`<br>`04_contract.md:383` | `[XÁC NHẬN]` |
| **42** | **Reporting**  | Kết xuất báo cáo định kỳ (PDF/CSV) | Báo cáo kiểm định môi trường TCVN | **Chưa có** | Đã nạp quyền `GENERATE_REPORT` | `01_code.md:488` | `[XÁC NHẬN]` |

---

## 3. ĐÁNH GIÁ KIẾN TRÚC HIỆN TẠI (ARCHITECTURE EVALUATION)

```
       [ MQTT ESP32-S3 Nodes ]                         [ HTTP Web Clients ]
                 | (QoS 1)                                       | (Port 8080)
                 v                                               v
    +--------------------------+                    +--------------------------+
    |   Mosquitto 2.0 Broker   |                    | Spring Security (JWT/RTR)|
    +-------------+------------+                    | Bucket4j Rate Limiting   |
                  |                                 +-------------+------------+
                  v                                               v
    +----------------------------------+            +--------------------------+
    | Spring Integration Inbound       |            | 7 REST Controllers       |
    | (Java 21 Virtual Threads)        |            | (ApiResponse Envelope)   |
    +-------------+--------------------+            +-------------+------------+
                  v                                               |
    +----------------------------------+                          |
    | MqttMessageDispatcherService     |                          |
    |  - HardwareId Anti-Spoofing      |                          |
    |  - Discovered Device Queue       |                          |
    |  - Caffeine lastSeen Throttle    |                          |
    |  - TelemetrySanitizer (Out-of-b) |                          |
    |  - ComfortScore Liebig Engine    |                          v
    +-------------+--------------------+            +--------------------------+
                  \________________________________>| 12 Application Services  |
                                                    +-------------+------------+
                                                                  v
                                                    +--------------------------+
                                                    | 8 MongoRepositories      |
                                                    +-------------+------------+
                                                                  v
                                                    +--------------------------+
                                                    | MongoDB 8.0 Engine       |
                                                    |  - TimeSeries Collection |
                                                    |  - Document Collections  |
                                                    |  - TTL Auto-Purge Index  |
                                                    +--------------------------+
```

### 3.1. Các Điểm Mạnh Nổi Bật Của Kiến Trúc (Architectural Strengths)
1. **Tiếp Nhận Dữ Liệu Hiệu Suất Cao Với Java 21 Virtual Threads**:
   - Tầng Spring Integration MQTT Inbound kích hoạt `newVirtualThreadPerTaskExecutor()` `[XÁC NHẬN: MqttConfig.java:42-44]`. Khi xảy ra bão dữ liệu từ hàng trăm trạm cảm biến gửi dồn dập, máy chủ không bị giới hạn bởi Platform Thread pool của hệ điều hành, tối ưu hóa triệt để tài nguyên RAM và CPU `[SUY LUẬN: 01_code.md:347-351]`.
2. **Thiết Kế CSDL Tối Ưu Chuyên Biệt Cho Dữ Liệu Thời Gian (Time-Series First)**:
   - Sử dụng MongoDB 8.0 Native TimeSeries Collection (`telemetry_records`) với `timeField: timestamp`, `metaField: metadata`, độ hạt `granularity: SECONDS` và chính sách dọn dẹp tự động TTL 90 ngày `[XÁC NHẬN: docker-compose.yml:5, TelemetryRecord.java:16-38]`. Kiến trúc này nén dữ liệu cực kỳ hiệu quả trên ổ cứng và tăng tốc độ đọc ghi vượt trội so với các CSDL quan hệ truyền thống `[SUY LUẬN: 02_config.md:120-145]`.
3. **Cơ Chế Điều Tiết & Chống Thắt Cổ Chai Cơ Sở Dữ Liệu (Write Amplification Throttling)**:
   - Sử dụng Caffeine Cache `lastSeenThrottleCache` cửa sổ 30 giây để bóp tần suất cập nhật `lastSeenAt` vào MongoDB `[XÁC NHẬN: MqttMessageDispatcherService.java:166-175]`. Nhờ đó, loại bỏ được hơn 90% số lượng truy vấn ghi cập nhật bảng thiết bị không cần thiết `[SUY LUẬN: 01_code.md:390-393]`.
4. **Bộ Lọc Cảm Biến & Động Cơ Tính Điểm Khoa Học Chặt Chẽ**:
   - `TelemetrySanitizerService` lọc ngưỡng vật lý, áp dụng kỹ thuật Forward-Fill 30 giây để bù đắp mẫu cảm biến thiếu nhưng loại trừ nghiêm ngặt xung đỉnh âm học `noisePeak` để bảo toàn tính trung thực của tiếng ồn `[XÁC NHẬN: TelemetrySanitizerService.java:82-106]`.
   - `ComfortScoreService` triển khai chuẩn xác **Nguyên lý Thùng gỗ Liebig** (Non-linear gating), giúp phân loại tiện nghi môi trường học thuật đạt độ tin cậy khoa học cao `[XÁC NHẬN: ComfortScoreService.java:140-145]`.
5. **Hệ Thống Bảo Mật & RBAC Vững Chắc**:
   - Sử dụng JWT HMAC-SHA512 với cơ chế Refresh Token Rotation (RTR) bảo vệ hai lớp, cơ chế Token Blacklist tự động xóa qua MongoDB TTL, băm mật khẩu BCrypt độ mạnh 10 và tích hợp Rate Limiting Bucket4j (10 req/phút) tại các điểm nhạy cảm `[XÁC NHẬN: SecurityConfig.java:63-101, RateLimitFilter.java:29-51]`.

---

### 3.2. Các Điểm Yếu & Hạn Chế Trọng Yếu Cần Giải Quyết (Architectural Weaknesses)
1. **Phân Hệ Cảnh Báo Bị Mồ Côi (Orphaned Alert Subsystem - Thiếu Tầng Service/Controller)**:
   - *Hiện trạng*: Trong mã nguồn đã có Document `Alert.java`, `AlertRepository.java`, các enum `AlertType`, `AlertStatus` và danh sách quyền RBAC `[XÁC NHẬN: AlertRepository.java:13-25, ApplicationInitConfig.java:68-70]`. Tuy nhiên, hoàn toàn **chưa có `AlertService`, `AlertController`**, và trong pipeline MQTT ingestion **chưa có câu lệnh so sánh ngưỡng để sinh bản ghi cảnh báo** `[XÁC NHẬN: 01_code.md:485, 05_p1_summary.md:53-55]`.
   - *Hậu quả*: Giao diện chuông thông báo và bảng nhật ký sự cố trên Web UI hoàn toàn không có API để hoạt động; người quản trị không nhận được cảnh báo khi môi trường vượt ngưỡng `[SUY LUẬN]`.
2. **Thiếu Cơ Chế Đẩy Realtime Ra Web UI (Dead WebSocket Dependency)**:
   - *Hiện trạng*: Dự án đã khai báo `spring-boot-starter-websocket` trong `pom.xml:108-111`, nhưng trong toàn bộ mã nguồn không có bất kỳ cấu hình WebSocket STOMP (`@EnableWebSocketMessageBroker`) hay Server-Sent Events (SSE) nào `[XÁC NHẬN: pom.xml:108-111, 01_code.md:494-498]`.
   - *Hậu quả*: Web Frontend bắt buộc phải dùng kỹ thuật REST Polling liên tục, gây trễ cập nhật và tạo tải truy vấn lặp lại đè nặng lên MongoDB Connection Pool `[SUY LUẬN: 05_p1_summary.md:56-58]`.
3. **Nguy Cơ Quá Tải Bộ Nhớ (OOM) Khi Query Dữ Liệu Chuỗi Thời Gian Thô**:
   - *Hiện trạng*: Các endpoint `GET /api/v1/telemetry/device/{id}` và `.../room/{id}` trả về danh sách thô `List<TelemetryResponse>` không giới hạn số lượng và không nén `[XÁC NHẬN: TelemetryController.java:39-57]`.
   - *Hậu quả*: Khi xem biểu đồ dải thời gian từ 24h đến 7 ngày (>60,000 bản ghi), backend có nguy cơ tràn RAM JVM (OutOfMemoryError), payload JSON nặng hàng chục MB gây đơ trình duyệt client `[SUY LUẬN: 05_p1_summary.md:59-61]`.
4. **Bất Nhất Trong Thiết Kế API RESTful (API Versioning & Pagination Inconsistency)**:
   - *Hiện trạng*: Tiền tố URI bị xé lẻ giữa phân hệ IAM (`/api/auth`, `/api/users`, `/api/roles`, `/api/permissions`) và phân hệ IoT (`/api/v1/rooms`, `/api/v1/devices`, `/api/v1/telemetry`) `[XÁC NHẬN: 04_contract.md:257-268]`. Đồng thời, ngoại trừ `GET /api/users`, toàn bộ các endpoint danh sách phòng, danh sách thiết bị và lịch sử đo đều không có phân trang `PageResponse` `[XÁC NHẬN: 04_contract.md:219-228]`.
   - *Hậu quả*: Gây khó khăn cho Frontend trong việc cấu hình `baseURL` và tiềm ẩn rủi ro tải chậm khi số lượng trạm đo mở rộng `[SUY LUẬN]`.
5. **Khoảng Trống Kiểm Thử Tầng Tích Hợp (Zero Integration / Slice Tests)**:
   - *Hiện trạng*: 100% test case hiện có (19 files, 124 tests) đều là Unit Test sử dụng mock thuần túy `[XÁC NHẬN: 04_contract.md:12-19]`. Toàn hệ thống có **0% Slice Test** (`@WebMvcTest`) và **0% Integration Test** (`@SpringBootTest`, Testcontainers), 5/7 Controllers không hề có bài test nào bảo vệ hợp đồng HTTP `[XÁC NHẬN: 04_contract.md:41-47]`.
   - *Hậu quả*: Các lỗi về phân quyền Security, lỗi cú pháp query MongoDB thực tế hoặc lỗi tuần tự hóa JSON không được bảo đảm phát hiện tự động `[SUY LUẬN: 05_p1_summary.md:65-67]`.

---

## 4. MỤC CÂU HỎI MỞ TỔNG HỢP (SYNTHESIZED OPEN QUESTIONS)

Từ kết quả rà soát toàn diện hiện trạng mã nguồn, hạ tầng và đối chiếu benchmark quốc tế, các câu hỏi mở cốt lõi dưới đây cần được chủ dự án phê duyệt làm căn cứ triển khai Roadmap và UI:

1. **Về Cơ Chế Realtime Cho Giao Diện Web**:
   - *Căn cứ*: `spring-boot-starter-websocket` đã có sẵn trong `pom.xml:108-111` nhưng chưa kích hoạt cấu hình `[XÁC NHẬN]`.
   - *Câu hỏi*: Dự án sẽ ưu tiên kích hoạt **WebSocket STOMP** (`/ws-aiot` - hỗ trợ client subscribe theo từng phòng `/topic/room.{roomId}` tương tự ThingsBoard) hay sử dụng **Server-Sent Events (SSE)** (`/api/v1/telemetry/stream` - đơn giản, tự reconnect tốt qua HTTP/2)? `[CHƯA RÕ: 06_references.md:316-318]`.
2. **Về Quản Trị Ngưỡng Cảnh Báo (Alert Threshold Management)**:
   - *Căn cứ*: Ngưỡng tiện nghi hiện tại đang được mã hóa cố định (hardcoded) trong mã Java `ComfortScoreService.java:160-414` `[XÁC NHẬN]`.
   - *Câu hỏi*: Ngưỡng cảnh báo sự cố nên được lưu trữ linh hoạt trong MongoDB gắn theo từng `Room` (để thủ thư tùy biến cho phòng đọc yên tĩnh vs phòng hội thảo), hay cố định theo phân loại `RoomType` trong mã nguồn? `[CHƯA RÕ: 01_code.md:610-616]`.
3. **Về Chiến Lược Giảm Tải Dữ Liệu Biểu Đồ (TimeSeries Downsampling)**:
   - *Căn cứ*: API telemetry hiện tại trả về dữ liệu thô không nén gây nguy cơ OOM khi vẽ biểu đồ 24h hoặc 7 ngày `[XÁC NHẬN: TelemetryController.java:39-57]`.
   - *Câu hỏi*: Đội ngũ có thống nhất bổ sung ngay API phân cụm Time Buckets (`/api/v1/telemetry/room/{id}/buckets?interval=15m|1h|1d`) sử dụng MongoDB Aggregation `$dateTrunc` học tập mô hình của AirGradient không? `[CHƯA RÕ: 06_references.md:295-300]`.
4. **Về Chuẩn Hóa Phiên Bản API & Phân Quyền Công Cộng (Kiosk Mode)**:
   - *Căn cứ*: URI bị phân mảnh `/api/` vs `/api/v1/`, và toàn bộ API telemetry phòng hiện đều yêu cầu đăng nhập có tài khoản `[XÁC NHẬN: 04_contract.md:257-268, TelemetryController.java:32]`.
   - *Câu hỏi*: Có thống nhất di chuyển toàn bộ endpoint IAM về `/api/v1/...`, đồng thời mở một endpoint công khai không yêu cầu token (`GET /api/v1/public/rooms/{id}/comfort-score`) để phục vụ các màn hình Kiosk/Tablet treo cửa phòng đọc cho sinh viên tra cứu không? `[CHƯA RÕ: 06_references.md:325-327]`.

---
*Báo cáo được hoàn thành và đối chiếu 100% dựa trên mã nguồn thực tế — Tuân thủ tuyệt đối quy tắc Read-Only, Bảo mật thông tin (che ***), và gắn nhãn minh chứng [XÁC NHẬN] / [SUY LUẬN] / [CHƯA RÕ] trên toàn bộ các nhận định kỹ thuật.*
