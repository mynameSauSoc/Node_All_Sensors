# KẾ HOẠCH LỘ TRÌNH PHÁT TRIỂN HỆ THỐNG AIoTLibTQB (SYSTEM ROADMAP)
> **Mã tài liệu**: `PHASE3-ROADMAP-08` | **Hệ thống thực hiện**: AIoTLibTQB (Smart Library IoT System)  
> **Thời điểm lập**: 2026-10-21 | **Phiên bản tài liệu**: 1.0 Final  
> **Nguyên tắc thực hiện**: Dữ liệu thực chứng 100%, bảo mật credentials (che ***), chỉ đọc mã nguồn không sửa đổi  
> **Quy ước nhãn chứng cứ**: `[XÁC NHẬN]` (mã nguồn/hạ tầng thực tế) | `[SUY LUẬN]` (phân tích kỹ thuật) | `[CHƯA RÕ]` (vấn đề mở)

---

## 1. TỔNG QUAN LỘ TRÌNH PHÁT TRIỂN (DEVELOPMENT ROADMAP STRATEGY)

Hệ thống AIoTLibTQB đã hoàn thành xuất sắc các phân hệ cốt lõi gồm: Ingestion MQTT đa luồng ảo Java 21, làm sạch số liệu, tính điểm tiện nghi LCS Liebig, lưu trữ CSDL MongoDB TimeSeries và phân quyền RBAC `[XÁC NHẬN: 07_project_conclusion.md:Section 2]`. Tuy nhiên, để chuyển đổi từ một **Backend IoT lõi** sang một **Hệ thống hoàn chỉnh phục vụ người dùng qua Giao diện Web (Frontend-Ready)**, dự án cần giải quyết các điểm nghẽn kỹ thuật và khoảng trống chức năng then chốt.

Lộ trình phát triển được phân chia theo 3 cấp độ ưu tiên nghiêm ngặt:
- **P0 (Khẩn cấp / Bắt buộc cho MVP & Chống sập hệ thống)**: Các thành phần chặn dòng (blockers) mà nếu thiếu chúng, Web UI không thể hoạt động được hoặc hệ sinh thái sẽ đối mặt với nguy cơ quá tải bộ nhớ (OOM) và tê liệt luồng nghiệp vụ.
- **P1 (Cốt lõi / Hoàn thiện Trải nghiệm & Độ tin cậy)**: Các chức năng nghiệp vụ quản trị không gian, tối ưu hóa thông lượng dữ liệu, bảo đảm tính nhất quán của trạng thái trạm đo và kiểm thử tự động.
- **P2 (Nâng cao / Mở rộng Hệ sinh thái & Báo cáo)**: Các tính năng phân tích dự báo dài hạn, cảnh báo đa kênh ngoại vi, xuất báo cáo chuẩn kiểm định và tinh chỉnh nội suy không gian.

---

## 2. DANH MỤC CÁC HẠNG MỤC THEO THỨ TỰ ƯU TIÊN (PRIORITIZED TASK CATALOG)

### 2.1. Nhóm Ưu Tiên P0: Bắt Buộc Để Web UI Hoạt Động Được & Chống Rủi Ro Hạ Tầng

