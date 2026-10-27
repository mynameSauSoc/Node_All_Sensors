# HỆ THỐNG AIoT QUAN TRẮC MÔI TRƯỜNG & ÂM HỌC THƯ VIỆN TẠ QUANG BỬU (TQB SMARTLIB)
> **Nền tảng Bo Mạch Chủ Cắm Chân Tùy Biến (Universal Modular Carrier Board) & Phần Mềm Nhúng ESP32-S3 Đa Nhiệm Thời Gian Thực**  
> *Đồ án Tốt nghiệp Kỹ sư - Đại học Bách Khoa Hà Nội (HUST)*

---

## 📌 1. TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)

Dự án phát triển một giải pháp hoàn chỉnh từ **Phần cứng (Altium Carrier Board)**, **Firmware nhúng (ESP-IDF v4.4.8 / FreeRTOS)** đến **Hạ tầng máy chủ (Docker, InfluxDB, Grafana, Telegram Bot)** nhằm giải quyết 3 bài toán trọng điểm tại Phòng Đọc Chuyên Ngành P.411 Thư viện Tạ Quang Bửu:
1. **Âm học số thời gian thực**: Lọc IIR A-weighting và tích phân năng lượng mức âm tương đương $L_{\text{Aeq}}$ (10s) loại bỏ xung âm vô hại 1s, phát hiện chính xác tiếng ồn đàm thoại vi phạm trật tự ($> 55\text{ dBA}$).
2. **Vi khí hậu & Bảo quản tài liệu**: Đo đạc độ rọi ánh sáng (BH1750), nhiệt độ - độ ẩm chống nấm mốc sách (SHT30), nồng độ khí $\text{CO}_2$ NDIR chống ngột ngạt (SCD40) và bụi mịn tán xạ hồng ngoại (Sharp GP2Y1014AU0F).
3. **Phân luồng dữ liệu kép & Chống mất mạng (Offline Fault Tolerance)**:
   - **Luồng Nóng (Hot Stream < 100ms)**: Bắn cảnh báo tức thời qua 3 LED đơn sắc rời, loa 1W và Telegram Bot thủ thư.
   - **Luồng Lạnh (Cold Stream 10s)**: Đẩy gói tin định kỳ lên MQTT Broker, lưu trữ chuỗi thời gian InfluxDB và trực quan hóa Grafana.
   - **Lưu trữ Offline**: Bộ đệm nhị phân 64B trên 1MB SPIFFS Flash lưu $> 40$ giờ khi cúp điện/mất Wi-Fi, tự xả bù FIFO khi có mạng lại.

---

## 🔌 2. SƠ ĐỒ CHÂN PHẦN CỨNG (HARDWARE PIN MAPPING)

