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
#include <math.h>

/**
 * @file mock_sensor.c
 * @brief Điều phối Thu thập Cảm biến Đa tốc độ & Tính toán Điểm Tiện nghi LCS Liebig.
 */

static float random_range(float min, float max) {
    uint32_t r = esp_random();
    float ratio = (float)r / (float)UINT32_MAX;
    return min + ratio * (max - min);
}

static float random_gaussian(float mean, float stddev) {
    float u1 = ((float)esp_random() + 1.0f) / ((float)UINT32_MAX + 1.0f);
    float u2 = ((float)esp_random() + 1.0f) / ((float)UINT32_MAX + 1.0f);
    float z0 = sqrtf(-2.0f * logf(u1)) * cosf(2.0f * (float)M_PI * u2);
    return mean + z0 * stddev;
}

// =============================================================================
// THUẬT TOÁN TÍNH ĐIỂM TIỆN NGHI HỌC TẬP LIEBIG (LCS) TRÊN TẦNG BIÊN FIRMWARE
// =============================================================================
float compute_liebig_comfort_score(const sensor_data_t *data, char *rank_out) {
    if (!data) return 0.0f;

    // 1. Điểm Âm học (S_acoustics) theo chuẩn phòng tự học thư viện ANSI/ASA S12.60
    float s_acoustic = 100.0f;
    float l_avg = data->laeq_db;
    if (l_avg <= 35.0f) {
        s_acoustic = 100.0f;
    } else if (l_avg <= 55.0f) {
        s_acoustic = 100.0f - (l_avg - 35.0f) * 1.5f;
    } else if (l_avg <= 70.0f) {
        s_acoustic = 70.0f - (l_avg - 55.0f) * (40.0f / 15.0f);
    } else if (l_avg <= 80.0f) {
        s_acoustic = 30.0f - (l_avg - 70.0f) * 3.0f;
    } else {
        s_acoustic = 0.0f;
    }
    if (s_acoustic < 0.0f) s_acoustic = 0.0f;

    // 2. Điểm Vi khí hậu (S_thermal) theo ASHRAE 55 (Nhiệt độ tối ưu 23.5 - 25.5°C, Ẩm 40 - 60%)
    float s_temp = 100.0f;
    if (data->temp >= 23.5f && data->temp <= 25.5f) {
        s_temp = 100.0f;
    } else if (data->temp < 23.5f) {
        s_temp = 100.0f - (23.5f - data->temp) * 8.0f;
    } else {
        s_temp = 100.0f - (data->temp - 25.5f) * 8.0f;
    }
    if (s_temp < 0.0f) s_temp = 0.0f;

    float s_rh = 100.0f;
    if (data->rh >= 40.0f && data->rh <= 60.0f) {
        s_rh = 100.0f;
    } else if (data->rh < 40.0f) {
        s_rh = 100.0f - (40.0f - data->rh) * 2.0f;
    } else {
        s_rh = 100.0f - (data->rh - 60.0f) * 2.0f;
    }
    if (s_rh < 0.0f) s_rh = 0.0f;

    float s_thermal = 0.70f * s_temp + 0.30f * s_rh;

    // 3. Điểm Chất lượng không khí (S_air) theo bụi mịn PM2.5 (WHO)
    float s_air = 100.0f;
    float pm = data->pm25;
    if (pm <= 15.0f) {
        s_air = 100.0f;
    } else if (pm <= 35.0f) {
        s_air = 100.0f - (pm - 15.0f) * 1.5f;
    } else if (pm <= 65.0f) {
        s_air = 70.0f - (pm - 35.0f) * (40.0f / 30.0f);
    } else if (pm <= 100.0f) {
        s_air = 30.0f - (pm - 65.0f) * (30.0f / 35.0f);
    } else {
        s_air = 0.0f;
    }
    if (s_air < 0.0f) s_air = 0.0f;

    // 4. Điểm Ánh sáng (S_light) theo tiêu chuẩn bàn đọc EN 12464-1 (300 - 500 Lux)
    float s_light = 100.0f;
    float lux = data->lux;
    if (lux >= 300.0f && lux <= 500.0f) {
        s_light = 100.0f;
    } else if (lux < 300.0f) {
        s_light = (lux <= 50.0f) ? 0.0f : (lux - 50.0f) / 2.5f;
    } else {
        s_light = (lux <= 1000.0f) ? (100.0f - (lux - 500.0f) * 0.1f) : 50.0f;
    }
    if (s_light < 0.0f) s_light = 0.0f;

    // Trọng số cơ bản cho phòng học STUDY_ROOM: Âm học 0.35, Bụi 0.30, Nhiệt ẩm 0.20, Ánh sáng 0.15
    float w_acoustic = 0.35f, w_air = 0.30f, w_thermal = 0.20f, w_light = 0.15f;
    float weighted_sum = w_acoustic * s_acoustic + w_air * s_air + w_thermal * s_thermal + w_light * s_light;

    // Thanh gỗ ngắn nhất (Nguyên lý Liebig)
    float min_score = s_acoustic;
    if (s_air < min_score) min_score = s_air;
    if (s_thermal < min_score) min_score = s_thermal;
    if (s_light < min_score) min_score = s_light;

    float bottleneck_ratio = (weighted_sum > 0.0f) ? (min_score / weighted_sum) : 0.0f;
    if (bottleneck_ratio > 1.0f) bottleneck_ratio = 1.0f;

    // Công thức gating phi tuyến Liebig:
    float lcs = weighted_sum * (0.30f + 0.70f * bottleneck_ratio);
    if (lcs < 0.0f) lcs = 0.0f;
    if (lcs > 100.0f) lcs = 100.0f;

    // Xác định Hạng Tiện Nghi
    const char *rank = "Poor";
    if (lcs >= 90.0f)      rank = "Platinum";
    else if (lcs >= 75.0f) rank = "Gold";
    else if (lcs >= 60.0f) rank = "Silver";
    else if (lcs >= 45.0f) rank = "Bronze";
    else                   rank = "Poor";

    if (rank_out) {
        strncpy(rank_out, rank, 15);
        rank_out[15] = '\0';
    }

    return roundf(lcs * 10.0f) / 10.0f;
}

