#pragma once
#include "app_config.h"
#include <stdint.h>

/**
 * @file mock_sensor.h
 * @brief Giao diện module thu thập / giả lập dữ liệu cảm biến Đa tốc độ (Multi-rate Sampling)
 *        cho Node_All_Sensors.
 */

// Khởi tạo giá trị ban đầu cho bộ đệm cảm biến đa tốc độ
void mock_sensor_init(sensor_data_t *data);

// Cập nhật dữ liệu cảm biến theo đúng chu kỳ vật lý (tick_sec tăng mỗi 1 giây)
// Trả về true nếu phát hiện vượt ngưỡng khẩn cấp cần bắn MQTT ngay lập tức (Event-Driven)
bool mock_sensor_update_multirate(sensor_data_t *data, uint32_t tick_sec);
