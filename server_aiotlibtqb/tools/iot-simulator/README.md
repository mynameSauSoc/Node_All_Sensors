# AIoTLibTQB IoT Circuit Simulator

Bộ giả lập mạch IoT độc lập (standalone IoT Circuit Simulator) dành cho hệ thống Thư viện Thông minh AIoTLibTQB. Công cụ giả lập vi khí hậu, âm học, bụi mịn, kết nối MQTT, mô phỏng cảm biến vật lý ESP32-S3 theo thời gian thực và kích hoạt các kịch bản kiểm thử tích hợp (FSM Alerts, Watchdog Offline, Conflation, TimeSeries Aggregation).

---

## 1. Cài đặt & Chuẩn bị Môi trường

Yêu cầu môi trường: **Node.js >= 18** (đã kiểm chứng hoạt động tốt trên Node.js v24.18.0).

```bash
cd tools/iot-simulator
npm install
```

Sao chép cấu hình mẫu `.env.example` thành `.env`:

```bash
cp .env.example .env
```

### Bảng Biến Môi Trường

| Biến Môi Trường | Mặc Định | Mô Tả |
| :--- | :--- | :--- |
| `MQTT_BROKER_URL` | `mqtt://localhost:1883` | Địa chỉ MQTT Broker (Mosquitto) |
| `MQTT_USERNAME` | `aiot_backend` | Tài khoản MQTT kết nối |
| `MQTT_PASSWORD` | `aiot_backend_secret` | Mật khẩu tài khoản MQTT |
| `MQTT_CLIENT_PREFIX` | `sim_node_` | Tiền tố clientId cho các node giả lập |
| `MQTT_KEEPALIVE` | `30` | Keepalive interval (giây) |
| `API_BASE_URL` | `http://localhost:8080` | URL Backend REST API |
| `ADMIN_USERNAME` | `admin` | Tài khoản Admin cấp quyền provision |
| `ADMIN_PASSWORD` | `admin` | Mật khẩu Admin |
| `SIM_INTERVAL_MS` | `5000` | Chu kỳ gửi bản tin telemetry (ms) |
| `SIM_SPEED` | `1` | Hệ số tua nhanh thời gian (speed multiplier) |
| `DEFAULT_SCENARIO` | `normal` | Kịch bản mặc định |
| `FORCE_REMOTE` | `false` | Rào an toàn: cho phép kết nối broker ngoài loopback |

---

## 2. Rào An Toàn (Safety Guard)

Nhằm ngăn chặn rủi ro vô tình phát tán telemetry giả lập lên broker sản xuất (production) hoặc môi trường không kiểm soát, Simulator tích hợp **Safety Guard** tự động kiểm tra hostname:
- Chấp nhận: `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`, `host.docker.internal`, `*.local`.
- Từ chối mọi địa chỉ IP/domain từ xa trừ khi có cờ xác nhận tường minh:
  - Cờ CLI: `--force-remote`
  - Hoặc biến môi trường: `FORCE_REMOTE=true`

---

## 3. Khởi Tạo Hạ Tầng (Idempotent Provisioning)

Script tự động đồng bộ Zone, Room (`/api/v1/rooms`) và Device (`/api/v1/devices`) lên backend từ tệp cấu hình `config/rooms.json`. Đảm bảo tính **idempotent**: chạy nhiều lần không tạo bản ghi trùng lặp.

```bash
# Chạy trực tiếp script provision
npm run provision
# Hoặc: node src/provision.js
```

---

## 4. Danh Sách 10 Kịch Bản Kiểm Thử (Scenarios)

