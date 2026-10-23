#pragma once
#include "app_config.h"

/**
 * @file led_alert.h
 * @brief Giao diện module điều khiển 3 đèn LED cảnh báo mức độ tiếng ồn tại chỗ.
 */

// Khởi tạo các chân GPIO điều khiển 3 đèn LED (Xanh lá, Xanh dương, Đỏ)
void led_alert_init(void);

// Đánh giá ngưỡng ồn LAeq (dBA), bật đèn LED tương ứng và xuất chuỗi trạng thái vào status_out
void led_alert_set_state(float laeq, char *status_out);
