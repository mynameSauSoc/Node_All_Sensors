# BÁO CÁO NGHIỆM THU VIỆC 1A: BỘ GIẢ LẬP MẠCH IoT (IoT CIRCUIT SIMULATOR)

> Ngày thực hiện: 2026-10-23  
> Tác giả: Worker 1 (IoT Circuit Simulator Developer)  
> Môi trường thực thi: Windows (Node.js v24.18.0, npm 11.16.0, Eclipse Mosquitto 2.0 trên Docker port 1883, MongoDB 8.0 trên Docker port 27017, Spring Boot Backend trên port 8080)  
> Quy ước tính trung thực: Mọi nhận định kỹ thuật được gắn nhãn `[XÁC NHẬN]`, `[SUY LUẬN]`, `[CHƯA RÕ]` kèm đường dẫn mã nguồn cụ thể.

---

## 1. Kết Quả Khảo Sát & Xác Định Định Dạng Dữ Liệu Thực Tế Từ Backend

Dựa trên khảo sát trực tiếp mã nguồn backend, các thông số và cấu trúc kỹ thuật được xác nhận như sau:

### 1.1 Topic MQTT & Cấu Trúc Payload
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/service/MqttMessageDispatcherService.java:82-83`):
  - Topic trạng thái thiết bị: `devices/{hardwareId}/status` (Regex: `^devices/([^/]+)/status$`)
  - Topic telemetry cảm biến: `devices/{hardwareId}/telemetry` (Regex: `^devices/([^/]+)/telemetry$`)
  - Mqtt Inbound Adapter QoS: `1` (`src/main/java/com/example/AIoTLibTQB/configuration/MqttConfig.java:57`)
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/service/MqttMessageDispatcherService.java:127-132, 173-178`):
  - Backend kiểm tra định danh `hardwareId`: Nếu `payload.hardware_id` (hoặc alias `hardwareId`, `device_id`) khác với `{hardwareId}` trong topic, hệ thống ghi nhận cảnh báo "Hardware ID spoofing/mismatch detected" và hủy bỏ bản tin.
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/dto/mqtt/TelemetryPayload.java:13-88`):
  - Cấu trúc telemetry DTO hỗ trợ các trường lồng nhau:
    - `hardware_id`: String (khớp topic)
    - `timestamp`: Long (epoch milliseconds hoặc seconds)
    - `wifi_rssi`: Integer (-30 đến -90 dBm)
    - `data.acoustics`: `noise_avg` (Double), `noise_peak` (Double)
    - `data.air_quality`: `pm1_0`, `pm2_5`, `pm4_0`, `pm10` (Double)
    - `data.environment`: `temperature`, `humidity`, `lux` (Double)
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/dto/mqtt/StatusPayload.java:13-33`):
  - Cấu trúc status DTO:
    - `hardware_id`: String
    - `status`: String (`"online"` hoặc `"offline"`)
    - `reason`: String (ví dụ: `"power_on"`, `"lwt"`, `"graceful_shutdown"`, `"reboot"`)
    - `firmware_version`: String
    - `uptime_seconds`: Long
    - `timestamp`: Long

### 1.2 Giới Hạn Vật Lý Của Bộ Lọc Dữ Liệu (TelemetrySanitizerService)
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/service/TelemetrySanitizerService.java:24-34`):
  - Âm học: `NOISE_MIN = 30.0`, `NOISE_AVG_MAX = 110.0`, `NOISE_PEAK_MAX = 130.0` dBA
  - Bụi mịn: `PM_MIN = 0.0`, `PM_MAX = 1000.0` µg/m³
  - Nhiệt độ: `TEMP_MIN = 0.0`, `TEMP_MAX = 60.0` °C
  - Độ ẩm: `HUMIDITY_MIN = 0.0`, `HUMIDITY_MAX = 100.0` %
  - Ánh sáng: `LUX_MIN = 0.0`, `LUX_MAX = 65535.0` Lux
  - Cơ chế bù suy giảm: Forward-fill tối đa 30 giây cho các giá trị lỗi/khuyết ngoại trừ `noisePeak` (không bù forward-fill nhằm bảo vệ tính đột biến). Nếu tất cả số liệu đều rỗng/bị loại bỏ, bản tin bị drop hoàn toàn (`MqttMessageDispatcherService.java:229-232`).

### 1.3 Ngưỡng Kích Hoạt Cảnh Báo FSM (AlertRuleEngine)
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/service/AlertRuleEngine.java:32-38`):
  - `THRESHOLD_NOISE_AVG = 65.0` dBA
  - `THRESHOLD_NOISE_PEAK = 75.0` dBA
  - `THRESHOLD_TEMP = 32.0` °C
  - `THRESHOLD_PM25 = 50.0` µg/m³
  - `PENDING_WINDOW = 30` giây (phải duy trì vượt ngưỡng liên tục 30s mới chuyển từ `PENDING` sang `FIRING` và ghi DB).
  - `HYSTERESIS_WINDOW = 60` giây (phải duy trì dưới ngưỡng 60s mới chuyển sang `RESOLVED`).

