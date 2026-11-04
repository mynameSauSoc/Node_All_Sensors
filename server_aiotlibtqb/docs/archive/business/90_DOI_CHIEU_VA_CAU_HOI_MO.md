# BÁO CÁO ĐỐI SOÁT TÀI LIỆU, MÃ DỞ DANG VÀ DANH SÁCH CÂU HỎI MỞ

> **Thuộc tài liệu:** Bộ Tài liệu Nghiệp vụ AIoTLibTQB  
> **Tài liệu cha:** [00_TONG_QUAN.md](00_TONG_QUAN.md)  
> **Nhãn truy vết:**  
> - `[Code]`: Kiểm chứng trực tiếp từ mã nguồn thực tế backend Spring Boot.  
> - `[Tài liệu]`: Trích xuất từ tài liệu đặc tả dự án (`IOT_SYSTEM_SPECIFICATION.md`, `KE_HOACH_TRIEN_KHAI_PHAN_MEM_IOT.md`, `ORIGINAL_REQUEST.md`).  
> - `[Suy luận]`: Phân tích nghiệp vụ và kiến trúc kỹ thuật.  
> - `[Chưa rõ]`: Điểm cần xác nhận thêm từ Product Owner.

---

## 1. BẢNG ĐỐI CHIẾU SAI LỆCH GIỮA TÀI LIỆU ĐẶC TẢ CŨ VÀ MÃ NGUỒN THỰC TẾ

Quá trình đọc ngược (Reverse Engineering) toàn bộ mã nguồn dự án đã phát hiện **6 điểm sai lệch cốt lõi** giữa các tài liệu đặc tả thiết kế cũ (`IOT_SYSTEM_SPECIFICATION.md`, `KE_HOACH_TRIEN_KHAI_PHAN_MEM_IOT.md`, `ORIGINAL_REQUEST.md`) so với hiện trạng mã nguồn Java đang chạy thực tế:

| STT | Thành phần / Nghiệp vụ | Nội dung trong Tài liệu Cũ (`[Tài liệu]`) | Hiện trạng thực tế trong Mã nguồn (`[Code]`) | Đánh giá & Rủi ro Kiến trúc (`[Suy luận]`) |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Công nghệ CSDL Lưu trữ Chuỗi Thời gian** | Đề xuất sử dụng **PostgreSQL + TimescaleDB** cho bảng `telemetry_data` `[Tài liệu: IOT_SYSTEM_SPECIFICATION.md:34-36, 175-182]`. | Toàn bộ hệ thống chạy trên **MongoDB 8.0**, sử dụng tính năng **Native TimeSeries collection** `@TimeSeries` cho `telemetry_records` `[Code: TelemetryRecord.java:12-18]`. | [Code] là quyết định kiến trúc chính xác nhằm đơn giản hóa hạ tầng, tránh vận hành cùng lúc 2 hệ CSDL (Polyglot Persistence) không cần thiết. |
| **2** | **Xử lý Dấu thời gian Đo (Timestamp Parsing)** | Yêu cầu phân biệt cả epoch 10 số (giây) và 13 số (mili-giây); bảo lưu dấu thời gian lịch sử của trạm lưu đệm ngoại tuyến (> 1 giờ) `[Tài liệu: ORIGINAL_REQUEST.md:12-14]`. | `MqttMessageDispatcherService.java:167` chỉ gọi `Instant.ofEpochSecond()`. Nếu trạm gửi epoch mili-giây hoặc trễ quá 1 giờ $\rightarrow$ bị kẹp cưỡng bức về `Instant.now()` `[Code: dòng 168-171]`. | [Chưa rõ] Trạm IoT gửi mili-giây sẽ bị nhận diện sai lệch thành thời gian ở tương lai xa (+56,000 năm) và bị ép về giờ hiện tại. Mất khả năng lưu trữ đúng thời gian của dữ liệu gửi bù Store-and-Forward. |
| **3** | **Loại trừ Xung Âm Đỉnh (`noisePeak`)** | Yêu cầu loại trừ `noisePeak` khỏi cơ chế Forward-fill vì xung âm biến thiên tức thời, không kéo dài `[Tài liệu: ORIGINAL_REQUEST.md:16-18]`. | `TelemetrySanitizerService.java:62` vẫn gọi `sanitizeField` cho `acoustics.noisePeak` giống hệt các cảm biến nhiệt ẩm khác `[Code: dòng 62]`. | [Chưa rõ] Nếu cảm biến âm thanh bị lỗi tạm thời trong 30s sau một tiếng động lớn (kéo ghế, va đập), giá trị đỉnh ồn sẽ bị điền bù kéo dài, dễ kích hoạt báo động giả `FIRING`. |
| **4** | **Lọc Bản ghi Đo Rỗng (Empty Record Filter)** | Yêu cầu hủy bỏ bản tin (discard payload) nếu cả 3 cụm metrics (âm học, bụi, môi trường) đều null `[Tài liệu: ORIGINAL_REQUEST.md:20-22]`. | `MqttMessageDispatcherService.java:179-195` vẫn khởi tạo và lưu `TelemetryRecord` vào MongoDB ngay cả khi cả 3 trường này đều là `null` `[Code: dòng 179-192]`. | [Suy luận] Làm phình to dung lượng TimeSeries collection bằng các bản ghi rác không mang giá trị đo lường thực tế. |
| **5** | **Kiểm soát Tải Đa luồng (Concurrency Throttling)** | Yêu cầu thiết lập Bounded Thread Pool cho MQTT và bóp tần suất cập nhật `lastSeenAt` (chỉ cập nhật nếu trôi quá 30-60s) `[Tài liệu: ORIGINAL_REQUEST.md:24-26]`. | `MqttConfig.java:43` cấp phát Virtual Threads không giới hạn; `MqttMessageDispatcherService.java:153-157` gọi `updateFirst` cập nhật `lastSeenAt` trên **mọi bản tin** đến `[Code: dòng 153]`. | [Suy luận] Gây hiện tượng khuếch đại ghi (Write Amplification) lên MongoDB `devices` collection khi hàng loạt trạm phát bản tin cùng lúc. |
| **6** | **Chỉ số Tiện nghi Thư viện (Comfort Score)** | Đưa ra công thức chuẩn hóa hàm phạt liên tục $C^0$ tính điểm tiện nghi thư viện LCS từ 0 đến 100 `[Tài liệu: KE_HOACH_TRIEN_KHAI_PHAN_MEM_IOT.md:90-100]`. | Lớp `ComfortScoreRecord` đã được định nghĩa nhưng trong `MqttMessageDispatcherService` **hoàn toàn bị bỏ qua (null)** khi lưu `TelemetryRecord` `[Code: dòng 179-192]`. | [Chưa rõ] Dữ liệu LCS trên toàn bộ hệ thống hiện đang bị rỗng (null), chưa có Service tính toán tự động khi dữ liệu đổ về. |

