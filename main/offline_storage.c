#include "offline_storage.h"
#include "esp_spiffs.h"
#include "esp_log.h"
#include "esp_timer.h"
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/time.h>
#include <unistd.h>

/**
 * @file offline_storage.c
 * @brief Lưu trữ nhị phân 64-byte trên phân vùng SPIFFS 1MB và xả bù (Replay) lên MQTT.
 */

static const char *TAG = "OFFLINE_STORAGE";
static const char *OFFLINE_FILE_PATH = "/spiffs/offline_queue.bin";

static bool     s_spiffs_mounted = false;
static uint32_t s_cached_count   = 0;
static uint32_t s_read_offset    = 0;

void offline_storage_init(void) {
    esp_vfs_spiffs_conf_t conf = {
        .base_path = "/spiffs",
        .partition_label = "storage",
        .max_files = 3,
        .format_if_mount_failed = true
    };

    esp_err_t ret = esp_vfs_spiffs_register(&conf);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "Khong the mount SPIFFS (%s) -> Dung dem RAM", esp_err_to_name(ret));
        s_spiffs_mounted = false;
        return;
    }

    s_spiffs_mounted = true;
    size_t total = 0, used = 0;
    esp_spiffs_info(conf.partition_label, &total, &used);
    ESP_LOGI(TAG, "Bo nho Flash Offline SPIFFS 1MB: Tong = %u bytes, Da dung = %u bytes",
             (unsigned int)total, (unsigned int)used);

    struct stat st;
    if (stat(OFFLINE_FILE_PATH, &st) == 0 && st.st_size >= sizeof(offline_record_64b_t)) {
        s_cached_count = st.st_size / sizeof(offline_record_64b_t);
        ESP_LOGW(TAG, "Phat hien %u ban ghi ton dong trong Flash SPIFFS tu truoc!", (unsigned int)s_cached_count);
    }
}

bool offline_storage_save(const sensor_data_t *data) {
    if (!s_spiffs_mounted || !data) {
        s_cached_count++;
        return false;
    }

    // Nếu đạt giới hạn ~14,680 bản ghi, xoay vòng file
    if (s_cached_count >= OFFLINE_STORAGE_MAX_RECORDS) {
        ESP_LOGW(TAG, "Flash 1MB day -> Xoay vong FIFO de ghi ban ghi moi");
        unlink(OFFLINE_FILE_PATH);
        s_cached_count = 0;
        s_read_offset  = 0;
    }

    offline_record_64b_t rec;
    memset(&rec, 0, sizeof(rec));

    struct timeval tv;
    if (gettimeofday(&tv, NULL) == 0 && tv.tv_sec > 1577836800L) {
        rec.timestamp = (uint32_t)tv.tv_sec;
    } else {
        rec.timestamp = (uint32_t)(esp_timer_get_time() / 1000000ULL);
    }

    rec.laeq_db        = data->laeq_db;
    rec.laeq_bg_db     = data->laeq_bg_db;
    rec.spl_peak_db    = data->spl_peak_db;
    rec.temp           = data->temp;
    rec.rh             = data->rh;
    rec.lux            = data->lux;
    rec.pm25           = data->pm25;
    rec.so2_ppb        = data->so2_ppb;
    rec.no2_ppb        = data->no2_ppb;
    rec.voc_ppb        = data->voc_ppb;
    rec.co2_ppm        = data->co2_ppm;
    rec.librarian_spk  = (uint8_t)data->librarian_spk;
    rec.telegram_alert = (uint8_t)data->telegram_alert;
    rec.power_mode     = (uint8_t)data->power_mode;
    rec.battery_pct    = (uint8_t)data->battery_pct;
    memcpy(rec.status, data->status, sizeof(rec.status) - 1);
    rec.status[sizeof(rec.status) - 1] = '\0';

    FILE *f = fopen(OFFLINE_FILE_PATH, "ab");
    if (f == NULL) {
        ESP_LOGE(TAG, "Loi mo file Flash de luu Offline!");
        return false;
    }

    fwrite(&rec, sizeof(offline_record_64b_t), 1, f);
    fclose(f);
    s_cached_count++;

    ESP_LOGW(TAG, "💾 [MAT MANG / PIN UPS] Da luu ban ghi 64-byte vao Flash SPIFFS (Tong ton dong: %u goi)",
             (unsigned int)s_cached_count);
    return true;
}

uint32_t offline_storage_get_count(void) {
    return s_cached_count;
}