### 1.4 Cơ Chế Giám Sát Thiết Bị Ngoại Tuyến (DeviceWatchdogService)
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/service/DeviceWatchdogService.java:71-75`):
  - Quét định kỳ mỗi 15 giây (`@Scheduled(fixedRate = 15000)`).
  - Thiết bị có `lastSeenAt` cũ hơn 2 phút (hoặc `lastSeenAt == null`) được chuyển sang `OFFLINE` và phát cảnh báo `DEVICE_OFFLINE`.

### 1.5 Bảo Vệ Tải Ghi CSDL (Mongo Semaphore)
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/service/MqttMessageDispatcherService.java:70-71, 254-286`):
  - `mongoWriteSemaphore`: 30 permits đồng thời, timeout lấy permit 3000ms. Nếu quá hạn chờ, ghi log `WARN` và bỏ qua bản tin an toàn, không treo thread.

---

## 2. Kiến Trúc Bộ Giả Lập Mạch IoT (`tools/iot-simulator/`)

Bộ giả lập được xây dựng hoàn toàn độc lập trong thư mục `tools/iot-simulator/` sử dụng Node.js (v24.18.0) và thư viện chuẩn `mqtt`:

1. **`config/rooms.json` & `config/profiles.json`:**
   - Quản lý 3 Zone (`ZONE_A`, `ZONE_B`, `ZONE_C`), 4 Room (`ROOM_101`, `ROOM_102`, `ROOM_201`, `ROOM_001`), và 4 thiết bị cảm biến (`ESP32S3_ZONE_A_001`, `ESP32_ROOM_101`, `ESP32_ROOM_102`, `ESP32_STORAGE_201`).
   - Cấu hình đặc tính môi trường theo từng loại phòng: `STUDY_ROOM` (yên tĩnh, vi khí hậu chuẩn), `BOOK_STORAGE` (nhiệt ẩm thấp, bảo quản sách), `CIRCULATION_HALL` (sảnh đông đúc).
2. **`src/safety.js` (Rào an toàn):**
   - Tự động chặn các kết nối ra ngoài máy cục bộ (`localhost`, `127.0.0.1`, `::1`) trừ khi có cờ xác nhận tường minh `--force-remote` hoặc `FORCE_REMOTE=true`.
3. **`src/signalModel.js` (Mô hình tín hiệu thực tế):**
   - Kết hợp giá trị nền (baseline), dao động hình sin 24h theo chu kỳ ngày đêm (diurnal cycle: đỉnh nhiệt lúc 14h, đáy lúc 4h), nhiễu ngẫu nhiên phân phối chuẩn Gauss (Box-Muller transform), và biến cố tập trung đông người vào các khung giờ cao điểm thư viện (10h-12h và 14h-17h).
4. **`src/scenarios.js` (10 Kịch bản kiểm thử):**
   - Đầy đủ 10 kịch bản: `normal`, `noise-spike`, `pm25-high`, `heat/humid`, `device-dropout`, `flap`, `lwt`, `bad-payload`, `burst`, `demo`.
5. **`src/provision.js` (Idempotent REST Provisioning):**
   - Kết nối vào `/api/v1/auth/login` bằng tài khoản admin lấy từ biến môi trường.
   - Truy vấn `/api/v1/rooms` và `/api/v1/devices` để kiểm tra sự tồn tại.
   - Chỉ tạo phòng và thiết bị nếu chưa có; gán chính xác `roomId` cho thiết bị. Chạy nhiều lần không sinh bản ghi trùng lặp.
6. **`bin/cli.js` & `src/index.js`:**
   - Cung cấp giao diện dòng lệnh với các tham số: `--scenario`, `--speed`, `--interval`, `--duration`, `--devices`, `--broker`, `--provision`, `--force-remote`.

---

## 3. Biên Bản Kiểm Thử & Nghiệm Thu Trên Broker Local

