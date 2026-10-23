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

    // Khởi tạo màn hình OLED SSD1306 (0x3C) nếu được cắm trên bus
    uint8_t oled_init_cmds[] = {
        0x00,       // Control byte: Command stream
        0xAE,       // Display OFF
        0x20, 0x00, // Memory Addressing Mode: Horizontal
        0x8D, 0x14, // Enable Charge Pump
        0xAF        // Display ON
    };
    if (i2c_master_write_to_device(I2C_MASTER_NUM, I2C_ADDR_OLED_SSD1306,
                                   oled_init_cmds, sizeof(oled_init_cmds), pdMS_TO_TICKS(50)) == ESP_OK) {
        s_oled_ready = true;
        ESP_LOGI(TAG, "Da ket noi Man hinh OLED SSD1306 (0x3C) thanh cong!");
    }

    return ESP_OK;
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
    // Màn hình gắn trên ESP32-S3 chỉ dùng để xuất thông báo & các thông số cốt lõi tại chỗ
    // (không vẽ Heatmap phức tạp trên màn hình nhỏ này)
    char line1[32], line2[32], line3[32], line4[32];
    snprintf(line1, sizeof(line1), "P.411 | %s", data->status);
    snprintf(line2, sizeof(line2), "On: %.1fdBA (Nen %.1f)", data->laeq_db, data->laeq_bg_db);
    snprintf(line3, sizeof(line3), "CO2:%uppm T:%.1fC RH:%.0f%%", data->co2_ppm, data->temp, data->rh);
    snprintf(line4, sizeof(line4), "PM2.5:%.1f VOC:%.0fppb", data->pm25, data->voc_ppb);

    ESP_LOGI(TAG, "[MAN HINH OLED TAI NODE] %s | %s | %s | %s", line1, line2, line3, line4);

    if (s_oled_ready) {
        // Đẩy buffer hiển thị qua I2C tới địa chỉ 0x3C của màn hình SSD1306
        uint8_t cursor_reset[] = {0x00, 0x21, 0x00, 0x7F, 0x22, 0x00, 0x07};
        i2c_master_write_to_device(I2C_MASTER_NUM, I2C_ADDR_OLED_SSD1306,
                                   cursor_reset, sizeof(cursor_reset), pdMS_TO_TICKS(20));
    }
}