// =============================================================================
// KHỞI TẠO BỘ ĐỆM DỮ LIỆU BAN ĐẦU
// =============================================================================
void mock_sensor_init(sensor_data_t *data) {
    if (!data) return;
    memset(data, 0, sizeof(sensor_data_t));

    data->laeq_db        = 41.5f;
    data->laeq_bg_db     = 40.2f;
    data->spl_peak_db    = 44.8f;
    data->librarian_spk  = 0;

    data->temp           = 24.8f;
    data->rh             = 54.0f;
    data->lux            = 465.0f;
    data->co2_ppm        = 580;

    data->pm1_0          = 7.4f;
    data->pm25           = 13.5f;
    data->pm4_0          = 15.5f;
    data->pm10           = 18.2f;

    data->so2_ppb        = 3.1f;
    data->no2_ppb        = 4.2f;
    data->voc_ppb        = 112.0f;

    data->power_mode     = 1; // AC
    data->battery_pct    = 98;
    data->offline_cached = 0;
    data->wifi_rssi      = -55;

    data->lcs_score      = compute_liebig_comfort_score(data, data->lcs_rank);
    data->telegram_alert = 0;
    strcpy(data->status, "GREEN_NORMAL");
    strcpy(data->alert_msg, "Hệ thống hoạt động bình thường - Không gian yên tĩnh đạt chuẩn");
}

