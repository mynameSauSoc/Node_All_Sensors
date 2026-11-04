# HỆ THỐNG AIoT QUAN TRẮC MÔI TRƯỜNG & ÂM HỌC THƯ VIỆN TẠ QUANG BỬU (AIoTLibTQB — NODE 1 & SERVER SYNC)
> **Đồng bộ Toàn diện Phần cứng Bo mạch ESP32-S3 (Altium Designer 26 - 0 DRC) · Firmware ESP-IDF Đa nhiệm · Backend Spring Boot 3 (Java 21 Virtual Threads) · MongoDB 8.0 TimeSeries · Frontend Next.js 15**  
> *Đồ án Tốt nghiệp Kỹ sư — Trường Điện - Điện tử, Đại học Bách Khoa Hà Nội (HUST)*

---

## 📄 TÀI LIỆU BÁO CÁO ĐỒNG BỘ & ĐÁNH GIÁ KỸ THUẬT DÀNH CHO ĐỒNG ĐỘI

Toàn bộ phân tích kỹ thuật, đánh giá 7 hạng mục giao diện thực tế và chi tiết các thay đổi mã nguồn để đồng bộ giữa **Firmware Nhúng ESP32-S3 (`Node_All_Sensors`)** và **Hệ thống Server/Web (`AIoTLibTQB`)** được trình bày tại:

- 📘 **Bản Word chuẩn quy cách (.docx):** [`BAO_CAO_TOI_UU_DONG_BO_FIRMWARE_SERVER.docx`](./BAO_CAO_TOI_UU_DONG_BO_FIRMWARE_SERVER.docx)
- 📝 **Bản đọc trực tiếp trên GitHub (.md):** [`BAO_CAO_TOI_UU_DONG_BO_FIRMWARE_SERVER.md`](./BAO_CAO_TOI_UU_DONG_BO_FIRMWARE_SERVER.md)
- 📂 **Mã nguồn Server, Backend, Frontend & Simulator đã tối ưu hóa:** [`./server_aiotlibtqb/`](./server_aiotlibtqb/)
- 📂 **Mã nguồn Firmware ESP-IDF v4.4.8 cho Bo mạch Node 1:** [`./main/`](./main/)

---

## 🚀 1. TÓM TẮT CÁC NÂNG CẤP & ĐỒNG BỘ HÓA TRỌNG TÂM

### A. Tầng Firmware Nhúng (`main/`) & Backend Spring Boot (`server_aiotlibtqb/src/`)
1. **Bảo toàn 100% các thuật toán nhúng cốt lõi trên ESP32-S3:**
   - **Đo âm học chuẩn $L_{\text{Aeq}}$ (dBA):** Thu mẫu I2S0 DMA 24-bit @ 16 kHz từ micro MEMS INMP441, lọc thông cao IIR bậc 1 khử DC offset, tích phân EMA thời gian thực và kích hoạt loa I2S1 MAX98357A trong `< 100ms` khi vượt ngưỡng ồn.
   - **Nén nhị phân 64-byte trên Flash SPIFFS (`offline_record_64b_t`):** Lưu trữ hơn 14.600 bản ghi (`> 40 giờ` mất mạng Wi-Fi liên tục) trong 1MB Flash mà không dùng chuỗi JSON tốn bộ nhớ.
   - **Vòng lặp truyền tin đa chu kỳ tiết kiệm năng lượng (Multi-rate Adaptive Loop):** Chu kỳ nhanh khi cấp nguồn lưới AC (5s–10s), tự động giãn chu kỳ khi chạy pin dự phòng UPS (30s–60s), và ngắt khẩn cấp `< 100ms` khi vượt ngưỡng nguy hiểm.
2. **Tích hợp Cảm biến Khí CO₂ Quang âm SCD40 (`0x62`) & Chống lỗi Rớt Gói JSON:**
   - Bổ sung `@JsonIgnoreProperties(ignoreUnknown = true)` và trường `Double co2` (`300 - 5000 ppm`) vào `TelemetryPayload`, `EnvironmentMetrics` và `TelemetrySanitizerService`.
3. **Phân luồng Gói tin Xả bù Ngoại tuyến (`"is_replay": true`):**
   - Khi có mạng lại, ESP32-S3 xả bù dữ liệu từ Flash SPIFFS kèm cờ `"is_replay": true`. Backend (`MqttMessageDispatcherService`) tự động ghi thẳng vào MongoDB TimeSeries để vẽ biểu đồ lịch sử, **không ghi đè vào `LatestTelemetryCache`**, giữ cho Dashboard thời gian thực luôn phản ánh đúng thực tại.
4. **Bộ lọc Trạng thái Nghỉ (Standby Core Filter) cho Điểm Tiện nghi Liebig (`ComfortScoreService`):**
   - Tránh hiện tượng phòng tự học tắt đèn ban đêm (`lux < 40`, độ ồn yên tĩnh `<= 42 dBA`) làm sập điểm tiện nghi toàn phòng về mức Kém (Poor).