| Mã Task | Tên Hạng Mục Công Việc | Lý Do Thực Hiện & Rủi Ro Nếu Bỏ Qua | Ràng Buộc Phụ Thuộc | Độ Lớn (S/M/L) | File / Mã Nguồn Liên Quan | Nhãn Bằng Chứng |
|:---:|:---|:---|:---:|:---:|:---|:---:|
| **P0-1** | **Hoàn thiện Phân hệ Cảnh báo (Alert Subsystem Backend)** | **Lý do**: Hiện tại đã có `Alert.java` và `AlertRepository.java` nhưng thiếu `AlertService`, `AlertController` và logic so ngưỡng trong pipeline MQTT `[XÁC NHẬN: 05_p1_summary.md:53-55]`.<br>**Rủi ro**: Không có API để giao diện chuông thông báo và bảng sự cố hoạt động; vi phạm tiện nghi không được phát hiện `[SUY LUẬN]`. | Phụ thuộc vào `AlertRepository` và `ComfortScoreService` | **M**<br>*(3–4 ngày)* | `Alert.java:14-52`<br>`AlertRepository.java:13-25`<br>`MqttMessageDispatcherService.java:141-214` | `[XÁC NHẬN]` |
| **P0-2** | **Xây dựng API Nén Chuỗi Thời Gian (TimeSeries Downsampling Aggregations)** | **Lý do**: API telemetry hiện tại trả về dữ liệu thô `List<TelemetryResponse>` `[XÁC NHẬN: TelemetryController.java:39-57]`. Khi xem biểu đồ 24h/7 ngày (>60,000 bản ghi), backend có nguy cơ OOM RAM JVM và đơ trình duyệt client `[SUY LUẬN]`.<br>**Giải pháp**: Bổ sung API `GET /api/v1/telemetry/room/{id}/buckets?interval=15m|1h|1d` dùng MongoDB `$dateTrunc` học theo AirGradient `[XÁC NHẬN: 06_references.md:295-300]`. | Phụ thuộc vào `telemetry_records` TimeSeries collection | **M**<br>*(3 ngày)* | `TelemetryController.java:39-57`<br>`TelemetryService.java:50-70`<br>`TelemetryRepository.java:15-28` | `[XÁC NHẬN]` |
| **P0-3** | **Kích hoạt Kênh Đẩy Dữ Liệu Thời Gian Thực (Realtime Push: WS STOMP / SSE)** | **Lý do**: `spring-boot-starter-websocket` đã nằm sẵn trong `pom.xml:108-111` nhưng là dead dependency `[XÁC NHẬN]`. Không có cơ chế đẩy, UI buộc phải REST Polling liên tục, gây trễ hiển thị và lãng phí kết nối DB `[SUY LUẬN]`.<br>**Giải pháp**: Cấu hình WebSocket STOMP tại `/ws-aiot` hoặc SSE stream `/api/v1/telemetry/stream` để đẩy số liệu mới và cảnh báo tức thời `[SUY LUẬN: 06_references.md:275-281]`. | Phụ thuộc vào `MqttMessageDispatcherService` sau bước tính LCS | **M**<br>*(3–5 ngày)* | `pom.xml:108-111`<br>`MqttConfig.java:42-44`<br>`MqttMessageDispatcherService.java:190-214` | `[XÁC NHẬN]` |
| **P0-4** | **Chuẩn Hóa Phân Trang, Phiên Bản API & Sửa Lỗ Hổng Validation Request** | **Lý do**: Duy nhất `GET /api/users` có phân trang; `devices` và `rooms` đều unpaginated `[XÁC NHẬN: 04_contract.md:219-228]`. Tiền tố URI bị xé lẻ giữa `/api/...` (IAM) và `/api/v1/...` (IoT) `[XÁC NHẬN: 04_contract.md:257-268]`. DTO đăng nhập thiếu chú thích `@Valid` `[XÁC NHẬN: AuthenticationRequest.java:12-14]`.<br>**Rủi ro**: Lỗi lọt payload rỗng; UI khó đồng bộ `baseURL`; tải danh sách lớn chậm `[SUY LUẬN]`. | Độc lập tầng Controller/DTO | **S**<br>*(1–2 ngày)* | `AuthenticationController.java:29`<br>`DeviceController.java:69`<br>`RoomController.java:31` | `[XÁC NHẬN]` |

---

### 2.2. Nhóm Ưu Tiên P1: Hoàn Thiện Nghiệp Vụ, Vận Hành & Độ Bền Vững Kiến Trúc

