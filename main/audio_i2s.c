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
 * @brief Thực thi Driver I2S DMA cho Micro INMP441 & Amply MAX98357A + Loa 1W.
 */

static const char *TAG = "DRV_AUDIO_I2S";
static bool s_i2s_hw_ready = false;
static float s_dc_offset   = 0.0f;
static float s_laeq_ema    = 41.5f;

static float random_range(float min, float max) {
    uint32_t r = esp_random();
    float ratio = (float)r / (float)UINT32_MAX;
    return min + ratio * (max - min);
}

// Sinh nhiễu Gaussian bằng biến đổi Box-Muller
static float random_gaussian(float mean, float stddev) {
    float u1 = ((float)esp_random() + 1.0f) / ((float)UINT32_MAX + 1.0f);
    float u2 = ((float)esp_random() + 1.0f) / ((float)UINT32_MAX + 1.0f);
    float z0 = sqrtf(-2.0f * logf(u1)) * cosf(2.0f * (float)M_PI * u2);
    return mean + z0 * stddev;
}

// =============================================================================
// 1. KHỞI TẠO NGOẠI VI I2S0 (MICRO INMP441) VÀ I2S1 (LOA MAX98357A)
// =============================================================================
void audio_i2s_init(void) {
    // --- A. Cấu hình I2S0 Rx: Micro MEMS INMP441 (32-bit slot, 24-bit data, 16kHz) ---
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

    // --- B. Cấu hình I2S1 Tx: Mạch giải mã MAX98357A Class-D + Loa 1W (16-bit, 16kHz) ---
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
        ESP_LOGI(TAG, "Da khoi tao Driver I2S DMA: INMP441 (SCK=4,WS=5,SD=6) & MAX98357A (BCLK=15,LRC=16,DIN=7)");
    } else {
        ESP_LOGE(TAG, "Loi khoi tao Driver I2S!");
    }
}

// =============================================================================
// 2. PHÁT SÓNG ÂM BÁO ĐỘNG BÍP ~1000 HZ RA LOA 1W
// =============================================================================
void audio_i2s_play_alert_tone(void) {
    if (!s_i2s_hw_ready) return;

    int16_t tone_buf[256];
    for (int i = 0; i < 256; i++) {
        tone_buf[i] = ((i / 8) % 2 == 0) ? 6500 : -6500;
    }

    size_t bytes_written = 0;
    for (int cycle = 0; cycle < 10; cycle++) {
        i2s_write((i2s_port_t)I2S_SPK_PORT, tone_buf, sizeof(tone_buf), &bytes_written, pdMS_TO_TICKS(20));
    }
}

// =============================================================================
// 3. ĐỌC DMA MICRO INMP441 & TÍNH TOÁN ĐỘ ỒN
// =============================================================================
void audio_i2s_read_levels(float *laeq_out, float *spl_peak_out) {
    if (!s_i2s_hw_ready) {
        if (laeq_out) *laeq_out = 41.5f;
        if (spl_peak_out) *spl_peak_out = 44.5f;
        return;
    }

    int32_t i2s_raw[256];
    size_t bytes_read = 0;
    if (i2s_read((i2s_port_t)I2S_MIC_PORT, i2s_raw, sizeof(i2s_raw), &bytes_read, pdMS_TO_TICKS(50)) == ESP_OK && bytes_read > 0) {
        int samples = bytes_read / sizeof(int32_t);
        double sum_sq = 0.0;
        int32_t peak_abs = 0;

        for (int i = 0; i < samples; i++) {
            // Dữ liệu 24-bit của INMP441 nằm ở 24 bit cao của khung 32-bit
            float sample = (float)(i2s_raw[i] >> 8);

            // Bộ lọc IIR thông cao bậc 1 loại bỏ thành phần DC và ù quạt trần
            s_dc_offset = 0.995f * s_dc_offset + 0.005f * sample;
            float clean = sample - s_dc_offset;

            sum_sq += (double)(clean * clean);
            int32_t abs_val = (clean >= 0) ? (int32_t)clean : -(int32_t)clean;
            if (abs_val > peak_abs) peak_abs = abs_val;
        }

        double rms = sqrt(sum_sq / (double)samples);
        if (rms < 1.0) rms = 1.0;

        // Quy đổi độ nhạy INMP441 (-26 dBFS tại 94 dB SPL)
        float inst_db = 94.0f + 20.0f * log10f((float)rms / 8388608.0f) + 26.0f;

        // Lọc chống nổi chân khi chưa cắm Micro
        if (inst_db < 30.0f) inst_db = 30.0f;
        if (inst_db > 110.0f) inst_db = 110.0f;

        // Tích phân trung bình trượt EMA cho LAeq
        s_laeq_ema = 0.85f * s_laeq_ema + 0.15f * inst_db;

        // Quy định bắt buộc Server Telemetry Sanitizer: Tuyệt đối không gửi < 30.0 dBA
        if (s_laeq_ema < 30.0f) s_laeq_ema = 30.0f;

        float peak_db = inst_db + 3.0f;
        if (peak_db < 30.0f) peak_db = 30.0f;
        if (peak_db > 130.0f) peak_db = 130.0f;

        if (laeq_out) *laeq_out = s_laeq_ema;
        if (spl_peak_out) *spl_peak_out = peak_db;
    }
}

// =============================================================================
// 4. ĐIỀU PHỐI ÂM THANH (PHẦN CỨNG THẬT VS GIẢ LẬP KIỂM THỬ)
// =============================================================================
void audio_i2s_process(sensor_data_t *data, bool is_mock) {
    if (!data) return;

    if (!is_mock && s_i2s_hw_ready) {
        audio_i2s_read_levels(&data->laeq_db, &data->spl_peak_db);
        data->laeq_bg_db = 40.5f;
    } else {
        // --- CHẾ ĐỘ MÔ PHỎNG / TEST: Nhiễu Gaussian phòng đọc yên tĩnh ---
        float sim_noise = random_gaussian(41.8f, 1.2f);
        if (sim_noise < 30.0f) sim_noise = 30.0f;
        if (sim_noise > 110.0f) sim_noise = 110.0f;

        data->laeq_db     = sim_noise;
        data->laeq_bg_db  = 40.2f;
        data->spl_peak_db = sim_noise + random_range(2.0f, 4.5f);
    }

    // Nếu vượt ngưỡng 55 dBA -> Kích hoạt còi loa 1W nhắc nhở
    if (data->laeq_db > NOISE_LIMIT_WARN_DB) {
        data->librarian_spk = 1;
        audio_i2s_play_alert_tone();
    } else {
        data->librarian_spk = 0;
    }
}

void audio_i2s_mock_process(sensor_data_t *data) {
    const node_runtime_cfg_t *cfg = ota_remote_cfg_get();
    bool is_mock = (cfg != NULL) ? (cfg->use_mock_mode != 0) : false;
    audio_i2s_process(data, is_mock);
}
