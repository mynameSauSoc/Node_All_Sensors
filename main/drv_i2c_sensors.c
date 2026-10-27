#include "drv_i2c_sensors.h"
#include "driver/i2c.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <stdio.h>
#include <string.h>

/**
 * @file drv_i2c_sensors.c
 * @brief Thực thi chi tiết Driver Bus I2C cho BH1750, SHT30, SCD40 và Màn hình OLED SSD1306.
 *        Giải thích nguyên lý kỹ thuật:
 *        - Cả 4 thiết bị mắc song song trên 2 dây SDA (GPIO 8) và SCL (GPIO 9).
 *        - ESP32-S3 đóng vai trò Master, gọi đúng từng thiết bị thông qua Địa chỉ 7-bit riêng biệt:
 *          BH1750 (0x23), SHT30 (0x44), SCD40 (0x62), OLED SSD1306 (0x3C).
 *        - Các cảm biến Sensirion (SHT30, SCD40) sử dụng mã kiểm tra CRC-8 (đa thức 0x31, khởi tạo 0xFF)
 *          sau mỗi 2 byte dữ liệu để chống nhiễu đường truyền tuyệt đối.
 */

static const char *TAG = "DRV_I2C";
static bool s_i2c_initialized = false;
static bool s_oled_ready      = false;
static uint8_t s_oled_addr    = 0x3C;

// Bảng mã ký tự ASCII 5x7 chuẩn (từ mã 32 đến 90) cho màn hình OLED 128x64
static const uint8_t font5x7[][5] = {
    {0x00, 0x00, 0x00, 0x00, 0x00}, // 32 ' '
    {0x00, 0x00, 0x5F, 0x00, 0x00}, // 33 '!'
    {0x00, 0x07, 0x00, 0x07, 0x00}, // 34 '"'
    {0x14, 0x7F, 0x14, 0x7F, 0x14}, // 35 '#'
    {0x24, 0x2A, 0x7F, 0x2A, 0x12}, // 36 '$'
    {0x23, 0x13, 0x08, 0x64, 0x62}, // 37 '%'
    {0x36, 0x49, 0x55, 0x22, 0x50}, // 38 '&'
    {0x00, 0x05, 0x03, 0x00, 0x00}, // 39 '''
    {0x00, 0x1C, 0x22, 0x41, 0x00}, // 40 '('
    {0x00, 0x41, 0x22, 0x1C, 0x00}, // 41 ')'
    {0x14, 0x08, 0x3E, 0x08, 0x14}, // 42 '*'
    {0x08, 0x08, 0x3E, 0x08, 0x08}, // 43 '+'
    {0x00, 0x50, 0x30, 0x00, 0x00}, // 44 ','
    {0x08, 0x08, 0x08, 0x08, 0x08}, // 45 '-'
    {0x00, 0x60, 0x60, 0x00, 0x00}, // 46 '.'
    {0x20, 0x10, 0x08, 0x04, 0x02}, // 47 '/'
    {0x3E, 0x51, 0x49, 0x45, 0x3E}, // 48 '0'
    {0x00, 0x42, 0x7F, 0x40, 0x00}, // 49 '1'
    {0x42, 0x61, 0x51, 0x49, 0x46}, // 50 '2'
    {0x21, 0x41, 0x45, 0x4B, 0x31}, // 51 '3'
    {0x18, 0x14, 0x12, 0x7F, 0x10}, // 52 '4'
    {0x27, 0x45, 0x45, 0x45, 0x39}, // 53 '5'
    {0x3C, 0x4A, 0x49, 0x49, 0x30}, // 54 '6'
    {0x01, 0x71, 0x09, 0x05, 0x03}, // 55 '7'
    {0x36, 0x49, 0x49, 0x49, 0x36}, // 56 '8'
    {0x06, 0x49, 0x49, 0x29, 0x1E}, // 57 '9'
    {0x00, 0x36, 0x36, 0x00, 0x00}, // 58 ':'
    {0x00, 0x56, 0x36, 0x00, 0x00}, // 59 ';'
    {0x08, 0x14, 0x22, 0x41, 0x00}, // 60 '<'
    {0x14, 0x14, 0x14, 0x14, 0x14}, // 61 '='
    {0x00, 0x41, 0x22, 0x14, 0x08}, // 62 '>'
    {0x02, 0x01, 0x51, 0x09, 0x06}, // 63 '?'
    {0x32, 0x49, 0x79, 0x41, 0x3E}, // 64 '@'
    {0x7E, 0x11, 0x11, 0x11, 0x7E}, // 65 'A'
    {0x7F, 0x49, 0x49, 0x49, 0x36}, // 66 'B'
    {0x3E, 0x41, 0x41, 0x41, 0x22}, // 67 'C'
    {0x7F, 0x41, 0x41, 0x22, 0x1C}, // 68 'D'
    {0x7F, 0x49, 0x49, 0x49, 0x41}, // 69 'E'
    {0x7F, 0x09, 0x09, 0x09, 0x01}, // 70 'F'
    {0x3E, 0x41, 0x49, 0x49, 0x7A}, // 71 'G'
    {0x7F, 0x08, 0x08, 0x08, 0x7F}, // 72 'H'
    {0x00, 0x41, 0x7F, 0x41, 0x00}, // 73 'I'
    {0x20, 0x40, 0x41, 0x3F, 0x01}, // 74 'J'
    {0x7F, 0x08, 0x14, 0x22, 0x41}, // 75 'K'
    {0x7F, 0x40, 0x40, 0x40, 0x40}, // 76 'L'
    {0x7F, 0x02, 0x0C, 0x02, 0x7F}, // 77 'M'
    {0x7F, 0x04, 0x08, 0x10, 0x7F}, // 78 'N'
    {0x3E, 0x41, 0x41, 0x41, 0x3E}, // 79 'O'
    {0x7F, 0x09, 0x09, 0x09, 0x06}, // 80 'P'
    {0x3E, 0x41, 0x51, 0x21, 0x5E}, // 81 'Q'
    {0x7F, 0x09, 0x19, 0x29, 0x46}, // 82 'R'
    {0x46, 0x49, 0x49, 0x49, 0x31}, // 83 'S'
    {0x01, 0x01, 0x7F, 0x01, 0x01}, // 84 'T'
    {0x3F, 0x40, 0x40, 0x40, 0x3F}, // 85 'U'
    {0x1F, 0x20, 0x40, 0x20, 0x1F}, // 86 'V'
    {0x3F, 0x40, 0x38, 0x40, 0x3F}, // 87 'W'
    {0x63, 0x14, 0x08, 0x14, 0x63}, // 88 'X'
    {0x07, 0x08, 0x70, 0x08, 0x07}, // 89 'Y'
    {0x61, 0x51, 0x49, 0x45, 0x43}, // 90 'Z'
};

