#pragma once
#include <stdint.h>
#include <stdbool.h>

/**
 * @file app_config.h
 * @brief Cấu hình Trung tâm Hệ thống Trạm Cảm biến Node 1 (Node All Sensors)
 *        Dự án: Hệ thống AIoT Giám sát Môi trường & Âm học Thư viện Tạ Quang Bửu (HUST)
 *
 * PHẦN CỨNG: Bo mạch 2 lớp Altium Designer 26 (0 lỗi DRC)
 * NỀN TẢNG: ESP32-S3 (ESP-IDF v4.4 / FreeRTOS)
 * SERVER BACKEND: Spring Boot 3 (Java 21 Virtual Threads) + MongoDB 8.0 TimeSeries
 * BROKER: Eclipse Mosquitto 2.0 (Port 1883)
 * WEB DASHBOARD: React 18 + Vite (Port 5173)
 */

// =============================================================================
// 1. CHẾ ĐỘ VẬN HÀNH "PLUG-AND-PLAY / ZERO EXTRA CODE"
// =============================================================================
/**
 * @brief Công tắc chuyển đổi chế độ vận hành:
 *        - Đặt = 0 (MẶC ĐỊNH SẢN XUẤT): Chạy trên bo mạch PCB Altium thật.
 *          Hệ thống tự động quét I2C bus (I2C scanner), khởi tạo I2S DMA thu âm
 *          và loa, bộ lọc RC ADC bụi mịn Sharp và chạy ngay lập tức mà KHÔNG CẦN
 *          CHỈNH SỬA BẤT KỲ DÒNG CODE NÀO.
 *        - Đặt = 1 (CHẾ ĐỘ MÔ PHỎNG / TEST): Hệ thống tự sinh số liệu môi trường
 *          thực tế (có nhiễu Gaussian và dao động theo thời gian thực) để kiểm thử
 *          toàn diện luồng tin từ biên lên Broker, Backend và Frontend.
 */
#define USE_MOCK_SENSOR_MODE        0

// Cấu hình vai trò Node (Node 1 Bàn đọc / Node 2 Cột / Node 3 Kệ sách / Node All Sensors)
#define NODE_ROLE_CURRENT           4   // 1: Bàn | 2: Cột | 3: Kệ | 4: Node All Sensors

// Thông tin định danh phần cứng (Khớp với CSDL Spring Boot & Mosquitto ACL)
#define DEFAULT_HARDWARE_ID         "Node_All_Sensors"
#define DEFAULT_ROOM_ID             "P411"
#define FIRMWARE_VERSION            "1.2.0"

// =============================================================================
// 2. CẤU HÌNH MẠNG WI-FI & MQTT BROKER MOSQUITTO 2.0 (CHUẨN HÓA MỚI)
// =============================================================================
// Cụm Server MỚI: Eclipse Mosquitto 2.0 (1883) | Spring Boot 3 (8080) | MongoDB (27017)
#define WIFI_SSID_DEFAULT           "FPT TANG 5"
#define WIFI_PASS_DEFAULT           "88888888"

#define MQTT_BROKER_URI_DEFAULT     "mqtt://192.168.1.100:1883"
#define MQTT_USERNAME_DEFAULT       "Node_All_Sensors"
#define MQTT_PASSWORD_DEFAULT       "CHANGE_ME_LOCAL_DEV_DEVICE"

// Định dạng Topic MQTT chuẩn hóa: devices/{hardwareId}/...
#define MQTT_TOPIC_TELEMETRY_FMT    "devices/%s/telemetry"
#define MQTT_TOPIC_STATUS_FMT       "devices/%s/status"
#define MQTT_TOPIC_COMMAND_FMT      "devices/%s/command"

// Kênh cảnh báo Telegram khẩn cấp (qua Backend hoặc gửi trực tiếp)
#define TELEGRAM_BOT_TOKEN          "8955861861:AAGOT3pJCJs5_2_e231k8wXsirzR9AyOR7o"
#define TELEGRAM_CHAT_ID            "8777618210"