| Mã Task | Tên Hạng Mục Công Việc | Lý Do Thực Hiện & Rủi Ro Nếu Bỏ Qua | Ràng Buộc Phụ Thuộc | Độ Lớn (S/M/L) | File / Mã Nguồn Liên Quan | Nhãn Bằng Chứng |
|:---:|:---|:---|:---:|:---:|:---|:---:|
| **P1-1** | **Xây dựng Tiến Trình Quét Thiết Bị Ngoại Tuyến (Offline Device Watchdog Job)** | **Lý do**: Hiện tại trạng thái `online` của trạm chỉ tính toán động khi gọi API `[XÁC NHẬN: DeviceService.java:231-234]`. Nếu thiết bị mất nguồn đột ngột không kịp gửi MQTT LWT, CSDL vẫn lưu `connectionState = ONLINE` `[XÁC NHẬN: 01_code.md:315-326]`.<br>**Giải pháp**: Bổ sung `@Scheduled(fixedRate = 60000)` để quét và cập nhật `connectionState = OFFLINE` cho trạm mất sóng quá 5 phút `[SUY LUẬN]`. | Phụ thuộc vào `DeviceRepository` | **S**<br>*(1 ngày)* | `DeviceService.java:231-234`<br>`AIoTLibTQBApplication.java:9` | `[XÁC NHẬN]` |
| **P1-2** | **Bổ Sung Bounded Concurrency & Cache Tra Cứu Thiết Bị Trong Luồng Ingestion** | **Lý do**: MQTT Inbound dùng Virtual Threads không giới hạn và gọi `deviceRepository.findByHardwareId` lặp lại trên mọi bản tin `[XÁC NHẬN: MqttConfig.java:43, MqttMessageDispatcherService.java:153]`. Khi bão dữ liệu xảy ra, có thể gây cạn kiệt Connection Pool MongoDB `[SUY LUẬN: 03_docs.md:232-240]`.<br>**Giải pháp**: Thêm Caffeine Cache tra cứu metadata trạm và kiểm soát tải bằng Semaphore/Bounded Executor `[SUY LUẬN]`. | Phụ thuộc vào `MqttMessageDispatcherService` | **S**<br>*(1–2 ngày)* | `MqttConfig.java:43`<br>`MqttMessageDispatcherService.java:153` | `[XÁC NHẬN]` |
| **P1-3** | **Chuẩn Hóa Thực Thể & Bộ API CRUD Quản Trị Phân Vùng Không Gian (Zone Mgmt)** | **Lý do**: Quyền `MANAGE_ZONES` và logic `assignedZones` đã có nhưng chưa có Document `Zone.java`, `ZoneRepository` hay `ZoneController` riêng `[XÁC NHẬN: 01_code.md:487]`. Zone hiện là chuỗi string tự do `[XÁC NHẬN]`.<br>**Giải pháp**: Tạo entity `Zone` để UI quản lý danh mục khu vực/tòa nhà một cách khoa học `[SUY LUẬN: 06_references.md:143]`. | Phụ thuộc vào `Device` và `Room` | **M**<br>*(2–3 ngày)* | `Device.java:38`<br>`User.java:47`<br>`ApplicationInitConfig.java:55` | `[XÁC NHẬN]` |
| **P1-4** | **Mở Endpoint Tra Cứu Công Cộng (Public Kiosk API) Cho Sinh Viên** | **Lý do**: Hiện tại mọi API đọc tiện nghi phòng đều yêu cầu tài khoản đăng nhập `[XÁC NHẬN: TelemetryController.java:32]`. Khách vãng lai và sinh viên xem màn hình TV/Tablet treo trước cửa phòng đọc không thể truy cập `[SUY LUẬN: 06_references.md:325-327]`.<br>**Giải pháp**: Mở `GET /api/v1/public/rooms/{id}/comfort-score` (PermitAll, Rate limited 60 req/phút) `[SUY LUẬN]`. | Phụ thuộc vào `TelemetryService` | **S**<br>*(1 ngày)* | `SecurityConfig.java:54-61`<br>`TelemetryController.java:32` | `[XÁC NHẬN]` |
| **P1-5** | **Xây Dựng Bộ Kiểm Thử Tầng Controller & Tích Hợp (Slice & Integration Tests)** | **Lý do**: Hiện tại hệ thống có **0% Slice Test** (`@WebMvcTest`) và **0% Integration Test**; 5/7 Controllers không hề có bài test bảo vệ hợp đồng HTTP `[XÁC NHẬN: 04_contract.md:41-47]`.<br>**Rủi ro**: Lỗi phân quyền Security, lỗi cú pháp query MongoDB hoặc serialization JSON không bị phát hiện bởi CI/CD `[SUY LUẬN: 05_p1_summary.md:65-67]`. | Phụ thuộc vào test infrastructure | **M**<br>*(3–4 ngày)* | Thư mục `src/test/java` | `[XÁC NHẬN]` |

---

### 2.3. Nhóm Ưu Tiên P2: Mở Rộng Hệ Sinh Thái, Báo Cáo Chuyên Sâu & Phân Tích