5. **Bổ sung `ZoneController` (`/api/v1/zones`) & Chuẩn hóa Route Aliases (`/overview`, `/devices/...`, `/rooms/...`):**
   - Khắc phục triệt để lỗi 404/500 và vượt qua tuyệt đối **191/191 bài kiểm thử tự động (0 lỗi)**.

### B. Tầng Giao diện Người dùng (`server_aiotlibtqb/frontend/`) — Giải quyết 7 Nhận xét Thực tiễn
1. **Giao diện Phòng đọc (`/rooms/[id]`):**
   - Nâng cấp lên **6 trụ cột tiện nghi** (bổ sung *Thông thoáng khí tươi CO₂ SCD40* chuẩn ASHRAE 62.1 và *An toàn bảo quản sách chống nấm mốc VTT* chuẩn TCVN 8681).
   - Thay thế ô Wi-Fi RSSI bằng ô **Khí CO₂ (ppm)** trong lưới 6 cảm biến chính.
   - Sửa nhãn chu kỳ lấy mẫu khớp phần cứng: `STOMP Realtime (<100ms · Chu kỳ AC 5s / UPS 60s)`.
   - Bổ sung **Hiệu ứng nhấp nháy đỏ (`animate-pulse`)**, nhãn `⚠️ VƯỢT MỨC`, **Chuông báo động âm thanh (Web Audio API Chime)** và nút **"Test Cảnh báo Đỏ & Âm thanh"** ngay trên giao diện.
   - Bổ sung **Vạch ngang đứt nét màu đỏ biểu thị ngưỡng giới hạn** trên biểu đồ chuỗi thời gian `MinMaxAvgChart`.
2. **Giao diện Tổng quan (`/dashboard`) & Cảnh báo (`/alerts`):**
   - Bổ sung hộp **"👉 Thủ thư cần thực hiện ngay (Quy trình SOP)"** và bảng cẩm nang xử lý sự cố cho từng loại cảnh báo (`NOISE_EXCEEDED`, `AIR_UNHEALTHY`, `DEVICE_OFFLINE`, `SENSOR_MALFUNCTION`).
3. **Giao diện Dữ liệu Cảm biến (`/telemetry-explorer`):**
   - Bổ sung tab **"Bảng Tổng quan Đa phòng (Live Multi-Room Matrix)"** giúp thủ thư nhìn bao quát toàn bộ 12 phòng đọc cùng lúc và lọc nhanh theo phòng ồn nhất / CO₂ cao nhất, bên cạnh chế độ tra cứu lịch sử 24h xuất CSV.
4. **Giao diện Bản đồ Tầng (`/floorplan`):**
   - Bật mặc định hiển thị **Vùng phủ cảm biến (`R = 6.0m`) & Điểm mù**, kèm thanh kiểm toán mật độ Node và nhãn phân biệt **không gian 2 cao độ (Sàn Tầng 1 Mượn sách + Tầng lửng Kho sách)**.
5. **Giao diện Kiosk Sảnh Thư viện (`/kiosk`):**
   - Thiết kế **🎓 Chế độ Sinh viên (Gợi ý nhanh trong 5 giây)**: Hiển thị rõ vị trí *"📍 BẠN ĐANG Ở ĐÂY: Sảnh Chính Tầng 1"*, **Top 3 phòng đọc lý tưởng nhất nên vào ngay**, hướng dẫn đường đi từng bước và bảng phân loại 3 màu đèn giao thông trực quan.
6. **Tối ưu Tốc độ Chuyển trang (`< 50ms`):**
   - Tối ưu hóa bộ đệm TanStack Query (`staleTime: 30s`, `gcTime: 5m`) và chạy bản **Production Build (`next build && next start`)** thay vì `next dev`, triệt tiêu hoàn toàn độ trễ biên dịch khi chuyển trang.

---

## 🛠️ 2. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY TOÀN HỆ THỐNG CHO ĐỒNG ĐỘI

Bạn có thể clone trực tiếp repository này về máy để lấy trọn bộ cả **Firmware Nhúng** lẫn **Server/Backend/Frontend đã đồng bộ**, hoặc copy các file trong thư mục [`./server_aiotlibtqb/`](./server_aiotlibtqb/) đè sang project `AIoTLibTQB` của bạn:

```bash
git clone https://github.com/mynameSauSoc/Node_All_Sensors.git
cd Node_All_Sensors
```

### Bước 1: Khởi chạy Hạ tầng Docker (Mosquitto MQTT, MongoDB 8.0 TimeSeries, Mongo Express)
```powershell
cd server_aiotlibtqb
docker compose up -d mosquitto mongodb mongo-express
```

### Bước 2: Khởi chạy Backend Spring Boot 3 (Port 8080)
Yêu cầu: **JDK 21**.
```powershell
cd server_aiotlibtqb
.\mvnw.cmd spring-boot:run
```
*(Kiểm tra toàn bộ 191 bài test: `.\mvnw.cmd test`)*