Chi tiết cấu hình phần cứng chuẩn hóa trong tệp [HARDWARE_MAP.md](file:///d:/esp/Node_All_Sensors/HARDWARE_MAP.md):

| Chân ESP32-S3 | Thiết Bị / Module Ngoại Vi | Chuẩn Giao Tiếp | Mức Điện Áp | Chức Năng Kỹ Thuật |
| :--- | :--- | :--- | :--- | :--- |
| **GPIO 1** | Bóng LED Đơn Sắc Xanh Lá | GPIO Output | 3.3V (Trở 330Ω) | Báo trạng thái an toàn: Tiếng ồn $\le 45\text{ dBA}$ |
| **GPIO 2** | Bóng LED Đơn Sắc Xanh Lam | GPIO Output | 3.3V (Trở 100Ω) | Báo mức nhắc nhở: Tiếng ồn $45 - 55\text{ dBA}$ |
| **GPIO 42** | Bóng LED Đơn Sắc Đỏ | GPIO Output | 3.3V (Trở 330Ω) | Báo động nghiêm trọng: Tiếng ồn $> 55\text{ dBA}$ |
| **GPIO 8** | Shared I2C Bus (SDA) | I2C Data | 3.3V (Pull-up 4.7kΩ) | Đường dữ liệu I2C cho toàn bộ cảm biến số |
| **GPIO 9** | Shared I2C Bus (SCL) | I2C Clock | 3.3V (Pull-up 4.7kΩ) | Đường xung nhịp I2C cho toàn bộ cảm biến số |
| *I2C: 0x3C* | **Màn hình OLED 0.96" SSD1306** | I2C Display | 3.3V LDO | Hiển thị địa chỉ IP, mã QR cấu hình và bảng 8 chỉ số |
| *I2C: 0x23* | **Cảm biến Ánh sáng BH1750** | I2C Slave | 3.3V LDO | Đo độ rọi bàn học (Lux), chuẩn CIE V($\lambda$) |
| *I2C: 0x44* | **Cảm biến Nhiệt Ẩm SHT30** | I2C Slave | 3.3V LDO | Đo nhiệt độ - độ ẩm, có thanh nhiệt sấy chống đọng sương |
| *I2C: 0x62* | **Cảm biến CO2 NDIR SCD40** | I2C Slave | 3.3V / 5V | Đo nồng độ khí $\text{CO}_2$ quang phổ thực (400 - 5000 ppm) |
| **GPIO 4** | Micro INMP441 (SCK/BCLK) | I2S0 Rx Clock | 3.3V LDO | Xung nhịp bit thu âm từ micro số MEMS 24-bit |
| **GPIO 5** | Micro INMP441 (WS/LRCLK) | I2S0 Rx Word Sel | 3.3V LDO | Chọn kênh thu tín hiệu âm thanh (kênh Trái - L/R nối GND) |
| **GPIO 6** | Micro INMP441 (SD) | I2S0 Rx Data | 3.3V LDO | Luồng dữ liệu âm thanh số 16 kHz nạp trực tiếp qua DMA |
| **GPIO 15** | Mạch Loa MAX98357A (BCLK) | I2S1 Tx Clock | 5V_PWR / 3.3V | Xung nhịp phát âm thanh cảnh báo |
| **GPIO 16** | Mạch Loa MAX98357A (LRC) | I2S1 Tx Word Sel | 5V_PWR / 3.3V | Chọn kênh phát âm thanh ra Amply Class-D |
| **GPIO 7** | Mạch Loa MAX98357A (DIN) | I2S1 Tx Data | 5V_PWR / 3.3V | Dữ liệu PCM phát ra Amply và Loa 1W 8Ω |
| **GPIO 10** | Cảm biến Bụi Sharp (LED Trigger)| GPIO Output | 3.3V qua BJT SS8050 | Kích xung $0.32\text{ms}$ (chu kỳ 10ms) bật LED phát hồng ngoại |
| **GPIO 3** | Cảm biến Bụi Sharp (Vo) | ADC Input | 0 - 2.8V (Cầu trở 10k:20k) | Đọc điện áp tán xạ bụi PM2.5 (ADC1_CHANNEL_2) |
| **GPIO 19, 20**| Native USB D- / D+ | USB JTAG Console | 3.3V | Nạp code tốc độ cao và xuất log giám sát qua cổng COM3 |

---

## 🛠️ 3. HƯỚNG DẪN CÀI ĐẶT & NẠP FIRMWARE (FIRMWARE SETUP)

### Bước 1: Chuẩn bị môi trường ESP-IDF v4.4.8
Hệ thống được phát triển và kiểm thử chuẩn xác trên **ESP-IDF v4.4.8**.
1. Tải và cài đặt ESP-IDF Tools Installer v4.4.8 cho Windows.
2. Mở cửa sổ dòng lệnh **ESP-IDF 4.4 CMD** hoặc PowerShell.

### Bước 2: Cấu hình thông số mạng trong mã nguồn
Mở tệp `main/app_config.h` và kiểm tra cấu hình Wi-Fi & MQTT Broker:
```c
#define WIFI_SSID               "FPT TANG 5"          // Tên Wi-Fi thư viện/phòng lab
#define WIFI_PASS               "88888888"            // Mật khẩu Wi-Fi
#define MQTT_BROKER_URI         "mqtt://192.168.100.209" // IP máy chủ Docker IoT
```

### Bước 3: Biên dịch và Nạp firmware qua cổng USB
Cắm cáp USB Type-C từ máy tính vào cổng USB Native của bo mạch ESP32-S3:
```powershell
cd d:\esp\Node_All_Sensors
idf.py set-target esp32s3
idf.py build
idf.py -p COM3 flash monitor
```
*(Nếu cổng COM khác `COM3`, kiểm tra trong Device Manager và thay thế số cổng tương ứng).*

---

## 🌐 4. TỰ ĐỘNG CẤU HÌNH WI-FI (CAPTIVE PORTAL) & NÂNG CẤP WEB OTA

Nếu không tìm thấy Wi-Fi đã lưu, ESP32-S3 tự động chuyển sang chế độ dự phòng thông minh:
1. Thiết bị tự phát mạng Wi-Fi tên: **`TQB_NODE_SETUP`** (Mật khẩu mặc định: để mở).
2. Dùng điện thoại kết nối vào Wi-Fi này $\rightarrow$ Trình duyệt tự bật trang Captive Portal tại **`http://192.168.4.1`**.
3. Chọn mạng Wi-Fi của phòng đọc, nhập mật khẩu và bấm **Save & Reboot**.
4. **Nâng cấp từ xa (Web OTA)**: Truy cập trang quản trị web của Node $\rightarrow$ Chọn file `main.bin` $\rightarrow$ Bấm **Upload Firmware** để nạp không dây mà không cần cắm cáp USB!

---

## 🐳 5. KHỞI ĐỘNG CỤM MÁY CHỦ DOCKER IOT & CƠ SỞ DỮ LIỆU

Hạ tầng máy chủ được đóng gói hoàn toàn trong Docker Compose tại thư mục `d:\iot_server`:
1. Chạy tệp kịch bản khởi động 1-click:
   ```cmd
   d:\ĐỒ ÁN TỐT NGHIỆP\KHOI_DONG_SERVER_TQB.bat
   ```
2. Hoặc khởi chạy thủ công bằng Docker:
   ```powershell
   cd d:\iot_server
   docker-compose up -d
   ```
3. **Các dịch vụ sẵn sàng hoạt động**:
   - **MQTT Broker (Eclipse Mosquitto)**: `localhost:1883`
   - **Cơ sở dữ liệu InfluxDB 2.7**: `http://localhost:8086` (Org: `hust_library`, Bucket: `sensor_data`)
   - **Giao diện Dashboard Grafana**: `http://localhost:3000` (User: `admin` / Pass: `admin`)
   - **Web App & Điều phối Telegram Bot**: `http://localhost:8090`

---

## 📚 6. HỒ SƠ TÀI LIỆU KỸ THUẬT & SINGLE SOURCE OF TRUTH (SSOT)

Dự án cung cấp bộ tài liệu kỹ thuật hoàn chỉnh phục vụ nghiên cứu, chấm điểm đồ án và bảo hành:

| Tên Tài Liệu | Định Dạng | Mô Tả Nội Dung |
| :--- | :--- | :--- |
| [HARDWARE_MAP.md](file:///d:/esp/Node_All_Sensors/HARDWARE_MAP.md) | Markdown | Bảng tra cứu sơ đồ chân GPIO, thông số điện áp và lưu ý chống nhiễu |
| [SOFTWARE_ARCH.md](file:///d:/esp/Node_All_Sensors/SOFTWARE_ARCH.md) | Markdown | Kiến trúc đa nhiệm FreeRTOS, luồng dữ liệu Nóng/Lạnh và JSON Schema |
| [BAO_CAO_THIET_KE_NGUYEN_LY_MACH_AIOT_TQB.docx](file:///d:/esp/Node_All_Sensors/BAO_CAO_THIET_KE_NGUYEN_LY_MACH_AIOT_TQB.docx) | Word .docx | Báo cáo thuyết minh thiết kế nguyên lý mạch, tính toán điện tử & Altium BOM |
| [BAO_CAO_HE_THONG_PHAN_MEM_NHUNG_VA_SERVER_DB.docx](file:///d:/esp/Node_All_Sensors/BAO_CAO_HE_THONG_PHAN_MEM_NHUNG_VA_SERVER_DB.docx) | Word .docx | Báo cáo thuyết minh thuật toán DSP âm thanh số, cơ chế Offline & Docker Server |
| [.ai-rules](file:///d:/esp/Node_All_Sensors/.ai-rules) | Config | Luật định hình hành vi AI giúp các phiên làm việc sau không bị trôi ngữ cảnh |

---

## 📜 7. GIẤY PHÉP & BẢN QUYỀN (LICENSE)
Dự án được bảo hộ theo Giấy phép mã nguồn mở **MIT License**. Thiết kế phần cứng và phần mềm thuộc sở hữu nghiên cứu của Nhóm sinh viên K65 - Trường Điện - Điện tử, Đại học Bách Khoa Hà Nội.