---

## 2. DANH MỤC TÍNH NĂNG DỞ DANG VÀ MÃ NGUỒN CHỜ (PENDING / DEAD CODE)

Quá trình quét mã nguồn ghi nhận **4 hạng mục** đã được khai báo scaffolding nhưng chưa được hiện thực hóa logic nghiệp vụ:

### 2.1. Hệ Sinh Thái Cảnh Báo Vi Khí Hậu & Âm Học (Alert Subsystem)
- **Hiện trạng trong Code:**
  - Thực thể CSDL: `com.example.AIoTLibTQB.document.Alert` đã được thiết kế hoàn chỉnh `[Code: Alert.java:14-52]`.
  - Repository: `com.example.AIoTLibTQB.repository.AlertRepository` với 5 phương thức tra cứu theo `deviceId`, `roomId`, `status` `[Code: AlertRepository.java:13-25]`.
  - Enums: `AlertStatus` (`PENDING`, `FIRING`, `ACKNOWLEDGED`, `RESOLVED`) và `AlertType` (`NOISE_EXCEEDED`, `AIR_UNHEALTHY`, `DEVICE_OFFLINE`, `SENSOR_MALFUNCTION`) `[Code: AlertStatus.java:3-8, AlertType.java:3-8]`.
  - Mã lỗi: `ErrorCode.ALERT_NOT_EXISTED` (Mã 6001, HTTP 404) `[Code: ErrorCode.java:49]`.
  - Quyền hạn: Đã seed 3 quyền `VIEW_ALERTS`, `ACKNOWLEDGE_ALERT`, `MANAGE_ALERT_CONFIG` `[Code: ApplicationInitConfig.java:51-57]`.
- **Điểm thiếu hụt:**
  - **Không có `AlertService` và không có `AlertController`**.
  - Không có logic kích hoạt phát sinh cảnh báo trong `MqttMessageDispatcherService` khi số đo vượt ngưỡng.
- **Phân loại:** **[Code: Chức năng dở dang - Pending Phase 2]**.

---

### 2.2. Thư Viện WebSocket STOMP trong `pom.xml`
- **Hiện trạng trong Code:**
  - `pom.xml` (dòng 108-111) khai báo thư viện:
    ```xml
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-websocket</artifactId>
    </dependency>
    ```