static uint8_t s_oled_pages[8][128];

static void oled_clear(void) {
    memset(s_oled_pages, 0x00, sizeof(s_oled_pages));
}

static void oled_draw_string(int x, int page, const char *str) {
    if (page < 0 || page >= 8) return;
    int cur_x = x;
    while (*str && cur_x < 122) {
        char c = *str++;
        if (c >= 'a' && c <= 'z') c = c - 'a' + 'A';
        if (c >= 32 && c <= 90) {
            int idx = c - 32;
            for (int col = 0; col < 5; col++) {
                if (cur_x + col < 128) {
                    s_oled_pages[page][cur_x + col] = font5x7[idx][col];
                }
            }
            if (cur_x + 5 < 128) s_oled_pages[page][cur_x + 5] = 0x00;
            cur_x += 6;
        } else {
            cur_x += 6;
        }
    }
}

static void oled_flush(void) {
    if (!s_oled_ready) return;
    for (uint8_t p = 0; p < 8; p++) {
        uint8_t set_page_cmds[] = {
            0x00,
            (uint8_t)(0xB0 | p),
            0x00,
            0x10
        };
        i2c_master_write_to_device(I2C_MASTER_NUM, s_oled_addr, set_page_cmds, sizeof(set_page_cmds), pdMS_TO_TICKS(20));

        uint8_t data_chunk[129];
        data_chunk[0] = 0x40;
        memcpy(&data_chunk[1], s_oled_pages[p], 128);
        i2c_master_write_to_device(I2C_MASTER_NUM, s_oled_addr, data_chunk, sizeof(data_chunk), pdMS_TO_TICKS(50));
    }
}