// =============================================================================
// 3. SƠ ĐỒ CHÂN PHẦN CỨNG (PINOUT KHỚP 100% SCHEMATIC & PCB ALTIUM DESIGNER 26)
// =============================================================================
/**
 * --- A. Cụm 3 Bóng Đèn LED Đơn Sắc Rời (Active HIGH, qua trở hạn dòng 330Ω) ---
 * - GPIO 1  : G_LED (LED Xanh lá - Mức an toàn, <= 45 dBA)
 * - GPIO 2  : B_LED (LED Xanh dương - Mức nhắc nhở, 45 - 55 dBA)
 * - GPIO 42 : R_LED (LED Đỏ - Mức báo động, > 55 dBA / Khí độc cao)
 */
#define LED_GREEN_PIN               1
#define LED_BLUE_PIN                2
#define LED_RED_PIN                 42

/**
 * --- B. Shared I2C Bus (Kéo trở R5 = 4.7 kΩ, R6 = 4.7 kΩ lên 3.3V) ---
 * - GPIO 8 : SDA (I2C Data)
 * - GPIO 9 : SCL (I2C Clock)
 * Phục vụ 4 ngoại vi số:
 *   1. OLED 0.96" SH1106 / SSD1306 (Địa chỉ I2C: 0x3C, dự phòng 0x3D)
 *   2. SHT30 / SHT31 Nhiệt độ - Độ ẩm chính xác (Địa chỉ I2C: 0x44)
 *   3. BH1750 Độ rọi ánh sáng Lux (Địa chỉ I2C: 0x23)
 *   4. SCD40 Khí CO2 NDIR quang âm (Địa chỉ I2C: 0x62)
 */
#define I2C_MASTER_NUM              0
#define I2C_MASTER_SDA_IO           8
#define I2C_MASTER_SCL_IO           9
#define I2C_MASTER_FREQ_HZ          100000  // 100 kHz chuẩn công nghiệp ổn định nhất

#define I2C_ADDR_BH1750             0x23
#define I2C_ADDR_OLED_DEFAULT       0x3C
#define I2C_ADDR_OLED_ALT           0x3D
#define I2C_ADDR_SHT30              0x44
#define I2C_ADDR_SCD40              0x62

/**
 * --- C. Bus Âm thanh Số I2S DMA Kép (Micro MEMS INMP441 & Amply MAX98357A) ---
 * - I2S0 Rx (Micro INMP441, 24-bit DMA, 16 kHz):
 *   * SCK (BCLK) : GPIO 4
 *   * WS  (LRCLK): GPIO 5
 *   * SD  (DATA) : GPIO 6
 * - I2S1 Tx (Amply MAX98357A Class-D + Loa 1W 8Ω):
 *   * BCLK        : GPIO 15
 *   * LRC (LRCLK) : GPIO 16
 *   * DIN (DATA)  : GPIO 7
 */
#define I2S_MIC_PORT                0
#define I2S_MIC_SCK_PIN             4
#define I2S_MIC_WS_PIN              5
#define I2S_MIC_SD_PIN              6

#define I2S_SPK_PORT                1
#define I2S_SPK_BCLK_PIN            15
#define I2S_SPK_LRC_PIN             16
#define I2S_SPK_DIN_PIN             7

/**
 * --- D. Cụm Cảm biến Bụi Sharp GP2Y1014AU0F & Kênh ADC1 ---
 * - GPIO 10 : Xung kích DUST_PULSE điều khiển cực Base transistor BJT SS8050 (Q_DUST NPN).
 *             (Mức CAO = 1 làm BJT bão hòa kéo Pin 3 Sharp xuống GND -> BẬT LED hồng ngoại;
 *              Mức THẤP = 0 ngắt BJT -> TẮT LED hồng ngoại).
 * - GPIO 3  : DUST_ADC kết nối ngõ vào ADC1_CHANNEL_2.
 *             Tín hiệu Vo đi qua cầu phân áp R2=10kΩ, R3=20kΩ:
 *             V_ADC = Vo * (20 / (10 + 20)) = Vo * (2/3)
 *             -> Firmware BẮT BUỘC NHÂN HỆ SỐ NGƯỢC LẠI LÀ 1.5 để khôi phục chính xác Vo!
 */