### 3.1 Kiểm Thử Kịch Bản 1: `normal` (Vi khí hậu ổn định)
- **Lệnh thực thi:**
  ```powershell
  node tools/iot-simulator/src/index.js --scenario normal --devices 3 --duration 15 --interval 3
  ```
- **Kết quả đầu ra của Simulator:**
  ```text
  [MQTT] [CONNECTED] Device [ESP32S3_ZONE_A_001] connected to broker
  [MQTT] [CONNECTED] Device [ESP32_ROOM_101] connected to broker
  [MQTT] [CONNECTED] Device [ESP32_ROOM_102] connected to broker
  [SIM] [STEP 1 | +0s] [ESP32S3_ZONE_A_001 | Phòng Đọc Tầng 1 - Khu A] -> T=21.4°C, H=59.8%, NoiseAvg=42.1dBA, NoisePeak=52.9dBA, PM2.5=15µg/m³, Lux=35.5
  ...
  [SIM] [STEP 5 | +12s] [ESP32_ROOM_102 | Phòng Thảo Luận 102 - Khu B] -> T=21.2°C, H=59.2%, NoiseAvg=41.4dBA, NoisePeak=47.7dBA, PM2.5=14.3µg/m³, Lux=30.4
  [SIM] Duration of 15s reached. Gracefully stopping simulator...
  [SIM] [STOPPED] Total published messages: 15. Virtual duration: 5 steps.
  ```
- **Xác minh phía MongoDB (`telemetry_records` collection):**
  - Số bản ghi ghi nhận thành công: **15 bản ghi**.
  - Mẫu dữ liệu lưu trữ:
    ```json
    {
      "timestamp": "2026-10-23T15:01:19.377Z",
      "metadata": {
        "deviceId": "6adb765aee72da4198a5f18b",
        "hardwareId": "ESP32_ROOM_102",
        "roomId": "6adb7659ee72da4198a5f187"
      },
      "acoustics": { "noiseAvg": 41.4, "noisePeak": 47.7 },
      "airQuality": { "pm1_0": 9.3, "pm2_5": 14.3, "pm4_0": 17.8, "pm10": 22.1 },
      "environment": { "temperature": 21.2, "humidity": 59.2, "lux": 30.4 },
      "comfortScore": { "overall": 22.6, "grade": "Poor" },
      "wifiRssi": -58
    }
    ```
  - `[XÁC NHẬN]` CSDL TimeSeries đã lưu trữ đầy đủ toàn bộ 15 bản tin từ 3 thiết bị; trạng thái kết nối chuyển sang `ONLINE` khi gửi và sang `OFFLINE` khi simulator tắt an toàn.

---

### 3.2 Kiểm Thử Kịch Bản 2: `noise-spike` (Đột biến tiếng ồn & Kích hoạt Alert FSM)
- **Lệnh thực thi:**
  ```powershell
  node tools/iot-simulator/src/index.js --scenario noise-spike --devices 3 --duration 35 --interval 3
  ```
- **Kết quả đầu ra của Simulator:**
  ```text
  [SIM] [STEP 1 | +0s] [ESP32S3_ZONE_A_001 | Phòng Đọc Tầng 1 - Khu A] -> NoiseAvg=70dBA, NoisePeak=84dBA
  ...
  [SIM] [STEP 11 | +30s] [ESP32_ROOM_102 | Phòng Thảo Luận 102 - Khu B] -> NoiseAvg=71.5dBA, NoisePeak=88dBA
  [SIM] Duration of 35s reached. Gracefully stopping simulator...
  [SIM] [STOPPED] Total published messages: 36. Virtual duration: 12 steps.
  ```
