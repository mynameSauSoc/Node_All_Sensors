# ĐẶC TẢ TÍCH HỢP HỆ THỐNG VÀ TIẾN TRÌNH NỀN (INTEGRATION & BACKGROUND PROCESSES)

> **Thuộc tài liệu:** Bộ Tài liệu Nghiệp vụ AIoTLibTQB  
> **Tài liệu cha:** [00_TONG_QUAN.md](00_TONG_QUAN.md)  
> **Nhãn truy vết:**  
> - `[Code]`: Kiểm chứng trực tiếp từ mã nguồn thực tế backend Spring Boot.  
> - `[Tài liệu]`: Trích xuất từ tài liệu đặc tả dự án (`IOT_SYSTEM_SPECIFICATION.md`, `KE_HOACH_TRIEN_KHAI_PHAN_MEM_IOT.md`, `HUONG_DAN_THUC_HIEN_VA_CAN_NHAC_GIAI_PHAP.md`).  
> - `[Suy luận]`: Phân tích nghiệp vụ và kiến trúc kỹ thuật.  
> - `[Chưa rõ]`: Điểm cần xác nhận thêm từ Product Owner.

---

## 1. TIẾN TRÌNH NỀN (SCHEDULED BACKGROUND JOBS)

Hệ thống AIoTLibTQB kích hoạt tính năng tiến trình nền thông qua annotation `@EnableScheduling` trên lớp khởi động chính `AIoTLibTQBApplication.java` (dòng 9) `[Code: AIoTLibTQBApplication.java:9]`.

### 1.1. Tiến trình Quét Dọn Token Quá Hạn (`cleanExpiredTokens`)
- **Vị trí cài đặt:** `AuthenticationService.java` (dòng 238-242) `[Code: AuthenticationService.java:238-242]`.
- **Lịch biểu kích hoạt (Cron Expression):**
  `@Scheduled(cron = "0 0 2 * * ?")`
  - Chạy đều đặn mỗi ngày một lần vào đúng **02:00:00 sáng** (theo múi giờ của máy chủ).
- **Mục đích nghiệp vụ:**
  Thu dọn triệt để các mã nhận diện token đã bị thu hồi (`invalidated_tokens`) mà thời hạn sống thực tế của token đã trôi qua (`expiryTime < new Date()`), giải phóng bộ nhớ lưu trữ và giảm kích thước bảng chỉ mục B-Tree trên CSDL MongoDB `[Code: AuthenticationService.java:240]`.
- **Dữ liệu đầu vào & Thao tác CSDL:**
  - Gọi Repository: `invalidatedTokenRepository.deleteByExpiryTimeBefore(new Date())` `[Code: InvalidatedTokenRepository.java:10]`.
  - Điều kiện lọc: `expiryTime: { $lt: new Date() }`.
- **Cơ chế phòng thủ chuyên sâu (Defense in Depth):**
  - Thực thể `InvalidatedToken` đã được cài đặt chỉ mục tự hủy cấp CSDL: `@Indexed(expireAfter = "0s") Date expiryTime` `[Code: InvalidatedToken.java:22-23]`.
  - `[Suy luận]`: Cơ chế kết hợp kép này đảm bảo:
    1. Background thread nội bộ của MongoDB tự động xóa bản ghi định kỳ (thường là mỗi 60 giây).
    2. Scheduled Cron Job lúc 02:00 sáng quét vét dự phòng trong các trường hợp chỉ mục MongoDB TTL bị chậm do nghẽn tải I/O hoặc xung đột đồng hồ hệ thống.
- **Xử lý lỗi & Ghi log:**
  - Nếu thành công: Ghi log `log.info("Cleaned up expired invalidated tokens")`.
  - Nếu xảy ra lỗi kết nối CSDL: Ngoại lệ DataAccessException được Spring bắt và in stack trace ra log hệ thống, không làm dừng ứng dụng.

---

## 2. BỘ LẮNG NGHE & KÊNH TIẾP VẬN THÔNG ĐIỆP (MESSAGE LISTENERS & ADAPTERS)

