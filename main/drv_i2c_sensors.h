#pragma once
#include "app_config.h"
#include "esp_err.h"
#include <stdbool.h>

/**
 * @file drv_i2c_sensors.h
 * @brief Driver phần cứng giao tiếp Bus I2C trên ESP32-S3 cho 4 thiết bị:
 *        1. Cảm biến ánh sáng BH1750 (Địa chỉ 0x23) -> Đo cường độ sáng (Lux).
 *        2. Cảm biến nhiệt ẩm SHT30/SHT31 (Địa chỉ 0x44) -> Đo Nhiệt độ (°C), Độ ẩm (%RH) & Sấy chống đọng sương.
 *        3. Cảm biến khí CO2 quang âm SCD40 (Địa chỉ 0x62) -> Đo nồng độ CO2 thực tế (ppm).
 *        4. Màn hình OLED SSD1306 0.96" (Địa chỉ 0x3C) -> Hiển thị thông báo & số liệu trực tiếp tại Node.
 */

// Khởi tạo ngoại vi I2C Master của ESP32-S3 và cấu hình ban đầu cho các cảm biến + màn hình OLED
esp_err_t drv_i2c_bus_init(void);

// Quét toàn bộ 127 địa chỉ I2C trên bus và in nhật ký thiết bị đang phản hồi ACK
void drv_i2c_scan_bus(void);

// Kiểm tra nhanh (Probe ACK) xem một thiết bị I2C (0x23, 0x44, 0x62, 0x3C) đang được CẮM hay đã RÚT RA
bool drv_i2c_probe_device(uint8_t addr_7bit);

// Đọc cường độ ánh sáng (Lux) từ cảm biến BH1750 (0x23)
esp_err_t drv_bh1750_read_lux(float *lux_out);

// Đọc Nhiệt độ (°C) và Độ ẩm (%RH) từ cảm biến SHT30 (0x44) kèm kiểm tra mã lỗi CRC-8
esp_err_t drv_sht30_read_temp_rh(float *temp_out, float *rh_out);

// Bật/tắt thanh nhiệt sấy nội (Internal Micro-Heater) trên SHT30 khi độ ẩm > 90% để chống đọng sương
esp_err_t drv_sht30_set_heater(bool enable);

// Đọc nồng độ khí CO2 (ppm), Nhiệt độ, Độ ẩm từ cảm biến SCD40 (0x62) kèm kiểm tra CRC-8
esp_err_t drv_scd40_read_measurement(uint16_t *co2_out, float *temp_out, float *rh_out);

// Xuất thông báo cảnh báo & các thông số cần thiết ra màn hình OLED SSD1306 (0x3C) gắn trên ESP32-S3
void drv_oled_ssd1306_update(const sensor_data_t *data);