| Tên Kịch Bản | Tham Số `--scenario` | Mô Tả & Mục Đích Kiểm Thử |
| :--- | :--- | :--- |
| **Normal** | `normal` | Dữ liệu vi khí hậu dao động ổn định theo chu kỳ ngày đêm trong ngưỡng an toàn thư viện. |
| **Noise Spike** | `noise-spike` | Đột biến tiếng ồn vượt 65 dBA nền và 75 dBA đỉnh để kích hoạt Rule Engine FSM (`PENDING` -> `FIRING`). |
| **PM2.5 High** | `pm25-high` | Bụi mịn PM2.5 vượt ngưỡng 50 µg/m³ (đạt 68–80 µg/m³) kích hoạt cảnh báo chất lượng không khí. |
| **Heat / Humid** | `heat/humid` | Quá nhiệt (> 32°C, đạt 35.5°C) và độ ẩm cao (> 85%) kích hoạt cảnh báo vi khí hậu. |
| **Device Dropout** | `device-dropout` | Ngừng gửi bản tin > 2 phút để kiểm chứng `DeviceWatchdogService` chuyển trạng thái sang `OFFLINE`. |
| **Connection Flap** | `flap` | Mất kết nối chập chờn liên tục (đổi trạng thái `online`/`offline` mỗi 2.5 giây). |
| **Last Will (LWT)** | `lwt` | Ngắt kết nối socket đột ngột (không gửi MQTT DISCONNECT) để broker tự phát bản tin LWT offline. |
| **Bad Payload** | `bad-payload` | Gửi dữ liệu lỗi (ngoài dải vật lý, thiếu trường, NaN, sai hardwareId) để kiểm tra `TelemetrySanitizerService`. |
| **Burst Load** | `burst` | Bắn đột biến 100 bản tin trong 1 tick để kiểm tra `Semaphore` 30 permits giới hạn tải ghi MongoDB. |
| **Demo 24h** | `demo` | Mô phỏng tuần hoàn chu kỳ một ngày vận hành thư viện (sáng vắng -> trưa đông -> chiều cao điểm -> đêm). |

---

## 5. Hướng Dẫn Chạy Từng Kịch Bản

### 5.1 Kịch bản `normal` (Ổn định, 3 thiết bị, chạy 60 giây)
```bash
node src/index.js --scenario normal --devices 3 --duration 60 --interval 5
```

### 5.2 Kịch bản `noise-spike` (Kích hoạt FSM cảnh báo ồn, chạy 35 giây)
```bash
node src/index.js --scenario noise-spike --devices 3 --duration 35 --interval 3
```

### 5.3 Kịch bản `pm25-high` (Cảnh báo bụi mịn PM2.5)
```bash
node src/index.js --scenario pm25-high --devices 2 --duration 30 --interval 3
```

### 5.4 Kịch bản `heat/humid` (Cảnh báo nhiệt ẩm cao)
```bash
node src/index.js --scenario heat/humid --devices 2 --duration 30 --interval 3
```

### 5.5 Kịch bản `device-dropout` (Kiểm thử Watchdog OFFLINE)
```bash
node src/index.js --scenario device-dropout --devices 2 --duration 140 --interval 5
```

### 5.6 Kịch bản `flap` (Chập chờn kết nối)
```bash
node src/index.js --scenario flap --devices 1 --duration 20
```

### 5.7 Kịch bản `lwt` (Kích hoạt Last Will and Testament)
```bash
node src/index.js --scenario lwt --devices 1
```

### 5.8 Kịch bản `bad-payload` (Kiểm thử bộ lọc dữ liệu Sanitizer)
```bash
node src/index.js --scenario bad-payload --devices 2 --duration 20 --interval 3
```

### 5.9 Kịch bản `burst` (Kiểm thử Semaphore 30 permits)
```bash
node src/index.js --scenario burst --devices 1
```

### 5.10 Kịch bản `demo` với hệ số tua nhanh `--speed`
```bash
# Tua nhanh 60 lần (1 giờ thực tế = 1 phút mô phỏng, chạy trong 120 giây)
node src/index.js --scenario demo --speed 60 --duration 120 --interval 2
```

---

## 6. Tự Động Provision Trước Khi Chạy

Bạn có thể kết hợp cờ `--provision` với bất kỳ kịch bản nào để simulator tự kiểm tra và đăng ký phòng/thiết bị nếu chưa có:

```bash
node src/index.js --provision --scenario normal --devices 3 --duration 30
```
