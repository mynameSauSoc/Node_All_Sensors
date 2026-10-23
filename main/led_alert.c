#include "app_config.h"
#include "led_alert.h"
#include "driver/gpio.h"
#include <string.h>

/**
 * @file led_alert.c
 * @brief Thực thi logic điều khiển 3 đèn LED cảnh báo tiếng ồn tại bàn đọc theo 3 mức.
 */

// Khởi tạo phần cứng GPIO cho 3 đèn LED cảnh báo
void led_alert_init(void) {
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << LED_GREEN_PIN) | (1ULL << LED_BLUE_PIN) | (1ULL << LED_RED_PIN),
        .mode = GPIO_MODE_OUTPUT,              // Chế độ ngõ ra (Output) để cấp nguồn bật/tắt LED
        .pull_up_en = GPIO_PULLUP_DISABLE,     // Không dùng trở kéo lên nội
        .pull_down_en = GPIO_PULLDOWN_DISABLE, // Không dùng trở kéo xuống nội
        .intr_type = GPIO_INTR_DISABLE,        // Không dùng ngắt GPIO
    };
    gpio_config(&io_conf);

    // Trạng thái khởi đầu: Tắt toàn bộ 3 đèn LED (xuất mức logic 0)
    gpio_set_level(LED_GREEN_PIN, 0);
    gpio_set_level(LED_BLUE_PIN, 0);
    gpio_set_level(LED_RED_PIN, 0);
}

// So sánh độ ồn LAeq (dBA) với các ngưỡng tiêu chuẩn thư viện để bật đèn LED tương ứng
void led_alert_set_state(float laeq, char *status_out) {
    if (laeq <= 45.0f) {
        // Mức 1 - An toàn (<= 45 dBA): Bật đèn XANH LÁ, tắt đèn Xanh dương & Đỏ
        gpio_set_level(LED_GREEN_PIN, 1);
        gpio_set_level(LED_BLUE_PIN,  0);
        gpio_set_level(LED_RED_PIN,   0);
        strcpy(status_out, "GREEN_NORMAL");
    } else if (laeq <= 55.0f) {
        // Mức 2 - Nhắc nhở (45 < LAeq <= 55 dBA): Bật đèn XANH DƯƠNG, tắt đèn Xanh lá & Đỏ
        gpio_set_level(LED_GREEN_PIN, 0);
        gpio_set_level(LED_BLUE_PIN,  1);
        gpio_set_level(LED_RED_PIN,   0);
        strcpy(status_out, "BLUE_WARNING");
    } else {
        // Mức 3 - Báo động (> 55 dBA): Bật đèn ĐỎ, tắt đèn Xanh lá & Xanh dương
        gpio_set_level(LED_GREEN_PIN, 0);
        gpio_set_level(LED_BLUE_PIN,  0);
        gpio_set_level(LED_RED_PIN,   1);
        strcpy(status_out, "RED_ALERT");
    }
}