static void oled_init_hardware(uint8_t addr) {
    s_oled_addr = addr;
    static const uint8_t init_cmds[] = {
        0x00,
        0xAE,
        0xD5, 0x80,
        0xA8, 0x3F,
        0xD3, 0x00,
        0x40,
        0x8D, 0x14,
        0x20, 0x02,
        0xA1,
        0xC8,
        0xDA, 0x12,
        0x81, 0xCF,
        0xD9, 0xF1,
        0xDB, 0x40,
        0xA4,
        0xA6,
        0xAF
    };
    i2c_master_write_to_device(I2C_MASTER_NUM, s_oled_addr, init_cmds, sizeof(init_cmds), pdMS_TO_TICKS(50));
    s_oled_ready = true;
    oled_clear();
    oled_draw_string(14, 0, "TQB SMARTLIB");
    oled_draw_string(4, 2, "HE THONG AIOT P411");
    oled_draw_string(4, 4, "STATUS: KHOI DONG");
    oled_draw_string(4, 6, "I2C SCANNING...");
    oled_flush();
    ESP_LOGI(TAG, "⚡ Da khoi tao Man hinh OLED SSD1306 tai dia chi 0x%02X thanh cong!", s_oled_addr);
}

// =============================================================================
// HÀM NỘI BỘ: TÍNH MÃ KIỂM TRA LỖI CRC-8 (ĐA THỨC 0x31 CHO SHT30 & SCD40)
// =============================================================================
static uint8_t sensirion_crc8(const uint8_t *data, int len) {
    uint8_t crc = 0xFF;
    for (int j = 0; j < len; j++) {
        crc ^= data[j];
        for (int i = 0; i < 8; i++) {
            if (crc & 0x80) {
                crc = (uint8_t)((crc << 1) ^ 0x31);
            } else {
                crc <<= 1;
            }
        }
    }
    return crc;
}

// =============================================================================
// 1. KHỞI TẠO BUS I2C MASTER TRÊN ESP32-S3 (SDA = GPIO 8, SCL = GPIO 9)
// =============================================================================
esp_err_t drv_i2c_bus_init(void) {
    if (s_i2c_initialized) {
        return ESP_OK;
    }

    i2c_config_t conf = {
        .mode = I2C_MODE_MASTER,
        .sda_io_num = I2C_MASTER_SDA_IO,
        .scl_io_num = I2C_MASTER_SCL_IO,
        .sda_pullup_en = GPIO_PULLUP_ENABLE, // Bật điện trở kéo lên nội của ESP32-S3
        .scl_pullup_en = GPIO_PULLUP_ENABLE,
        .master.clk_speed = I2C_MASTER_FREQ_HZ,
        .clk_flags = 0
    };

    esp_err_t err = i2c_param_config(I2C_MASTER_NUM, &conf);
    if (err != ESP_OK) return err;

    err = i2c_driver_install(I2C_MASTER_NUM, conf.mode, 0, 0, 0);
    if (err != ESP_OK) return err;

    s_i2c_initialized = true;
    ESP_LOGI(TAG, "Da khoi tao Bus I2C Master (SDA=GPIO%d, SCL=GPIO%d, Toc do=%d Hz)",
             I2C_MASTER_SDA_IO, I2C_MASTER_SCL_IO, I2C_MASTER_FREQ_HZ);

    // Khởi động chế độ đo liên tục cho BH1750 (Lệnh 0x10: Continuous High Resolution Mode)
    uint8_t bh1750_cmd = 0x10;
    i2c_master_write_to_device(I2C_MASTER_NUM, I2C_ADDR_BH1750, &bh1750_cmd, 1, pdMS_TO_TICKS(50));

    // Khởi động chế độ đo định kỳ cho cảm biến CO2 SCD40 (Lệnh 0x21B1: Start Periodic Measurement)
    uint8_t scd40_start_cmd[2] = {0x21, 0xB1};
    i2c_master_write_to_device(I2C_MASTER_NUM, I2C_ADDR_SCD40, scd40_start_cmd, 2, pdMS_TO_TICKS(50));

    // Khởi tạo màn hình OLED SSD1306 (thử cả 2 địa chỉ 0x3C và 0x3D)
    if (drv_i2c_probe_device(0x3C)) {
        oled_init_hardware(0x3C);
    } else if (drv_i2c_probe_device(0x3D)) {
        oled_init_hardware(0x3D);
    } else {
        s_oled_ready = false;
        ESP_LOGW(TAG, "Chua phat hien Man hinh OLED SSD1306 tren SDA=GPIO%d, SCL=GPIO%d (0x3C/0x3D)!",
                 I2C_MASTER_SDA_IO, I2C_MASTER_SCL_IO);
    }

    return ESP_OK;
}

