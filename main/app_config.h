#pragma once
#include <stdint.h>
#include <stdbool.h>

/**
 * @file app_config.h
 * @brief Cấu hình trung tâm của dự án Node_All_Sensors (ESP32-S3)
 *        Bao gồm:
 *        1. Cấu hình Wi-Fi, MQTT Broker (Luồng Nóng & Luồng Lạnh) và Bot Telegram.
 *        2. Công tắc chọn Chế độ vận hành: Giả lập Kiểm thử (Admin Test Mode) vs Phần cứng Thật (Real Hardware).
 *        3. Sơ đồ chân GPIO (Pinout) cho 3 Đèn LED đơn sắc rời, Bus I2C (BH1750, SHT30, SCD40, Màn hình OLED),
 *           Bus I2S DMA (Micro INMP441 + Mạch giải mã MAX98357A + Loa 1W), và ADC (Bụi Sharp GP2Y10, Khí độc, Pin UPS).
 */

// =============================================================================
// 1. CHẾ ĐỘ VẬN HÀNH & CẤU HÌNH VAI TRÒ NODE (PLUG-AND-PLAY MODULAR NODE)
// =============================================================================
// Đặt = 1: Chạy chế độ Giả lập (Mock Data / Admin Stress Test) khi chưa cắm cảm biến vật lý.
// Đặt = 0: Chạy chế độ Đọc Driver Phần Cứng Thật (tự động phát hiện cảm biến nào đang cắm, cảm biến nào đã rút ra).
#define USE_MOCK_SENSOR_MODE    0

// Định nghĩa 3 cấp độ Node theo đúng tài liệu thiết kế hệ thống:
// - NODE_TYPE_1_TABLE  (Cấp 1 - Node Bàn Đọc) : Cắm INMP441 + BH1750 + 3 Đèn LED rời (Rút SHT30/SCD40/PM2.5)
// - NODE_TYPE_2_COLUMN (Cấp 2 - Node Cột)     : Cắm SCD40 + BH1750 + INMP441 (Ồn nền) + MAX98357A Loa 1W + Màn OLED
// - NODE_TYPE_3_SHELF  (Cấp 3 - Node Kệ Sách) : Cắm SHT30 + BH1750 + Sharp GP2Y10 PM2.5 + Khí độc SO2/NO2/VOCs
// - NODE_TYPE_ALL_TEST (Node Tổng hợp Demo)   : Bật toàn bộ các module để kiểm thử tổng thể
#define NODE_ROLE_CURRENT       4   // 1: Node 1 Bàn | 2: Node 2 Cột | 3: Node 3 Kệ Sách | 4: Node All Sensors

// =============================================================================
// 2. CẤU HÌNH MẠNG WI-FI, MQTT BROKER & TELEGRAM BOT THỦ THƯ
// =============================================================================
#define WIFI_SSID               "FPT TANG 5"
#define WIFI_PASS               "88888888"

#define MQTT_BROKER_URI         "mqtt://192.168.100.209"
#define MQTT_TOPIC_TELEMETRY    "library/p411/node_all_sensors/telemetry" // Luồng Lạnh: Lưu InfluxDB & Vẽ biểu đồ
#define MQTT_TOPIC_ALERT        "library/p411/node_all_sensors/alert"     // Luồng Nóng: Bắn tức thời (<100ms) ra Telegram & Loa
#define MQTT_TOPIC_ADMIN_CMD    "library/p411/node_all_sensors/cmd"       // Nhận lệnh điều khiển Test từ Admin

// Thông tin Bot Telegram chính thức của dự án (nhận cảnh báo qua cả Wi-Fi lẫn 4G/5G)
#define TELEGRAM_BOT_TOKEN      "8955861861:AAGOT3pJCJs5_2_e231k8wXsirzR9AyOR7o"
#define TELEGRAM_CHAT_ID        "8777618210"

