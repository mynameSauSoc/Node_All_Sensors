#include "drv_adc_sensors.h"
#include "driver/gpio.h"
#include "driver/adc.h"
#include "esp_adc_cal.h"
#include "esp32s3/rom/ets_sys.h"
#include "esp_log.h"
#include <math.h>

/**
 * @file drv_adc_sensors.c
 * @brief Thực thi Driver phần cứng ADC1 & Xung định thời micro-giây cho ESP32-S3:
 *
 * 1. CẢM BIẾN BỤI SHARP GP2Y1014AU0F:
 *    - GPIO 10 (DUST_PULSE): Nối cực Base transistor NPN SS8050 (Q_DUST).
 *      * Mức THẤP (0): BJT ngắt, chân 3 (LED) của Sharp thả nổi -> LED TẮT (Chế độ nghỉ).
 *      * Mức CAO (1): BJT dẫn bão hòa, kéo chân 3 Sharp xuống GND -> LED BẬT.
 *    - Giản đồ xung Sharp Datasheet:
 *      * Bật LED (GPIO10 = 1) -> Đợi chính xác 280 micro-giây -> Lấy mẫu ADC1_CH2 (GPIO 3)
 *      * Đợi thêm 40 micro-giây (tổng độ rộng xung = 320 micro-giây) -> Tắt LED (GPIO10 = 0).
 *    - Mạch cầu phân áp bảo vệ ngõ vào:
 *      * R2 = 10 kΩ, R3 = 20 kΩ -> V_ADC = Vo * (20 / (10 + 20)) = Vo * (2/3).
 *      * Firmware BẮT BUỘC NHÂN HỆ SỐ 1.5 (SHARP_DIVIDER_FACTOR) để khôi phục đúng điện áp Vo!
 *      * Phương trình Sharp: Nồng độ bụi PM2.5 (ug/m3) = (0.17 * Vo - 0.1) * 1000.
 */

static const char *TAG = "DRV_ADC";
static bool s_adc_initialized = false;
static esp_adc_cal_characteristics_t s_adc_chars;

esp_err_t drv_adc_sensors_init(void) {
    if (s_adc_initialized) {
        return ESP_OK;
    }

    // 1. Cấu hình GPIO 10 điều khiển Base transistor NPN SS8050 kích LED hồng ngoại Sharp
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << SHARP_LED_Trigger_PIN),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE
    };
    gpio_config(&io_conf);
    // Trạng thái nghỉ: Mức THẤP (0) để ngắt BJT SS8050 -> LED Sharp TẮT hoàn toàn
    gpio_set_level(SHARP_LED_Trigger_PIN, 0);

    // 2. Cấu hình ADC1 ESP32-S3 (Độ phân giải 12-bit: 0 - 4095; Suy hao 11dB: đo tuyến tính 0 - 3100 mV)
    adc1_config_width(ADC_WIDTH_BIT_12);
    adc1_config_channel_atten((adc1_channel_t)ADC_CH_SHARP_PM25, ADC_ATTEN_DB_12);
    adc1_config_channel_atten((adc1_channel_t)ADC_CH_GAS_SO2,    ADC_ATTEN_DB_12);
    adc1_config_channel_atten((adc1_channel_t)ADC_CH_GAS_NO2,    ADC_ATTEN_DB_12);
    adc1_config_channel_atten((adc1_channel_t)ADC_CH_GAS_VOC,    ADC_ATTEN_DB_12);
    adc1_config_channel_atten((adc1_channel_t)ADC_CH_UPS_BATTERY, ADC_ATTEN_DB_12);

    // 3. Khởi tạo hiệu chuẩn ADC Cal (eFuse Vref nội)
    esp_adc_cal_characterize(ADC_UNIT_1, ADC_ATTEN_DB_12, ADC_WIDTH_BIT_12, 1100, &s_adc_chars);

    s_adc_initialized = true;
    ESP_LOGI(TAG, "Da khoi tao Driver ADC1 (GPIO3=PM2.5 qua cau phan ap 10k:20k x1.5, GPIO10=Xung BJT SS8050)");
    return ESP_OK;
}

