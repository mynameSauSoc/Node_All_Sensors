#include <stdio.h>
#include <string.h>
#include <sys/time.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_sntp.h"
#include "mqtt_client.h"

#include "app_config.h"
#include "led_alert.h"
#include "audio_i2s.h"
#include "drv_i2c_sensors.h"
#include "drv_adc_sensors.h"
#include "mock_sensor.h"
#include "offline_storage.h"
#include "ota_remote_cfg.h"

/**
 * @file main.c
 * @brief Chương trình chính Trạm Cảm biến Node 1 (Node All Sensors) - Thư viện Tạ Quang Bửu:
 *
 * PHẦN CỨNG (Altium Designer 26 - 0 lỗi DRC):
 * - GPIO 1  : G_LED (Xanh lá - An toàn, Active HIGH)
 * - GPIO 2  : B_LED (Xanh dương - Nhắc nhở, Active HIGH)
 * - GPIO 42 : R_LED (Đỏ - Báo động, Active HIGH)
 * - GPIO 8  : Shared I2C SDA (R5 = 4.7 kΩ pull-up)
 * - GPIO 9  : Shared I2C SCL (R6 = 4.7 kΩ pull-up)
 *   -> 4 ngoại vi: OLED SH1106/SSD1306 (0x3C), SHT30 (0x44), BH1750 (0x23), SCD40 (0x62)
 * - GPIO 4, 5, 6  : Micro MEMS INMP441 (SCK=4, WS=5, SD=6, 24-bit DMA dBA)
 * - GPIO 15, 16, 7: Amply MAX98357A (BCLK=15, LRC=16, DIN=7, Loa 1W)
 * - GPIO 10 : Xung kích DUST_PULSE điều khiển BJT SS8050 NPN bật LED Sharp
 * - GPIO 3  : DUST_ADC (ADC1_CH2) qua cầu phân áp 10k:20k (Nhân ngược hệ số 1.5)
 * - CẤM DÙNG: GPIO 35, 36, 37 (Octal PSRAM) và chân 3V3 của kit (dùng LDO U1 riêng).
 *
 * HẠ TẦNG KẾT NỐI (SSOT TAI_LIEU_CHUAN_HOA_KET_NOI_FIRMWARE_SERVER.md):
 * - Mosquitto 2.0 MQTT Broker (Port 1883)
 * - Spring Boot 3 + Java 21 Virtual Threads (Port 8080)
 * - MongoDB 8.0 Native TimeSeries Collections + Mongo Express (Port 8081)
 * - React 18 + Vite Web Dashboard (Port 5173)
 */

static const char *TAG = "APP_MAIN";
static QueueHandle_t s_sensor_queue = NULL;
static esp_mqtt_client_handle_t s_mqtt_client = NULL;
static bool s_is_connected = false;
static uint32_t s_boot_timestamp = 0;

static int64_t get_epoch_millis(void) {
    struct timeval tv;
    if (gettimeofday(&tv, NULL) == 0 && tv.tv_sec > 1577836800L) { // Sau 2020-01-01
        return (int64_t)tv.tv_sec * 1000LL + (tv.tv_usec / 1000LL);
    }
    return 0; // Chưa đồng bộ NTP -> Server sẽ tự gắn mốc giờ
}