#define SHARP_LED_Trigger_PIN       10
#define ADC_CH_SHARP_PM25           2   // ADC1_CHANNEL_2 (GPIO 3)
#define SHARP_DIVIDER_FACTOR        1.5f // Hệ số khôi phục cầu phân áp 10k:20k

// Các kênh ADC1 phụ trợ cho Khí độc và Giám sát Pin UPS
#define ADC_CH_GAS_SO2              3   // ADC1_CHANNEL_3 (Chân mở rộng)
#define ADC_CH_GAS_NO2              4   // ADC1_CHANNEL_4
#define ADC_CH_GAS_VOC              5   // ADC1_CHANNEL_5
#define ADC_CH_UPS_BATTERY          6   // ADC1_CHANNEL_6 (Cầu phân áp 1:2 đọc Pin 18650)

/**
 * --- E. CHÂN CẤM SỬ DỤNG / BỎ TRỐNG TUYỆT ĐỐI ---
 * 1. GPIO 35, 36, 37: Dành riêng cho Octal PSRAM/Flash nội bộ của ESP32-S3. CẤM ĐI DÂY.
 * 2. Hai chân 3V3 của kit ESP32-S3: BỎ TRỐNG trên PCB. Hệ thống dùng IC LDO U1 LM1117-3.3 riêng
 *    cấp điện 3.3V độc lập, chống sụt áp khi phát sóng Wi-Fi và nung nhiệt SCD40.
 */

// =============================================================================
// 4. CHU KỲ ĐO ĐA TỐC ĐỘ (MULTI-RATE SAMPLING) & TRUYỀN TIN MQTT
// =============================================================================
#define AUDIO_FAST_LOOP_MS          1000    // 1 giây/lần : Đọc I2S DMA tính LAeq, SPL peak
#define LUX_SAMPLE_PERIOD_SEC       5       // 5 giây/lần : Đọc độ rọi BH1750
#define ENV_GAS_SAMPLE_PERIOD_SEC   10      // 10 giây/lần: Đọc SHT30, SCD40, Khí độc
#define PM25_SAMPLE_PERIOD_SEC      30      // 30 giây/lần: Kích xung 280us đo bụi Sharp

#define PUBLISH_PERIOD_AC_SEC       5       // Có điện lưới: Bắn MQTT mỗi 5 giây (Chuẩn SSOT)
#define PUBLISH_PERIOD_UPS_SEC      30      // Chạy pin dự phòng: Giãn chu kỳ lên 30 giây

#define OFFLINE_STORAGE_MAX_RECORDS 14680   // ~14,680 bản ghi x 64 bytes trên phân vùng SPIFFS 1MB
#define OFFLINE_REPLAY_BATCH_SIZE   5       // Xả bù tối đa 5 bản ghi/chu kỳ khi mạng hồi phục

// =============================================================================
// 5. TIÊU CHUẨN ĐÁNH GIÁ MÔI TRƯỜNG & THUẬT TOÁN TIỆN NGHI HỌC TẬP LCS LIEBIG
// =============================================================================
#define NOISE_LIMIT_SAFE_DB         45.0f   // Mức yên tĩnh lý tưởng (<= 45 dBA) -> LED Xanh lá
#define NOISE_LIMIT_WARN_DB         55.0f   // Mức nhắc nhở (45 - 55 dBA) -> LED Xanh dương
#define NOISE_LIMIT_ALERT_DB        65.0f   // Mức báo động (> 55 dBA) -> LED Đỏ + Loa 1W
#define CO2_LIMIT_ALERT_PPM         1000    // Ngưỡng CO2 gây ngột ngạt buồn ngủ
#define RH_LIMIT_ALERT_PERCENT      65.0f   // Ngưỡng ẩm nguy cơ nấm mốc (ISO 11799)
#define PM25_LIMIT_ALERT_UGM3       35.0f   // Ngưỡng bụi mịn vượt tiêu chuẩn WHO