### Bước 3: Khởi chạy Frontend Next.js 15 ở Chế độ Tối ưu Tốc độ Cao (Port 3000)
Yêu cầu: **Node.js >= 20**.
```powershell
cd server_aiotlibtqb/frontend
npm install
npm run build
npm run start
```
> **Lưu ý:** Sử dụng `npm run build && npm run start` (Production mode) để đạt tốc độ chuyển trang tức thì `< 50ms`. Nếu đang viết thêm code mới cần Hot Reload thì mới chạy `npm run dev`.

### Bước 4: Chạy Trình Mô phỏng IoT Đa Phòng & Node 1 (`tools/iot-simulator`)
```powershell
cd server_aiotlibtqb/tools/iot-simulator
npm install
node src/index.js --scenario normal
```

---

## 🌐 3. ĐỊA CHỈ TRUY CẬP CỤC BỘ & TÀI KHOẢN KIỂM THỬ

| Phân hệ / Trang chức năng | Địa chỉ URL | Ghi chú & Tài khoản |
| :--- | :--- | :--- |
| **Đăng nhập Hệ thống** | `http://localhost:3000/login` | User: **`admin`** / Pass: **`admin123456`** |
| **Tổng quan & Chỉ dẫn SOP** | `http://localhost:3000/dashboard` | Giám sát KPI, Điểm sáng & Phòng cần xử lý |
| **Bản đồ Nhiệt 2D & Vùng phủ Node** | `http://localhost:3000/floorplan` | CAD 1:100, Bán kính R=6m & Phân tầng lửng |
| **Ma trận Đa phòng & Xuất CSV** | `http://localhost:3000/telemetry-explorer` | Xem 12 phòng cùng lúc hoặc truy vấn 24h |
| **Trung tâm Cảnh báo FSM & SOP** | `http://localhost:3000/alerts` | Xử lý sự cố kèm cẩm nang hành động |
| **Màn hình Kiosk Sinh viên** | `http://localhost:3000/kiosk` | Top 3 phòng gợi ý & Chỉ đường từ Sảnh T1 |
| **Backend Health Check** | `http://localhost:8080/actuator/health` | Trả về `{"status":"UP"}` |
| **Quản trị CSDL Mongo Express** | `http://localhost:8081` | User: **`admin`** / Pass: **`pass`** |

---

## 🔌 4. SƠ ĐỒ CHÂN PHẦN CỨNG BO MẠCH NODE 1 (ALTIUM DESIGNER 26 — 0 DRC)

Chi tiết cấu hình phần cứng chuẩn hóa trong tệp [`HARDWARE_MAP.md`](./HARDWARE_MAP.md) và [`main/app_config.h`](./main/app_config.h):

| Chân ESP32-S3 | Thiết Bị / Module Ngoại Vi | Chuẩn Giao Tiếp | Mức Điện Áp | Chức Năng Kỹ Thuật |
| :--- | :--- | :--- | :--- | :--- |
| **GPIO 1** | LED Xanh Lá (`G_LED`) | GPIO Output | 3.3V (Active HIGH) | Báo mức an toàn: Tiếng ồn $\le 45\text{ dBA}$ |
| **GPIO 2** | LED Xanh Dương (`B_LED`) | GPIO Output | 3.3V (Active HIGH) | Báo mức nhắc nhở: Tiếng ồn $45 - 55\text{ dBA}$ |
| **GPIO 42** | LED Đỏ (`R_LED`) | GPIO Output | 3.3V (Active HIGH) | Báo động vượt ngưỡng: Tiếng ồn $> 55\text{ dBA}$ |
| **GPIO 8 / 9** | Shared I2C Bus (`SDA` / `SCL`) | I2C Master | 3.3V (Trở kéo 4.7kΩ) | Kết nối OLED (`0x3C`), SHT30 (`0x44`), BH1750 (`0x23`), SCD40 (`0x62`) |
| **GPIO 4, 5, 6** | Micro MEMS INMP441 (`SCK, WS, SD`)| I2S0 DMA Rx | 3.3V LDO | Thu âm số 24-bit @ 16 kHz tính toán $L_{\text{Aeq}}$ (dBA) |
| **GPIO 15, 16, 7**| Amply Loa MAX98357A (`BCLK, LRC, DIN`)| I2S1 DMA Tx | 5V_PWR / 3.3V | Phát âm thanh nhắc nhở & còi cảnh báo khẩn cấp |
| **GPIO 10** | Xung kích LED Bụi (`DUST_PULSE`) | GPIO Output | Kích BJT SS8050 | Xung $0.32\text{ms}$ / chu kỳ $10\text{ms}$ cho cảm biến Sharp |
| **GPIO 3** | Đọc ADC Bụi (`DUST_ADC`) | ADC1_CH2 | Cầu phân áp 10k:20k | Nhân hệ số bù `1.5x` khôi phục điện áp $V_o$ tính PM2.5 |

---

## 📜 5. GIẤY PHÉP & BẢN QUYỀN (LICENSE)
Dự án thuộc Đồ án Tốt nghiệp Kỹ sư — Trường Điện - Điện tử, Đại học Bách Khoa Hà Nội (HUST). Bảo hộ theo giấy phép mã nguồn mở **MIT License**.
