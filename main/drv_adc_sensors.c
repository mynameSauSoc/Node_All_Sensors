#include "drv_adc_sensors.h"
#include "driver/gpio.h"
#include "driver/adc.h"
#include "esp32s3/rom/ets_sys.h"
#include "esp_log.h"

/**
 * @file drv_adc_sensors.c
 * @brief Thực thi Driver phần cứng ADC1 & Xung định thời micro-giây cho Sharp GP2Y1014AU0F,
 *        cảm biến khí độc (SO2, NO2, VOCs) và giám sát Pin dự phòng UPS.
 *        Giải thích nguyên lý kỹ thuật quan trọng:
 *        - Cảm biến bụi Sharp GP2Y1014AU0F dùng 1 đèn LED hồng ngoại (IR LED) và 1 Phototransistor.
 *        - Theo Datasheet Sharp: Không được bật sáng LED liên tục mà phải kích xung chu kỳ 10ms (10000us),
 *          độ rộng xung bật LED là 320us, và BẮT BUỘC lấy mẫu ADC tại đúng thời điểm 280us sau khi bật LED!
 */

static const char *TAG = "DRV_ADC";
static bool s_adc_initialized = false;

esp_err_t drv_adc_sensors_init(void) {
    if (s_adc_initialized) return ESP_OK;

    // 1. Cấu hình chân GPIO kích xung LED hồng ngoại của cảm biến bụi Sharp (Output)
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << SHARP_LED_Trigger_PIN),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE
    };
    gpio_config(&io_conf);
    // Mạch transistor PNP trên cảm biến Sharp: Mức CAO (1) là TẮT LED, mức THẤP (0) là BẬT LED
    gpio_set_level(SHARP_LED_Trigger_PIN, 1);

    // 2. Cấu hình độ phân giải ADC1 của ESP32-S3 là 12-bit (0 - 4095) và suy hao 11dB (đọc 0 - 3100mV)
    adc1_config_width(ADC_WIDTH_BIT_12);
    adc1_config_channel_atten((adc1_channel_t)ADC_CH_SHARP_PM25, ADC_ATTEN_DB_12);
    adc1_config_channel_atten((adc1_channel_t)ADC_CH_GAS_SO2,    ADC_ATTEN_DB_12);
    adc1_config_channel_atten((adc1_channel_t)ADC_CH_GAS_NO2,    ADC_ATTEN_DB_12);
    adc1_config_channel_atten((adc1_channel_t)ADC_CH_GAS_VOC,    ADC_ATTEN_DB_12);
    adc1_config_channel_atten((adc1_channel_t)ADC_CH_UPS_BATTERY, ADC_ATTEN_DB_12);

    s_adc_initialized = true;
    ESP_LOGI(TAG, "Da khoi tao Driver ADC1 (12-bit) & Chan xung Sharp GP2Y10 (GPIO%d)", SHARP_LED_Trigger_PIN);
    return ESP_OK;
}

// Đọc bụi mịn PM2.5 theo đúng giản đồ thời gian (Timing Diagram) 280us của Datasheet Sharp GP2Y1014AU0F
float drv_sharp_gp2y10_read_pm25(void) {
    // Bước 1: Kéo chân điều khiển xuống mức THẤP (0) để BẬT đèn LED hồng ngoại chiếu vào buồng bụi
    gpio_set_level(SHARP_LED_Trigger_PIN, 0);

    // Bước 2: Đợi chính xác 280 micro-giây để đỉnh xung ánh sáng phản xạ từ hạt bụi đạt cực đại
    ets_delay_us(280);

    // Bước 3: Lấy mẫu tức thời giá trị ADC 12-bit (0 - 4095)
    int adc_raw = adc1_get_raw((adc1_channel_t)ADC_CH_SHARP_PM25);

    // Bước 4: Đợi thêm 40 micro-giây cho đủ độ rộng xung 320us rồi TẮT đèn LED hồng ngoại (kéo lên 1)
    ets_delay_us(40);
    gpio_set_level(SHARP_LED_Trigger_PIN, 1);

    // Bước 5: Quy đổi giá trị ADC sang điện áp (V) và áp dụng phương trình tuyến tính của Sharp:
    //         Dust Density (ug/m3) = (0.17 * Voltage - 0.1) * 1000
    float voltage = ((float)adc_raw / 4095.0f) * 3.3f;
    float pm25_ugm3 = (0.17f * voltage - 0.1f) * 1000.0f;
    if (pm25_ugm3 < 5.0f) pm25_ugm3 = 5.0f;
    return pm25_ugm3;
}

// Đọc nồng độ khí độc hóa học SO2, NO2, VOCs từ các kênh ADC qua mạch tiền khuếch đại AFE
void drv_gas_sensors_read(float *so2_ppb, float *no2_ppb, float *voc_ppb) {
    int raw_so2 = adc1_get_raw((adc1_channel_t)ADC_CH_GAS_SO2);
    int raw_no2 = adc1_get_raw((adc1_channel_t)ADC_CH_GAS_NO2);
    int raw_voc = adc1_get_raw((adc1_channel_t)ADC_CH_GAS_VOC);

    // Quy đổi tín hiệu điện áp AFE sang nồng độ phần tỷ (ppb)
    if (so2_ppb) *so2_ppb = ((float)raw_so2 / 4095.0f) * 20.0f;
    if (no2_ppb) *no2_ppb = ((float)raw_no2 / 4095.0f) * 20.0f;
    if (voc_ppb) *voc_ppb = ((float)raw_voc / 4095.0f) * 500.0f;
}

// Đọc điện áp Pin dự phòng UPS (qua cầu phân áp 1/2)
void drv_ups_power_read(int *power_mode, int *battery_pct) {
    int raw_bat = adc1_get_raw((adc1_channel_t)ADC_CH_UPS_BATTERY);
    // Điện áp thực tế của Pin 18650 (3.0V = 0%, 4.2V = 100%; nếu > 4.15V là đang được cắm sạc AC)
    float v_bat = ((float)raw_bat / 4095.0f) * 3.3f * 2.0f;
    int pct = (int)(((v_bat - 3.0f) / (4.2f - 3.0f)) * 100.0f);
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;

    if (battery_pct) *battery_pct = pct;
    if (power_mode)  *power_mode  = (v_bat >= 4.10f) ? 1 : 0;
}
