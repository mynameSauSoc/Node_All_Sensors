# SOFTWARE ARCHITECTURE - HỆ THỐNG QUAN TRẮC MÔI TRƯỜNG THƯ VIỆN TẠ QUANG BỬU (TQB SMARTLIB)

> **Single Source of Truth (SSOT) cho Kiến Trúc Phần Mềm, Phân Định Paradigms & Luồng Dữ Liệu**  
> Tuân thủ nghiêm ngặt quy tắc `.ai-rules`. Phân tách rành mạch giữa:
> - **Lập trình Cấu trúc (Procedural / Modular Embedded C & FreeRTOS)** trên Firmware ESP32-S3.
> - **Lập trình Hướng đối tượng (Enterprise OOP / Layered Architecture)** trên Backend Spring Boot 3 & MongoDB 8.0.
> - **Lập trình Hướng thành phần (Component-Driven / Declarative UI)** trên Frontend React 18 & Vite.

---

## 1. QUY HOẠCH CẤU TRÚC THƯ MỤC CHUẨN HOÁ (SYSTEM DIRECTORY STRUCTURE)

```
d:\ĐỒ ÁN TỐT NGHIỆP\
├── .ai-rules                                  # Luật hành vi AI (tiết kiệm token & chuẩn quy trình)
├── HARDWARE_MAP.md                            # SSOT phần cứng, sơ đồ chân GPIO, thông số điện áp
├── SOFTWARE_ARCH.md                           # SSOT kiến trúc phần mềm, luồng dữ liệu & Hot/Cold DB
├── README.md                                  # Hướng dẫn tổng quan đồ án tốt nghiệp
│
├── 01_HE_THONG_SERVER/                        # HỆ THỐNG MÁY CHỦ MASTER (HƯỚNG ĐỐI TƯỢNG OOP)
│   ├── Backend_Spring_Boot_Java/              # Mã nguồn D:\AIoTLibTQB (Spring Boot 3.5, Java 21)
│   │   ├── document/                          # MongoDB Documents (User, Device, Room, TelemetryRecord)
│   │   ├── repository/                        # Spring Data Mongo Repositories
│   │   ├── service/                           # Business Logic (ComfortScore, TelegramBot, RBAC)
│   │   ├── controller/                        # REST API Controllers (JWT Protected)
│   │   └── configuration/                     # SecurityConfig (CORS, RateLimit, JWT)
│   ├── Frontend_React_Vite/                   # Mã nguồn D:\IOT-project\frontend (React 18, Tailwind, Zustand)
│   │   ├── pages/                             # Màn hình (Dashboard, ClassroomDetail, UserManagement)
│   │   ├── components/                        # Sơ đồ phòng đọc (Digital Twin), Widget cảm biến, Heatmap
│   │   └── services/                          # Tầng Axios API & WebSocket Client
│   └── docker-compose.yml                     # Cụm MongoDB 8.0, Mongo Express (8081), Mosquitto (1883)
│
├── 02_FIRMWARE_PHAN_CUNG/                     # MÃ NGUỒN NHÚNG ESP32-S3 (HƯỚNG CẤU TRÚC MODULAR C)
│   └── Code_Firmware_ESP32_S3/                # Mã nguồn D:\esp\Node_All_Sensors (ESP-IDF v4.4.8)
│       ├── main/app_config.h                  # Cấu hình chân GPIO, chu kỳ đo, ngưỡng cảnh báo
│       ├── main/main.c                        # Khởi tạo FreeRTOS tasks, Wi-Fi Station/AP, MQTT
│       ├── main/audio_i2s.c                   # Driver I2S DMA, thuật toán LAeq, SPL peak, điều khiển 3 LED
│       ├── main/drv_i2c_sensors.c             # Driver SHT30, BH1750, SCD40 NDIR, OLED SSD1306
│       ├── main/drv_adc_sensors.c             # Driver ADC1 bụi Sharp GP2Y10, Pin UPS 18650
│       ├── main/offline_storage.c             # Ring-buffer 64B nhị phân lưu Flash SPIFFS khi mất mạng
│       └── main/ota_remote_cfg.c              # Web Captive Portal cấu hình Wi-Fi & nạp OTA
│
├── 03_CONG_CU_MO_PHONG/                       # BỘ TEST & GIẢ LẬP DỮ LIỆU
│   └── simulate_dual_servers.py               # Trình sinh dữ liệu vi khí hậu & âm học tự động
│
├── 04_TAI_LIEU_BAO_CAO_CHINH_THUC/            # Thuyết minh tốt nghiệp, slide báo cáo, file Word
└── 05_GOI_BAN_GIAO_VA_LUU_TRU/                # Bản sao lưu backup, tài liệu bàn giao kỹ thuật
```

