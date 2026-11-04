#pragma once
#include "app_config.h"
#include "esp_err.h"
#include <stdbool.h>

/**
 * @file drv_i2c_sensors.h
 * @brief Driver Bus I2C Master trên ESP32-S3 (SDA = GPIO 8, SCL = GPIO 9)
 *        Điều khiển 4 ngoại vi:
 *        1. Cảm biến ánh sáng BH1750 (0x23) -> Độ rọi Lux
 *        2. Cảm biến nhiệt ẩm SHT30 (0x44) -> Nhiệt độ, Độ ẩm & Sấy nội chống đọng sương
 *        3. Cảm biến CO2 Sensirion SCD40 (0x62) -> Nồng độ CO2 ppm
 *        4. Màn hình OLED SH1106 / SSD1306 (0x3C / 0x3D) -> Hiển thị trực quan tại chỗ
 */

// Khởi tạo ngoại vi I2C Master (100kHz) và các cảm biến
esp_err_t drv_i2c_bus_init(void);

// Quét toàn bộ bus I2C (127 địa chỉ) và in log các thiết bị phản hồi ACK
void drv_i2c_scan_bus(void);

// Kiểm tra sự hiện diện (Plug-and-Play ACK) của 1 địa chỉ I2C cụ thể
bool drv_i2c_probe_device(uint8_t addr_7bit);

// Đọc độ rọi ánh sáng (Lux) từ BH1750
esp_err_t drv_bh1750_read_lux(float *lux_out);

// Đọc Nhiệt độ (°C) và Độ ẩm (%RH) từ SHT30 (kèm CRC-8)
esp_err_t drv_sht30_read_temp_rh(float *temp_out, float *rh_out);

// Bật/tắt thanh nhiệt sấy màng cảm biến SHT30 khi độ ẩm > 90%
esp_err_t drv_sht30_set_heater(bool enable);

// Đọc nồng độ CO2 (ppm), Nhiệt độ, Độ ẩm từ SCD40 (kèm CRC-8)
esp_err_t drv_scd40_read_measurement(uint16_t *co2_out, float *temp_out, float *rh_out);

// Cập nhật màn hình OLED (hỗ trợ cả SSD1306 và SH1106)
void drv_oled_update(const sensor_data_t *data);