void offline_storage_flush_batch(esp_mqtt_client_handle_t mqtt_client, const char *hardware_id) {
    if (s_cached_count == 0 || mqtt_client == NULL) {
        return;
    }

    if (!s_spiffs_mounted) {
        s_cached_count = 0;
        return;
    }

    const char *hw_id = (hardware_id != NULL && strlen(hardware_id) > 0) ? hardware_id : DEFAULT_HARDWARE_ID;

    FILE *f = fopen(OFFLINE_FILE_PATH, "rb");
    if (f == NULL) {
        s_cached_count = 0;
        s_read_offset  = 0;
        return;
    }

    fseek(f, s_read_offset * sizeof(offline_record_64b_t), SEEK_SET);

    offline_record_64b_t rec;
    char replay_payload[768];
    char topic[128];
    snprintf(topic, sizeof(topic), MQTT_TOPIC_TELEMETRY_FMT, hw_id);

    int sent_in_batch = 0;

    while (sent_in_batch < OFFLINE_REPLAY_BATCH_SIZE &&
           fread(&rec, sizeof(offline_record_64b_t), 1, f) == 1) {

        // Timestamp: Nếu hợp lệ (> 2020), đổi sang milliseconds
        int64_t ts_ms = (rec.timestamp > 1577836800L) ? ((int64_t)rec.timestamp * 1000LL) : 0;

        float pm25 = rec.pm25;
        float pm1_0 = pm25 * 0.55f;
        float pm4_0 = pm25 * 1.15f;
        float pm10  = pm25 * 1.35f;

        // Kẹp chuẩn Sanitizer
        float noise_avg = (rec.laeq_db >= 30.0f) ? rec.laeq_db : 30.0f;
        float noise_peak = (rec.spl_peak_db >= 30.0f) ? rec.spl_peak_db : 30.0f;

        if (ts_ms > 0) {
            snprintf(replay_payload, sizeof(replay_payload),
                     "{\"hardware_id\":\"%s\",\"is_replay\":true,\"timestamp\":%lld,\"wifi_rssi\":-60,"
                     "\"data\":{"
                     "\"acoustics\":{\"noise_avg\":%.1f,\"noise_peak\":%.1f},"
                     "\"air_quality\":{\"pm1_0\":%.1f,\"pm2_5\":%.1f,\"pm4_0\":%.1f,\"pm10\":%.1f},"
                     "\"environment\":{\"temperature\":%.1f,\"humidity\":%.1f,\"lux\":%.1f,\"co2\":%u}"
                     "},"
                     "\"ups\":{\"power_mode\":%u,\"battery_pct\":%u},"
                     "\"comfort_score\":{\"status\":\"%s\"}}",
                     hw_id, (long long)ts_ms,
                     noise_avg, noise_peak,
                     pm1_0, pm25, pm4_0, pm10,
                     rec.temp, rec.rh, rec.lux, (unsigned int)rec.co2_ppm,
                     (unsigned int)rec.power_mode, (unsigned int)rec.battery_pct,
                     rec.status);
        } else {
            snprintf(replay_payload, sizeof(replay_payload),
                     "{\"hardware_id\":\"%s\",\"is_replay\":true,\"wifi_rssi\":-60,"
                     "\"data\":{"
                     "\"acoustics\":{\"noise_avg\":%.1f,\"noise_peak\":%.1f},"
                     "\"air_quality\":{\"pm1_0\":%.1f,\"pm2_5\":%.1f,\"pm4_0\":%.1f,\"pm10\":%.1f},"
                     "\"environment\":{\"temperature\":%.1f,\"humidity\":%.1f,\"lux\":%.1f,\"co2\":%u}"
                     "},"
                     "\"ups\":{\"power_mode\":%u,\"battery_pct\":%u},"
                     "\"comfort_score\":{\"status\":\"%s\"}}",
                     hw_id,
                     noise_avg, noise_peak,
                     pm1_0, pm25, pm4_0, pm10,
                     rec.temp, rec.rh, rec.lux, (unsigned int)rec.co2_ppm,
                     (unsigned int)rec.power_mode, (unsigned int)rec.battery_pct,
                     rec.status);
        }

        esp_mqtt_client_publish(mqtt_client, topic, replay_payload, 0, 1, 0);
        s_read_offset++;
        if (s_cached_count > 0) s_cached_count--;
        sent_in_batch++;
    }

    fclose(f);

    ESP_LOGI(TAG, "📤 [REPLAY FLASH -> MQTT] Da xa bu %d ban ghi cu len Server (Con lai: %u ban ghi)",
             sent_in_batch, (unsigned int)s_cached_count);

    if (s_cached_count == 0) {
        unlink(OFFLINE_FILE_PATH);
        s_read_offset = 0;
        ESP_LOGI(TAG, "Da dong bo xong 100%% du lieu Offline tu Flash SPIFFS len Mosquitto Broker!");
    }
}