- **Điểm thiếu hụt:**
  - Trong toàn bộ cây thư mục `src/main/java` **hoàn toàn không có bất kỳ file cấu hình hay mã nguồn nào** liên quan đến WebSocket (không có `@EnableWebSocketMessageBroker`, `WebSocketConfig`, `ChannelInterceptor`, `@MessageMapping`).
- **Phân loại:** **[Code: Dead Dependency]**. Thư viện này làm tăng nhẹ kích thước gói build và thời gian quét classpath nhưng không tạo ra bất kỳ endpoint runtime nào.

---

### 2.3. Thuật Toán Tính Điểm Tiện Nghi (`ComfortScoreRecord`)
- **Hiện trạng trong Code:**
  - Thực thể `ComfortScoreRecord.java` đã sẵn sàng với 6 trường: `overall`, `grade`, `acousticScore`, `airScore`, `thermalScore`, `lightScore` `[Code: ComfortScoreRecord.java:11-19]`.
  - Được nhúng trong `TelemetryRecord` và `TelemetryResponse` `[Code: TelemetryRecord.java:39, TelemetryResponse.java:22]`.
- **Điểm thiếu hụt:**
  - Khi lưu `TelemetryRecord` tại `MqttMessageDispatcherService.java:179-192`, trường này bị bỏ qua không gán, dẫn đến mọi bản ghi trong MongoDB đều có `comfortScore = null`.
- **Phân loại:** **[Code: Pending Calculation Engine]**.

---

### 2.4. Khả Năng Mở Rộng Runtime Documentation (Swagger / OpenAPI)
- **Hiện trạng trong Code:**
  - Tệp `pom.xml` không chứa thư viện `springdoc-openapi-starter-webmvc-ui`.
  - Ứng dụng khi chạy thực tế không cung cấp giao diện `/swagger-ui.html` hay `/v3/api-docs` `[Ghi nhận: Chưa xác minh runtime qua Swagger UI]`.
- **Phân loại:** **[Code: Thiếu công cụ tài liệu hóa Runtime]**. Toàn bộ việc đối soát API trong hồ sơ này được thực hiện qua mã nguồn Controller, SecurityConfig và bộ kiểm thử `AIoTLibTQB_Postman_Collection.json`.

---

## 3. DANH SÁCH MỤC [SUY LUẬN] CẦN LÃNH ĐẠO / PO XÁC NHẬN

1. **[Suy luận: Kiến trúc Token]**: Quyết định thiết lập Access Token sống ngắn (1 giờ) và Refresh Token sống dài (24 giờ) xoay vòng một lần (Rotation) là giải pháp tối ưu cho Web Dashboard, tuy nhiên với ứng dụng di động của sinh viên/độc giả, thời hạn 24 giờ có thể khiến người dùng bị yêu cầu đăng nhập lại mỗi ngày. Cần xác nhận có nên nâng thời hạn Refresh Token lên 7 hoặc 30 ngày cho Mobile Client không?
2. **[Suy luận: Lưu trữ Token Blacklist]**: Việc kiểm tra danh sách thu hồi trực tiếp qua CSDL MongoDB (`invalidatedTokenRepository.existsById(jwtId)`) trên **từng request nghiệp vụ** có thể trở thành nút thắt cổ chai I/O khi lưu lượng truy cập lớn. Có nên bổ sung bộ nhớ đệm phân tán Redis (hoặc Caffeine cục bộ) phía trước không?
3. **[Suy luận: Toàn vẹn Dữ liệu Phòng & Trạm]**: Khi Quản trị viên xóa một phòng đọc (`DELETE /api/v1/rooms/{id}`), mã nguồn hiện tại không kiểm tra xem phòng có chứa trạm cảm biến nào không. Hệ quả là các thiết bị trong phòng đó sẽ bị lưu trường `roomId` tham chiếu tới một ID không còn tồn tại (Mồ côi phòng). Cần bổ sung luật chặn xóa phòng nếu phòng đang có thiết bị gắn kèm?
4. **[Suy luận: Virtual Threads & Kết nối MongoDB]**: Kênh `mqttInboundChannel` sử dụng luồng ảo Java 21 không giới hạn số lượng (`newVirtualThreadPerTaskExecutor()`). Khi xảy ra bão bản tin (hàng trăm trạm phát sóng đồng thời sau sự cố mất điện), số lượng Virtual Threads tăng vọt có thể làm cạn kiệt MongoDB Connection Pool (mặc định 100 kết nối). Cần xem xét áp dụng Semaphore hoặc Bounded Queue để bảo vệ Connection Pool?

---

## 4. TOP 10 CÂU HỎI QUAN TRỌNG NHẤT CẦN PRODUCT OWNER / LEAD KỸ THUẬT TRẢ LỜI