---

## 2. BẢN CHẤT KIẾN TRÚC FIRMWARE ESP32-S3 (ESP-IDF & FREERTOS)

### A. Code nhúng này có áp dụng FreeRTOS không?
**CÓ — Áp dụng 100% làm hạt nhân điều phối thời gian thực**.
1. **Đa tác vụ tiền định (Preemptive Multitasking)**:
   - `audio_loop_task` (Priority: High, 1s): Thu mẫu âm thanh I2S DMA liên tục, tính $L_{\text{Aeq}}$ và $SPL_{\text{peak}}$, đổi màu 3 LED (Xanh $\le 45$, Lam $45-55$, Đỏ $> 55\text{ dBA}$).
   - `sensor_task` (Priority: Medium): Multi-rate sampling (Lux 5s, SHT30/CO2 10s, Bụi 30s).
   - `publisher_task` (Priority: Normal): Đóng gói Compact JSON, đẩy MQTT `devices/{id}/telemetry`.
   - `display_task` (Priority: Low): Hiển thị màn hình OLED SSD1306.
   - `web_ota_task` (Priority: Low): Phát AP Wi-Fi và cập nhật firmware qua Web.
2. **Kỹ thuật Ghim Lõi Kép (Dual-Core SMP Pinning - `xTaskCreatePinnedToCore`)**:
   - **Core 0 (Protocol Core)**: Xử lý ngăn xếp mạng Wi-Fi, LWIP TCP/IP, MQTT Client, OTA.
   - **Core 1 (Application & DSP Core)**: Xử lý lấy mẫu âm thanh I2S DMA, giải thuật DSP và đọc I2C/ADC. Giúp quá trình tính toán âm học không bị gián đoạn khi truyền sóng Wi-Fi.
3. **Đồng bộ liên tác vụ (Queues & Mutexes)**:
   - `QueueHandle_t`: Chuyển dữ liệu đo từ `sensor_task` sang `publisher_task`.
   - `SemaphoreHandle_t` (I2C Mutex): Bảo vệ bus I2C tránh xung đột giữa 4 thiết bị slave (BH1750, SHT30, SCD40, SSD1306).

### B. Các Kỹ thuật Phần Cứng & Thuật Toán Chuyên Sâu Khác Được Áp Dụng:
1. **DMA (Direct Memory Access) cho Audio I2S**: Micro số INMP441 truyền dữ liệu trực tiếp vào SRAM qua bộ đệm kép (ping-pong DMA buffer) mà không tiêu tốn chu kỳ CPU.
2. **Thuật toán Âm học DSP $L_{\text{Aeq}}$ (IEC 61672)**:
   $$L_{\text{Aeq}} = 10 \log_{10} \left( \frac{1}{N} \sum_{i=1}^{N} 10^{0.1 \cdot L_i} \right)$$
   Tích lũy năng lượng âm học liên tục trong cửa sổ 1 giây để lọc các tiếng va đập tức thời.