// =============================================================================
// 3. SƠ ĐỒ CHÂN PHẦN CỨNG (PINOUT) TRÊN CHIP ESP32-S3
// =============================================================================
// --- A. 3 Bóng Đèn LED Đơn Sắc Riêng Biệt (Không dùng LED dải RGB) ---
#define LED_GREEN_PIN           1   // GPIO 1 : Bóng LED Xanh lá (Mức An toàn <= 45 dBA)
#define LED_BLUE_PIN            2   // GPIO 2 : Bóng LED Xanh dương (Mức Nhắc nhở 45 - 55 dBA)
#define LED_RED_PIN             42  // GPIO 42: Bóng LED Đỏ (Mức Báo động > 55 dBA)

// --- B. Bus Giao tiếp I2C Dùng Chung (BH1750, SHT30, SCD40, Màn hình OLED SSD1306) ---
#define I2C_MASTER_NUM          0           // Sử dụng bộ điều khiển I2C phần cứng số 0
#define I2C_MASTER_SDA_IO       8           // Chân truyền dữ liệu I2C (SDA -> GPIO 8)
#define I2C_MASTER_SCL_IO       9           // Chân xung nhịp I2C (SCL -> GPIO 9)
#define I2C_MASTER_FREQ_HZ      100000      // Tốc độ chuẩn 100 kHz (ổn định nhất khi nối nhiều cảm biến)

#define I2C_ADDR_BH1750         0x23        // Địa chỉ 7-bit của Cảm biến ánh sáng BH1750
#define I2C_ADDR_SHT30          0x44        // Địa chỉ 7-bit của Cảm biến nhiệt/ẩm SHT30 / SHT31
#define I2C_ADDR_SCD40          0x62        // Địa chỉ 7-bit của Cảm biến khí CO2 NDIR SCD40
#define I2C_ADDR_OLED_SSD1306   0x3C        // Địa chỉ 7-bit của Màn hình OLED 0.96" SSD1306 (128x64)

// --- C. Bus Giao tiếp Âm thanh Số I2S DMA (Micro INMP441 & Mạch Loa MAX98357A) ---
#define I2S_MIC_PORT            0           // I2S0 Rx: Thu âm từ Micro kỹ thuật số INMP441
#define I2S_MIC_SCK_PIN         4           // Chân xung nhịp bit BCLK/SCK của INMP441 (GPIO 4)
#define I2S_MIC_WS_PIN          5           // Chân chọn kênh trái/phải WS/LRCLK của INMP441 (GPIO 5)
#define I2S_MIC_SD_PIN          6           // Chân dữ liệu âm thanh SD của INMP441 (GPIO 6)

#define I2S_SPK_PORT            1           // I2S1 Tx: Phát âm báo ra mạch giải mã MAX98357A Class-D + Loa 1W
#define I2S_SPK_BCLK_PIN        15          // Chân xung nhịp BCLK của MAX98357A (GPIO 15)
#define I2S_SPK_LRC_PIN         16          // Chân chọn kênh LRC của MAX98357A (GPIO 16)
#define I2S_SPK_DIN_PIN         7           // Chân dữ liệu âm thanh DIN của MAX98357A (GPIO 7)

// --- D. Cụm Cảm biến Bụi mịn Sharp GP2Y1014AU0F, Khí độc Analog & Đo Pin UPS ---
#define SHARP_LED_Trigger_PIN   10          // GPIO 10: Chân kích xung bật/tắt LED hồng ngoại của cảm biến bụi Sharp
#define ADC_CH_SHARP_PM25       2           // ADC1_CHANNEL_2 (GPIO 3): Đọc điện áp tán xạ bụi mịn PM2.5
#define ADC_CH_GAS_SO2          3           // ADC1_CHANNEL_3 (GPIO 4/tuỳ chọn): Đọc tín hiệu AFE cảm biến SO2
#define ADC_CH_GAS_NO2          4           // ADC1_CHANNEL_4: Đọc tín hiệu AFE cảm biến NO2
#define ADC_CH_GAS_VOC          5           // ADC1_CHANNEL_5: Đọc tín hiệu cảm biến VOCs
#define ADC_CH_UPS_BATTERY      6           // ADC1_CHANNEL_6: Đọc cầu phân áp kiểm tra nguồn AC / % Pin dự phòng UPS

