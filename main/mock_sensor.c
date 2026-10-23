#include "app_config.h"
#include "mock_sensor.h"
#include "ota_remote_cfg.h"
#include "audio_i2s.h"
#include "led_alert.h"
#include "offline_storage.h"
#include "drv_i2c_sensors.h"
#include "drv_adc_sensors.h"
#include "esp_random.h"
#include <stdio.h>
#include <string.h>
#include <stdint.h>

/**
 * @file mock_sensor.c
 * @brief Bộ điều phối Cảm biến Đa tốc độ & Plug-and-Play (Sensor Manager):
 *        - Tự động đọc cấu hình `sensor_mask` từ NVS (được điều khiển qua Wi-Fi/MQTT)
 *          để biết cảm biến nào đang ĐƯỢC CẮM (bật đo) và cảm biến nào ĐÃ RÚT RA (bỏ qua).
 *        - Hỗ trợ chuyển đổi mượt mà giữa Chế độ Phần cứng Thật (`use_mock_mode == 0`)
 *          và Chế độ Giả lập Kiểm thử Admin (`use_mock_mode == 1`) qua Wi-Fi mà không cần nạp lại code.
 */

static float random_range(float min, float max) {
    uint32_t r = esp_random();
    float ratio = (float)r / (float)UINT32_MAX;
    return min + ratio * (max - min);
}

void mock_sensor_init(sensor_data_t *data) {
    memset(data, 0, sizeof(sensor_data_t));
    data->laeq_db        = 41.5f;
    data->laeq_bg_db     = 40.2f;
    data->spl_peak_db    = 45.0f;
    data->librarian_spk  = 0;
    data->co2_ppm        = 620;
    data->temp           = 25.0f;
    data->rh             = 56.0f;
    data->lux            = 420.0f;
    data->pm25           = 18.5f;
    data->so2_ppb        = 3.2f;
    data->no2_ppb        = 4.1f;
    data->voc_ppb        = 110.0f;
    data->power_mode     = 1;
    data->battery_pct    = 98;
    data->offline_cached = 0;
    data->telegram_alert = 0;
    strcpy(data->status, "GREEN_NORMAL");
    strcpy(data->alert_msg, "Hệ thống hoạt động bình thường - Không gian yên tĩnh");
}