static void send_online_status(esp_mqtt_client_handle_t client, const char *hardware_id, const char *reason) {
    if (!client) return;

    char status_topic[128];
    snprintf(status_topic, sizeof(status_topic), MQTT_TOPIC_STATUS_FMT, hardware_id);

    char status_payload[256];
    int64_t ts = get_epoch_millis();
    uint32_t uptime_sec = (uint32_t)(esp_timer_get_time() / 1000000ULL);

    if (ts > 0) {
        snprintf(status_payload, sizeof(status_payload),
                 "{\"hardware_id\":\"%s\",\"status\":\"online\",\"reason\":\"%s\","
                 "\"firmware_version\":\"%s\",\"uptime_seconds\":%u,\"timestamp\":%lld}",
                 hardware_id, reason, FIRMWARE_VERSION, (unsigned int)uptime_sec, (long long)ts);
    } else {
        snprintf(status_payload, sizeof(status_payload),
                 "{\"hardware_id\":\"%s\",\"status\":\"online\",\"reason\":\"%s\","
                 "\"firmware_version\":\"%s\",\"uptime_seconds\":%u}",
                 hardware_id, reason, FIRMWARE_VERSION, (unsigned int)uptime_sec);
    }

    ESP_LOGI(TAG, "Gửi Bản tin Online Status tới [%s]: %s", status_topic, status_payload);
    esp_mqtt_client_publish(client, status_topic, status_payload, 0, 1, 0);
}

// =============================================================================
// TIẾN TRÌNH THU THẬP CẢM BIẾN (SENSOR TASK)
// =============================================================================
void sensor_task(void *pvParameters) {
    sensor_data_t data;
    uint32_t tick_sec = 0;
    uint32_t last_publish_sec = 0;

    mock_sensor_init(&data);

    while (1) {
        tick_sec++;

        bool urgent_alert = mock_sensor_update_multirate(&data, tick_sec);
        uint32_t publish_period = (data.power_mode == 1) ? PUBLISH_PERIOD_AC_SEC : PUBLISH_PERIOD_UPS_SEC;

        // Cập nhật RSSI Wi-Fi
        wifi_ap_record_t ap_info;
        if (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK) {
            data.wifi_rssi = ap_info.rssi;
        }

        if (urgent_alert || (tick_sec - last_publish_sec >= publish_period)) {
            last_publish_sec = tick_sec;

            if (urgent_alert) {
                ESP_LOGW(TAG, "⚡ [SỰ KIỆN KHẨN CẤP] Vượt ngưỡng an toàn -> Phát gói tin tức thời (<100ms)!");
            }

            if (s_sensor_queue != NULL) {
                xQueueSend(s_sensor_queue, &data, pdMS_TO_TICKS(100));
            }
        }

        vTaskDelay(pdMS_TO_TICKS(AUDIO_FAST_LOOP_MS));
    }
}