| Mã Task | Tên Hạng Mục Công Việc | Lý Do Thực Hiện & Rủi Ro Nếu Bỏ Qua | Ràng Buộc Phụ Thuộc | Độ Lớn (S/M/L) | File / Mã Nguồn Liên Quan | Nhãn Bằng Chứng |
|:---:|:---|:---|:---:|:---:|:---|:---:|
| **P2-1** | **Tích Hợp Cảnh Báo Đa Kênh (Multi-channel Alerting: Email SMTP, Webhook)** | **Lý do**: Khi xảy ra sự cố nghiêm trọng (ví dụ: kho sách quá nhiệt $>25^\circ\text{C}$ hoặc độ ẩm $>70\%$ đe dọa nấm mốc), thủ thư cần nhận được email tức thời `[SUY LUẬN: 06_references.md:120-123]`. | Phụ thuộc vào Task P0-1 (Alert Subsystem) | **M**<br>*(3 ngày)* | `AlertService.java` (mới)<br>`pom.xml:spring-boot-starter-mail` | `[SUY LUẬN]` |
| **P2-2** | **Xây Dựng Thuật Toán Nguy Cơ Ẩm Mốc VTT Mould Index & Phân Tích Dự Báo** | **Lý do**: Quyền `VIEW_ANALYTICS` trong seed RBAC có nêu rõ mô tả "Xem phân tích sâu, dự báo xu hướng, chỉ số nấm mốc VTT" nhưng code chưa triển khai `[XÁC NHẬN: ApplicationInitConfig.java:71]`. | Phụ thuộc vào Task P0-2 (TimeSeries Buckets) | **M**<br>*(3–5 ngày)* | `ApplicationInitConfig.java:71`<br>`TelemetryService.java` | `[XÁC NHẬN]` |
| **P2-3** | **Module Kết Xuất Báo Cáo Định Kỳ Kiểm Định Môi Trường (PDF/CSV)** | **Lý do**: Quyền `GENERATE_REPORT` đã được khai báo nhưng chưa có logic xuất file `[XÁC NHẬN: ApplicationInitConfig.java:72, 01_code.md:488]`. Phục vụ công tác thanh kiểm tra môi trường học đường theo tiêu chuẩn TCVN `[SUY LUẬN]`. | Phụ thuộc vào Task P0-2 (Aggregation Data) | **M**<br>*(3–4 ngày)* | `ApplicationInitConfig.java:72` | `[XÁC NHẬN]` |
| **P2-4** | **Lập Chỉ Mục MongoDB GeoJSON `2dsphere` Cho Thuật Toán Nội Suy Nhiệt IDW** | **Lý do**: Tối ưu hóa truy vấn không gian khi render lớp Heatmap đa điểm trên Canvas theo giải thuật Inverse Distance Weighting học từ openSenseMap `[XÁC NHẬN: 06_references.md:237-253]`. | Phụ thuộc vào `boundaryPolygon` và vị trí `Device` | **S**<br>*(2 ngày)* | `Room.java:42`<br>`Device.java:45-47` | `[XÁC NHẬN]` |

---

## 3. PHẦN BACKEND CÒN THIẾU ĐỂ GIAO DIỆN HOẠT ĐỘNG ĐƯỢC (BACKEND GAPS FOR UI ENABLEMENT)

Để đội ngũ phát triển Frontend có thể xây dựng giao diện hoàn chỉnh mà không gặp lỗi nghẽn (blockers), bảng dưới đây liệt kê chi tiết các thành phần Backend bắt buộc phải bổ sung:

```
+-----------------------------------------------------------------------------------------+
|                  CÁC THÀNH PHẦN BACKEND BẮT BUỘC BỔ SUNG CHO GIAO DIỆN                 |
+-----------------------------------------------------------------------------------------+
|  1. THIẾU API CẢNH BÁO:                                                                 |
|     - GET  /api/v1/alerts/unread-count         -> Số đếm badge đỏ trên icon chuông     |
|     - GET  /api/v1/alerts (phân trang + lọc)   -> Danh sách sự cố vượt ngưỡng           |
|     - POST /api/v1/alerts/{id}/acknowledge     -> Nút bấm tiếp nhận xử lý sự cố         |
|     - POST /api/v1/alerts/{id}/resolve         -> Đóng sự cố khi thông số an toàn       |
+-----------------------------------------------------------------------------------------+
|  2. THIẾU API NÉN DỮ LIỆU BIỂU ĐỒ (DOWNSAMPLING):                                       |
|     - GET /api/v1/telemetry/room/{id}/buckets?interval=15m|1h|1d -> Tránh tràn RAM      |
|     - GET /api/v1/telemetry/overview/summary   -> Điểm LCS trung bình toàn thư viện     |
+-----------------------------------------------------------------------------------------+
|  3. THIẾU KÊNH REALTIME ĐẨY DỮ LIỆU:                                                    |
|     - Kích hoạt Spring WebSocket STOMP (/ws-aiot) hoặc SSE (/api/v1/telemetry/stream)  |
|     - Cho phép subscribe theo phòng: /topic/room.{roomId}.telemetry                     |
|     - Kênh thông báo sự cố toàn hệ thống: /topic/alerts                                 |
+-----------------------------------------------------------------------------------------+
|  4. CHUẨN HÓA DỮ LIỆU & HỢP ĐỒNG API:                                                   |
|     - Đồng nhất tiền tố API sang /api/v1/... (chuyển /api/auth -> /api/v1/auth)        |
|     - Phân trang chuẩn PageResponse<T> cho GET /api/v1/devices và GET /api/v1/rooms     |
|     - Thêm @Valid vào AuthenticationRequest.java                                       |
+-----------------------------------------------------------------------------------------+
```

### 3.1. Danh Sách Endpoint Cần Viết Mới Hoặc Bổ Sung Tham Số
1. **Phân hệ Cảnh báo (Alerts)**:
   - `GET /api/v1/alerts/unread-count`: Trả về `{ "unreadCount": 3 }` để hiển thị chấm đỏ trên Header Bell icon.
   - `GET /api/v1/alerts?page=0&size=10&status=ACTIVE_UNACK&severity=CRITICAL&roomId=...`: Trả về danh sách sự cố có phân trang, lọc theo phòng, trạng thái và mức nghiêm trọng.
   - `POST /api/v1/alerts/{id}/acknowledge`: Tiếp nhận xử lý sự cố, chuyển trạng thái từ `ACTIVE_UNACK` sang `ACTIVE_ACK`.
   - `POST /api/v1/alerts/{id}/resolve`: Thủ thư xác nhận đóng sự cố môi trường.
2. **Phân hệ Tổng hợp Chuỗi Thời Gian (Analytics & Downsampling)**:
   - `GET /api/v1/telemetry/room/{id}/buckets?interval=15m|1h|1d&start=...&end=...`: Trả về danh sách điểm đo đã gom cụm qua MongoDB Aggregation `$dateTrunc` gồm: thời điểm, LCS trung bình, $T_{\text{avg}}, T_{\text{min}}, T_{\text{max}}$, độ ẩm, độ ồn, bụi PM2.5.
   - `GET /api/v1/telemetry/overview/summary`: Trả về các chỉ số KPI tóm tắt toàn thư viện: LCS trung bình toàn trường, phòng có điều kiện tốt nhất, phòng có điều kiện tệ nhất cần lưu ý, tổng số trạm Online / Offline.
3. **Phân hệ Tra cứu Công cộng (Public Kiosk)**:
   - `GET /api/v1/public/rooms/{id}/comfort-score`: Cung cấp điểm số LCS, nhãn phân hạng (Platinum, Gold, Silver...), và thông số vi khí hậu cơ bản mà không yêu cầu header `Authorization: Bearer <token>`.

### 3.2. Chuẩn Hóa Dữ Liệu & Hợp Đồng API (Contract Standardization)
- **Đồng nhất URI Versioning**: Di chuyển toàn bộ các controller IAM (`/api/auth`, `/api/users`, `/api/roles`, `/api/permissions`) sang chuẩn chung có phiên bản `/api/v1/...` nhằm giúp cấu hình `baseURL` trên Frontend đồng nhất, tránh phân mảnh logic gọi API `[XÁC NHẬN: 04_contract.md:257-268]`.
- **Đồng nhất Phân trang (Pagination Envelope)**: Bổ sung cấu trúc `PageResponse<T>` (`page`, `size`, `totalElements`, `totalPages`, `last`) cho `GET /api/v1/devices` và `GET /api/v1/rooms` thay vì trả về `List<T>` thô `[XÁC NHẬN: 04_contract.md:219-228]`.
- **Validation Request DTO**: Bổ sung chú thích `@Valid` vào tham số `AuthenticationRequest` trong `AuthenticationController.java:29` để bảo đảm dữ liệu đầu vào không bị null hoặc rỗng trước khi xử lý nghiệp vụ `[XÁC NHẬN: AuthenticationRequest.java:12-14]`.

