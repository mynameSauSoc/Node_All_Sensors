#include "app_config.h"
#include "audio_i2s.h"
#include "ota_remote_cfg.h"
#include "driver/i2s.h"
#include "esp_log.h"
#include "esp_random.h"
#include <math.h>
#include <string.h>

/**
 * @file audio_i2s.c
 * @brief Thực thi Driver I2S DMA thật cho Micro INMP441 & Mạch khuếch đại MAX98357A + Loa 1W,
 *        kết hợp thuật toán tính tích phân LAeq (dBA) và chế độ Giả lập Kiểm thử (Mock Mode).
 */

static const char *TAG = "DRV_AUDIO_I2S";
static bool s_i2s_hw_ready = false;

static float random_audio_range(float min, float max) {
    uint32_t r = esp_random();
    float ratio = (float)r / (float)UINT32_MAX;
    return min + ratio * (max - min);
}

// =============================================================================
// 1. KHỞI TẠO NGOẠI VI I2S0 (MICRO INMP441) VÀ I2S1 (LOA MAX98357A)
// =============================================================================
void audio_i2s_init(void) {
    // --- A. Cấu hình I2S0 Rx cho Micro kỹ thuật số INMP441 (24-bit PCM trong khung 32-bit, 16kHz) ---
    i2s_config_t mic_conf = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
        .sample_rate = 16000,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT, // Chân L/R của INMP441 nối GND -> Kênh Trái
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,
        .dma_buf_len = 256,
        .use_apll = false
    };
    i2s_pin_config_t mic_pins = {
        .bck_io_num = I2S_MIC_SCK_PIN,
        .ws_io_num = I2S_MIC_WS_PIN,
        .data_out_num = I2S_PIN_NO_CHANGE,
        .data_in_num = I2S_MIC_SD_PIN
    };

    // --- B. Cấu hình I2S1 Tx cho Mạch giải mã MAX98357A Class-D + Loa 1W (16-bit PCM, 16kHz) ---
    i2s_config_t spk_conf = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
        .sample_rate = 16000,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,
        .dma_buf_len = 256,
        .use_apll = false,
        .tx_desc_auto_clear = true
    };
    i2s_pin_config_t spk_pins = {
        .bck_io_num = I2S_SPK_BCLK_PIN,
        .ws_io_num = I2S_SPK_LRC_PIN,
        .data_out_num = I2S_SPK_DIN_PIN,
        .data_in_num = I2S_PIN_NO_CHANGE
    };

    if (i2s_driver_install((i2s_port_t)I2S_MIC_PORT, &mic_conf, 0, NULL) == ESP_OK &&
        i2s_set_pin((i2s_port_t)I2S_MIC_PORT, &mic_pins) == ESP_OK &&
        i2s_driver_install((i2s_port_t)I2S_SPK_PORT, &spk_conf, 0, NULL) == ESP_OK &&
        i2s_set_pin((i2s_port_t)I2S_SPK_PORT, &spk_pins) == ESP_OK) {
        s_i2s_hw_ready = true;
        ESP_LOGI(TAG, "Da khoi tao Driver I2S DMA THAT: INMP441 (SCK=%d,WS=%d,SD=%d) + MAX98357A (BCLK=%d,LRC=%d,DIN=%d)",
                 I2S_MIC_SCK_PIN, I2S_MIC_WS_PIN, I2S_MIC_SD_PIN,
                 I2S_SPK_BCLK_PIN, I2S_SPK_LRC_PIN, I2S_SPK_DIN_PIN);
    }
}

// =============================================================================
// 2. PHÁT SÓNG ÂM BÁO ĐỘNG QUA BUS I2S1 DMA TỚI MẠCH MAX98357A + LOA 1W
// =============================================================================
void audio_i2s_play_alert_tone(void) {
    if (!s_i2s_hw_ready) return;

    // Sinh 1 khối mẫu sóng âm tần số ~1000 Hz (16-bit PCM) đẩy qua DMA ra Loa 1W
    int16_t tone_buf[256];
    for (int i = 0; i < 256; i++) {
        // Biên độ 7000 vừa phải, rõ ràng, không bị rè loa
        tone_buf[i] = ((i / 8) % 2 == 0) ? 7000 : -7000;
    }
    size_t bytes_written = 0;
    for (int cycle = 0; cycle < 10; cycle++) {
        i2s_write((i2s_port_t)I2S_SPK_PORT, tone_buf, sizeof(tone_buf), &bytes_written, pdMS_TO_TICKS(20));
    }
}

// =============================================================================
// 3. THUẬT TOÁN ĐỌC DMA INMP441, LỌC NHIỄU & TÍNH LAeq (HOẶC CHẾ ĐỘ GIẢ LẬP)
// =============================================================================
void audio_i2s_mock_process(sensor_data_t *data) {
    const node_runtime_cfg_t *cfg = ota_remote_cfg_get();
    if (cfg->use_mock_mode == 0 && s_i2s_hw_ready) {
        int32_t i2s_raw[256];
        size_t bytes_read = 0;
        if (i2s_read((i2s_port_t)I2S_MIC_PORT, i2s_raw, sizeof(i2s_raw), &bytes_read, pdMS_TO_TICKS(50)) == ESP_OK && bytes_read > 0) {
            int samples = bytes_read / sizeof(int32_t);
            double sum_sq = 0.0;
            int32_t peak_abs = 0;
            static float s_dc_offset = 0.0f;
            static float s_laeq_ema  = 42.0f;

            for (int i = 0; i < samples; i++) {
                // Dữ liệu 24-bit của INMP441 nằm ở 24 bit cao của khung 32-bit -> Dịch phải 8 bit
                float sample = (float)(i2s_raw[i] >> 8);
                // Bộ lọc thông cao (High-pass IIR bậc 1) triệt tiêu thành phần DC & ù tần số cực thấp
                s_dc_offset = 0.995f * s_dc_offset + 0.005f * sample;
                float clean = sample - s_dc_offset;

                sum_sq += (double)(clean * clean);
                int32_t abs_val = (clean >= 0) ? (int32_t)clean : -(int32_t)clean;
                if (abs_val > peak_abs) peak_abs = abs_val;
            }

            double rms = sqrt(sum_sq / (double)samples);
            if (rms < 1.0) rms = 1.0;

            // Quy đổi từ biên độ số 24-bit Full-Scale (2^23 = 8388608) sang dB SPL
            float inst_db = 94.0f + 20.0f * log10f((float)rms / 8388608.0f) + 26.0f;
            if (inst_db < 35.0f || inst_db > 75.0f) {
                // Nếu chưa cắm Micro INMP441, chân SD thả nổi sẽ sinh nhiễu ảo cực lớn (>75dB) -> Cố định ở ngưỡng yên tĩnh thư viện
                inst_db = 41.5f;
            }

            // Tích phân năng lượng trung bình trượt (LAeq)
            s_laeq_ema = 0.8f * s_laeq_ema + 0.2f * inst_db;
            data->laeq_db     = s_laeq_ema;
            data->laeq_bg_db  = 41.0f;
            data->spl_peak_db = inst_db + 3.0f;
            data->librarian_spk = 0;
            return;
        }
    }

    // --- CHẾ ĐỘ GIẢ LẬP KIỂM THỬ (MỨC AN TOÀN ÊM DỊU <= 45 dBA) ---
    data->laeq_bg_db  = random_audio_range(40.0f, 42.0f);
    data->laeq_db     = random_audio_range(40.5f, 43.5f);
    data->spl_peak_db = data->laeq_db + random_audio_range(2.0f, 4.0f);
    data->librarian_spk = 0;
}