// =============================================================================
// TIẾN TRÌNH ĐÓNG GÓI & TRUYỀN TIN MQTT TELEMETRY (PUBLISHER TASK)
// =============================================================================
void publisher_task(void *pvParameters) {
    sensor_data_t rx_data;
    char payload[768];
    char topic_telemetry[128];

    while (1) {
        if (xQueueReceive(s_sensor_queue, &rx_data, portMAX_DELAY) == pdTRUE) {
            const node_runtime_cfg_t *cfg = ota_remote_cfg_get();
            const char *hw_id = (cfg != NULL && strlen(cfg->node_id) > 0) ? cfg->node_id : DEFAULT_HARDWARE_ID;
            snprintf(topic_telemetry, sizeof(topic_telemetry), MQTT_TOPIC_TELEMETRY_FMT, hw_id);

            if (s_is_connected && s_mqtt_client != NULL) {
                int64_t ts_ms = get_epoch_millis();

                // Kẹp ngưỡng âm học: Server cấm 0, tối thiểu 30.0 dBA
                float noise_avg = (rx_data.laeq_db >= 30.0f) ? rx_data.laeq_db : 30.0f;
                float noise_peak = (rx_data.spl_peak_db >= 30.0f) ? rx_data.spl_peak_db : 30.0f;

                // Đóng gói JSON theo chuẩn SSOT TAI_LIEU_CHUAN_HOA_KET_NOI_FIRMWARE_SERVER.md
                if (ts_ms > 0) {
                    snprintf(payload, sizeof(payload),
                             "{\"hardware_id\":\"%s\",\"timestamp\":%lld,\"wifi_rssi\":%d,"
                             "\"data\":{"
                             "\"acoustics\":{\"noise_avg\":%.1f,\"noise_peak\":%.1f},"
                             "\"air_quality\":{\"pm1_0\":%.1f,\"pm2_5\":%.1f,\"pm4_0\":%.1f,\"pm10\":%.1f},"
                             "\"environment\":{\"temperature\":%.1f,\"humidity\":%.1f,\"lux\":%.1f,\"co2\":%u}"
                             "},"
                             "\"ups\":{\"power_mode\":%d,\"battery_pct\":%d},"
                             "\"comfort_score\":{\"lcs\":%.1f,\"rank\":\"%s\",\"status\":\"%s\"}}",
                             hw_id, (long long)ts_ms, rx_data.wifi_rssi,
                             noise_avg, noise_peak,
                             rx_data.pm1_0, rx_data.pm25, rx_data.pm4_0, rx_data.pm10,
                             rx_data.temp, rx_data.rh, rx_data.lux, (unsigned int)rx_data.co2_ppm,
                             rx_data.power_mode, rx_data.battery_pct,
                             rx_data.lcs_score, rx_data.lcs_rank, rx_data.status);
                } else {
                    snprintf(payload, sizeof(payload),
                             "{\"hardware_id\":\"%s\",\"wifi_rssi\":%d,"
                             "\"data\":{"
                             "\"acoustics\":{\"noise_avg\":%.1f,\"noise_peak\":%.1f},"
                             "\"air_quality\":{\"pm1_0\":%.1f,\"pm2_5\":%.1f,\"pm4_0\":%.1f,\"pm10\":%.1f},"
                             "\"environment\":{\"temperature\":%.1f,\"humidity\":%.1f,\"lux\":%.1f,\"co2\":%u}"
                             "},"
                             "\"ups\":{\"power_mode\":%d,\"battery_pct\":%d},"
                             "\"comfort_score\":{\"lcs\":%.1f,\"rank\":\"%s\",\"status\":\"%s\"}}",
                             hw_id, rx_data.wifi_rssi,
                             noise_avg, noise_peak,
                             rx_data.pm1_0, rx_data.pm25, rx_data.pm4_0, rx_data.pm10,
                             rx_data.temp, rx_data.rh, rx_data.lux, (unsigned int)rx_data.co2_ppm,
                             rx_data.power_mode, rx_data.battery_pct,
                             rx_data.lcs_score, rx_data.lcs_rank, rx_data.status);
                }

                ESP_LOGI(TAG, "MQTT Telemetry Publish -> [%s]: %s", topic_telemetry, payload);
                esp_mqtt_client_publish(s_mqtt_client, topic_telemetry, payload, 0, 1, 0);

                // Nếu có bản ghi cũ tồn đọng trong SPIFFS Flash -> Xả bù mẻ nhỏ lên Mosquitto
                if (offline_storage_get_count() > 0) {
                    offline_storage_flush_batch(s_mqtt_client, hw_id);
                }
            } else {
                // Mất kết nối Wi-Fi hoặc Broker -> Lưu vào phân vùng Flash SPIFFS 1MB
                offline_storage_save(&rx_data);
            }
        }
    }
}