Hệ thống sử dụng **Spring Integration MQTT** (`spring-integration-mqtt` và Eclipse Paho Client `1.2.5`) để kết nối liên tục với MQTT Broker `[Code: pom.xml:97-105, MqttConfig.java:1-61]`.

```mermaid
flowchart TD
    subgraph EdgeStation["Mạng Lưới Trạm Phần Cứng"]
        ESP1["Trạm ESP32-S3 Phòng 101"]
        ESP2["Trạm ESP32-S3 Phòng 102"]
        ESP_N["Trạm ESP32-S3 Phòng N"]
    end

    subgraph MosquittoLayer["MQTT Broker (Eclipse Mosquitto 2.0)"]
        TopicTel["Topic: devices/+/telemetry (QoS 1)"]
        TopicStat["Topic: devices/+/status (QoS 1)"]
    end

    subgraph SpringIntegration["Spring Integration Inbound Pipeline"]
        Adapter["MqttPahoMessageDrivenChannelAdapter\n(ClientId: aiot_backend_consumer)"]
        Channel["mqttInboundChannel\n(ExecutorSubscribableChannel)"]
        VThreads["Java 21 Virtual Threads Pool\n(Executors.newVirtualThreadPerTaskExecutor())"]
    end

    subgraph DispatcherService["Bộ Điều Phối Ingestion"]
        Dispatcher["MqttMessageDispatcherService#dispatch\n(@ServiceActivator)"]
        StatusBranch["handleStatusMessage\n(Regex: ^devices/([^/]+)/status$)"]
        TelemetryBranch["handleTelemetryMessage\n(Regex: ^devices/([^/]+)/telemetry$)"]
    end

    ESP1 & ESP2 & ESP_N -- "PUBLISH (QoS 1)" --> TopicTel & TopicStat
    TopicTel & TopicStat --> Adapter
    Adapter --> Channel
    Channel --> VThreads
    VThreads --> Dispatcher
    Dispatcher --> StatusBranch & TelemetryBranch
```

---

### 2.1. Cấu hình Kênh Inbound & Luồng Ảo Java 21 (`MqttConfig.java`)
- **Nhà máy kết nối Paho (`MqttPahoClientFactory`):**
  - Cấu hình qua `MqttConnectOptions` `[Code: MqttConfig.java:27-39]`:
    - `serverURIs`: Đọc từ cấu hình `mqtt.broker-url` (mặc định: `tcp://localhost:1883`) `[Code: MqttProperties.java:15]`.
    - `userName` / `password`: `aiot_backend` / `aiot_backend_secret` `[Code: MqttProperties.java:17-18]`.
    - `cleanSession = true`: Không duy trì session cũ khi kết nối lại.
    - `automaticReconnect = true`: Tự động phục hồi kết nối TCP socket khi Broker gặp sự cố khởi động lại.
    - `keepAliveInterval = 30` giây: Gửi gói tin PingREQ định kỳ giữ thông tuyến mạng.
    - `connectionTimeout = 10` giây: Giới hạn thời gian bắt tay kết nối.
- **Kênh thông điệp Luồng Ảo (`mqttInboundChannel`):**
  ```java
  @Bean
  public MessageChannel mqttInboundChannel() {
      return new ExecutorSubscribableChannel(Executors.newVirtualThreadPerTaskExecutor());
  }
  ```
  `[Code: MqttConfig.java:41-44]`.
  - `[Suy luận]`: Cấu hình này tạo ra một kênh phân phối tin nhắn bất đồng bộ mà mỗi thông điệp đi vào sẽ được phục vụ bởi một **Java 21 Virtual Thread** độc lập. Giúp giải phóng toàn bộ Platform OS Threads khi thực thi các thao tác I/O như truy vấn CSDL MongoDB hay xử lý làm sạch dữ liệu.
