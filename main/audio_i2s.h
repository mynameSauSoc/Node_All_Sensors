#pragma once
#include "app_config.h"

/**
 * @file audio_i2s.h
 * @brief Driver phần cứng I2S DMA & Thuật toán xử lý âm thanh cho Đồ án tốt nghiệp:
 *        1. Micro INMP441 (I2S0 DMA Rx): Thu luồng PCM 24-bit ở 16kHz, lọc khử DC/quạt trần,
 *           tính áp suất âm thanh đỉnh (SPL Peak) và tích phân mức ồn tương đương LAeq (dBA).
 *        2. Mạch giải mã MAX98357A I2S Class-D (I2S1 DMA Tx) + Loa 1W (SPK+/SPK-):
 *           Phát sóng âm thanh cảnh báo trực tiếp ra Loa khi vượt ngưỡng (> 55 dBA).
 *        3. Hỗ trợ chuyển đổi mượt giữa Chế độ Phần cứng Thật và Chế độ Giả lập (Admin Test).
 */

// Khởi tạo ngoại vi I2S0 (Micro INMP441) và I2S1 (Mạch Loa MAX98357A)
void audio_i2s_init(void);

// Đọc & xử lý âm thanh từ phần cứng INMP441 thật (hoặc giả lập khi ở chế độ Admin Test)
void audio_i2s_mock_process(sensor_data_t *data);

// Phát 1 chuỗi xung âm thanh cảnh báo thật qua bus I2S1 DMA tới mạch MAX98357A + Loa 1W
void audio_i2s_play_alert_tone(void);
