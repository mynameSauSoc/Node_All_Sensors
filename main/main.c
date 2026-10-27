#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_wifi.h"
#include "esp_event.h"
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
 * @brief Chương trình chính của Node_All_Sensors (ESP32-S3):
 *        - Khởi tạo toàn bộ các Driver phần cứng:
 *          1. 3 Đèn LED đơn sắc rời (GPIO 1, GPIO 2, GPIO 42).
 *          2. Bus I2C (BH1750 0x23, SHT30 0x44, SCD40 0x62, Màn hình OLED SSD1306 0x3C).
 *          3. Bus I2S DMA (Micro INMP441 + Mạch giải mã MAX98357A + Loa 1W).
 *          4. Cụm ADC1 & Xung 280us (Bụi mịn Sharp GP2Y10, Khí độc SO2/NO2/VOCs, Pin dự phòng UPS).
 *          5. Bộ nhớ Offline Flash 1MB SPIFFS (Store-and-Forward khi mất điện / đứt Wi-Fi).
 *          6. Module Quản lý Từ xa qua Wi-Fi (`ota_remote_cfg`):
 *             + Nạp code mới qua Wi-Fi (OTA HTTP Firmware Update) không cần tháo gỡ mạch.
 *             + Đổi vai trò Node (Node 1 Bàn / Node 2 Cột / Node 3 Kệ sách), bật/tắt từng sensor
 *               và đổi mạng Wi-Fi từ xa qua lệnh MQTT, lưu vĩnh viễn vào Flash NVS.
 */

static const char *TAG = "APP_MAIN";
static QueueHandle_t s_sensor_queue = NULL;
static esp_mqtt_client_handle_t s_mqtt_client = NULL;
static bool s_is_connected = false;

void sensor_task(void *pvParameters) {
    sensor_data_t data;
    uint32_t tick_sec = 0;
    uint32_t last_publish_sec = 0;

    mock_sensor_init(&data);

    while (1) {
        tick_sec++;

        bool urgent_alert = mock_sensor_update_multirate(&data, tick_sec);
        uint32_t publish_period = (data.power_mode == 1) ? PUBLISH_PERIOD_AC_SEC : PUBLISH_PERIOD_UPS_SEC;

        if (urgent_alert || (tick_sec - last_publish_sec >= publish_period)) {
            last_publish_sec = tick_sec;

            if (urgent_alert) {
                ESP_LOGW(TAG, "⚡ [NGAT SU KIEN KHAN CAP] Phat hien vuot nguong -> Day goi tin ban MQTT tuc thoi (<100ms)!");
            }

            if (s_sensor_queue != NULL) {
                xQueueSend(s_sensor_queue, &data, pdMS_TO_TICKS(100));
            }
        }

        vTaskDelay(pdMS_TO_TICKS(AUDIO_FAST_LOOP_MS));
    }
}

void publisher_task(void *pvParameters) {
    sensor_data_t rx_data;
    char payload[768];

    while (1) {
        if (xQueueReceive(s_sensor_queue, &rx_data, portMAX_DELAY) == pdTRUE) {
            if (s_is_connected && s_mqtt_client != NULL) {
                const node_runtime_cfg_t *cfg = ota_remote_cfg_get();
                rx_data.offline_cached = offline_storage_get_count();

                snprintf(payload, sizeof(payload),
                         "{\"room\":\"%s\",\"node\":\"%s\",\"role\":%u,\"mask\":%u,"
                         "\"laeq\":%.1f,\"laeq_bg\":%.1f,\"spl\":%.1f,"
                         "\"librarian_spk\":%d,\"co2\":%u,\"temp\":%.1f,\"rh\":%.1f,\"lux\":%.1f,"
                         "\"pm25\":%.1f,\"so2\":%.1f,\"no2\":%.1f,\"voc\":%.1f,"
                         "\"power_mode\":%d,\"battery_pct\":%d,\"offline_cached\":%u,"
                         "\"telegram_alert\":%d,\"status\":\"%s\",\"alert_msg\":\"%s\"}",
                         cfg->room_id, cfg->node_id, cfg->node_role, cfg->sensor_mask,
                         rx_data.laeq_db, rx_data.laeq_bg_db, rx_data.spl_peak_db,
                         rx_data.librarian_spk, rx_data.co2_ppm, rx_data.temp, rx_data.rh, rx_data.lux,
                         rx_data.pm25, rx_data.so2_ppb, rx_data.no2_ppb, rx_data.voc_ppb,
                         rx_data.power_mode, rx_data.battery_pct, (unsigned int)rx_data.offline_cached,
                         rx_data.telegram_alert, rx_data.status, rx_data.alert_msg);

                ESP_LOGI(TAG, "Gui MQTT JSON: %s", payload);

                // 1. Luồng Lạnh (Cold Path): Lưu InfluxDB & Vẽ biểu đồ Grafana
                esp_mqtt_client_publish(s_mqtt_client, MQTT_TOPIC_TELEMETRY, payload, 0, 1, 0);

                // 2. Luồng Nóng (Hot Path): Khi có cảnh báo vượt ngưỡng -> Bắn tức thời sang Topic Alert
                if (rx_data.telegram_alert == 1) {
                    esp_mqtt_client_publish(s_mqtt_client, MQTT_TOPIC_ALERT, payload, 0, 1, 0);
                }

                // 3. Xả bù dữ liệu lưu trong Flash 1MB (nếu trước đó bị mất mạng)
                if (offline_storage_get_count() > 0) {
                    offline_storage_flush_batch(s_mqtt_client);
                }
            } else {
                offline_storage_save(&rx_data);
            }
        }
    }
}

