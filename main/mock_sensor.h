#pragma once
#include "app_config.h"
#include <stdint.h>
#include <stdbool.h>

/**
 * @file mock_sensor.h
 * @brief Bộ điều phối Cảm biến Đa tốc độ & Cơ chế Plug-and-Play (Sensor Manager):
 *        - Khi USE_MOCK_SENSOR_MODE = 1: Tự sinh số liệu môi trường thực tế (Gaussian noise + drift).
 *        - Khi USE_MOCK_SENSOR_MODE = 0: Đọc trực tiếp 100% cảm biến phần cứng thật trên bo mạch Altium.
 */

void mock_sensor_init(sensor_data_t *data);

// Cập nhật dữ liệu cảm biến theo tick 1 giây
// Trả về true nếu phát hiện sự kiện vượt ngưỡng khẩn cấp cần bắn MQTT tức thời
bool mock_sensor_update_multirate(sensor_data_t *data, uint32_t tick_sec);

// Tính toán Điểm Tiện Nghi Học Tập Liebig LCS trên vi điều khiển
float compute_liebig_comfort_score(const sensor_data_t *data, char *rank_out);