3. **Bộ đệm Nhị Phân Flash SPIFFS (Binary Packed Ring-Buffer)**:
   - Cấu trúc 64 bytes (`__attribute__((packed))`).
   - Lưu trữ được hơn **14.680 bản ghi** (hơn 40 giờ) khi đứt mạng, tự động xả dồn FIFO khi có mạng lại.
4. **Cơ chế Cắm-Và-Chạy Không Treo Bus (Non-blocking I2C Auto-Recovery)**:
   - Tự động thăm dò I2C ACK khi khởi động. Nếu bất kỳ cảm biến nào chưa cắm, hệ thống tự động bypass mà không crash bus.
5. **Kỹ thuật Báo Cáo Theo Ngoại Lệ (Report by Exception & Deadband Filtering)**:
   - Khi ổn định: Gửi định kỳ 15s - 30s.
   - Khi có đột biến ($\Delta \text{Noise} > 6\text{ dBA}$ hoặc nồng độ khí tăng vọt): Kích hoạt ngắt gửi ngay lập tức (<100ms).

---

## 3. KIẾN TRÚC DỮ LIỆU LAI HOT / COLD TRÊN MONGODB 8.0 (LOẠI BỎ INFLUXDB)

Hệ thống chỉ sử dụng **MongoDB 8.0** kết hợp mô hình lưu trữ lai 2 tầng:

```
[ MQTT Message (Telemetry) ]
           │
           ▼
[ MqttMessageDispatcherService ]
           │
           ├──► [ HOT BUCKET: TimeSeries "telemetry_records" ]
           │    - Granularity: SECONDS (Bucketed & Columnar Snappy Compressed)
           │    - Tự động hủy sau 90 ngày: @Indexed(expireAfterSeconds = 7776000)
           │    - Phục vụ Heatmap & Biểu đồ thời gian thực 24h
           │
           ├──► [ COLD ARCHIVE: "telemetry_hourly_rollup" ]
           │    - Scheduled Task tổng hợp Min/Max/Avg/P95 mỗi giờ
           │    - Lưu trữ lịch sử 2 - 5 năm phục vụ nghiên cứu & TCVN 8681
           │    - Tiết kiệm 97% dung lượng đĩa
           │
           └──► [ TELEGRAM ALERT ENGINE: TelegramNotificationService ]
                - Cảnh báo âm thanh vượt 55 dBA
                - Cảnh báo ẩm mốc sách TCVN 8681 (RH > 70%)
                - Bắn tin nhắn trực tiếp đến Telegram Thủ thư (@TQB_SmartLib_Bot)
```

---

## 4. MA TRẬN PHÂN QUYỀN RBAC (5 VAI TRÒ ENTERPRISE)

| Role | Màn hình truy cập | Quyền hạn trên Mặt bằng (Digital Twin) | Cảnh báo Telegram |
| :--- | :--- | :--- | :---: |
| **`ADMIN`** | Toàn bộ Dashboard, User, Role, Sơ đồ phòng | Toàn quyền kéo-thả vị trí Node (`posX, posY`), sửa bàn/kệ sách/cửa | Có (Mất kết nối Node, lỗi hệ thống) |
| **`LIBRARIAN`** | Danh sách phòng, Heatmap, Xuất báo cáo TCVN | Xem vị trí node, điều chỉnh ngưỡng cảnh báo tiếng ồn/ẩm mốc | **Có (Tiếng ồn >55dBA, ẩm mốc sách >70%)** |
| **`MAINTENANCE`**| Trạng thái phần cứng, Pin UPS, RSSI Wi-Fi | Xem vị trí node để đến bảo trì, xác nhận (Acknowledge) sự cố | Có (Node offline, pin yếu, cảm biến lỗi) |
| **`VIEWER`** | Màn hình công cộng sảnh thư viện | Xem đèn Xanh/Lam/Đỏ mức độ yên tĩnh của các phòng | Không |
| **`DEVICE`** | Kênh MQTT Telemetry | Chỉ được phép ghi số liệu đo đạc (Write Only) | Không |