- **Inbound Message Driven Channel Adapter:**
  - Lắng nghe 2 chủ đề (Topics) dạng wildcard cấp đơn lẻ (`+`) `[Code: MqttConfig.java:47-60]`:
    1. `devices/+/telemetry`: Tiếp nhận chuỗi số đo quan trắc.
    2. `devices/+/status`: Tiếp nhận thông báo sống còn và bản tin di chúc LWT.
  - `adapter.setQos(1)`: Đảm bảo độ tin cậy vận chuyển "At least once delivery".
  - `adapter.setCompletionTimeout(5000)`: Chờ tối đa 5000ms cho việc xác nhận gói tin.

---

### 2.2. Bộ Điều Phối Xử Lý Thông Điệp (`MqttMessageDispatcherService.java`)
- **Kích hoạt Service Activator:**
  `@ServiceActivator(inputChannel = "mqttInboundChannel") public void dispatch(Message<?> message)` `[Code: MqttMessageDispatcherService.java:47-82]`.
- **Giải mã Payload:** Hỗ trợ tự động chuyển đổi payload nhận được từ mảng byte (`byte[]`) sang chuỗi UTF-8 JSON `[Code: MqttMessageDispatcherService.java:57-59]`.
- **Cơ chế Phân luồng theo Regex:**
  1. **Nhánh Status (`STATUS_TOPIC_PATTERN`):**
     - Mẫu khớp: `^devices/([^/]+)/status$` `[Code: MqttMessageDispatcherService.java:44]`.
     - Gọi `handleStatusMessage(topicHardwareId, payloadStr)`.
     - Phân tích bản tin `online`/`offline`, cập nhật nguyên tử `connectionState` trong MongoDB `devices` `[Code: dòng 84-125]`.
  2. **Nhánh Telemetry (`TELEMETRY_TOPIC_PATTERN`):**
     - Mẫu khớp: `^devices/([^/]+)/telemetry$` `[Code: MqttMessageDispatcherService.java:45]`.
     - Gọi `handleTelemetryMessage(topicHardwareId, payloadStr)`.
     - Thực hiện làm sạch dữ liệu qua `TelemetrySanitizerService`, kẹp thời gian đo và lưu vào `telemetry_records` `[Code: dòng 127-199]`.
- **Cơ chế Chống Đổ Vỡ (Fault-Tolerance & Resilience):**
  Toàn bộ phương thức `dispatch` và các hàm con được bao bọc trong các khối `try - catch (Exception e)` độc lập. Nếu một thông điệp bị lỗi định dạng JSON, sai dữ liệu hoặc lỗi CSDL, hệ thống chỉ ghi log cảnh báo cấp độ `ERROR` kèm chi tiết topic/payload và kết thúc Virtual Thread đó một cách an toàn mà **không làm chết luồng Inbound Adapter**, đảm bảo các gói tin tiếp theo vẫn được tiêu thụ bình thường `[Code: dòng 78-81, 122-124, 196-198]`.

---

## 3. TÍCH HỢP HỆ THỐNG NGOÀI (EXTERNAL INTEGRATIONS)

### 3.1. Máy Chủ Điều Phối Tin Nhắn (Eclipse Mosquitto 2.0 Broker)
- **Phương thức triển khai:** Khởi chạy dưới dạng Docker container `aiot_mosquitto` `[Code: docker-compose.yml:43-57]`.
- **Cổng giao tiếp:** Port `1883` (chuẩn MQTT over TCP).
- **Hồ sơ cấu hình bảo mật (`mosquitto/config/`):**
  1. `mosquitto.conf`:
     - Khóa truy cập nặc danh: `allow_anonymous false` `[Code: mosquitto.conf:14]`.
     - Định tuyến file mật khẩu: `password_file /mosquitto/config/password.txt`.
     - Định tuyến file phân quyền: `acl_file /mosquitto/config/acl.conf`.
     - Lưu trữ trạng thái bền vững: `persistence true`, ghi vào volume `mosquitto_data`.
  2. `acl.conf` (Quy tắc phân quyền kênh truyền):
     - Tài khoản Backend (`aiot_backend`) và Admin (`admin`): Toàn quyền đọc/ghi trên mọi topic (`topic readwrite #`) `[Code: acl.conf:4-9]`.
     - Thiết bị phần cứng trạm đo: Phân quyền động theo tên tài khoản đã đăng nhập (`%u`) `[Code: acl.conf:11-13]`:
       * Chỉ được quyền **ghi (PUBLISH)** vào các topic con của chính nó: `pattern write devices/%u/#`.
       * Chỉ được quyền **đọc (SUBSCRIBE)** các bản tin lệnh điều khiển gửi riêng cho nó: `pattern read devices/%u/command`.
       * **[Suy luận]**: Ngăn chặn trạm này đọc trộm dữ liệu cảm biến của trạm khác hoặc spam thông điệp giả mạo vào hàng đợi của hệ thống.
  3. `password.txt`: Lưu trữ danh sách thông tin tài khoản nội bộ cho Backend và quản trị viên Mosquitto.

