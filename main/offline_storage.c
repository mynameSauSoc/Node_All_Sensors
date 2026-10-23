#include "offline_storage.h"
#include "esp_spiffs.h"
#include "esp_log.h"
#include "esp_timer.h"
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

/**
 * @file offline_storage.c
 * @brief Thực thi cơ chế Lưu trữ Offline (Circular Binary Log) trên phân vùng Flash 1MB (SPIFFS)
 *        và xả bù dữ liệu (Store-and-Forward) khi có mạng Wi-Fi / Điện lưới trở lại.
 */

static const char *TAG = "OFFLINE_STORAGE";
static const char *OFFLINE_FILE_PATH = "/spiffs/offline_queue.bin";

static bool     s_spiffs_mounted = false;
static uint32_t s_cached_count   = 0;     // Số bản ghi 64-byte đang lưu trong Flash
static uint32_t s_read_offset    = 0;     // Vị trí con trỏ đọc để xả bù (FIFO)

// Khởi tạo hệ thống file SPIFFS trên phân vùng "storage" (1 MB trong partitions.csv)
void offline_storage_init(void) {
    esp_vfs_spiffs_conf_t conf = {
        .base_path = "/spiffs",
        .partition_label = "storage",
        .max_files = 3,
        .format_if_mount_failed = true
    };

    esp_err_t ret = esp_vfs_spiffs_register(&conf);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "Khong the mount SPIFFS (ma loi: %s) -> Su dung dem RAM tam thoi", esp_err_to_name(ret));
        s_spiffs_mounted = false;
        return;
    }

    s_spiffs_mounted = true;
    size_t total = 0, used = 0;
    esp_spiffs_info(conf.partition_label, &total, &used);
    ESP_LOGI(TAG, "Da khoi tao Bo nho Flash Offline (SPIFFS): Tong = %u bytes (~1MB), Da dung = %u bytes",
             (unsigned int)total, (unsigned int)used);

    // Kiểm tra xem có file dữ liệu tồn đọng từ lần mất điện trước không
    struct stat st;
    if (stat(OFFLINE_FILE_PATH, &st) == 0 && st.st_size >= sizeof(offline_record_64b_t)) {
        s_cached_count = st.st_size / sizeof(offline_record_64b_t);
        ESP_LOGW(TAG, "Phat hien %u ban ghi (64-byte) ton dong tu lan mat dien/mat mang truoc!",
                 (unsigned int)s_cached_count);
    }
}

// Chuyển đổi gói dữ liệu đầy đủ sang bản ghi nhị phân siêu gọn 64-byte và ghi xuống Flash
bool offline_storage_save(const sensor_data_t *data) {
    if (!s_spiffs_mounted) {
        s_cached_count++;
        return false;
    }

    // Nếu vượt quá giới hạn tối đa (~14,680 bản ghi trên 1MB), xoay vòng file để bảo vệ bộ nhớ
    if (s_cached_count >= OFFLINE_STORAGE_MAX_RECORDS) {
        ESP_LOGW(TAG, "Bo nho Flash 1MB da day (%u ban ghi) -> Xoay vong FIFO de ghi de du lieu moi nhat",
                 (unsigned int)s_cached_count);
        unlink(OFFLINE_FILE_PATH);
        s_cached_count = 0;
        s_read_offset  = 0;
    }

    offline_record_64b_t rec;
    memset(&rec, 0, sizeof(rec));
    rec.timestamp      = (uint32_t)(esp_timer_get_time() / 1000000ULL);
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
        ESP_LOGE(TAG, "Loi mo file Flash de luu du lieu Offline!");
        return false;
    }

    fwrite(&rec, sizeof(offline_record_64b_t), 1, f);
    fclose(f);
    s_cached_count++;

    ESP_LOGW(TAG, "[MAT WI-FI / CHAY PIN UPS] Da luu ban ghi 64-byte vao Flash 1MB (Tong ton dong: %u goi)",
             (unsigned int)s_cached_count);
    return true;
}

uint32_t offline_storage_get_count(void) {
    return s_cached_count;
}

// Xả bù (Store-and-Forward) tối đa 5 bản ghi mỗi chu kỳ khi mạng Wi-Fi/MQTT hoạt động trở lại
void offline_storage_flush_batch(esp_mqtt_client_handle_t mqtt_client) {
    if (s_cached_count == 0 || mqtt_client == NULL) {
        return;
    }

    if (!s_spiffs_mounted) {
        s_cached_count = 0;
        return;
    }

    FILE *f = fopen(OFFLINE_FILE_PATH, "rb");
    if (f == NULL) {
        s_cached_count = 0;
        s_read_offset  = 0;
        return;
    }

    fseek(f, s_read_offset * sizeof(offline_record_64b_t), SEEK_SET);

    offline_record_64b_t rec;
    char replay_payload[512];
    int sent_in_batch = 0;

    while (sent_in_batch < OFFLINE_REPLAY_BATCH_SIZE &&
           fread(&rec, sizeof(offline_record_64b_t), 1, f) == 1) {

        snprintf(replay_payload, sizeof(replay_payload),
                 "{\"node\":\"Node_All_Sensors\",\"laeq\":%.1f,\"laeq_bg\":%.1f,\"spl\":%.1f,"
                 "\"librarian_spk\":%u,\"co2\":%u,\"temp\":%.1f,\"rh\":%.1f,\"lux\":%.1f,"
                 "\"pm25\":%.1f,\"so2\":%.1f,\"no2\":%.1f,\"voc\":%.1f,"
                 "\"power_mode\":%u,\"battery_pct\":%u,\"offline_cached\":%u,"
                 "\"telegram_alert\":%u,\"status\":\"%s\","
                 "\"alert_msg\":\"[DONG BO BU TU FLASH] Goi du lieu luu luc mat mang (t=%us)\"}",
                 rec.laeq_db, rec.laeq_bg_db, rec.spl_peak_db,
                 rec.librarian_spk, rec.co2_ppm, rec.temp, rec.rh, rec.lux,
                 rec.pm25, rec.so2_ppb, rec.no2_ppb, rec.voc_ppb,
                 rec.power_mode, rec.battery_pct, (unsigned int)(s_cached_count - 1),
                 rec.telegram_alert, rec.status, (unsigned int)rec.timestamp);

        esp_mqtt_client_publish(mqtt_client, MQTT_TOPIC_TELEMETRY, replay_payload, 0, 1, 0);
        s_read_offset++;
        if (s_cached_count > 0) s_cached_count--;
        sent_in_batch++;
    }

    fclose(f);

    ESP_LOGI(TAG, "[DONG BO FLASH -> MQTT] Da xa bu %d ban ghi cu len Server (Con lai: %u ban ghi)",
             sent_in_batch, (unsigned int)s_cached_count);

    // Nếu đã xả hết toàn bộ các bản ghi tồn đọng thì xóa file để giải phóng 100% dung lượng Flash
    if (s_cached_count == 0) {
        unlink(OFFLINE_FILE_PATH);
        s_read_offset = 0;
        ESP_LOGI(TAG, "Da dong bo sach 100%% du lieu Offline trong Flash 1MB!");
    }
}
