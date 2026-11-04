#include "app_config.h"
#include "led_alert.h"
#include "driver/gpio.h"
#include <string.h>

/**
 * @file led_alert.c
 * @brief Thực thi điều khiển 3 đèn LED cảnh báo mức độ ồn và chất lượng môi trường.
 */

void led_alert_init(void) {
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << LED_GREEN_PIN) | (1ULL << LED_BLUE_PIN) | (1ULL << LED_RED_PIN),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&io_conf);

    // Mặc định ban đầu: Tắt toàn bộ 3 đèn LED
    gpio_set_level(LED_GREEN_PIN, 0);
    gpio_set_level(LED_BLUE_PIN, 0);
    gpio_set_level(LED_RED_PIN, 0);
}

void led_alert_set_state(float laeq, char *status_out) {
    if (laeq <= NOISE_LIMIT_SAFE_DB) {
        // Mức 1 - An toàn (<= 45 dBA): Bật LED Xanh lá (GPIO 1), tắt LED Xanh dương & Đỏ
        gpio_set_level(LED_GREEN_PIN, 1);
        gpio_set_level(LED_BLUE_PIN,  0);
        gpio_set_level(LED_RED_PIN,   0);
        if (status_out) strcpy(status_out, "GREEN_NORMAL");
    } else if (laeq <= NOISE_LIMIT_WARN_DB) {
        // Mức 2 - Nhắc nhở (45 - 55 dBA): Bật LED Xanh dương (GPIO 2), tắt LED Xanh lá & Đỏ
        gpio_set_level(LED_GREEN_PIN, 0);
        gpio_set_level(LED_BLUE_PIN,  1);
        gpio_set_level(LED_RED_PIN,   0);
        if (status_out) strcpy(status_out, "BLUE_WARNING");
    } else {
        // Mức 3 - Báo động (> 55 dBA): Bật LED Đỏ (GPIO 42), tắt LED Xanh lá & Xanh dương
        gpio_set_level(LED_GREEN_PIN, 0);
        gpio_set_level(LED_BLUE_PIN,  0);
        gpio_set_level(LED_RED_PIN,   1);
        if (status_out) strcpy(status_out, "RED_ALERT");
    }
}