// =============================================================================
// 4. CẤU HÌNH CHU KỲ ĐO ĐA TỐC ĐỘ (MULTI-RATE SAMPLING) & BỘ NHỚ OFFLINE
// =============================================================================
#define AUDIO_FAST_LOOP_MS          1000    // 1 giây/lần : Quét âm thanh INMP441 & kiểm tra vượt ngưỡng tức thời
#define LUX_SAMPLE_PERIOD_SEC       5       // 5 giây/lần : Đo ánh sáng BH1750
#define ENV_GAS_SAMPLE_PERIOD_SEC   10      // 10 giây/lần: Đo Vi khí hậu (SHT30/SCD40) & Khí độc (VOCs, SO2, NO2)
#define PM25_SAMPLE_PERIOD_SEC      30      // 30 giây/lần: Đo bụi mịn PM2.5 (bảo vệ tuổi thọ cảm biến)

#define PUBLISH_PERIOD_AC_SEC       10      // Khi có điện lưới: Gửi gói tin định kỳ mỗi 10 giây (nếu không có biến cố)
#define PUBLISH_PERIOD_UPS_SEC      30      // Khi mất điện (chạy Pin UPS): Giãn chu kỳ gửi/lưu lên 30 giây

#define OFFLINE_STORAGE_MAX_RECORDS 14680   // Sức chứa tối đa trên 1MB Flash (~14,680 bản ghi nhị phân x 64 bytes)
#define OFFLINE_REPLAY_BATCH_SIZE   5       // Số bản ghi cũ xả bù tối đa mỗi chu kỳ khi có Wi-Fi trở lại

// =============================================================================
// 5. NGƯỠNG CẢNH BÁO TIÊU CHUẨN (KÍCH HOẠT TELEGRAM & LOA BÁO THỦ THƯ)
// =============================================================================
#define NOISE_WARNING_DB        45.0f   // Ngưỡng bắt đầu nhắc nhở tiếng ồn (dBA) -> Bật LED Xanh dương
#define NOISE_ALERT_DB          55.0f   // Ngưỡng vượt mức ồn cho phép -> Bật LED Đỏ + Loa 1W + Gửi Telegram
#define CO2_ALERT_PPM           1000    // Ngưỡng CO2 gây ngột ngạt, buồn ngủ (ppm)
#define RH_ALERT_PERCENT        65.0f   // Ngưỡng độ ẩm nguy cơ nấm mốc sách (%RH theo chuẩn ISO 11799)
#define PM25_ALERT_UGM3         35.0f   // Ngưỡng bụi mịn PM2.5 bám bề mặt tài liệu (ug/m3)
#define SO2_ALERT_PPB           10.0f   // Ngưỡng khí độc SO2 gây axit hóa giấy (ppb)
#define NO2_ALERT_PPB           10.0f   // Ngưỡng khí độc NO2 gây oxy hóa & ố vàng giấy (ppb)
#define VOC_ALERT_PPB           300.0f  // Ngưỡng khí VOCs làm ố vàng tài liệu (ppb)

