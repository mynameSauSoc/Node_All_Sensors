#pragma once
#include "app_config.h"
#include "esp_err.h"

/**
 * @file drv_adc_sensors.h
 * @brief Driver phần cứng điều khiển ADC1 & Xung GPIO trên ESP32-S3 cho:
 *        1. Cảm biến bụi mịn quang học Sharp GP2Y1014AU0F (Xung kích LED 280us + Đọc ADC).
 *        2. Cụm cảm biến khí độc hóa học SO2, NO2 và VOCs làm ố vàng tài liệu.
 *        3. Mạch giám sát trạng thái Nguồn điện lưới AC và % Pin dự phòng UPS.
 */

// Khởi tạo ngoại vi ADC1 (12-bit) và chân GPIO kích xung LED hồng ngoại của cảm biến bụi Sharp
esp_err_t drv_adc_sensors_init(void);

// Đọc nồng độ bụi mịn PM2.5 (ug/m3) từ cảm biến Sharp GP2Y1014AU0F theo đúng giản đồ xung 280us
float drv_sharp_gp2y10_read_pm25(void);

// Đọc nồng độ các khí độc bảo quản tài liệu (SO2, NO2, VOCs - đơn vị ppb)
void drv_gas_sensors_read(float *so2_ppb, float *no2_ppb, float *voc_ppb);

// Đọc trạng thái Nguồn điện (1: Điện lưới AC, 0: Pin UPS) và phần trăm dung lượng Pin dự phòng (%)
void drv_ups_power_read(int *power_mode, int *battery_pct);