// =============================================================================
// TRÌNH XỬ LÝ SỰ KIỆN MQTT
// =============================================================================
static void mqtt_handler(void *args, esp_event_base_t base, int32_t id, void *event_data) {
    esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;
    const node_runtime_cfg_t *cfg = ota_remote_cfg_get();
    const char *hw_id = (cfg != NULL && strlen(cfg->node_id) > 0) ? cfg->node_id : DEFAULT_HARDWARE_ID;

    if (id == MQTT_EVENT_CONNECTED) {
        ESP_LOGI(TAG, "Da ket noi toi Eclipse Mosquitto 2.0 Broker!");
        s_is_connected = true;

        // Gửi thông điệp Online Status
        send_online_status(s_mqtt_client, hw_id, (s_boot_timestamp == 0) ? "power_on" : "reconnected");
        s_boot_timestamp = 1;

        // Đăng ký lắng nghe Topic lệnh điều khiển từ xa
        char cmd_topic[128];
        snprintf(cmd_topic, sizeof(cmd_topic), MQTT_TOPIC_COMMAND_FMT, hw_id);
        esp_mqtt_client_subscribe(s_mqtt_client, cmd_topic, 1);
        ESP_LOGI(TAG, "Da lang nghe topic lenh: %s", cmd_topic);

    } else if (id == MQTT_EVENT_DISCONNECTED) {
        ESP_LOGW(TAG, "Mat ket noi Mosquitto Broker -> Chuyen sang che do luu Flash SPIFFS 1MB!");
        s_is_connected = false;

    } else if (id == MQTT_EVENT_DATA) {
        if (event->data != NULL && event->data_len > 0) {
            ESP_LOGI(TAG, "Nhan lenh MQTT tu xa (len=%d): %.*s", event->data_len, event->data_len, event->data);
            ota_remote_cfg_handle_mqtt_cmd(event->data, event->data_len);
        }
    }
}

// =============================================================================
// TRÌNH XỬ LÝ SỰ KIỆN WI-FI & IP
// =============================================================================
static int s_retry_num = 0;

static void wifi_handler(void* arg, esp_event_base_t base, int32_t id, void* data) {
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_AP_START) {
        ESP_LOGI(TAG, "Diem truy cap AP 'TQB_NODE_SETUP' san sang tai http://192.168.4.1");
        ota_remote_start_ap_web_portal();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        s_is_connected = false;
        if (s_retry_num < 5) {
            s_retry_num++;
            ESP_LOGW(TAG, "Wi-Fi dang thu ket noi lai (lan %d/5)...", s_retry_num);
            esp_wifi_connect();
        } else {
            ESP_LOGW(TAG, "Tam dung thu ket noi Wi-Fi -> Node tiep tuc do cam bien & duy tri AP cai dat!");
        }
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        s_retry_num = 0;
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) data;
        ESP_LOGI(TAG, "Ket noi Wi-Fi thanh cong! IP: " IPSTR, IP2STR(&event->ip_info.ip));

        // Khởi động đồng bộ thời gian SNTP
        sntp_setoperatingmode(SNTP_OPMODE_POLL);
        sntp_setservername(0, "pool.ntp.org");
        sntp_setservername(1, "time.google.com");
        sntp_init();

        if (s_mqtt_client != NULL) {
            esp_mqtt_client_start(s_mqtt_client);
        }
    }
}