// =============================================================================
// 6. CẤU TRÚC BẢN GHI NHỊ PHÂN LƯU FLASH KHI MẤT ĐIỆN / MẤT WI-FI (64 BYTES)
// =============================================================================
typedef struct __attribute__((packed)) {
    uint32_t timestamp;      // Thời điểm đo (Unix epoch / Uptime giây) - 4 bytes
    float    laeq_db;        // Độ ồn bàn đọc LAeq (dBA) - 4 bytes
    float    laeq_bg_db;     // Độ ồn nền LAeq,bg (dBA) - 4 bytes
    float    spl_peak_db;    // Áp suất âm đỉnh SPL (dBA) - 4 bytes
    float    temp;           // Nhiệt độ (°C) - 4 bytes
    float    rh;             // Độ ẩm (%RH) - 4 bytes
    float    lux;            // Ánh sáng (Lux) - 4 bytes
    float    pm25;           // Bụi mịn PM2.5 (ug/m3) - 4 bytes
    float    so2_ppb;        // Khí SO2 (ppb) - 4 bytes
    float    no2_ppb;        // Khí NO2 (ppb) - 4 bytes
    float    voc_ppb;        // Khí VOCs (ppb) - 4 bytes
    uint16_t co2_ppm;        // Khí CO2 (ppm) - 2 bytes
    uint8_t  librarian_spk;  // Trạng thái Loa (0/1) - 1 byte
    uint8_t  telegram_alert; // Cờ cảnh báo Telegram (0/1) - 1 byte
    uint8_t  power_mode;     // Nguồn điện (1: Điện lưới AC, 0: Pin dự phòng UPS) - 1 byte
    uint8_t  battery_pct;    // Dung lượng Pin dự phòng (%) - 1 byte
    char     status[14];     // Mã trạng thái LED ngắn gọn - 14 bytes (Tổng = 64 bytes)
} offline_record_64b_t;

// =============================================================================
// 7. CẤU TRÚC DỮ LIỆU ĐO ĐẠC TOÀN DIỆN (NODE_ALL_SENSORS)
// =============================================================================
typedef struct {
    // --- A. Nhóm Xử lý & Quản lý Âm thanh (INMP441 + MAX98357A + Loa 1W) ---
    float    laeq_db;        // Độ ồn tương đương tại bàn đọc LAeq (dBA)
    float    laeq_bg_db;     // Độ ồn nền tham chiếu toàn phòng LAeq,bg (dBA)
    float    spl_peak_db;    // Áp suất âm thanh tức thời đỉnh (dBA)
    int      librarian_spk;  // Trạng thái Loa 1W (1: Phát thông báo báo Thủ thư, 0: Tắt)

    // --- B. Nhóm Vi khí hậu & Ánh sáng (SCD40 0x62, SHT30 0x44, BH1750 0x23) ---
    uint16_t co2_ppm;        // Nồng độ khí CO2 thực tế (ppm)
    float    temp;           // Nhiệt độ môi trường (°C)
    float    rh;             // Độ ẩm tương đối (%RH)
    float    lux;            // Cường độ ánh sáng / Độ rọi (Lux)

    // --- C. Nhóm Bảo quản sách & Tài liệu lưu trữ (Sharp GP2Y10, SO2, NO2, VOCs) ---
    float    pm25;           // Nồng độ bụi mịn PM2.5 (ug/m3)
    float    so2_ppb;        // Khí độc hóa học SO2 (ppb)
    float    no2_ppb;        // Khí độc hóa học NO2 (ppb)
    float    voc_ppb;        // Hợp chất hữu cơ bay hơi VOCs (ppb)

    // --- D. Nhóm Quản lý Nguồn Pin Dự phòng (UPS) & Lưu trữ Offline ---
    int      power_mode;     // Nguồn cấp (1: Điện lưới AC, 0: Đang chạy Pin dự phòng UPS)
    int      battery_pct;    // Phần trăm dung lượng Pin dự phòng UPS (0 - 100%)
    uint32_t offline_cached; // Số lượng bản ghi đang lưu trong Flash 1MB chờ mạng khôi phục

    // --- E. Nhóm Cảnh báo (3 Đèn LED đơn sắc + Telegram Bot + Loa Thủ thư) ---
    int      telegram_alert; // Cờ kích hoạt gửi tin nhắn Telegram cho Thủ thư (1: Vượt ngưỡng, 0: An toàn)
    char     status[24];     // Trạng thái 3 đèn LED rời: "GREEN_NORMAL", "BLUE_WARNING", "RED_ALERT"
    char     alert_msg[256]; // Nội dung tin nhắn Tiếng Việt gửi Thủ thư & hiển thị lên màn hình
} sensor_data_t;