Dưới đây là 10 câu hỏi mở có tác động lớn nhất đến tính chính xác nghiệp vụ và độ ổn định của hệ thống:

### Câu hỏi 1 (Định dạng Thời gian Cảm biến - R1):
> *Trạm phần cứng ESP32-S3 thực tế đang gửi `timestamp` dưới dạng Unix Epoch giây (10 chữ số) hay mili-giây (13 chữ số)? Nếu gửi mili-giây, hệ thống hiện đang kẹp sai toàn bộ về thời gian máy chủ `now`.*

### Câu hỏi 2 (Dữ liệu Ngoại tuyến Store-and-Forward - R1):
> *Khi trạm đo bị mất mạng Wi-Fi vài giờ và lưu đệm dữ liệu vào Flash, khi có mạng trở lại, trạm sẽ gửi dồn toàn bộ dữ liệu lịch sử cũ lên Broker. Hệ thống có bắt buộc phải lưu đúng thời điểm đo gốc trong quá khứ của trạm hay tiếp tục kẹp về `server now` như code hiện tại?*

### Câu hỏi 3 (Quy tắc Xung Âm Đỉnh - R2):
> *Số đo mức ồn đỉnh `noisePeak` có được phép điền bù (Forward-fill) 30 giây khi gói tin sau bị null hay bắt buộc phải loại trừ (bỏ trống nếu cảm biến không gửi số đo mới) để tránh kích hoạt báo động giả?*

### Câu hỏi 4 (Loại bỏ Bản ghi Cảm biến Rỗng - R3):
> *Trong trường hợp trạm gửi bản tin Telemetry mà cả 3 cụm chỉ số (âm học, bụi, nhiệt ẩm) đều là `null` (ví dụ do đứt cáp nguồn cảm biến), hệ thống nên **hủy bỏ bản tin (discard)** hay vẫn tiếp tục lưu bản ghi rỗng vào MongoDB TimeSeries như hiện tại?*

### Câu hỏi 5 (Bóp Tần Suất Cập Nhật LastSeen - R4):
> *Mỗi bản tin cảm biến gửi về (chu kỳ 5s) hiện đều kích hoạt một câu lệnh `updateFirst` ghi vào bảng `devices` để cập nhật `lastSeenAt`. Có cần bóp tần suất này (chỉ ghi đè DB nếu thiết bị đã im lặng quá 30 - 60 giây) để giảm tải đĩa ghi cho CSDL không?*

### Câu hỏi 6 (Hiện thực hóa Phân hệ Cảnh báo - Alert):
> *Hệ sinh thái `Alert` (Document, Repository, Enums) đã có sẵn nhưng chưa nối vào luồng xử lý. Kế hoạch triển khai Rule Engine phát hiện cảnh báo theo trễ Hysteresis và kênh thông báo ra ngoài (WebSocket Notification / Telegram Bot) được xếp vào Sprint nào?*

### Câu hỏi 7 (Kích hoạt Điểm Tiện Nghi - LCS Engine):
> *Công thức tính điểm tiện nghi thư viện LCS (0 - 100 điểm) có cần được kích hoạt chạy tự động ngay trong luồng `MqttMessageDispatcherService` trước khi lưu vào MongoDB TimeSeries hay sẽ được tính toán định kỳ qua một Job thống kê riêng biệt?*

### Câu hỏi 8 (Triển khai WebSocket STOMP):
> *Thư viện `spring-boot-starter-websocket` trong `pom.xml` hiện chưa có mã nguồn kích hoạt. Giao diện Web Dashboard mặt bằng nhiệt (Heatmap) dự kiến sẽ kéo dữ liệu qua cơ chế Polling REST API hay bắt buộc phải thiết lập STOMP over WebSocket tại `/ws-aiot`?*

### Câu hỏi 9 (Ràng buộc Khi Xóa Phòng & Xóa Vai trò):
> *Khi xóa một `Role`, có cần tự động thu hồi Role đó khỏi tất cả người dùng liên quan? Và khi xóa một `Room`, có cần bắt buộc di chuyển toàn bộ trạm đo trong phòng đó sang trạng thái "Chưa gán phòng" trước khi cho phép xóa?*

### Câu hỏi 10 (Tích hợp Swagger UI):
> *Đội ngũ phát triển Frontend có yêu cầu tích hợp thư viện `springdoc-openapi-starter-webmvc-ui` vào `pom.xml` để tự động sinh tài liệu API tương tác tại `/swagger-ui.html` cho môi trường Dev/Staging hay tiếp tục sử dụng Postman Collection?*