// =============================================================================
// HÀM KHỞI CHẠY CHÍNH (APP_MAIN)
// =============================================================================
void app_main(void) {
    esp_reset_reason_t rst_reason = esp_reset_reason();
    ESP_LOGI(TAG, "=====================================================");
    ESP_LOGI(TAG, "  AIoT SMARTLIB TQB - NODE 1 (NODE ALL SENSORS)");
    ESP_LOGI(TAG, "  ESP32-S3 BOOT - MA RESET: %d | FIRMWARE: %s", (int)rst_reason, FIRMWARE_VERSION);
    ESP_LOGI(TAG, "=====================================================");

    // 1. Khởi tạo NVS Flash
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // 2. Khởi tạo toàn bộ Drivers phần cứng theo Sơ đồ PCB Altium Designer 26
    led_alert_init();            // GPIO 1 (Green), GPIO 2 (Blue), GPIO 42 (Red)
    drv_i2c_bus_init();          // GPIO 8 (SDA), GPIO 9 (SCL)
    drv_i2c_scan_bus();          // Quét và in toàn bộ ngoại vi I2C đang cắm
    drv_adc_sensors_init();      // GPIO 10 (Pulse via SS8050 NPN), GPIO 3 (ADC1_CH2 x1.5)
    audio_i2s_init();            // I2S0 (INMP441: 4,5,6), I2S1 (MAX98357A: 15,16,7)
    audio_i2s_play_alert_tone(); // Kêu 1 tiếng bíp kiểm tra loa 1W
    offline_storage_init();      // Phân vùng SPIFFS Flash 1MB

    // 3. Khởi tạo cấu hình NVS & Nhận diện thiết bị cắm-và-chạy (Plug-and-Play)
    ota_remote_cfg_init();
    const node_runtime_cfg_t *cfg = ota_remote_cfg_get();

    ESP_LOGI(TAG, "Che do van hanh: %s | Vai tro: %u | Hardware ID: %s",
             (cfg->use_mock_mode ? "MO PHONG GAUSSIAN (ADMIN TEST)" : "PHAN CUNG THAT (PCB ALTIUM 100%)"),
             cfg->node_role, cfg->node_id);

    // 4. Tạo Queue luân chuyển dữ liệu FreeRTOS
    s_sensor_queue = xQueueCreate(20, sizeof(sensor_data_t));

    // 5. Chuẩn bị thông tin Di chúc LWT cho MQTT
    char lwt_topic[128];
    char lwt_msg[128];
    snprintf(lwt_topic, sizeof(lwt_topic), MQTT_TOPIC_STATUS_FMT, cfg->node_id);
    snprintf(lwt_msg, sizeof(lwt_msg),
             "{\"hardware_id\":\"%s\",\"status\":\"offline\",\"reason\":\"lwt\"}", cfg->node_id);

    char client_id[64];
    snprintf(client_id, sizeof(client_id), "node_%s", cfg->node_id);

    esp_mqtt_client_config_t mqtt_cfg = {
        .uri          = cfg->mqtt_uri,
        .username     = cfg->mqtt_user,
        .password     = cfg->mqtt_pass,
        .client_id    = client_id,
        .keepalive    = 30,
        .lwt_topic    = lwt_topic,
        .lwt_msg      = lwt_msg,
        .lwt_msg_len  = strlen(lwt_msg),
        .lwt_qos      = 1,
        .lwt_retain   = 0,
        .buffer_size  = 1024,
    };
    s_mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(s_mqtt_client, ESP_EVENT_ANY_ID, mqtt_handler, NULL);

    // 6. Khởi tạo Tasks FreeRTOS
    xTaskCreate(sensor_task, "sensor_task", 4096, NULL, 5, NULL);
    xTaskCreate(publisher_task, "publisher_task", 6144, NULL, 5, NULL);

    // 7. Khởi tạo Wi-Fi chế độ Kép (STA + AP Setup Portal)
    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_sta();
    esp_netif_create_default_wifi_ap();

    wifi_init_config_t wifi_init_cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&wifi_init_cfg);

    esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_handler, NULL);
    esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_handler, NULL);

    wifi_config_t wifi_cfg = {0};
    memcpy(wifi_cfg.sta.ssid, cfg->wifi_ssid, sizeof(wifi_cfg.sta.ssid) - 1);
    wifi_cfg.sta.ssid[sizeof(wifi_cfg.sta.ssid) - 1] = '\0';
    memcpy(wifi_cfg.sta.password, cfg->wifi_pass, sizeof(wifi_cfg.sta.password) - 1);
    wifi_cfg.sta.password[sizeof(wifi_cfg.sta.password) - 1] = '\0';

    wifi_config_t ap_cfg = {
        .ap = {
            .ssid = "TQB_NODE_SETUP",
            .ssid_len = strlen("TQB_NODE_SETUP"),
            .channel = 1,
            .password = "",
            .max_connection = 4,
            .authmode = WIFI_AUTH_OPEN
        },
    };

    esp_wifi_set_mode(WIFI_MODE_APSTA);
    esp_wifi_set_config(WIFI_IF_STA, &wifi_cfg);
    esp_wifi_set_config(WIFI_IF_AP, &ap_cfg);
    esp_wifi_start();

    ESP_LOGI(TAG, "He thong Node 1 da san sang van hanh!");
}