### 3.3. Phục Vụ Giao Diện Về Auth, CORS & Realtime
- **CORS**: Hiện tại cấu hình tại `SecurityConfig.java:91-101` đã cho phép `http://localhost:3000` và `http://localhost:8081` `[XÁC NHẬN]`. Cần bảo đảm biến môi trường `CORS_ALLOWED_ORIGINS` được thiết lập chính xác khi đưa lên môi trường staging/production.
- **Xử lý Hết hạn Phiên (Silent Refresh)**: Frontend Interceptor cần bắt mã lỗi `ErrorCode.UNAUTHENTICATED` (mã code `1006`) từ backend để tự động gọi `POST /api/v1/auth/refresh` bằng `refreshToken`, thực hiện quay vòng token (RTR) mượt mà mà không làm gián đoạn trải nghiệm người dùng `[XÁC NHẬN: 01_code.md:561-570]`.
- **Chiến lược Realtime**: Nếu kích hoạt WebSocket STOMP, backend phát sóng dữ liệu vi khí hậu mới qua topic `/topic/room.{roomId}.telemetry` ngay trong hàm `MqttMessageDispatcherService:210` sau khi lưu CSDL thành công. Nếu dùng SSE, cung cấp kênh luồng tại `/api/v1/telemetry/stream?roomId={id}` `[SUY LUẬN: 06_references.md:275-281]`.

---

## 4. MA TRẬN RỦI RO DỰ ÁN & BIỆN PHÁP GIẢM THIỂU (PROJECT RISK MATRIX)

| TT | Rủi Ro Kỹ Thuật / Vận Hành | Mức Độ Ảnh Hưởng | Xác Suất | Biện Pháp Phòng Ngừa & Giảm Thiểu Khuyến Nghị | File Minh Chứng |
|:---:|:---|:---:|:---:|:---|:---|
| **1** | **Tràn RAM JVM (OOM) khi Query Dữ Liệu Lịch Sử** | **Nghiêm trọng (High)** | **Rất cao** | Triển khai ngay Task **P0-2** (Downsampling Time Buckets 15m/1h qua MongoDB Aggregation). Khống chế dải thời gian truy vấn thô tối đa 24 giờ nếu không chỉ định bucket. | `TelemetryController.java:39-57`<br>`05_p1_summary.md:59` `[XÁC NHẬN]` |
| **2** | **Cạn Kiệt MongoDB Connection Pool Khi Bão MQTT** | **Nghiêm trọng (High)** | **Trung bình** | Triển khai Task **P1-2**: Đặt Semaphore giới hạn số lượng Virtual Threads đồng thời ghi DB; bổ sung Caffeine RAM Cache cho `deviceRepository.findByHardwareId` để tránh truy vấn DB lặp lại. | `MqttConfig.java:43`<br>`03_docs.md:232-240` `[SUY LUẬN]` |
| **3** | **Treo Trình Duyệt Khi Vẽ Heatmap Đa Giác Trên Web** | **Trung bình (Medium)** | **Trung bình** | Render lớp Heatmap trên thẻ **HTML5 Canvas 2D / OffscreenCanvas** độc lập thay vì vẽ hàng nghìn DOM elements SVG. Áp dụng kỹ thuật clip theo `boundaryPolygon` của phòng `[SUY LUẬN: 06_references.md:288-292]`. | `Room.java:42`<br>`06_references.md:290` `[XÁC NHẬN]` |
| **4** | **Lệch Trạng Thái Thiết Bị Online/Offline Trong CSDL** | **Trung bình (Medium)** | **Rất cao** | Triển khai Task **P1-1** (Watchdog Scheduler 60s) để quét và đồng bộ cờ `connectionState = OFFLINE` trực tiếp vào MongoDB cho các node không có heartbeat quá 5 phút. | `DeviceService.java:231-234`<br>`01_code.md:315` `[XÁC NHẬN]` |
| **5** | **Rò Rỉ Token Khi Refresh (Token Replay Attack)** | **Thấp (Low)** | **Thấp** | Cơ chế Refresh Token Rotation (RTR) và Blacklist TTL trong `AuthenticationService.java:125-162` đã được kiểm thử 100% unit test. Cần bảo đảm Client lưu `refreshToken` an toàn trong `HttpOnly` Cookie. | `AuthenticationService.java:125`<br>`04_contract.md:12` `[XÁC NHẬN]` |

