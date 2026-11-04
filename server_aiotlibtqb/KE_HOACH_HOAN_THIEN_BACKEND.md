# KẾ HOẠCH TRIỂN KHAI HOÀN THIỆN BACKEND HỆ THỐNG AIoTLibTQB
## Lộ Trình Chuyển Đổi Từ Lõi Xử Lý IoT Sang Sản Phẩm Hoàn Chỉnh (MVP / Production-Ready)

> **Mã kế hoạch:** `PLAN-BACKEND-COMPLETION-2026-V1.0`  
> **Hệ sinh thái:** AIoTLibTQB (Hệ thống IoT Giám sát Vi khí hậu & Âm học Thư viện Thông minh)  
> **Nền tảng công nghệ:** Java 21 LTS (Virtual Threads) | Spring Boot 3.5.8 | MongoDB 8.0 (Native TimeSeries) | Eclipse Mosquitto 2.0 (MQTT QoS 1) | Nimbus JOSE JWT HS512  
> **Chiến lược tiếp cận:** **Xây dựng sản phẩm hoàn thiện tương đối trước (MVP Chạy được End-to-End)** $\rightarrow$ **Tiến hành đo đạc, kiểm thử và điều chỉnh tối ưu hóa sau**.

---

## MỤC LỤC
1. [TỔNG QUAN HIỆN TRẠNG & MỤC TIÊU DỰ ÁN](#1-tổng-quan-hiện-trạng--mục-tiêu-dự-án)
2. [MA TRẬN HẠNG MỤC CÔNG VIỆC GIAI ĐOẠN 1 (BẮT BUỘC ĐỂ CÓ SẢN PHẨM CHẠY ĐƯỢC)](#2-ma-trận-hạng-mục-công-việc-giai-đoạn-1-bắt-buộc-để-có-sản-phẩm-chạy-được)
3. [ĐẶC TẢ KỸ THUẬT CHI TIẾT TỪNG PHÂN HỆ GIAI ĐOẠN 1](#3-đặc-tả-kỹ-thuật-chi-tiết-từng-phân-hệ-giai-đoạn-1)
   - [Nhiệm vụ 1: Hoàn thiện Phân hệ Cảnh báo (Alert Subsystem)](#nhiệm-vụ-1-hoàn-thiện-phân-hệ-cảnh-báo-alert-subsystem)
   - [Nhiệm vụ 2: Kích hoạt Kênh Đẩy Dữ liệu Thời gian thực (Realtime WebSocket STOMP)](#nhiệm-vụ-2-kích-hoạt-kênh-đẩy-dữ-liệu-thời-gian-thực-realtime-websocket-stomp)
   - [Nhiệm vụ 3: Tiến trình Nền Giám sát Thiết bị Ngoại tuyến (Device Offline Watchdog)](#nhiệm-vụ-3-tiến-trình-nền-giám-sát-thiết-bị-ngoại-tuyến-device-offline-watchdog)
   - [Nhiệm vụ 4: API Nén Chuỗi Thời Gian Vẽ Biểu Đồ (TimeSeries Downsampling Buckets)](#nhiệm-vụ-4-api-nén-chuỗi-thời-gian-vẽ-biểu-đồ-timeseries-downsampling-buckets)
   - [Nhiệm vụ 5: Chuẩn hóa Hợp đồng REST API, Phân trang & Validation](#nhiệm-vụ-5-chuẩn-hóa-hợp-đồng-rest-api-phân-trang--validation)
   - [Nhiệm vụ 6: Bảo vệ Tải Hạ tầng & Caching Trong Luồng Ingestion](#nhiệm-vụ-6-bảo-vệ-tải-hạ-tầng--caching-trong-luồng-ingestion)
4. [GIAI ĐOẠN 2: CÁC HẠNG MỤC MỞ RỘNG & TINH CHỈNH TIẾP THEO](#4-giai-đoạn-2-các-hạng-mục-mở-rộng--tinh-chỉnh-tiếp-theo)
5. [LỊCH TRÌNH THỰC HIỆN VÀ PHÂN BỔ NGUỒN LỰC (SPRINTS)](#5-lịch-trình-thực-hiện-và-phân-bổ-nguồn-lực-sprints)
6. [TIÊU CHÍ NGHIỆM THU ĐỊNH LƯỢNG (DEFINITION OF DONE - DoD)](#6-tiêu-chí-nghiệm-thu-định-lượng-definition-of-done---dod)

---

## 1. TỔNG QUAN HIỆN TRẠNG & MỤC TIÊU DỰ ÁN

### 1.1. Hiện Trạng Backend Đã Có (Core Foundation)
Backend AIoTLibTQB hiện đã sở hữu một kiến trúc nền tảng rất vững chắc:
- **Pipeline Tiếp nhận MQTT Tốc độ cao:** Sử dụng Spring Integration kết hợp Java 21 Virtual Threads ([`MqttConfig.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/configuration/MqttConfig.java)) tiếp nhận thông điệp QoS 1 từ Mosquitto 2.0.
- **Làm sạch & Bù khuyết Dữ liệu:** Thuật toán Forward-Fill 30 giây trong [`TelemetrySanitizerService.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/service/TelemetrySanitizerService.java) kết hợp bộ đệm Caffeine bounded cache, loại trừ xung âm tức thời `noisePeak`, và chuẩn hóa mốc thời gian đo lường.
- **Lưu trữ TimeSeries Chuyên Dụng:** Ghi bản ghi vào MongoDB 8.0 Native TimeSeries collection ([`TelemetryRecord.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/document/TelemetryRecord.java)) với độ phân giải theo giây và compound indexes.
- **Động cơ Chấm điểm Tiện nghi LCS:** Thuật toán phi tuyến tính theo Nguyên lý Thùng gỗ Liebig ([`ComfortScoreService.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/service/ComfortScoreService.java)) hỗ trợ 3 cấu hình phòng học và đạt 100% tỷ lệ đỗ unit tests.
- **Bảo mật Đa tầng & RBAC:** Nimbus JOSE JWT HMAC-SHA512, Refresh Token Rotation (24h), Token Blacklist MongoDB TTL, và RateLimitFilter (Bucket4j + Caffeine).

### 1.2. Khoảng Trống Kỹ Thuật Cần Giải Quyết (Gaps to Bridge)
Để trở thành một **sản phẩm hoàn chỉnh chạy được (Runnable System)** có khả năng kết nối trực tiếp với giao diện Web Dashboard, hệ thống đang thiếu 5 phân hệ quan trọng:
1. **Phân hệ Cảnh báo (Alerts):** Mới có Entity và Repository; chưa có Service, Controller và Rule Engine so ngưỡng trong luồng Ingestion.
2. **Kênh Đẩy Dữ liệu Thời gian thực (Realtime):** Thư viện WebSocket trong `pom.xml` chưa có mã nguồn kích hoạt.
3. **Tiến trình Quét Thiết bị Ngoại tuyến (Watchdog):** Trạng thái Online hiện tính động; chưa có Scheduled Job tự động đánh dấu thiết bị mất sóng vào DB.
4. **API Nén Chuỗi Thời Gian (Downsampling Buckets):** Chưa có API nén dữ liệu cho biểu đồ 24h/7 ngày; truy vấn thô đối mặt nguy cơ tràn RAM JVM.
5. **Chuẩn hóa Hợp đồng REST API:** Thiếu phân trang ở API phòng và thiết bị; tiền tố URI bị phân mảnh giữa `/api` và `/api/v1`.

---

## 2. MA TRẬN HẠNG MỤC CÔNG VIỆC GIAI ĐOẠN 1 (BẮT BUỘC ĐỂ CÓ SẢN PHẨM CHẠY ĐƯỢC)

| Mã Task | Tên Phân Hệ / Hạng Mục | Mục Tiêu Kỹ Thuật | Thành Phần Tác Động / Tạo Mới | Thời Gian Dự Kiến | Mức Độ Ưu Tiên |
|:---:|:---|:---|:---|:---:|:---:|
| **T1** | **Chuẩn Hóa Hợp Đồng API & Validation** | Đồng nhất URI `/api/v1`, bổ sung phân trang `PageResponse<T>` cho Device/Room, gắn `@Valid` kiểm tra dữ liệu đầu vào. | [`AuthenticationController.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/controller/AuthenticationController.java), [`DeviceController.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/controller/DeviceController.java), [`RoomController.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/controller/RoomController.java), DTOs | 1 Ngày | **Bắt buộc (P0)** |
| **T2** | **Xây Dựng Phân Hệ Cảnh Báo (Alert Subsystem)** | Xây dựng Rule Engine so ngưỡng trong luồng Ingestion, máy trạng thái 4 bước (PENDING $\rightarrow$ FIRING $\rightarrow$ ACK $\rightarrow$ RESOLVED), viết `AlertService` và `AlertController`. | [`AlertService.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/service), [`AlertController.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/controller), [`MqttMessageDispatcherService.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/service/MqttMessageDispatcherService.java) | 2–3 Ngày | **Bắt buộc (P0)** |
| **T3** | **Tiến Trình Quét Thiết Bị Ngoại Tuyến (Watchdog)** | Scheduled job chạy ngầm chu kỳ 30s; phát hiện trạm đo mất kết nối/treo vi điều khiển quá 2 phút, cập nhật trạng thái `OFFLINE` và phát cảnh báo. | [`DeviceWatchdogService.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/service), [`DeviceRepository.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/repository/DeviceRepository.java) | 1 Ngày | **Bắt buộc (P0)** |
| **T4** | **API Nén Chuỗi Thời Gian (Downsampling Buckets)** | Xây dựng API tổng hợp biểu đồ theo khoảng 15m, 1h, 1d qua MongoDB Aggregation; cung cấp API KPI tóm tắt toàn hệ thống cho Dashboard. | [`TelemetryService.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/service/TelemetryService.java), [`TelemetryController.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/controller/TelemetryController.java) | 2 Ngày | **Bắt buộc (P0)** |
| **T5** | **Kích Hoạt WebSocket STOMP Realtime** | Cấu hình WebSocket message broker `/ws-aiot`, xác thực frame `CONNECT`, phân phối kênh `/topic/rooms/{id}/telemetry` và `/topic/alerts` kèm cơ chế Conflation 1Hz. | [`WebSocketConfig.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/configuration), [`MqttMessageDispatcherService.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/service/MqttMessageDispatcherService.java) | 2 Ngày | **Bắt buộc (P0)** |
| **T6** | **Tối Ưu Bộ Nhớ Đệm & Giới Hạn Luồng Ingestion** | Cache metadata thiết bị bằng Caffeine; bổ sung Semaphore giới hạn số luồng ghi đồng thời vào MongoDB, chống cạn kiệt Connection Pool. | [`MqttConfig.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/configuration/MqttConfig.java), [`MqttMessageDispatcherService.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/service/MqttMessageDispatcherService.java) | 1 Ngày | **Quan trọng (P1)** |

---

## 3. ĐẶC TẢ KỸ THUẬT CHI TIẾT TỪNG PHÂN HỆ GIAI ĐOẠN 1

### Nhiệm vụ 1: Hoàn thiện Phân hệ Cảnh báo (Alert Subsystem)

#### 1.1. Mục Tiêu Nghiệp Vụ
Phát hiện tự động các hiện tượng vi phạm môi trường và sự cố phần cứng:
- Tiếng ồn vượt ngưỡng phòng đọc (ồn nền $>50\text{ dBA}$ hoặc va đập $>75\text{ dBA}$).
- Ô nhiễm bụi mịn không khí ($\text{PM2.5} > 35\ \mu\text{g/m}^3$).
- Nhiệt độ/độ ẩm vượt ngưỡng bảo quản hoặc học tập.
- Thiết bị mất kết nối mạng hoặc lỗi cảm biến cục bộ.

#### 1.2. Kiến Trúc Luồng Xử Lý Cảnh Báo
```
[Bản tin Telemetry Đến]
          │
          ▼
[Tính Điểm Tiện Nghi LCS]
          │
          ▼
[Rule Engine: So sánh Ngưỡng Phòng & Ngưỡng Chuẩn]
          │
     ┌────┴───────────────────────────┐
(Vượt ngưỡng)                  (Trong ngưỡng an toàn)
     ▼                                │
[Kiểm tra Alert Hiện tại]             ▼
  - Nếu chưa có: Tạo PENDING         [Nếu có Alert FIRING/ACK:
  - Nếu đã PENDING > 30s: Chuyển        Kiểm tra phục hồi liên tục 60s
    trạng thái FIRING                   -> Chuyển trạng thái RESOLVED]
  - Phát STOMP `/topic/alerts`
```

#### 1.3. Các Thành Phần Code Cần Triển Khai
1. **`com.example.AIoTLibTQB.service.AlertService`**:
   - `checkAndTriggerAlerts(TelemetryRecord record, Room room, Device device)`: Đánh giá số liệu và cập nhật máy trạng thái cảnh báo.
   - `getAlerts(String roomId, String deviceId, AlertStatus status, Pageable pageable)`: Trả về danh sách cảnh báo phân trang.
   - `getUnreadCount()`: Đếm các cảnh báo ở trạng thái `FIRING` chưa được xác nhận.
   - `acknowledgeAlert(String alertId, String username)`: Chuyển trạng thái sang `ACKNOWLEDGED`, ghi nhận `acknowledgedBy`.
   - `resolveAlert(String alertId)`: Xác nhận đóng cảnh báo.
2. **`com.example.AIoTLibTQB.controller.AlertController`**:
   - `GET /api/v1/alerts/unread-count`: Header Bell badge.
   - `GET /api/v1/alerts`: Bảng quản trị sự cố.
   - `PATCH /api/v1/alerts/{id}/acknowledge`: Nút nhận xử lý sự cố.
   - `PATCH /api/v1/alerts/{id}/resolve`: Nút đóng sự cố thủ công.
3. **Tích hợp vào Ingestion:**
   - Gọi `alertService.checkAndTriggerAlerts()` ngay sau khi lưu `TelemetryRecord` tại [`MqttMessageDispatcherService.java:207`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/service/MqttMessageDispatcherService.java#L207).

---

### Nhiệm vụ 2: Kích hoạt Kênh Đẩy Dữ liệu Thời gian thực (Realtime WebSocket STOMP)

#### 2.1. Mục Tiêu Nghiệp Vụ
Cho phép Web Dashboard cập nhật bản đồ nhiệt (Floorplan Heatmap) và nhận chuông cảnh báo tức thời mà không cần gửi request polling liên tục lên máy chủ.

#### 2.2. Các Thành Phần Code Cần Triển Khai
1. **`com.example.AIoTLibTQB.configuration.WebSocketConfig`**:
   ```java
   @Configuration
   @EnableWebSocketMessageBroker
   public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
       @Override
       public void registerStompEndpoints(StompEndpointRegistry registry) {
           registry.addEndpoint("/ws-aiot")
                   .setAllowedOriginPatterns("*")
                   .withSockJS();
       }

       @Override
       public void configureMessageBroker(MessageBrokerRegistry config) {
           config.enableSimpleBroker("/topic");
           config.setApplicationDestinationPrefixes("/app");
       }

       @Override
       public void configureClientInboundChannel(ChannelRegistration registration) {
           registration.interceptors(new StompAuthChannelInterceptor(customJwtDecoder));
       }
   }
   ```
2. **`StompAuthChannelInterceptor`**:
   - Chặn frame `StompCommand.CONNECT`.
   - Trích xuất header `Authorization: Bearer <token>`, giải mã qua [`CustomJwtDecoder`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/configuration/CustomJwtDecoder.java).
   - Thiết lập `SecurityContext` cho phiên kết nối.
3. **Cơ chế Conflation Throttling 1Hz:**
   - Thay vì đẩy dồn dập mỗi khi có bản tin cảm biến, backend sử dụng bộ nhớ đệm gom mẫu theo từng `roomId`.
   - Định kỳ mỗi **1.0 giây**, một Scheduled Job gom dữ liệu mới nhất của từng phòng và đẩy 1 gói tin tổng hợp lên topic `/topic/rooms/{roomId}/telemetry`.
   - Gói tin cảnh báo được đẩy tức thời lên `/topic/alerts`.

---

### Nhiệm vụ 3: Tiến trình Nền Giám sát Thiết bị Ngoại tuyến (Device Offline Watchdog)

#### 3.1. Mục Tiêu Nghiệp Vụ
Giải quyết dứt điểm các kịch bản thiết bị đứt sóng Wi-Fi, sập nguồn đột ngột không kịp gửi MQTT LWT, hoặc vi điều khiển ESP32 bị treo (MCU Deadlock).

#### 3.2. Các Thành Phần Code Cần Triển Khai
1. **`com.example.AIoTLibTQB.service.DeviceWatchdogService`**:
   ```java
   @Service
   @RequiredArgsConstructor
   @Slf4j
   public class DeviceWatchdogService {
       private final DeviceRepository deviceRepository;
       private final AlertService alertService;
       private final SimpMessagingTemplate messagingTemplate;

       @Scheduled(fixedDelay = 30000) // Chạy mỗi 30 giây
       public void scanOfflineDevices() {
           Instant threshold = Instant.now().minus(2, ChronoUnit.MINUTES);
           List<Device> staleDevices = deviceRepository.findByIsActiveTrueAndLastSeenAtBefore(threshold);

           for (Device device : staleDevices) {
               if (!"OFFLINE".equalsIgnoreCase(device.getConnectionState())) {
                   device.setConnectionState("OFFLINE");
                   deviceRepository.save(device);
                   log.warn("Device marked OFFLINE by Watchdog: id={}, hwId={}", device.getId(), device.getHardwareId());
                   alertService.triggerOfflineAlert(device);
               }
           }
       }
   }
   ```
2. **Bổ sung truy vấn vào [`DeviceRepository.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/repository/DeviceRepository.java)**:
   ```java
   List<Device> findByIsActiveTrueAndLastSeenAtBefore(Instant threshold);
   ```

---

### Nhiệm vụ 4: API Nén Chuỗi Thời Gian Vẽ Biểu Đồ (TimeSeries Downsampling Buckets)

#### 4.1. Mục Tiêu Nghiệp Vụ
Cung cấp dữ liệu nén mượt mà cho các biểu đồ phân tích 24 giờ, 7 ngày, 30 ngày trên giao diện người dùng mà không làm quá tải bộ nhớ máy chủ và trình duyệt client.

#### 4.2. Thiết Kế API & MongoDB Aggregation Pipeline
1. **Endpoint nén theo khoảng thời gian:**
   `GET /api/v1/telemetry/room/{roomId}/buckets?interval=15m|1h|1d&start=...&end=...`
2. **MongoDB Aggregation Pipeline thực thi:**
   ```json
   [
     { "$match": { "metadata.roomId": roomId, "timestamp": { "$gte": start, "$lte": end } } },
     {
       "$group": {
         "_id": { "$dateTrunc": { "date": "$timestamp", "unit": "hour", "binSize": 1 } },
         "avgComfortScore": { "$avg": "$comfortScore.overall" },
         "avgNoise": { "$avg": "$acoustics.noiseAvg" },
         "maxNoisePeak": { "$max": "$acoustics.noisePeak" },
         "avgPm25": { "$avg": "$airQuality.pm2_5" },
         "avgTemp": { "$avg": "$environment.temperature" },
         "minTemp": { "$min": "$environment.temperature" },
         "maxTemp": { "$max": "$environment.temperature" },
         "avgHumidity": { "$avg": "$environment.humidity" },
         "avgLux": { "$avg": "$environment.lux" },
         "sampleCount": { "$sum": 1 }
       }
     },
     { "$sort": { "_id": 1 } }
   ]
   ```
3. **Endpoint KPI Tóm Tắt Toàn Thư Viện (Dashboard Overview Summary):**
   `GET /api/v1/telemetry/overview/summary`
   - Trả về:
     - `overallComfortScore`: Điểm tiện nghi trung bình toàn bộ phòng đọc trong thư viện.
     - `totalActiveSensors`: Tổng số trạm cảm biến đang hoạt động.
     - `onlineSensorsCount` & `offlineSensorsCount`.
     - `activeAlertsCount`: Tổng số sự cố chưa giải quyết.
     - `bestRoom`: Phòng có điều kiện không gian lý tưởng nhất.
     - `attentionRoom`: Phòng có điều kiện tệ nhất cần thủ thư lưu ý.

---

### Nhiệm vụ 5: Chuẩn hóa Hợp đồng REST API, Phân trang & Validation

#### 5.1. Đồng Nhất Tiền Tố Phiên Bản API
Di chuyển toàn bộ các controller quản trị định danh sang chuẩn chung `/api/v1/...`:
- `/api/auth/**` $\rightarrow$ `/api/v1/auth/**`
- `/api/users/**` $\rightarrow$ `/api/v1/users/**`
- `/api/roles/**` $\rightarrow$ `/api/v1/roles/**`
- `/api/permissions/**` $\rightarrow$ `/api/v1/permissions/**`
- Cập nhật lại mảng `PUBLIC_POST_ENDPOINTS` trong [`SecurityConfig.java:28-35`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/configuration/SecurityConfig.java#L28-L35).

#### 5.2. Chuẩn Hóa Phân Trang (`PageResponse<T>`)
Bổ sung tham số `Pageable` vào:
- `GET /api/v1/devices?page=0&size=10&zoneId=...&roomId=...`
- `GET /api/v1/rooms?page=0&size=10&floor=...`
- Đóng gói kết quả trả về trong DTO chuẩn [`PageResponse<T>`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/dto/response/PageResponse.java) (bao gồm `currentPage`, `pageSize`, `totalPages`, `totalElements`, `data`).

#### 5.3. Ràng Buộc Toàn Vẹn & Validation Đầu Vào
1. Bổ sung `@Valid`, `@NotBlank(message = "USERNAME_REQUIRED")`, `@NotBlank(message = "PASSWORD_REQUIRED")` vào [`AuthenticationRequest.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/dto/request/AuthenticationRequest.java) và [`AuthenticationController.java`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/controller/AuthenticationController.java).
2. **Kiểm tra khi xóa Phòng (`deleteRoom`):** Kiểm tra `deviceRepository.existsByRoomId(roomId)`. Nếu còn thiết bị gắn kèm phòng, từ chối xóa và ném lỗi `ROOM_HAS_ASSOCIATED_DEVICES` (tránh tạo thiết bị mồ côi).
3. **Kiểm tra khi xóa Vai trò (`deleteRole`):** Tự động thu hồi vai trò khỏi danh sách `roles` của toàn bộ tài liệu `User` trước khi xóa khỏi CSDL.

---

### Nhiệm vụ 6: Bảo vệ Tải Hạ tầng & Caching Trong Luồng Ingestion

1. **Bộ nhớ đệm Tra cứu Thiết bị (Device Metadata Cache):**
   - Trong [`MqttMessageDispatcherService.java:153`](file:///c:/Users/C/Documents/Project/AIoTLibTQB/src/main/java/com/example/AIoTLibTQB/service/MqttMessageDispatcherService.java#L153), thay vì gọi `deviceRepository.findByHardwareId` liên tục trên từng gói tin, sử dụng Caffeine Cache:
     ```java
     LoadingCache<String, Optional<Device>> deviceMetadataCache = Caffeine.newBuilder()
             .maximumSize(10_000)
             .expireAfterWrite(5, TimeUnit.MINUTES)
             .build(deviceRepository::findByHardwareId);
     ```
   - Giúp giảm hơn **90%** tải đọc truy vấn lên MongoDB `devices` collection.
2. **Kiểm soát Tải Đa luồng Ghi CSDL (Bounded Concurrency):**
   - Giới hạn số lượng tác vụ ghi CSDL đồng thời từ Virtual Threads (sử dụng Semaphore kích thước 50), bảo đảm không vượt quá Connection Pool 100 kết nối của MongoDB Driver, triệt tiêu nguy cơ cạn kiệt kết nối khi xảy ra bão dữ liệu MQTT.

---

## 4. GIAI ĐOẠN 2: CÁC HẠNG MỤC MỞ RỘNG & TINH CHỈNH TIẾP THEO

Sau khi Giai đoạn 1 hoàn tất, hệ thống đã đạt trạng thái sẵn sàng vận hành tương đối. Các hạng mục sau đây sẽ được triển khai tinh chỉnh:

| STT | Phân Hệ / Chức Năng | Mục Tiêu Kỹ Thuật & Nghiệp Vụ | Thư Viện / Mã Nguồn |
|:---:|:---|:---|:---|
| **1** | **Tài Liệu Hóa Runtime (Swagger / OpenAPI)** | Tích hợp `springdoc-openapi-starter-webmvc-ui` để tự động sinh tài liệu tương tác tại `/swagger-ui.html`. | `pom.xml`, `OpenApiConfig.java` |
| **2** | **Endpoint Tra Cứu Công Cộng (Public Kiosk)** | Mở `GET /api/v1/public/rooms/{id}/comfort-score` (PermitAll, rate limit 60 req/phút) cho màn hình Tablet treo trước cửa phòng đọc. | `SecurityConfig.java`, `TelemetryController.java` |
| **3** | **Kết Xuất Báo Cáo Định Kỳ (PDF/CSV)** | Hiện thực hóa quyền `GENERATE_REPORT` bằng thư viện iText / Apache POI xuất báo cáo kiểm định môi trường theo chuẩn TCVN. | `ReportService.java`, `ReportController.java` |
| **4** | **Thông Báo Đa Kênh Ngoại Vi** | Tích hợp Email SMTP (`spring-boot-starter-mail`) và Telegram Bot Webhook khi có sự cố nghiêm trọng. | `NotificationService.java` |
| **5** | **Bộ Kiểm Thử Tích Hợp (Integration Tests)** | Bổ sung `@WebMvcTest` cho các Controller và Testcontainers MongoDB để kiểm thử luồng tích hợp tự động trong CI/CD. | `src/test/java` |

---

## 5. LỊCH TRÌNH THỰC HIỆN VÀ PHÂN BỔ NGUỒN LỰC (SPRINTS)

Lộ trình thực hiện Giai đoạn 1 được chia thành **3 Sprints ngắn** (Tổng thời gian ước tính: 2 – 3 tuần):

```mermaid
gantt
    title LỘ TRÌNH HOÀN THIỆN BACKEND GIAI ĐOẠN 1
    dateFormat  YYYY-MM-DD
    section Sprint 1 (Nền Tảng & Vận Hành)
    T1: Chuẩn hóa Hợp đồng API, Phân trang & Validation   :2026-10-23, 2d
    T3: Tiến trình Offline Device Watchdog Scheduler      :2026-10-25, 1d
    T6: Ingestion Caffeine Caching & Bounded Executor    :2026-10-26, 1d
    section Sprint 2 (Nghiệp Vụ Cảnh Báo)
    T2.1: Alert Rule Engine & FSM trong luồng MQTT       :2026-10-27, 2d
    T2.2: AlertService & AlertController CRUD APIs        :2026-10-29, 2d
    section Sprint 3 (Realtime & Biểu Đồ)
    T4: TimeSeries Buckets Aggregation & Summary KPI     :2026-10-31, 2d
    T5: WebSocket STOMP Streaming & Conflation 1Hz       :2026-11-02, 2d
    Kiểm thử E2E & Đóng gói Bản phát hành MVP            :2026-11-04, 2d
```

---

## 6. TIÊU CHÍ NGHIỆM THU ĐỊNH LƯỢNG (DEFINITION OF DONE - DoD)

Hệ thống Backend được coi là hoàn thiện tương đối và sẵn sàng bàn giao cho đội ngũ Frontend khi đáp ứng đủ các tiêu chuẩn sau:

1. **Tính Toàn Vẹn Của Luồng Cảnh Báo:**
   - Trạm đo phát gói tin vượt ngưỡng $\rightarrow$ Hệ thống tự động sinh bản ghi `Alert` ở trạng thái `FIRING`.
   - API `GET /api/v1/alerts/unread-count` phản ánh đúng số lượng sự cố chưa xác nhận.
   - Thao tác Acknowledge và Resolve hoạt động chính xác theo đúng quyền hạn RBAC.
2. **Độ Nhạy Phát Hiện Thiết Bị Offline:**
   - Khi rút dây nguồn trạm đo (không có MQTT LWT), Watchdog Job phát hiện và cập nhật trạng thái `OFFLINE` trong vòng $\le 2\text{ phút}$.
3. **Độ Trễ & Thông Lượng Realtime:**
   - Dữ liệu vi khí hậu từ trạm đo chuyển tiếp qua WebSocket STOMP tới client với độ trễ toàn trình $\le 1.5\text{ giây}$.
   - Tần suất phát tán dữ liệu mỗi phòng được điều tiết ổn định ở mức $\le 1\text{ Hz}$ (1 bản tin/giây).
4. **Hiệu Năng Truy Vấn Biểu Đồ:**
   - Truy vấn nén Time Buckets 7 ngày (`GET .../buckets?interval=1h`) phản hồi trong thời gian $\le 200\text{ ms}$, kích thước payload trả về $\le 50\text{ KB}$.
5. **Độ Ổn Định Mã Nguồn:**
   - Toàn bộ các unit test hiện tại và mới bổ sung vượt qua 100% tỷ lệ đỗ (`./mvnw test`).
   - Biên dịch sạch sẽ không có cảnh báo lỗi nghiêm trọng.
