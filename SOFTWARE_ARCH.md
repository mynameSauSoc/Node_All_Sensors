# SOFTWARE ARCHITECTURE - HỆ THỐNG QUAN TRẮC MÔI TRƯỜNG THƯ VIỆN TẠ QUANG BỬU (TQB SMARTLIB)

> **Single Source of Truth (SSOT) cho Kiến Trúc Phần Mềm & Luồng Dữ Liệu**  
> Mọi thay đổi về cấu trúc thư mục, thư viện, tác vụ FreeRTOS, luồng MQTT hoặc Schema dữ liệu phải được ghi nhận tại file này.

---

## 1. CẤU TRÚC THƯ MỤC HỆ THỐNG (SYSTEM DIRECTORY STRUCTURE)

```
d:\ĐỒ ÁN TỐT NGHIỆP\
├── .ai-rules                               # Luật hành vi AI (tiết kiệm token & chuẩn quy trình)
├── HARDWARE_MAP.md                         # SSOT phần cứng, sơ đồ chân GPIO, thông số điện áp
├── SOFTWARE_ARCH.md                        # SSOT kiến trúc phần mềm, luồng dữ liệu & MQTT
├── KHOI_DONG_SERVER_TQB.bat                # Script 1-click kích hoạt Docker, Firewall, Server & App
├── MO_APP_TQB_SMARTLIB.bat                 # Script mở giao diện trình duyệt Web & Grafana
├── server_ip.txt                           # Tệp lưu địa chỉ IP hiện tại của máy chủ
├── Bao_Cao_*.docx                          # Tài liệu thuyết minh luận văn tốt nghiệp
│
├── d:\esp\Node_All_Sensors\                # SOURCE CODE FIRMWARE ESP32-S3 (ESP-IDF v4.4.8)
│   ├── .ai-rules                           # Bản sao đồng bộ quy tắc AI
│   ├── HARDWARE_MAP.md                     # Bản sao đồng bộ phần cứng
│   ├── SOFTWARE_ARCH.md                    # Bản sao đồng bộ kiến trúc
│   ├── partitions.csv                      # Bảng phân vùng Flash (nvs, phy, otadata, ota_0, ota_1, storage)
│   ├── sdkconfig                           # Cấu hình ESP-IDF (USB Serial, no PSRAM, 16MB Flash)
│   └── main/
│       ├── app_config.h                    # File cấu hình trung tâm (GPIO pinout, ngưỡng báo động, chu kỳ)
│       ├── main.c                          # Khởi tạo hệ thống, Wi-Fi Station/AP, quản lý vòng đời tasks
│       ├── audio_i2s.c / .h                # Driver I2S DMA cho Micro INMP441 & Amply MAX98357A
│       ├── drv_i2c_sensors.c / .h          # Driver I2C (BH1750, SHT30, SCD40 CO2, OLED SSD1306)
│       ├── drv_adc_sensors.c / .h          # Driver ADC1 (Bụi Sharp GP2Y10, AFE SO2/NO2/VOC, Pin UPS)
│       ├── led_alert.c / .h                # Điều khiển 3 LED đơn sắc (GPIO 1 Xanh, 2 Lam, 42 Đỏ)
│       ├── offline_storage.c / .h          # Ghi & xả dữ liệu nhị phân 64B vào Flash SPIFFS khi mất mạng
│       ├── ota_remote_cfg.c / .h           # Web Server AP cấu hình Wi-Fi & nâng cấp OTA qua Web
│       └── mock_sensor.c / .h              # Bộ sinh dữ liệu giả lập cho Admin stress test
│
└── d:\iot_server\                          # CỤM DOCKER SERVER IOT LOCAL
    ├── docker-compose.yml                  # Khởi chạy Mosquitto, InfluxDB, Telegraf, Grafana
    ├── telegraf.conf                       # Cấu hình Telegraf chuyển tiếp MQTT -> InfluxDB
    ├── grafana_dashboard_*.json            # Mẫu Dashboard Grafana cho Phòng 411 TV Tạ Quang Bửu
    └── mosquitto/mosquitto.conf            # Cấu hình MQTT Broker (cổng 1883, cho phép anonymous)
```

---

## 2. KIẾN TRÚC FIRMWARE ESP32-S3 (ESP-IDF v4.4.8 & FREERTOS)

### A. Danh sách các Tác vụ FreeRTOS (Tasks)
1. **`audio_loop_task` (Ưu tiên cao, chu kỳ 1s)**:
   - Đọc mẫu âm thanh từ INMP441 qua I2S0 DMA.
   - Tính toán mức áp suất âm tương đương $L_{\text{Aeq}}$, âm nền $L_{\text{Aeq,bg}}$, và mức đỉnh $SPL_{\text{peak}}$.
   - Tự động điều khiển 3 bóng LED đơn sắc (GPIO 1, 2, 42) theo 3 cấp độ:
     - Xanh lá: $\le 45\text{ dBA}$ (Yên tĩnh)
     - Xanh dương: $45 - 55\text{ dBA}$ (Nhắc nhở)
     - Đỏ: $> 55\text{ dBA}$ (Báo động)
   - Kích hoạt Amply MAX98357A phát âm báo ngắn và bắn cờ cảnh báo tức thời.
