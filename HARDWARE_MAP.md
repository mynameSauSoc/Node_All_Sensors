# HARDWARE MAP - HỆ THỐNG QUAN TRẮC MÔI TRƯỜNG THƯ VIỆN TẠ QUANG BỬU (ESP32-S3)

> **Single Source of Truth (SSOT) cho Phần Cứng & Sơ Đồ Chân**  
> Mọi thay đổi chân GPIO, chuẩn bus, hoặc linh kiện bắt buộc phải cập nhật tài liệu này trước khi chỉnh sửa mã nguồn.

---

## 1. THÔNG SỐ VI ĐIỀU KHIỂN TRUNG TÂM
- **Chipset**: ESP32-S3 (ESP32-S3-WROOM-1 / DevKit N16, Revision v0.2)
- **Bộ nhớ Flash**: 16 MB SPI Flash (Quad SPI, 80 MHz)
- **Bộ nhớ RAM**: 512 KB Internal SRAM (Không dùng external PSRAM)
- **Cổng nạp & Console Log**: Native USB-Serial/JTAG (`COM3`, VID:PID `303A:1001`, GPIO 19 D-, GPIO 20 D+)
- **Nguồn cấp vận hành**: 5V DC (Cổng USB Type-C hoặc Module sạc dự phòng UPS 18650)

---

## 2. BẢNG PHÂN BỔ SƠ ĐỒ CHÂN (PIN MAPPING TABLE)

| Chân ESP32-S3 | Tên Ngoại Vi / Module | Chuẩn Giao Tiếp | Mức Điện Áp | Thông Số / Địa Chỉ I2C / Kênh ADC | Chức Năng Chi Tiết |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GPIO 1** | Bóng LED Đơn Sắc Xanh Lá | GPIO Output | 3.3V | Active HIGH (qua trở 330Ω) | Báo trạng thái an toàn: Tiếng ồn $\le$ 45 dBA |
| **GPIO 2** | Bóng LED Đơn Sắc Xanh Dương | GPIO Output | 3.3V | Active HIGH (qua trở 330Ω) | Báo mức nhắc nhở: Tiếng ồn 45 - 55 dBA |
| **GPIO 42** | Bóng LED Đơn Sắc Đỏ | GPIO Output | 3.3V | Active HIGH (qua trở 330Ω) | Báo động nghiêm trọng: Tiếng ồn > 55 dBA / Khí độc cao |
| **GPIO 8** | Shared I2C Bus (SDA) | I2C Data | 3.3V | Tần số 100 kHz (Pull-up 4.7kΩ) | Đường dữ liệu I2C cho toàn bộ cảm biến số |
| **GPIO 9** | Shared I2C Bus (SCL) | I2C Clock | 3.3V | Tần số 100 kHz (Pull-up 4.7kΩ) | Đường xung nhịp I2C cho toàn bộ cảm biến số |
| *I2C Bus* | **BH1750** | I2C Slave | 3.3V | **Địa chỉ: `0x23`** | Đo độ rọi bàn đọc (Lux), chu kỳ 5 giây |
| *I2C Bus* | **SHT30 / SHT31** | I2C Slave | 3.3V | **Địa chỉ: `0x44`** | Đo nhiệt độ (°C) và độ ẩm (%RH), chu kỳ 10 giây |
| *I2C Bus* | **SCD40 (NDIR)** | I2C Slave | 3.3V / 5V | **Địa chỉ: `0x62`** | Đo nồng độ khí CO2 thực tế (ppm), chu kỳ 10 giây |
| *I2C Bus* | **OLED 0.96" SSD1306** | I2C Display | 3.3V | **Địa chỉ: `0x3C`** (dự phòng `0x3D`) | Màn hình 128x64 hiển thị IP, QR Code, chỉ số |
| **GPIO 4** | Micro INMP441 (SCK/BCLK) | I2S0 Rx Clock | 3.3V | 16-bit, 16 kHz DMA | Xung nhịp bit thu âm từ micro số MEMS |
| **GPIO 5** | Micro INMP441 (WS/LRCLK) | I2S0 Rx Word Sel | 3.3V | 16-bit, 16 kHz DMA | Chọn kênh trái/phải tín hiệu âm thanh thu |
| **GPIO 6** | Micro INMP441 (SD) | I2S0 Rx Serial Data | 3.3V | Dữ liệu PCM 16-bit | Đường dữ liệu âm thanh số từ micro vào ESP32-S3 |
| **GPIO 15** | Mạch Loa MAX98357A (BCLK)| I2S1 Tx Clock | 3.3V / 5V | 16-bit, 16 kHz DMA | Xung nhịp bit phát âm thanh cảnh báo |
| **GPIO 16** | Mạch Loa MAX98357A (LRC) | I2S1 Tx Word Sel | 3.3V / 5V | 16-bit, 16 kHz DMA | Chọn kênh phát âm thanh ra Amply Class-D |
| **GPIO 7** | Mạch Loa MAX98357A (DIN) | I2S1 Tx Serial Data | 3.3V / 5V | Dữ liệu PCM phát | Dữ liệu âm thanh phát ra Amply và Loa 1W 8Ω |
| **GPIO 10** | Sharp GP2Y1014AU0F (LED) | GPIO Output | 3.3V -> 5V BJT| Xung 0.32ms chu kỳ 10ms | Kích xung phát LED hồng ngoại đo bụi mịn PM2.5 |
| **GPIO 3** | Sharp GP2Y1014AU0F (Vo) | ADC Input | 0 - 3.1V | **ADC1_CHANNEL_2** (Atten 11dB) | Đọc điện áp tán xạ đo nồng độ bụi PM2.5 |
| **Chân Mở Rộng**| Module Khí SO2 (AFE) | ADC Input | 0 - 3.1V | **ADC1_CHANNEL_3** (Atten 11dB) | Đo khí SO2 gây axit hoá tài liệu (ppb) |
| **Chân Mở Rộng**| Module Khí NO2 (AFE) | ADC Input | 0 - 3.1V | **ADC1_CHANNEL_4** (Atten 11dB) | Đo khí NO2 gây ố vàng trang sách (ppb) |
| **Chân Mở Rộng**| Module Khí VOCs (AFE) | ADC Input | 0 - 3.1V | **ADC1_CHANNEL_5** (Atten 11dB) | Đo hợp chất hữu cơ bay hơi VOCs (ppb) |
| **Chân Mở Rộng**| Phân Áp Nguồn Pin UPS | ADC Input | 0 - 3.1V | **ADC1_CHANNEL_6** (Cầu trở 1:2) | Đo dung lượng Pin UPS (%) và trạng thái mất điện lưới |
| **GPIO 19** | Native USB D- | USB JTAG | 3.3V | USB D- Differential Pair | Nạp firmware và xuất log console tốc độ cao |
| **GPIO 20** | Native USB D+ | USB JTAG | 3.3V | USB D+ Differential Pair | Nạp firmware và xuất log console tốc độ cao |

