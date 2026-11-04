#pragma once
#include "app_config.h"
#include "esp_err.h"

/**
 * @file drv_adc_sensors.h
 * @brief Driver phần cứng ADC1 & Xung định thời micro-giây trên ESP32-S3:
 *        1. Cảm biến bụi Sharp GP2Y1014AU0F:
 *           - GPIO 10 (DUST_PULSE): Xung 320us kích cực Base BJT SS8050 (Q_DUST NPN).
 *           - GPIO 3  (DUST_ADC)  : Đọc ADC1_CH2 qua cầu phân áp R2=10k, R3=20k -> Nhân 1.5.
 *        2. Cụm cảm biến khí độc SO2, NO2, VOCs (Kênh mở rộng ADC1_CH3, CH4, CH5).
 *        3. Đo trạng thái Nguồn điện AC và % Pin dự phòng UPS (ADC1_CH6 qua cầu phân áp 1:2).
 */

// Khởi tạo ngoại vi ADC1 (12-bit, Atten 11dB) và chân GPIO 10 kích xung
esp_err_t drv_adc_sensors_init(void);

// Đọc nồng độ bụi mịn PM2.5 (ug/m3) theo giản đồ xung 280us và nhân hệ số phục hồi 1.5
float drv_sharp_gp2y10_read_pm25(void);

// Đọc toàn bộ các phân đoạn kích thước hạt bụi (PM1.0, PM2.5, PM4.0, PM10)
void drv_dust_read_all_fractions(float *pm1_0, float *pm2_5, float *pm4_0, float *pm10);

// Đọc nồng độ khí độc SO2, NO2, VOCs (ppb)
void drv_gas_sensors_read(float *so2_ppb, float *no2_ppb, float *voc_ppb);

// Đọc trạng thái nguồn AC / Pin UPS và phần trăm Pin
void drv_ups_power_read(int *power_mode, int *battery_pct);
