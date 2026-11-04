#pragma once
#include "app_config.h"

/**
 * @file led_alert.h
 * @brief Điều khiển 3 Đèn LED Đơn Sắc Rời trên ESP32-S3 (Active HIGH):
 *        - GPIO 1  : G_LED (Xanh lá - An toàn, LAeq <= 45 dBA)
 *        - GPIO 2  : B_LED (Xanh dương - Nhắc nhở, 45 < LAeq <= 55 dBA)
 *        - GPIO 42 : R_LED (Đỏ - Báo động, LAeq > 55 dBA hoặc ô nhiễm cao)
 */

void led_alert_init(void);

// Cập nhật trạng thái đèn LED theo độ ồn LAeq và xuất mã trạng thái
void led_alert_set_state(float laeq, char *status_out);