// Quét toàn bộ 127 địa chỉ I2C trên bus và in nhật ký thiết bị đang phản hồi ACK
void drv_i2c_scan_bus(void) {
    ESP_LOGI(TAG, "==================================================");
    ESP_LOGI(TAG, "  QUET TOAN BO DIA CHI I2C (SDA=GPIO%d, SCL=GPIO%d)", I2C_MASTER_SDA_IO, I2C_MASTER_SCL_IO);
    ESP_LOGI(TAG, "==================================================");
    int count = 0;
    for (uint8_t a = 1; a < 127; a++) {
        if (drv_i2c_probe_device(a)) {
            ESP_LOGI(TAG, ">>> [I2C PHAT HIEN] Dia chi: 0x%02X (%d)", a, a);
            count++;
        }
    }
    if (count == 0) {
        ESP_LOGW(TAG, ">>> [I2C SCAN] Khong co thiet bi nao phan hoi ACK tren SDA=GPIO%d, SCL=GPIO%d!",
                 I2C_MASTER_SDA_IO, I2C_MASTER_SCL_IO);
    }
    ESP_LOGI(TAG, "==================================================");
}

// Kiểm tra nhanh (I2C Address Probe) xem thiết bị có phản hồi ACK trên bus hay không (Plug-and-Play)
bool drv_i2c_probe_device(uint8_t addr_7bit) {
    if (!s_i2c_initialized) return false;
    i2c_cmd_handle_t cmd = i2c_cmd_link_create();
    i2c_master_start(cmd);
    i2c_master_write_byte(cmd, (addr_7bit << 1) | I2C_MASTER_WRITE, true);
    i2c_master_stop(cmd);
    esp_err_t ret = i2c_master_cmd_begin(I2C_MASTER_NUM, cmd, pdMS_TO_TICKS(25));
    i2c_cmd_link_delete(cmd);
    return (ret == ESP_OK);
}

// =============================================================================
// 2. DRIVER CẢM BIẾN ÁNH SÁNG BH1750 (ĐỊA CHỈ 0x23)
// =============================================================================
esp_err_t drv_bh1750_read_lux(float *lux_out) {
    uint8_t raw[2] = {0};
    // Đọc 2 byte (MSB, LSB) trực tiếp từ thanh ghi dữ liệu của BH1750
    esp_err_t err = i2c_master_read_from_device(I2C_MASTER_NUM, I2C_ADDR_BH1750, raw, 2, pdMS_TO_TICKS(50));
    if (err != ESP_OK) {
        return err;
    }

    // Ghép 2 byte thành số 16-bit và chia cho hệ số nhạy quang học 1.2 theo Datasheet BH1750
    uint16_t raw_val = ((uint16_t)raw[0] << 8) | raw[1];
    *lux_out = (float)raw_val / 1.2f;
    return ESP_OK;
}

// =============================================================================
// 3. DRIVER CẢM BIẾN NHIỆT ĐỘ & ĐỘ ẨM SHT30 / SHT31 (ĐỊA CHỈ 0x44)
// =============================================================================
esp_err_t drv_sht30_read_temp_rh(float *temp_out, float *rh_out) {
    // Gửi lệnh Single-Shot Measurement, High Repeatability, Clock Stretching Disabled (0x2400)
    uint8_t cmd[2] = {0x24, 0x00};
    esp_err_t err = i2c_master_write_to_device(I2C_MASTER_NUM, I2C_ADDR_SHT30, cmd, 2, pdMS_TO_TICKS(50));
    if (err != ESP_OK) return err;

    // Đợi 15 ms để cảm biến SHT30 hoàn tất chuyển đổi ADC nội bộ (theo đúng Datasheet)
    vTaskDelay(pdMS_TO_TICKS(15));

    // Đọc 6 byte kết quả: [Temp_MSB, Temp_LSB, Temp_CRC, RH_MSB, RH_LSB, RH_CRC]
    uint8_t buf[6] = {0};
    err = i2c_master_read_from_device(I2C_MASTER_NUM, I2C_ADDR_SHT30, buf, 6, pdMS_TO_TICKS(50));
    if (err != ESP_OK) return err;

    // Kiểm tra mã lỗi CRC-8 cho cả Nhiệt độ và Độ ẩm
    if (sensirion_crc8(&buf[0], 2) != buf[2] || sensirion_crc8(&buf[3], 2) != buf[5]) {
        ESP_LOGW(TAG, "Loi CRC-8 khi doc cam bien SHT30!");
        return ESP_ERR_INVALID_CRC;
    }

    uint16_t raw_temp = ((uint16_t)buf[0] << 8) | buf[1];
    uint16_t raw_rh   = ((uint16_t)buf[3] << 8) | buf[4];

    // Áp dụng công thức quy đổi vật lý trong Datasheet Sensirion SHT30:
    *temp_out = -45.0f + 175.0f * ((float)raw_temp / 65535.0f);
    *rh_out   = 100.0f * ((float)raw_rh / 65535.0f);
    return ESP_OK;
}