---

## 3. THIẾT KẾ NGUỒN ĐIỆN & LƯU Ý PHẦN CỨNG (POWER & HARDWARE NOTES)

1. **Phân chia điện áp (Voltage Rails)**:
   - **Đường 3.3V**: Cấp nguồn cho ESP32-S3, OLED SSD1306, SHT30, BH1750, Micro INMP441. Cần tụ lọc $\ge 100\mu\text{F}$ song song tụ gốm $0.1\mu\text{F}$ chống sụt áp tức thời.
   - **Đường 5V**: Cấp cho Amply MAX98357A (để đạt công suất lớn cho Loa 1W), cảm biến bụi Sharp GP2Y1014AU0F (đèn phát hồng ngoại cần 5V), và cấp chân VIN của SCD40.
2. **Bảo vệ ngõ vào ADC**:
   - Tín hiệu Analog Out ($V_o$) của cảm biến Sharp có thể lên tới 3.7V - 4.2V khi nồng độ bụi cực đại. **Bắt buộc** đi qua mạch cầu phân áp điện trở ($10\text{k}\Omega : 20\text{k}\Omega$) để đưa điện áp về dưới $3.1\text{V}$ trước khi vào `GPIO 3` (ADC1_CH2).
3. **Cơ chế Cắm-Và-Chạy (Plug-and-Play Resilience)**:
   - Tất cả Driver I2C và ADC được lập trình cơ chế non-blocking: tự động thăm dò I2C ACK khi khởi động.
   - Nếu bất kỳ cảm biến nào chưa cắm (hoặc bị lỏng dây), hệ thống tự chuyển giá trị cảm biến đó sang `0` hoặc giữ trạng thái chờ, **tuyệt đối không treo chip, không crash bus I2C, không kích hoạt loa báo giả**.
4. **Cấu hình Brownout & Bootloader**:
   - Đã tắt Brownout Detector trong firmware (`CONFIG_ESP32S3_BROWNOUT_DET=n`) để tránh hiện tượng khởi động lại khi cắm cáp USB chất lượng kém hoặc dòng khởi động đỉnh của cảm biến NDIR SCD40 (đạt 205mA).