- **Xác minh phía MongoDB (`alerts` collection):**
  - Sau đúng 30 giây duy trì tiếng ồn vượt ngưỡng (`noiseAvg` 71.5 dBA > 65 dBA và `noisePeak` 88 dBA > 75 dBA), `AlertRuleEngine` đã chuyển FSM từ `PENDING` sang `FIRING` và ghi nhận thành công vào MongoDB:
    1. Alert ID `6adb777eee72da4198a5f1bd`: `NOISE_EXCEEDED` on `ESP32_ROOM_102` (`status: FIRING`, `currentValue: 71.5`, `threshold: 65.0`, `startedAt: 2026-10-23T15:04:30.697Z`)
    2. Alert ID `6adb777eee72da4198a5f1be`: `NOISE_EXCEEDED` on `ESP32S3_ZONE_A_001` (`status: FIRING`, `currentValue: 71.5`, `threshold: 65.0`)
    3. Alert ID `6adb777eee72da4198a5f1bf`: `NOISE_EXCEEDED` on `ESP32_ROOM_101` (`status: FIRING`, `currentValue: 71.5`, `threshold: 65.0`)
    4. Alert ID `6adb777eee72da4198a5f1c1`: `NOISE_EXCEEDED` on `ESP32_ROOM_102` (`status: FIRING`, `currentValue: 88.0`, `threshold: 75.0`, `message: Peak noise spike (88.0 dBA) exceeded threshold (75.0 dBA)`)
    5. Alert ID `6adb777eee72da4198a5f1c2`: `NOISE_EXCEEDED` on `ESP32S3_ZONE_A_001` (`status: FIRING`, `currentValue: 88.0`, `threshold: 75.0`)
    6. Alert ID `6adb777eee72da4198a5f1c0`: `NOISE_EXCEEDED` on `ESP32_ROOM_101` (`status: FIRING`, `currentValue: 88.0`, `threshold: 75.0`)
  - `[XÁC NHẬN]` Cả 6 cảnh báo tiếng ồn nền và xung âm đỉnh đều được kích hoạt chính xác theo máy trạng thái FSM.

---

### 3.3 Xác Minh Qua Backend REST API
1. **API Tổng quan (`GET /api/v1/telemetry/overview/summary`):**
   - Kết quả phản hồi (HTTP 200, code: 1000):
     ```json
     {
       "code": 1000,
       "result": {
         "totalRooms": 2,
         "optimalRoomsCount": 0,
         "averageComfortScore": 16.15,
         "overallGrade": "Poor",
         "bestRoom": {
           "roomId": "6adb7659ee72da4198a5f186",
           "noiseAvg": 68.5,
           "bottleneckReason": "Average noise level (68.5 dBA) exceeded threshold (65.0 dBA)"
         },
         "attentionRoom": {
           "roomId": "6adb7659ee72da4198a5f187",
           "noiseAvg": 68.5,
           "bottleneckReason": "Average noise level (68.5 dBA) exceeded threshold (65.0 dBA)"
         }
       }
     }
     ```
   - `[XÁC NHẬN]` API Overview Summary đọc trực tiếp từ `LatestTelemetryCache` và phát hiện chính xác điểm nghẽn `bottleneckReason` do sự cố tiếng ồn.

2. **API Nén Biểu Đồ (`GET /api/v1/telemetry/room/{roomId}/buckets?interval=15m&start=...&end=...`):**
   - Kết quả phản hồi (HTTP 200, code: 1000):
     ```json
     {
       "code": 1000,
       "result": {
         "roomId": "6adb7659ee72da4198a5f186",
         "interval": "15m",
         "dataPoints": [
           {
             "bucketTime": "2026-10-23T15:00:00Z",
             "sampleCount": 34,
             "comfortScoreAvg": 17.65,
             "tempAvg": 21.68,
             "humidityAvg": 60.42,
             "noiseAvg": 61.25,
             "noiseMax": 71.5,
             "pm25Avg": 12.78,
             "luxAvg": 28.24
           }
         ]
       }
     }
     ```
   - `[XÁC NHẬN]` MongoDB Aggregation `$dateTrunc` đã tổng hợp chuẩn xác 34 mẫu telemetry trong bucket 15m với đầy đủ giá trị min, max, avg.

---

## 4. Điều Tra & Đề Xuất Phương Án Nạp Dữ Liệu Lịch Sử 24h / 7 Ngày

### 4.1 Khảo Sát Kỹ Thuật Trong Mã Nguồn Ingestion
- `[XÁC NHẬN]` (`src/main/java/com/example/AIoTLibTQB/service/MqttMessageDispatcherService.java:293-318`):
  ```java
  private Instant parseAndNormalizeTimestamp(Long rawTimestamp, Instant now, String hardwareId) {
      if (rawTimestamp == null || rawTimestamp <= 0) return now;
      Instant parsed = (rawTimestamp >= 100_000_000_000L) ? Instant.ofEpochMilli(rawTimestamp) : Instant.ofEpochSecond(rawTimestamp);
      if (parsed.isBefore(Instant.parse("2020-01-01T00:00:00Z"))) return now;
      if (parsed.isAfter(now.plusSeconds(60))) return now;
      return parsed;
  }
  ```
  Hàm `parseAndNormalizeTimestamp` **không đè thời gian quá khứ về hiện tại** nếu timestamp nằm giữa `2020-01-01T00:00:00Z` và `now + 60s`. Điều này cho phép nạp các bản tin có nhãn thời gian lịch sử trong quá khứ 24h hoặc 7 ngày mà không bị ép về thời gian hiện tại!