// =============================================================================
// CẬP NHẬT CẢM BIẾN ĐA TỐC ĐỘ (MULTI-RATE SAMPLING)
// =============================================================================
bool mock_sensor_update_multirate(sensor_data_t *data, uint32_t tick_sec) {
    if (!data) return false;

    int prev_alert = data->telegram_alert;
    const node_runtime_cfg_t *cfg = ota_remote_cfg_get();
    uint16_t mask = (cfg != NULL) ? cfg->sensor_mask : ROLE_MASK_ALL_SENSORS;
    bool is_mock  = (cfg != NULL) ? (cfg->use_mock_mode != 0) : (USE_MOCK_SENSOR_MODE != 0);

    // -------------------------------------------------------------------------
    // 1. NHÓM ĐO TỨC THỜI (MỖI 1 GIÂY): Âm thanh I2S INMP441, Loa & 3 Đèn LED rời
    // -------------------------------------------------------------------------
    if (mask & SENSOR_MASK_INMP441) {
        audio_i2s_process(data, is_mock);
    } else {
        data->laeq_db     = 30.0f;
        data->spl_peak_db = 30.0f;
        data->librarian_spk = 0;
    }

    if (mask & SENSOR_MASK_LED3) {
        led_alert_set_state(data->laeq_db, data->status);
    } else {
        strcpy(data->status, "GREEN_NORMAL");
    }

    // -------------------------------------------------------------------------
    // 2. NHÓM ĐO MỖI 5 GIÂY: Độ rọi ánh sáng BH1750 (I2C 0x23)
    // -------------------------------------------------------------------------
    if (tick_sec % LUX_SAMPLE_PERIOD_SEC == 0) {
        if (mask & SENSOR_MASK_BH1750) {
            if (!is_mock) {
                float read_lux = 0.0f;
                if (drv_bh1750_read_lux(&read_lux) == ESP_OK) {
                    data->lux = read_lux;
                }
            } else {
                // Giả lập ánh sáng bàn đọc sách thư viện ổn định quanh 465 Lux
                data->lux = roundf(random_gaussian(465.0f, 8.0f));
                if (data->lux < 0.0f) data->lux = 0.0f;
            }
        }
    }

    // Luôn cập nhật hiển thị OLED
    if (mask & SENSOR_MASK_OLED) {
        drv_oled_update(data);
    }

    // -------------------------------------------------------------------------
    // 3. NHÓM ĐO MỖI 10 GIÂY: Vi khí hậu SHT30 (0x44), CO2 SCD40 (0x62), Khí độc & Pin
    // -------------------------------------------------------------------------
    if (tick_sec % ENV_GAS_SAMPLE_PERIOD_SEC == 0) {
        // --- CO2 Sensirion SCD40 ---
        if (mask & SENSOR_MASK_SCD40) {
            if (!is_mock) {
                uint16_t read_co2 = 0;
                float scd_t = 0.0f, scd_rh = 0.0f;
                if (drv_scd40_read_measurement(&read_co2, &scd_t, &scd_rh) == ESP_OK && read_co2 > 0) {
                    data->co2_ppm = read_co2;
                    // Nếu không có SHT30, dùng nhiệt/ẩm từ SCD40
                    if (!(mask & SENSOR_MASK_SHT30) && scd_t > 0.0f) {
                        data->temp = scd_t;
                        data->rh   = scd_rh;
                    }
                }
            } else {
                // Mô phỏng CO2 phòng đọc thông thoáng quanh 580 ppm
                data->co2_ppm = (uint16_t)random_gaussian(580.0f, 15.0f);
            }
        }

        // --- Nhiệt độ & Độ ẩm SHT30 ---
        if (mask & SENSOR_MASK_SHT30) {
            if (!is_mock) {
                float t = 0.0f, rh = 0.0f;
                if (drv_sht30_read_temp_rh(&t, &rh) == ESP_OK) {
                    data->temp = t;
                    data->rh   = rh;
                    drv_sht30_set_heater(rh > 90.0f);
                }
            } else {
                // Mô phỏng dao động nhiệt ẩm nhẹ theo thời gian thực
                float t_sim = 24.8f + 0.4f * sinf((float)tick_sec * 0.02f) + random_range(-0.1f, 0.1f);
                float rh_sim = 53.5f + 1.2f * cosf((float)tick_sec * 0.015f) + random_range(-0.3f, 0.3f);
                data->temp = roundf(t_sim * 10.0f) / 10.0f;
                data->rh   = roundf(rh_sim * 10.0f) / 10.0f;
            }
        }

        // --- Cụm Khí độc SO2 / NO2 / VOCs ---
        if (mask & SENSOR_MASK_GAS) {
            if (!is_mock) {
                drv_gas_sensors_read(&data->so2_ppb, &data->no2_ppb, &data->voc_ppb);
            } else {
                data->so2_ppb = random_range(2.8f, 4.0f);
                data->no2_ppb = random_range(3.5f, 4.8f);
                data->voc_ppb = random_range(105.0f, 125.0f);
            }
        }

        // --- Nguồn Pin UPS & Điện lưới ---
        if (!is_mock) {
            drv_ups_power_read(&data->power_mode, &data->battery_pct);
        } else {
            data->power_mode  = 1;
            data->battery_pct = 98;
        }
    }

    // -------------------------------------------------------------------------
    // 4. NHÓM ĐO MỖI 30 GIÂY: Bụi mịn Sharp GP2Y1014AU0F (Xung 280us + ADC1_CH2 x1.5)
    // -------------------------------------------------------------------------
    if (tick_sec % PM25_SAMPLE_PERIOD_SEC == 0) {
        if (mask & SENSOR_MASK_PM25) {
            if (!is_mock) {
                drv_dust_read_all_fractions(&data->pm1_0, &data->pm25, &data->pm4_0, &data->pm10);
            } else {
                // Mô phỏng nồng độ bụi phòng đọc điều hòa chuẩn sạch
                float sim_pm25 = random_gaussian(13.2f, 1.5f);
                if (sim_pm25 < 0.0f) sim_pm25 = 0.0f;
                data->pm25  = roundf(sim_pm25 * 10.0f) / 10.0f;
                data->pm1_0 = roundf(data->pm25 * 0.55f * 10.0f) / 10.0f;
                data->pm4_0 = roundf(data->pm25 * 1.15f * 10.0f) / 10.0f;
                data->pm10  = roundf(data->pm25 * 1.35f * 10.0f) / 10.0f;
            }
        }
    }

    // -------------------------------------------------------------------------
    // 5. TÍNH ĐIỂM TIỆN NGHI HỌC TẬP LIEBIG LCS & KIỂM TRA NGƯỠNG CẢNH BÁO
    // -------------------------------------------------------------------------
    data->lcs_score = compute_liebig_comfort_score(data, data->lcs_rank);
    data->offline_cached = offline_storage_get_count();

    bool noise_exceed = ((mask & SENSOR_MASK_INMP441) && (data->laeq_db > NOISE_LIMIT_WARN_DB));
    bool env_exceed   = (((mask & SENSOR_MASK_SCD40) && data->co2_ppm > CO2_LIMIT_ALERT_PPM) ||
                         ((mask & (SENSOR_MASK_SHT30 | SENSOR_MASK_SCD40)) && data->rh > RH_LIMIT_ALERT_PERCENT) ||
                         ((mask & SENSOR_MASK_PM25) && data->pm25 > PM25_LIMIT_ALERT_UGM3) ||
                         (data->lcs_score < 50.0f));

    const char *node_id = (cfg != NULL) ? cfg->node_id : DEFAULT_HARDWARE_ID;

    if (noise_exceed) {
        data->telegram_alert = 1;
        snprintf(data->alert_msg, sizeof(data->alert_msg),
                 "🚨 [CẢNH BÁO ĐỎ - %s] Độ ồn %.1f dBA (vượt ngưỡng 55 dBA, ồn nền %.1f dBA)! "
                 "LCS=%.1f [%s]. Đã bật Loa nhắc nhở!",
                 node_id, data->laeq_db, data->laeq_bg_db, data->lcs_score, data->lcs_rank);
    } else if (env_exceed) {
        data->telegram_alert = 1;
        snprintf(data->alert_msg, sizeof(data->alert_msg),
                 "⚠️ [CẢNH BÁO VI KHÍ HẬU - %s] Thông số vượt ngưỡng: "
                 "CO2=%u ppm, Ẩm=%.1f%%, PM2.5=%.1f, LCS=%.1f [%s]!",
                 node_id, data->co2_ppm, data->rh, data->pm25, data->lcs_score, data->lcs_rank);
    } else if ((mask & SENSOR_MASK_INMP441) && (data->laeq_db > NOISE_LIMIT_SAFE_DB)) {
        data->telegram_alert = 0;
        snprintf(data->alert_msg, sizeof(data->alert_msg),
                 "🔵 [NHẮC NHỞ - %s] Độ ồn %.1f dBA (45-55 dBA) - LED Xanh dương sáng nhắc sinh viên",
                 node_id, data->laeq_db);
    } else {
        data->telegram_alert = 0;
        snprintf(data->alert_msg, sizeof(data->alert_msg),
                 "🟢 [AN TOÀN - %s] Môi trường học tập lý tưởng (LCS=%.1f [%s])",
                 node_id, data->lcs_score, data->lcs_rank);
    }

    if (noise_exceed || (data->telegram_alert == 1 && prev_alert == 0)) {
        return true; // Kích hoạt sự kiện gửi ngay lập tức
    }
    return false;
}