2. **`sensor_task` (Multi-Rate Sampling)**:
   - Ánh sáng (BH1750): Quét mỗi **5 giây/lần**.
   - Vi khí hậu & Khí độc (SHT30, SCD40 CO2, VOCs, SO2, NO2): Quét mỗi **10 giây/lần**.
   - Bụi mịn PM2.5 (Sharp GP2Y10): Quét mỗi **30 giây/lần** (để tối ưu tuổi thọ phát hồng ngoại).
3. **`publisher_task` (Chu kỳ 10s AC / 30s UPS)**:
   - Đóng gói toàn bộ chỉ số thành JSON chuẩn.
   - Gửi lên MQTT Broker topic `library/p411/node_all_sensors/telemetry`.
   - Nếu mất kết nối Wi-Fi: Tự động gọi `offline_storage_write()`.
   - Khi có kết nối lại: Tự động replay theo batch (5 bản ghi/chu kỳ) để xả kho dữ liệu mà không nghẽn mạng.
4. **`display_task` (SSD1306 OLED 128x64)**:
   - Hiển thị địa chỉ IP, trạng thái Wi-Fi/MQTT, trạng thái các cảm biến và mã QR truy cập trang quản trị.
5. **`web_ota_task` & Captive Portal**:
   - Khi chưa có cấu hình mạng: Tự động phát AP `TQB_NODE_SETUP` tại `192.168.4.1` để thủ thư nhập Wi-Fi.
   - Hỗ trợ nạp firmware từ xa (OTA Update) qua giao diện Web.

---

## 3. CƠ CHẾ BẢO VỆ OFFLINE (FAULT TOLERANCE)
- **Cấu trúc bản ghi nhị phân (`offline_record_64b_t`)**: 64 bytes/bản ghi đóng gói chặt chẽ (`__attribute__((packed))`).
- **Dung lượng lưu trữ**: Phân vùng SPIFFS 1MB chứa được **~14.680 bản ghi** (tương đương hơn **40 giờ lưu trữ liên tục** khi mất toàn bộ điện lưới và internet).
- **Cơ chế phục hồi (Self-Healing Replay)**: Khi có lại kết nối, hệ thống xả dữ liệu cũ song song với dữ liệu thực thời gian thực theo cơ chế hàng đợi FIFO.

---

## 4. LUỒNG DỮ LIỆU HỆ THỐNG (DATA FLOW PIPELINE)

```
[ ESP32-S3 Sensor Node ]
       │
       ├── (Luồng Nóng <100ms: Vượt ngưỡng ồn >55dBA / CO2 >1000ppm)
       │    └── MQTT: library/p411/node_all_sensors/alert
       │         └── Python Coordinator Server (Port 8090)
       │              └── Bot Telegram Thủ thư (@TQB_SmartLib_Bot)
       │
       └── (Luồng Lạnh 10s: Chu kỳ đo định kỳ)
            └── MQTT: library/p411/node_all_sensors/telemetry
                 └── Telegraf (Port 1883)
                      └── InfluxDB 2.7 (Port 8086, Org: hust_library, Bucket: sensor_data)
                           └── Grafana 10.2 (Port 3000 Dashboard)
```

---

## 5. QUY ƯỚC MQTT TOPICS & JSON SCHEMA

### A. Luồng Lạnh (Telemetry): `library/p411/node_all_sensors/telemetry`
```json
{
  "node_id": "TQB_P411_NODE_01",
  "laeq_db": 42.5,
  "laeq_bg_db": 39.8,
  "spl_peak_db": 48.2,
  "temp": 24.6,
  "rh": 58.2,
  "lux": 420.0,
  "co2_ppm": 650,
  "pm25": 18.5,
  "so2_ppb": 2.1,
  "no2_ppb": 3.4,
  "voc_ppb": 85.0,
  "power_mode": 1,
  "battery_pct": 100,
  "offline_cached": 0,
  "status": "GREEN_NORMAL"
}
```

### B. Luồng Nóng (Cảnh báo vượt ngưỡng): `library/p411/node_all_sensors/alert`
```json
{
  "node_id": "TQB_P411_NODE_01",
  "alert_type": "NOISE_EXCEEDED",
  "level": "RED_ALERT",
  "laeq_db": 62.4,
  "threshold_db": 55.0,
  "message": "⚠️ Phát hiện tiếng ồn vượt ngưỡng tại Bàn 01 (62.4 dBA > 55.0 dBA)! Đã phát âm báo nhắc nhở.",
  "timestamp": 1729780000
}
```

### C. Luồng Điều Khiển Admin (Command): `library/p411/node_all_sensors/cmd`
```json
{
  "cmd": "SET_MODE",
  "mock_mode": 0,
  "role": 4,
  "reset_offline": false
}
```