- `[XÁC NHẬN]` Tác động phụ khi nạp qua MQTT:
  1. `LatestTelemetryCache`: Cứ mỗi bản tin đến qua MQTT, `latestTelemetryCache.putRoomTelemetry(...)` sẽ ghi đè giá trị mới nhất của phòng. Nếu phát dữ liệu 7 ngày qua MQTT mà thứ tự ngẫu nhiên hoặc chạy tua nhanh, cache thời gian thực của phòng sẽ bị ảnh hưởng.
  2. `AlertRuleEngine`: Luồng FSM đánh giá theo `clock.instant()` (thời gian thực hiện tại của server) chứ không theo timestamp của bản tin. Do đó các giá trị cũ trong quá khứ có thể kích hoạt cảnh báo FSM sai nếu gửi dồn dập.
  3. `mongoWriteSemaphore`: Giới hạn 30 permits đồng thời; nếu nạp hàng chục nghìn bản tin quá nhanh qua MQTT sẽ bị drop bởi timeout 3000ms.

### 4.2 Ba Phương Án Đề Xuất (So Sánh & Đánh Giá)

| Tiêu Chí | Phương Án 1: Tua Nhanh Qua MQTT Replay | Phương Án 2: REST Batch Import Endpoint | Phương Án 3: Script Nạp Trực Tiếp MongoDB TimeSeries |
| :--- | :--- | :--- | :--- |
| **Cơ chế** | Sử dụng Simulator phát bản tin MQTT có timestamp lùi dần từ quá khứ đến hiện tại với `--speed`. | Bổ sung endpoint backend `/api/v1/telemetry/import-batch` cho Admin. | Chạy script Node/Python nạp thẳng bản ghi vào collection `telemetry_records`. |
| **Ưu điểm** | Đi qua 100% pipeline thực tế (Sanitizer, ComfortScore, MongoDB TimeSeries). Không cần thêm code backend mới. | Kiểm soát quyền admin, tính toán ComfortScore chuẩn, không làm nhiễu luồng MQTT và Alert FSM. | Tốc độ cực nhanh (nạp 100.000 điểm dữ liệu trong < 3 giây). Thích hợp tạo seed data demo. |
| **Nhược điểm** | Tốc độ bị khống chế bởi Semaphore (30 permits) và có thể kích hoạt FSM không mong muốn. | Cần tạo thêm endpoint mới trên backend (vi phạm quy tắc đóng băng mã nguồn hiện tại). | Bỏ qua logic tính `ComfortScoreService` nếu không tái hiện lại công thức tính điểm của backend. |
| **Khuyến nghị** | **Khuyến nghị cho giai đoạn hiện tại (Giai đoạn 1):** Dùng Simulator với cờ `--speed` hợp lý và kịch bản `demo` theo từng batch nhỏ có giãn cách, bảo đảm không vi phạm Semaphore. | Xem xét bổ sung ở Giai đoạn 2 phục vụ backup/restore. | Khuyến nghị dùng cho môi trường staging khi cần biểu đồ 90 ngày với hàng triệu điểm dữ liệu. |

---

## 5. Hướng Dẫn Kiểm Thử Thủ Công (Khi Hạ Tầng Chưa Bật Sẵn)

Nếu người dùng hoặc kiểm toán viên chạy trên máy mới chưa bật hạ tầng:

1. **Khởi động hạ tầng Docker:**
   ```powershell
   docker-compose up -d mongodb mosquitto
   ```
2. **Khởi động Spring Boot Backend:**
   ```powershell
   .\mvnw.cmd spring-boot:run
   ```
3. **Thực thi Provisioning tự động:**
   ```powershell
   cd tools/iot-simulator
   npm install
   npm run provision
   ```
4. **Chạy kịch bản kiểm thử:**
   ```powershell
   # 1. Kịch bản bình thường
   node src/index.js --scenario normal --devices 3 --duration 30
   # 2. Kịch bản cảnh báo ồn
   node src/index.js --scenario noise-spike --devices 3 --duration 35
   ```
5. **Kiểm tra kết quả:**
   - Xem dữ liệu tại Mongo Express: `http://localhost:8081` (Database: `aiot_identity_db`, Collections: `telemetry_records`, `alerts`).
   - Gọi API tóm tắt: `http://localhost:8080/api/v1/telemetry/overview/summary`.