---

### 3.2. Cơ Sở Dữ Liệu Tài Liệu & Chuỗi Thời Gian (MongoDB 8.0)
- **Phương thức triển khai:** Docker container `aiot_mongodb` (`mongo:8.0`) `[Code: docker-compose.yml:4-24]`.
- **Cổng kết nối:** Port `27017`.
- **URI kết nối Backend:**
  `mongodb://root:root@localhost:27017/aiot_identity_db?authSource=admin` `[Code: application.yaml:7]`.
- **Cấu hình chỉ mục tự động:**
  `spring.data.mongodb.auto-index-creation: true` `[Code: application.yaml:8]`. Khi ứng dụng Spring Boot khởi động, các chỉ mục `@Indexed(unique = true)` (trên `username`, `hardwareId`, `code`) và chỉ mục TTL (`expireAfter = "0s"` trên `expiryTime`) được MongoDB tự động kiến tạo.
- **Công cụ Quản trị Trực quan:** Docker service `mongo-express:1.0.2` lắng nghe tại port `8081` `[Code: docker-compose.yml:25-42]`.

---

## 4. CÁC HẠNG MỤC TÍCH HỢP ĐANG CHỜ TRIỂN KHAI (PENDING / PLANNED INTEGRATIONS)

Dựa trên đối soát giữa mã nguồn và tài liệu kiến trúc, các thành phần sau hiện đang ở dạng khung chờ hoặc phụ thuộc chưa kích hoạt:

### 4.1. Hạ tầng Truyền phát Thời Gian Thực WebSocket STOMP
- `[Code]`: Thư viện `spring-boot-starter-websocket` đã có sẵn trong `pom.xml` (dòng 108-111).
- `[Chưa rõ / Code]`: Trong toàn bộ thư mục `src/main/java` hiện **hoàn toàn chưa có** lớp cấu hình WebSocket (`@EnableWebSocketMessageBroker`, `WebSocketMessageBrokerConfigurer`) hay bộ điều khiển tin nhắn `@MessageMapping`.
- `[Tài liệu: HUONG_DAN_THUC_HIEN_VA_CAN_NHAC_GIAI_PHAP.md: Bước 6]`:
  Theo kế hoạch, backend sẽ mở endpoint WebSocket `/ws-aiot` với giao thức STOMP để truyền luồng số đo vi khí hậu trực tiếp lên Web Dashboard với cơ chế gộp tin (Conflation/Throttling 1Hz) nhằm chống quá tải giật lag giao diện (DOM Thrashing).

### 4.2. Bộ Tạo Cảnh Báo Tự Động (Alert Notification Integrations)
- `[Code]`: Entity `Alert` và `AlertRepository` đã sẵn sàng trong mã nguồn.
- `[Chưa rõ / Code]`: Hiện tại chưa có dịch vụ nền nào đánh giá ngưỡng vi phạm để tự động phát tin cảnh báo ra bên ngoài.
- `[Tài liệu: IOT_SYSTEM_SPECIFICATION.md:151-154]`:
  Kế hoạch kiến trúc yêu cầu kết nối với **Telegram Bot API** để gửi tin nhắn khẩn cấp kèm vị trí phòng vi phạm tiếng ồn/ô nhiễm bụi tới bảo vệ và thủ thư trực ban.