// =============================================================================
// 6. CẤU TRÚC BẢN GHI LƯU TRỮ FLASH SPIFFS KHI MẤT MẠNG (ĐÚNG 64 BYTES)
// =============================================================================
typedef struct __attribute__((packed)) {
    uint32_t timestamp;      // Unix Epoch (giây) - 4 bytes
    float    laeq_db;        // Độ ồn LAeq (dBA) - 4 bytes
    float    laeq_bg_db;     // Độ ồn nền LAeq,bg (dBA) - 4 bytes
    float    spl_peak_db;    // Áp suất âm đỉnh (dBA) - 4 bytes
    float    temp;           // Nhiệt độ (°C) - 4 bytes
    float    rh;             // Độ ẩm (%RH) - 4 bytes
    float    lux;            // Ánh sáng (Lux) - 4 bytes
    float    pm25;           // Bụi mịn PM2.5 (ug/m3) - 4 bytes
    float    so2_ppb;        // Khí SO2 (ppb) - 4 bytes
    float    no2_ppb;        // Khí NO2 (ppb) - 4 bytes
    float    voc_ppb;        // Khí VOCs (ppb) - 4 bytes
    uint16_t co2_ppm;        // Khí CO2 (ppm) - 2 bytes
    uint8_t  librarian_spk;  // Trạng thái Loa (0/1) - 1 byte
    uint8_t  telegram_alert; // Cờ cảnh báo khẩn (0/1) - 1 byte
    uint8_t  power_mode;     // Nguồn (1: AC, 0: Pin UPS) - 1 byte
    uint8_t  battery_pct;    // % Pin dự phòng - 1 byte
    char     status[14];     // Mã trạng thái LED - 14 bytes (Tổng = 64 bytes)
} offline_record_64b_t;

// =============================================================================
// 7. CẤU TRÚC DỮ LIỆU ĐO TOÀN DIỆN NODE 1 (NODE_ALL_SENSORS)
// =============================================================================
typedef struct {
    // --- Âm học I2S (INMP441 + MAX98357A) ---
    float    laeq_db;        // Độ ồn LAeq (dBA)
    float    laeq_bg_db;     // Độ ồn nền LAeq,bg (dBA)
    float    spl_peak_db;    // Áp suất âm đỉnh (dBA)
    int      librarian_spk;  // 1: Loa đang phát cảnh báo, 0: Tắt

    // --- Vi khí hậu & Ánh sáng I2C (SHT30, BH1750, SCD40) ---
    float    temp;           // Nhiệt độ (°C)
    float    rh;             // Độ ẩm (%RH)
    float    lux;            // Ánh sáng (Lux)
    uint16_t co2_ppm;        // Nồng độ CO2 (ppm)

    // --- Bụi mịn & Khí độc (Sharp GP2Y10 + ADC) ---
    float    pm1_0;          // Bụi siêu mịn PM1.0 (ug/m3)
    float    pm25;           // Bụi mịn PM2.5 (ug/m3)
    float    pm4_0;          // Bụi PM4.0 (ug/m3)
    float    pm10;           // Bụi thô PM10 (ug/m3)
    float    so2_ppb;        // Khí SO2 (ppb)
    float    no2_ppb;        // Khí NO2 (ppb)
    float    voc_ppb;        // Khí VOCs (ppb)

    // --- Quản lý Nguồn Pin & Lưu trữ ---
    int      power_mode;     // 1: AC, 0: Pin UPS
    int      battery_pct;    // % Pin (0 - 100%)
    uint32_t offline_cached; // Số gói tin lưu trong Flash chờ đồng bộ
    int      wifi_rssi;      // Cường độ sóng Wi-Fi (dBm)

    // --- Điểm Tiện Nghi Học Tập Liebig LCS ---
    float    lcs_score;      // Điểm tổng hợp LCS (0 - 100)
    char     lcs_rank[16];   // "Platinum", "Gold", "Silver", "Bronze", "Poor"

    // --- Cảnh báo & Hiển thị ---
    int      telegram_alert; // 1: Cảnh báo khẩn cấp, 0: Bình thường
    char     status[24];     // "GREEN_NORMAL", "BLUE_WARNING", "RED_ALERT"
    char     alert_msg[256]; // Thông báo Tiếng Việt
} sensor_data_t;
