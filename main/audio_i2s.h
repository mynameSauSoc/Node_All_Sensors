#pragma once
#include "app_config.h"

/**
 * @file audio_i2s.h
 * @brief Driver Bus Âm thanh I2S DMA Kép trên ESP32-S3:
 *        1. Micro INMP441 (I2S0 Rx DMA): SCK=GPIO4, WS=GPIO5, SD=GPIO6.
 *           Thu âm 24-bit @ 16 kHz, lọc IIR khử DC, tính tích phân LAeq & SPL peak.
 *        2. Mạch giải mã MAX98357A Class-D + Loa 1W (I2S1 Tx DMA): BCLK=GPIO15, LRC=GPIO16, DIN=GPIO7.
 *           Phát âm cảnh báo khi độ ồn > 55 dBA.
 */

// Khởi tạo ngoại vi I2S0 Rx (Micro) và I2S1 Tx (Loa)
void audio_i2s_init(void);

// Đọc và xử lý luồng âm thanh thực tế từ DMA Micro INMP441
void audio_i2s_read_levels(float *laeq_out, float *spl_peak_out);

// Hàm điều phối xử lý âm thanh (chạy phần cứng thật hoặc chế độ mô phỏng)
void audio_i2s_process(sensor_data_t *data, bool is_mock);

// Tương thích ngược với tên hàm cũ
void audio_i2s_mock_process(sensor_data_t *data);

// Phát chuỗi âm báo động bíp ~1000Hz ra Loa 1W
void audio_i2s_play_alert_tone(void);