---

## 5. MỤC CÂU HỎI MỞ CẦN CHỦ DỰ ÁN QUYẾT ĐỊNH (DECISIONS REQUIRED)

Các câu hỏi chiến lược dưới đây cần sự định hướng và phê duyệt chính thức từ Chủ dự án để chốt phạm vi thực thi cho các bước tiếp theo:

1. **Quyết định Lựa chọn Công nghệ Realtime cho Giao diện**:
   - *Lựa chọn A*: **Spring WebSocket STOMP** (`/ws-aiot`) — Tương tự mô hình ThingsBoard. Ưu điểm: Hỗ trợ pub/sub linh hoạt theo từng phòng (`/topic/room.{roomId}`), truyền tin 2 chiều mượt mà. Nhược điểm: Cần quản lý vòng đời kết nối socket và heartbeat client.
   - *Lựa chọn B*: **Server-Sent Events (SSE)** (`/api/v1/telemetry/stream`) — Ưu điểm: Cực kỳ đơn giản, chạy trên HTTP/2 tiêu chuẩn, trình duyệt tự động kết nối lại khi mất mạng (auto-reconnect), không cần thư viện phụ trợ phức tạp. Nhược điểm: Chỉ truyền dữ liệu 1 chiều từ server xuống client.
   - *Câu hỏi*: **Chủ dự án phê duyệt lựa chọn nào (WebSocket STOMP hay SSE)?** `[CHƯA RÕ: 06_references.md:316-318]`.
2. **Quyết định Cơ chế Cấu hình Ngưỡng Cảnh báo (Alert Thresholds)**:
   - *Lựa chọn A*: Lưu động trong CSDL MongoDB gắn theo từng Document `Room` (thêm trường `Map<String, ThresholdRange> thresholds`). Cho phép thủ thư tùy biến ngưỡng ồn riêng cho từng loại phòng (ví dụ: phòng đọc tĩnh $<40\text{ dBA}$, phòng tự học nhóm $<60\text{ dBA}$).
   - *Lựa chọn B*: Áp dụng cố định theo cấu hình mã nguồn `RoomType` trong `ComfortScoreService.java` (không cần giao diện cấu hình ngưỡng, đơn giản hóa tối đa).
   - *Câu hỏi*: **Chủ dự án lựa chọn phương án A (linh hoạt theo phòng) hay phương án B (cố định theo code)?** `[CHƯA RÕ: 01_code.md:610-616]`.
3. **Quyết định Phạm vi Phân quyền Công cộng (Public Kiosk Mode)**:
   - *Câu hỏi*: Có cho phép sinh viên/bạn đọc vãng lai tra cứu điểm tiện nghi LCS của phòng đọc qua màn hình Kiosk đặt tại sảnh mà không cần đăng nhập tài khoản (Task P1-4) hay không? `[CHƯA RÕ: 06_references.md:325-327]`.
4. **Phê duyệt Thứ tự Triển khai (Roadmap Sign-off)**:
   - *Câu hỏi*: Chủ dự án có đồng thuận với thứ tự ưu tiên 4 tác vụ P0 (P0-1: Alert Backend, P0-2: Downsampling API, P0-3: Realtime Push, P0-4: Standardize API & Validation) làm điều kiện tiên quyết trước khi phát triển giao diện Web không? `[CHƯA RÕ]`.

---
*Báo cáo được hoàn thành và đối chiếu 100% dựa trên mã nguồn thực tế — Tuân thủ tuyệt đối quy tắc Read-Only, Bảo mật thông tin (che ***), và gắn nhãn minh chứng [XÁC NHẬN] / [SUY LUẬN] / [CHƯA RÕ] trên toàn bộ các nhận định kỹ thuật.*