// Đọc bụi mịn PM2.5 từ Sharp GP2Y1014AU0F theo đúng giản đồ xung 280us và nhân 1.5
float drv_sharp_gp2y10_read_pm25(void) {
    if (!s_adc_initialized) {
        drv_adc_sensors_init();
    }

    // Bước 1: Kéo chân GPIO 10 lên mức CAO (1) để kích BJT SS8050 dẫn bão hòa, BẬT đèn phát LED hồng ngoại
    gpio_set_level(SHARP_LED_Trigger_PIN, 1);

    // Bước 2: Đợi chính xác 280 micro-giây để hạt bụi trong buồng quang học tán xạ đạt đỉnh
    ets_delay_us(280);

    // Bước 3: Lấy mẫu tức thời điện áp trên chân GPIO 3 (ADC1_CHANNEL_2)
    // Thực hiện oversampling 4 lần cực nhanh trong cửa sổ đỉnh để lọc nhiễu cao tần
    uint32_t adc_sum = 0;
    for (int i = 0; i < 4; i++) {
        adc_sum += adc1_get_raw((adc1_channel_t)ADC_CH_SHARP_PM25);
    }
    int adc_raw = adc_sum / 4;

    // Bước 4: Đợi thêm 40 micro-giây cho đủ tổng độ rộng xung 320 micro-giây
    ets_delay_us(40);

    // Bước 5: Kéo chân GPIO 10 xuống mức THẤP (0) để ngắt BJT SS8050, TẮT đèn LED hồng ngoại
    gpio_set_level(SHARP_LED_Trigger_PIN, 0);

    // Bước 6: Chuyển đổi giá trị ADC raw sang điện áp tại chân GPIO 3 (V_ADC)
    uint32_t voltage_mv = esp_adc_cal_raw_to_voltage(adc_raw, &s_adc_chars);
    float v_adc = (float)voltage_mv / 1000.0f;

    // Bước 7: BẮT BUỘC NHÂN HỆ SỐ 1.5 để khôi phục đúng điện áp Vo thực của cảm biến Sharp:
    // Cầu phân áp trên PCB: V_ADC = Vo * (R3 / (R2 + R3)) = Vo * (20k / 30k) = Vo * (2/3)
    // => Vo = V_ADC * 1.5
    float vo = v_adc * SHARP_DIVIDER_FACTOR;

    // Bước 8: Áp dụng phương trình đặc tuyến tuyến tính của Datasheet Sharp:
    // PM2.5 (ug/m3) = (0.17 * Vo - 0.1) * 1000
    float pm25_ugm3 = (0.17f * vo - 0.1f) * 1000.0f;

    // Kẹp ngưỡng vật lý an toàn: Không âm (Server loại bỏ giá trị âm), tối đa 1000 ug/m3
    if (pm25_ugm3 < 0.0f) pm25_ugm3 = 0.0f;
    if (pm25_ugm3 > 1000.0f) pm25_ugm3 = 1000.0f;

    ESP_LOGD(TAG, "[SHARP DUST] Raw=%d, V_ADC=%.3fV, Vo=%.3fV (x1.5), PM2.5=%.1f ug/m3",
             adc_raw, v_adc, vo, pm25_ugm3);

    return pm25_ugm3;
}

void drv_dust_read_all_fractions(float *pm1_0, float *pm2_5, float *pm4_0, float *pm10) {
    float pm25 = drv_sharp_gp2y10_read_pm25();
    if (pm2_5) *pm2_5 = pm25;

    // Ước lượng các phân đoạn kích thước hạt bụi theo mô hình khí dung phòng đọc thư viện
    if (pm1_0) *pm1_0 = pm25 * 0.55f;
    if (pm4_0) *pm4_0 = pm25 * 1.15f;
    if (pm10)  *pm10  = pm25 * 1.35f;
}

// Đọc nồng độ khí độc SO2, NO2, VOCs từ các kênh ADC qua mạch tiền khuếch đại AFE
void drv_gas_sensors_read(float *so2_ppb, float *no2_ppb, float *voc_ppb) {
    int raw_so2 = adc1_get_raw((adc1_channel_t)ADC_CH_GAS_SO2);
    int raw_no2 = adc1_get_raw((adc1_channel_t)ADC_CH_GAS_NO2);
    int raw_voc = adc1_get_raw((adc1_channel_t)ADC_CH_GAS_VOC);

    // Quy đổi điện áp sang đơn vị phần tỷ (ppb)
    if (so2_ppb) *so2_ppb = ((float)raw_so2 / 4095.0f) * 20.0f;
    if (no2_ppb) *no2_ppb = ((float)raw_no2 / 4095.0f) * 20.0f;
    if (voc_ppb) *voc_ppb = ((float)raw_voc / 4095.0f) * 500.0f;
}

// Đọc điện áp Pin dự phòng UPS (ADC1_CH6 qua cầu phân áp 1/2)
void drv_ups_power_read(int *power_mode, int *battery_pct) {
    int raw_bat = adc1_get_raw((adc1_channel_t)ADC_CH_UPS_BATTERY);
    uint32_t mv = esp_adc_cal_raw_to_voltage(raw_bat, &s_adc_chars);
    float v_adc = (float)mv / 1000.0f;

    // Cầu phân áp 1:2 -> V_pin = V_adc * 2.0
    float v_bat = v_adc * 2.0f;

    // Pin Lithium 18650: 3.0V = 0%, 4.2V = 100%
    int pct = (int)(((v_bat - 3.0f) / (4.2f - 3.0f)) * 100.0f);
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;

    if (battery_pct) *battery_pct = pct;
    // Nếu điện áp > 4.10V thì mạch đang được cắm sạc điện lưới AC
    if (power_mode)  *power_mode  = (v_bat >= 4.10f) ? 1 : 0;
}