bool mock_sensor_update_multirate(sensor_data_t *data, uint32_t tick_sec) {
    int prev_alert = data->telegram_alert;
    const node_runtime_cfg_t *cfg = ota_remote_cfg_get();
    uint16_t mask = cfg->sensor_mask;
    bool is_mock  = (cfg->use_mock_mode != 0);

    // -------------------------------------------------------------------------
    // 1. NHÓM ĐO TỨC THỜI (MỖI 1 GIÂY): Âm thanh I2S INMP441, Loa MAX98357A & 3 Đèn LED rời
    // -------------------------------------------------------------------------
    if (mask & SENSOR_MASK_INMP441) {
        audio_i2s_mock_process(data);
    } else {
        data->laeq_db = 0.0f;
        data->spl_peak_db = 0.0f;
        data->librarian_spk = 0;
    }

    if (mask & SENSOR_MASK_LED3) {
        led_alert_set_state(data->laeq_db, data->status);
    } else {
        strcpy(data->status, "GREEN_NORMAL");
    }

    // -------------------------------------------------------------------------
    // 2. NHÓM ĐO MỖI 5 GIÂY: Cảm biến ánh sáng BH1750 (I2C 0x23) & Cập nhật màn hình OLED
    // -------------------------------------------------------------------------
    if (tick_sec % LUX_SAMPLE_PERIOD_SEC == 0) {
        if (mask & SENSOR_MASK_BH1750) {
            if (!is_mock) {
                if (drv_bh1750_read_lux(&data->lux) != ESP_OK) {
                    data->lux = random_range(360.0f, 520.0f);
                }
            } else {
                data->lux = random_range(360.0f, 520.0f);
            }
        } else {
            data->lux = 0.0f;
        }

        // Nếu Node có cắm màn hình OLED (VD: Node 2 Cột) -> Cập nhật thông số lên màn hình
        if (mask & SENSOR_MASK_OLED) {
            drv_oled_ssd1306_update(data);
        }
    }

    // -------------------------------------------------------------------------
    // 3. NHÓM ĐO MỖI 10 GIÂY: Vi khí hậu (SCD40 0x62, SHT30 0x44) & Khí độc (ADC)
    // -------------------------------------------------------------------------
    if (tick_sec % ENV_GAS_SAMPLE_PERIOD_SEC == 0) {
        // --- Cảm biến CO2 SCD40 (Node 2 Cột / Kho lưu trữ) ---
        if (mask & SENSOR_MASK_SCD40) {
            if (!is_mock) {
                if (drv_scd40_read_measurement(&data->co2_ppm, &data->temp, &data->rh) != ESP_OK) {
                    data->co2_ppm = (uint16_t)random_range(480.0f, 1040.0f);
                }
            } else {
                data->co2_ppm = (uint16_t)random_range(480.0f, 1040.0f);
            }
        } else {
            data->co2_ppm = 400;
        }

        // --- Cảm biến Nhiệt/Ẩm SHT30 (Node 3 Kệ sách) ---
        if ((mask & SENSOR_MASK_SHT30) || (mask & SENSOR_MASK_SCD40)) {
            if (!is_mock && (mask & SENSOR_MASK_SHT30)) {
                if (drv_sht30_read_temp_rh(&data->temp, &data->rh) != ESP_OK) {
                    data->temp = random_range(24.2f, 26.4f);
                    data->rh   = random_range(52.0f, 67.5f);
                }
                drv_sht30_set_heater(data->rh > 90.0f);
            } else if (is_mock) {
                data->temp = random_range(24.2f, 26.4f);
                data->rh   = random_range(52.0f, 67.5f);
            }
        }

        // --- Cụm cảm biến Khí độc SO2 / NO2 / VOCs (Node 3 Kệ sách quý hiếm) ---
        if (mask & SENSOR_MASK_GAS) {
            if (!is_mock) {
                drv_gas_sensors_read(&data->so2_ppb, &data->no2_ppb, &data->voc_ppb);
            } else {
                data->so2_ppb = random_range(1.5f, 11.2f);
                data->no2_ppb = random_range(2.0f, 11.5f);
                data->voc_ppb = random_range(75.0f, 325.0f);
            }
        } else {
            data->so2_ppb = 0.0f;
            data->no2_ppb = 0.0f;
            data->voc_ppb = 0.0f;
        }

        if (!is_mock) {
            drv_ups_power_read(&data->power_mode, &data->battery_pct);
        }
    }

    // -------------------------------------------------------------------------
    // 4. NHÓM ĐO MỖI 30 GIÂY: Bụi mịn PM2.5 Sharp GP2Y10 (Xung 280us + ADC)
    // -------------------------------------------------------------------------
    if (tick_sec % PM25_SAMPLE_PERIOD_SEC == 0) {
        if (mask & SENSOR_MASK_PM25) {
            if (!is_mock) {
                data->pm25 = drv_sharp_gp2y10_read_pm25();
            } else {
                data->pm25 = random_range(14.0f, 37.5f);
            }
        } else {
            data->pm25 = 0.0f;
        }
    }

    data->offline_cached = offline_storage_get_count();

    // -------------------------------------------------------------------------
    // 5. ĐÁNH GIÁ VƯỢT NGƯỠNG & SOẠN TIN NHẮN CẢNH BÁO TIẾNG VIỆT CHO THỦ THƯ
    // -------------------------------------------------------------------------
    bool noise_exceed = ((mask & SENSOR_MASK_INMP441) && (data->laeq_db > NOISE_ALERT_DB));
    bool env_exceed   = (((mask & SENSOR_MASK_SCD40) && data->co2_ppm > CO2_ALERT_PPM) ||
                         ((mask & (SENSOR_MASK_SHT30 | SENSOR_MASK_SCD40)) && data->rh > RH_ALERT_PERCENT) ||
                         ((mask & SENSOR_MASK_PM25) && data->pm25 > PM25_ALERT_UGM3) ||
                         ((mask & SENSOR_MASK_GAS) && (data->so2_ppb > SO2_ALERT_PPB ||
                                                       data->no2_ppb > NO2_ALERT_PPB ||
                                                       data->voc_ppb > VOC_ALERT_PPB)));

    if (noise_exceed) {
        data->telegram_alert = 1;
        snprintf(data->alert_msg, sizeof(data->alert_msg),
                 "🚨 [CẢNH BÁO ĐỎ - %s] Độ ồn %.1f dBA (vượt ngưỡng 55 dBA, ồn nền %.1f dBA)! "
                 "Đã bật Loa nhắc nhở, đề nghị Thủ thư kiểm tra!",
                 cfg->node_id, data->laeq_db, data->laeq_bg_db);
    } else if (env_exceed) {
        data->telegram_alert = 1;
        snprintf(data->alert_msg, sizeof(data->alert_msg),
                 "⚠️ [CẢNH BÁO VI KHÍ HẬU / BẢO QUẢN SÁCH - %s] Phát hiện thông số vượt ngưỡng: "
                 "CO2=%u ppm, Ẩm=%.1f%%, PM2.5=%.1f, VOCs=%.0f ppb!",
                 cfg->node_id, data->co2_ppm, data->rh, data->pm25, data->voc_ppb);
    } else if ((mask & SENSOR_MASK_INMP441) && (data->laeq_db > NOISE_WARNING_DB)) {
        data->telegram_alert = 0;
        snprintf(data->alert_msg, sizeof(data->alert_msg),
                 "🔵 [NHẮC NHỞ TẠI %s] Độ ồn %.1f dBA (45-55 dBA) - Đèn LED Xanh dương đang sáng nhắc sinh viên",
                 cfg->node_id, data->laeq_db);
    } else {
        data->telegram_alert = 0;
        snprintf(data->alert_msg, sizeof(data->alert_msg),
                 "🟢 [AN TOÀN - %s] Môi trường ổn định, đạt chuẩn bảo quản tài liệu", cfg->node_id);
    }

    if (noise_exceed || (data->telegram_alert == 1 && prev_alert == 0)) {
        return true;
    }
    return false;
}