static void mqtt_handler(void *args, esp_event_base_t base, int32_t id, void *event_data) {
    esp_mqtt_event_handle_t event = (esp_mqtt_event_handle_t)event_data;
    if (id == MQTT_EVENT_CONNECTED) {
        ESP_LOGI(TAG, "Da ket noi toi MQTT Broker! Dang ky nhan lenh OTA & Config qua Wi-Fi tai: %s", MQTT_TOPIC_ADMIN_CMD);
        s_is_connected = true;
        // Đăng ký lắng nghe Topic nhận lệnh Nạp code OTA & Đổi cấu hình Plug-and-Play qua Wi-Fi
        esp_mqtt_client_subscribe(s_mqtt_client, MQTT_TOPIC_ADMIN_CMD, 1);
    } else if (id == MQTT_EVENT_DISCONNECTED) {
        ESP_LOGW(TAG, "Mat ket noi MQTT Broker -> Chuyen sang che do luu Offline vao Flash 1MB!");
        s_is_connected = false;
    } else if (id == MQTT_EVENT_DATA) {
        // Khi nhận được lệnh điều khiển từ xa (OTA update / Config sensor / Đổi Wi-Fi)
        if (event->data != NULL && event->data_len > 0) {
            ESP_LOGI(TAG, "📥 [LENH WI-FI TU XA] Nhan duoc goi tin dieu khien (%d bytes): %.*s",
                     event->data_len, event->data_len, event->data);
            ota_remote_cfg_handle_mqtt_cmd(event->data, event->data_len);
        }
    }
}

static int s_retry_num = 0;

static void wifi_handler(void* arg, esp_event_base_t base, int32_t id, void* data) {
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_AP_START) {
        ESP_LOGI(TAG, "Diem truy cap Wi-Fi AP da san sang! Khoi dong Web Portal cai dat...");
        ota_remote_start_ap_web_portal();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        s_is_connected = false;
        if (s_retry_num < 3) {
            s_retry_num++;
            ESP_LOGW(TAG, "Wi-Fi dang thu ket noi lai (lan %d/3)...", s_retry_num);
            esp_wifi_connect();
        } else {
            ESP_LOGW(TAG, "Tam dung thu Wi-Fi STA -> Node tiep tuc doc cam bien & duy tri AP TQB_NODE_SETUP!");
        }
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        s_retry_num = 0;
        ESP_LOGI(TAG, "Da ket noi Wi-Fi thanh cong!");
        if (s_mqtt_client != NULL) {
            esp_mqtt_client_start(s_mqtt_client);
        }
    }
}

void app_main(void) {
    esp_reset_reason_t rst_reason = esp_reset_reason();
    ESP_LOGI(TAG, "*****************************************************");
    ESP_LOGI(TAG, "  ESP32-S3 BOOT - MA LY DO RESET: %d", (int)rst_reason);
    ESP_LOGI(TAG, "*****************************************************");

    // 1. Khởi tạo NVS Flash (xử lý tự động nếu phân vùng NVS bị đầy)
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // 2. Khởi tạo toàn bộ hệ thống Driver phần cứng trên ESP32-S3
    led_alert_init();         // Driver 3 đèn LED đơn sắc riêng biệt (GPIO 1, 2, 42)
    drv_i2c_bus_init();       // Driver Bus I2C (BH1750, SHT30, SCD40, Màn hình OLED SSD1306)
    drv_i2c_scan_bus();       // Quét toàn bộ 127 địa chỉ I2C thực tế trên mạch testboard
    drv_adc_sensors_init();   // Driver ADC1 & Xung 280us (Bụi Sharp GP2Y10, SO2, NO2, VOCs, Pin UPS)
    audio_i2s_init();         // Driver Bus I2S DMA (Micro INMP441 + Mạch giải mã MAX98357A + Loa 1W)
    audio_i2s_play_alert_tone(); // Kêu 1 tiếng BÍP kiểm tra loa khi khởi động
    offline_storage_init();   // Driver Bộ nhớ Flash Offline 1MB SPIFFS

    // 3. Khởi tạo Module Quản lý Từ xa qua Wi-Fi (Đọc cấu hình NVS & Quét tự động I2C Plug-and-Play)
    ota_remote_cfg_init();
    const node_runtime_cfg_t *cfg = ota_remote_cfg_get();

    // 4. Tạo hàng đợi Queue trên RAM
    s_sensor_queue = xQueueCreate(20, sizeof(sensor_data_t));

    // 5. Khởi tạo MQTT Client theo URI lưu trong NVS Flash (Sẵn sàng trước khi Wi-Fi có IP)
    esp_mqtt_client_config_t mqtt_cfg = { .uri = cfg->mqtt_uri };
    s_mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(s_mqtt_client, ESP_EVENT_ANY_ID, mqtt_handler, NULL);

    // 6. Khởi chạy các tiến trình FreeRTOS
    xTaskCreate(sensor_task, "sensor_task", 4096, NULL, 5, NULL);
    xTaskCreate(publisher_task, "publisher_task", 6144, NULL, 5, NULL);

    // 7. Khởi tạo kết nối Wi-Fi chế độ Kép (AP + STA):
    //    - STA: Tự động kết nối vào Wi-Fi lưu trong NVS (ở nhà hoặc ở trường).
    //    - AP ("TQB_NODE_SETUP"): Luôn phát sẵn điểm truy cập cài đặt tại http://192.168.4.1
    //      để khi mang mạch sang nơi có Wi-Fi mới, chỉ cần lấy điện thoại bắt "TQB_NODE_SETUP"
    //      là đổi được tên Wi-Fi trường + IP Laptop Server ngay lập tức mà không cần nạp lại code!
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
    memcpy(wifi_cfg.sta.password, cfg->wifi_pass, sizeof(wifi_cfg.sta.password) - 1);

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
}