// Bật/tắt thanh sấy nội (Internal Heater) trên SHT30 khi độ ẩm > 90% để chống đọng sương màng cảm biến
esp_err_t drv_sht30_set_heater(bool enable) {
    uint8_t cmd[2] = {0x30, enable ? 0x6D : 0x66};
    return i2c_master_write_to_device(I2C_MASTER_NUM, I2C_ADDR_SHT30, cmd, 2, pdMS_TO_TICKS(50));
}

// =============================================================================
// 4. DRIVER CẢM BIẾN KHÍ CO2 QUANG ÂM SCD40 (ĐỊA CHỈ 0x62)
// =============================================================================
esp_err_t drv_scd40_read_measurement(uint16_t *co2_out, float *temp_out, float *rh_out) {
    // Gửi lệnh Read Measurement (0xEC05)
    uint8_t cmd[2] = {0xEC, 0x05};
    esp_err_t err = i2c_master_write_to_device(I2C_MASTER_NUM, I2C_ADDR_SCD40, cmd, 2, pdMS_TO_TICKS(50));
    if (err != ESP_OK) return err;

    vTaskDelay(pdMS_TO_TICKS(2));

    // Đọc 9 byte: [CO2_MSB, CO2_LSB, CRC, T_MSB, T_LSB, CRC, RH_MSB, RH_LSB, CRC]
    uint8_t buf[9] = {0};
    err = i2c_master_read_from_device(I2C_MASTER_NUM, I2C_ADDR_SCD40, buf, 9, pdMS_TO_TICKS(50));
    if (err != ESP_OK) return err;

    if (sensirion_crc8(&buf[0], 2) != buf[2]) {
        return ESP_ERR_INVALID_CRC;
    }

    *co2_out = ((uint16_t)buf[0] << 8) | buf[1];
    if (temp_out != NULL && sensirion_crc8(&buf[3], 2) == buf[5]) {
        uint16_t raw_t = ((uint16_t)buf[3] << 8) | buf[4];
        *temp_out = -45.0f + 175.0f * ((float)raw_t / 65535.0f);
    }
    if (rh_out != NULL && sensirion_crc8(&buf[6], 2) == buf[8]) {
        uint16_t raw_rh = ((uint16_t)buf[6] << 8) | buf[7];
        *rh_out = 100.0f * ((float)raw_rh / 65535.0f);
    }
    return ESP_OK;
}

// =============================================================================
// 5. DRIVER MÀN HÌNH OLED SSD1306 (0x3C) HIỂN THỊ SỐ LIỆU & THÔNG BÁO TẠI CHỖ
// =============================================================================
void drv_oled_ssd1306_update(const sensor_data_t *data) {
    char line1[32], line2[32], line3[32], line4[32];
    snprintf(line1, sizeof(line1), "TQB: %s", data->status);
    if (data->laeq_db > 0.0f) {
        snprintf(line2, sizeof(line2), "NOISE: %.1f dBA", data->laeq_db);
    } else {
        snprintf(line2, sizeof(line2), "NOISE: DISCONNECT");
    }

    if (data->co2_ppm > 0) {
        snprintf(line3, sizeof(line3), "CO2: %u ppm", data->co2_ppm);
    } else {
        snprintf(line3, sizeof(line3), "CO2: DISCONNECT");
    }

    if (data->temp > 0.0f) {
        snprintf(line4, sizeof(line4), "T:%.1fC H:%.0f%%", data->temp, data->rh);
    } else {
        snprintf(line4, sizeof(line4), "ENV: DISCONNECT");
    }

    ESP_LOGI(TAG, "[MAN HINH OLED] %s | %s | %s | %s", line1, line2, line3, line4);

    if (s_oled_ready) {
        oled_clear();
        oled_draw_string(2, 0, line1);
        oled_draw_string(2, 2, line2);
        oled_draw_string(2, 4, line3);
        oled_draw_string(2, 6, line4);
        oled_flush();
    }
}
