#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_ota_ops.h"
#include "esp_http_client.h"
#include "esp_https_ota.h"
#include "esp_http_server.h"
#include "esp_system.h"
#include "cJSON.h"

#include "app_config.h"
#include "ota_remote_cfg.h"
#include "drv_i2c_sensors.h"

static const char *TAG = "OTA_REMOTE_CFG";
#define NVS_NAMESPACE "node_cfg"

static node_runtime_cfg_t s_cfg;
static char s_ota_url[160] = {0};

static esp_err_t save_cfg_to_nvs(void) {
    nvs_handle_t handle;
    esp_err_t err = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Khong the mo NVS de luu cau hinh: %s", esp_err_to_name(err));
        return err;
    }

    nvs_set_str(handle, "room_id", s_cfg.room_id);
    nvs_set_str(handle, "node_id", s_cfg.node_id);
    nvs_set_u8(handle,  "node_role", s_cfg.node_role);
    nvs_set_u16(handle, "sensor_mask", s_cfg.sensor_mask);
    nvs_set_u8(handle,  "mock_mode", s_cfg.use_mock_mode);
    nvs_set_str(handle, "wifi_ssid", s_cfg.wifi_ssid);
    nvs_set_str(handle, "wifi_pass", s_cfg.wifi_pass);
    nvs_set_str(handle, "mqtt_uri", s_cfg.mqtt_uri);
    nvs_set_str(handle, "mqtt_user", s_cfg.mqtt_user);
    nvs_set_str(handle, "mqtt_pass", s_cfg.mqtt_pass);

    err = nvs_commit(handle);
    nvs_close(handle);
    ESP_LOGI(TAG, "💾 Da luu cau hinh vao NVS: Room=%s | ID=%s | Role=%u | Mask=0x%04X | Mock=%u | URI=%s",
             s_cfg.room_id, s_cfg.node_id, s_cfg.node_role, s_cfg.sensor_mask, s_cfg.use_mock_mode, s_cfg.mqtt_uri);
    return err;
}

static void auto_detect_plugged_i2c_sensors(void) {
    bool has_bh1750 = drv_i2c_probe_device(I2C_ADDR_BH1750);
    bool has_sht30  = drv_i2c_probe_device(I2C_ADDR_SHT30);
    bool has_scd40  = drv_i2c_probe_device(I2C_ADDR_SCD40);
    bool has_oled   = drv_i2c_probe_device(I2C_ADDR_OLED_DEFAULT) || drv_i2c_probe_device(I2C_ADDR_OLED_ALT);

    ESP_LOGI(TAG, "🔍 [PLUG-AND-PLAY I2C SCAN] BH1750(0x23):%s | SHT30(0x44):%s | SCD40(0x62):%s | OLED(0x3C):%s",
             has_bh1750 ? "DETECTED" : "UNPLUGGED",
             has_sht30  ? "DETECTED" : "UNPLUGGED",
             has_scd40  ? "DETECTED" : "UNPLUGGED",
             has_oled   ? "DETECTED" : "UNPLUGGED");

    if (s_cfg.use_mock_mode == 0) {
        if (has_bh1750) s_cfg.sensor_mask |= SENSOR_MASK_BH1750; else s_cfg.sensor_mask &= ~SENSOR_MASK_BH1750;
        if (has_sht30)  s_cfg.sensor_mask |= SENSOR_MASK_SHT30;  else s_cfg.sensor_mask &= ~SENSOR_MASK_SHT30;
        if (has_scd40)  s_cfg.sensor_mask |= SENSOR_MASK_SCD40;  else s_cfg.sensor_mask &= ~SENSOR_MASK_SCD40;
        if (has_oled)   s_cfg.sensor_mask |= SENSOR_MASK_OLED;   else s_cfg.sensor_mask &= ~SENSOR_MASK_OLED;
    }
}

esp_err_t ota_remote_cfg_init(void) {
    // 1. Mặc định từ app_config.h
    snprintf(s_cfg.room_id, sizeof(s_cfg.room_id), "%s", DEFAULT_ROOM_ID);
    snprintf(s_cfg.node_id, sizeof(s_cfg.node_id), "%s", DEFAULT_HARDWARE_ID);
    s_cfg.node_role     = NODE_ROLE_CURRENT;
    s_cfg.sensor_mask   = ROLE_MASK_ALL_SENSORS;
    s_cfg.use_mock_mode = USE_MOCK_SENSOR_MODE;
    snprintf(s_cfg.wifi_ssid, sizeof(s_cfg.wifi_ssid), "%s", WIFI_SSID_DEFAULT);
    snprintf(s_cfg.wifi_pass, sizeof(s_cfg.wifi_pass), "%s", WIFI_PASS_DEFAULT);
    snprintf(s_cfg.mqtt_uri,  sizeof(s_cfg.mqtt_uri),  "%s", MQTT_BROKER_URI_DEFAULT);
    snprintf(s_cfg.mqtt_user, sizeof(s_cfg.mqtt_user), "%s", MQTT_USERNAME_DEFAULT);
    snprintf(s_cfg.mqtt_pass, sizeof(s_cfg.mqtt_pass), "%s", MQTT_PASSWORD_DEFAULT);

    // 2. Mở NVS kiểm tra cấu hình đã lưu
    nvs_handle_t handle;
    esp_err_t err = nvs_open(NVS_NAMESPACE, NVS_READONLY, &handle);
    if (err == ESP_OK) {
        size_t len;
        len = sizeof(s_cfg.room_id);   nvs_get_str(handle, "room_id", s_cfg.room_id, &len);
        len = sizeof(s_cfg.node_id);   nvs_get_str(handle, "node_id", s_cfg.node_id, &len);
        nvs_get_u8(handle,  "node_role", &s_cfg.node_role);
        nvs_get_u16(handle, "sensor_mask", &s_cfg.sensor_mask);
        nvs_get_u8(handle,  "mock_mode", &s_cfg.use_mock_mode);
        len = sizeof(s_cfg.wifi_ssid); nvs_get_str(handle, "wifi_ssid", s_cfg.wifi_ssid, &len);
        len = sizeof(s_cfg.wifi_pass); nvs_get_str(handle, "wifi_pass", s_cfg.wifi_pass, &len);
        len = sizeof(s_cfg.mqtt_uri);  nvs_get_str(handle, "mqtt_uri", s_cfg.mqtt_uri, &len);
        len = sizeof(s_cfg.mqtt_user); nvs_get_str(handle, "mqtt_user", s_cfg.mqtt_user, &len);
        len = sizeof(s_cfg.mqtt_pass); nvs_get_str(handle, "mqtt_pass", s_cfg.mqtt_pass, &len);
        nvs_close(handle);
        ESP_LOGI(TAG, "Da khoi phuc cau hinh Node tu Flash NVS: HardwareID=%s | Mode=%s",
                 s_cfg.node_id, (s_cfg.use_mock_mode ? "MOCK" : "REAL_HARDWARE"));
    } else {
        ESP_LOGI(TAG, "Chua co NVS -> Luu cau hinh mac dinh ban dau");
        save_cfg_to_nvs();
    }

    // 3. Tự động kiểm tra các cảm biến I2C đang cắm
    auto_detect_plugged_i2c_sensors();
    return ESP_OK;
}

const node_runtime_cfg_t* ota_remote_cfg_get(void) {
    return &s_cfg;
}

static void wifi_ota_update_task(void *pvParameter) {
    ESP_LOGW(TAG, "Bat dau nạp Firmware qua Wi-Fi OTA tu URL: %s", s_ota_url);

    esp_http_client_config_t http_cfg = {
        .url = s_ota_url,
        .timeout_ms = 15000,
        .keep_alive_enable = true,
    };

    esp_err_t ret = esp_https_ota(&http_cfg);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Nap OTA thanh cong! Khoi dong lai ESP32-S3 sau 2 giay...");
        vTaskDelay(pdMS_TO_TICKS(2000));
        esp_restart();
    } else {
        ESP_LOGE(TAG, "Nap OTA that bai: %s", esp_err_to_name(ret));
    }
    vTaskDelete(NULL);
}

void ota_remote_start_wifi_update(const char *firmware_url) {
    if (!firmware_url || strlen(firmware_url) < 7) return;
    snprintf(s_ota_url, sizeof(s_ota_url), "%s", firmware_url);
    xTaskCreate(&wifi_ota_update_task, "wifi_ota_task", 8192, NULL, 6, NULL);
}

void ota_remote_cfg_handle_mqtt_cmd(const char *json_str, int len) {
    if (!json_str || len <= 0) return;

    cJSON *root = cJSON_ParseWithLength(json_str, len);
    if (!root) {
        ESP_LOGW(TAG, "Goi tin dieu khien MQTT khong dung dinh dang JSON");
        return;
    }

    cJSON *cmd_item = cJSON_GetObjectItem(root, "cmd");
    if (!cJSON_IsString(cmd_item)) {
        cJSON_Delete(root);
        return;
    }

    const char *cmd = cmd_item->valuestring;

    // 1. Lenh OTA
    if (strcmp(cmd, "ota") == 0) {
        cJSON *url_item = cJSON_GetObjectItem(root, "url");
        if (cJSON_IsString(url_item)) {
            ota_remote_start_wifi_update(url_item->valuestring);
        }
    }
    // 2. Lenh Config (Doi Hardware ID, Vai tro, Mock Mode, Sensor Mask)
    else if (strcmp(cmd, "config") == 0) {
        cJSON *room_item = cJSON_GetObjectItem(root, "room_id");
        cJSON *id_item   = cJSON_GetObjectItem(root, "node_id");
        cJSON *role_item = cJSON_GetObjectItem(root, "role");
        cJSON *mask_item = cJSON_GetObjectItem(root, "sensor_mask");
        cJSON *mock_item = cJSON_GetObjectItem(root, "mock");

        if (cJSON_IsString(room_item)) {
            snprintf(s_cfg.room_id, sizeof(s_cfg.room_id), "%s", room_item->valuestring);
        }
        if (cJSON_IsString(id_item)) {
            snprintf(s_cfg.node_id, sizeof(s_cfg.node_id), "%s", id_item->valuestring);
        }
        if (cJSON_IsNumber(role_item)) {
            s_cfg.node_role = (uint8_t)role_item->valueint;
            if (!cJSON_IsNumber(mask_item)) {
                if (s_cfg.node_role == 1)      s_cfg.sensor_mask = ROLE_MASK_NODE1_TABLE;
                else if (s_cfg.node_role == 2) s_cfg.sensor_mask = ROLE_MASK_NODE2_COLUMN;
                else if (s_cfg.node_role == 3) s_cfg.sensor_mask = ROLE_MASK_NODE3_SHELF;
                else                           s_cfg.sensor_mask = ROLE_MASK_ALL_SENSORS;
            }
        }
        if (cJSON_IsNumber(mask_item)) {
            s_cfg.sensor_mask = (uint16_t)mask_item->valueint;
        }
        if (cJSON_IsNumber(mock_item)) {
            s_cfg.use_mock_mode = (uint8_t)mock_item->valueint;
        }

        save_cfg_to_nvs();
        ESP_LOGI(TAG, "Da cap nhat cau hinh qua MQTT thanh cong!");
    }
    // 3. Lenh Doi Wi-Fi & MQTT
    else if (strcmp(cmd, "wifi") == 0) {
        cJSON *ssid_item = cJSON_GetObjectItem(root, "ssid");
        cJSON *pass_item = cJSON_GetObjectItem(root, "pass");
        cJSON *mqtt_item = cJSON_GetObjectItem(root, "mqtt_uri");

        if (cJSON_IsString(ssid_item)) {
            snprintf(s_cfg.wifi_ssid, sizeof(s_cfg.wifi_ssid), "%s", ssid_item->valuestring);
        }
        if (cJSON_IsString(pass_item)) {
            snprintf(s_cfg.wifi_pass, sizeof(s_cfg.wifi_pass), "%s", pass_item->valuestring);
        }
        if (cJSON_IsString(mqtt_item)) {
            snprintf(s_cfg.mqtt_uri, sizeof(s_cfg.mqtt_uri), "%s", mqtt_item->valuestring);
        }

        save_cfg_to_nvs();
        ESP_LOGW(TAG, "Da luu thong tin Wi-Fi moi -> Khoi dong lai ket noi sau 1 giay...");
        vTaskDelay(pdMS_TO_TICKS(1000));
        esp_restart();
    }

    cJSON_Delete(root);
}

// =============================================================================
// CỔNG CÀI ĐẶT WEB PORTAL (CAPTIVE PORTAL TRÊN AP "TQB_NODE_SETUP")
// =============================================================================
static httpd_handle_t s_setup_server = NULL;

static void url_decode_inplace(char *str) {
    char *src = str, *dst = str;
    while (*src) {
        if (*src == '+') {
            *dst++ = ' ';
            src++;
        } else if (*src == '%' && src[1] && src[2]) {
            char hex[3] = { src[1], src[2], 0 };
            *dst++ = (char)strtol(hex, NULL, 16);
            src += 3;
        } else {
            *dst++ = *src++;
        }
    }
    *dst = '\0';
}

static esp_err_t setup_portal_get_handler(httpd_req_t *req) {
    char html[2400];
    snprintf(html, sizeof(html),
        "<!DOCTYPE html><html lang='vi'><head><meta charset='UTF-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>Cài Đặt Node Thư Viện TQB</title>"
        "<style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:16px}"
        ".box{max-width:440px;margin:auto;background:#1e293b;padding:18px;border-radius:12px;border:1px solid #38bdf8}"
        "label{display:block;font-size:13px;color:#94a3b8;margin-top:10px}"
        "input,select{width:100%%;padding:9px;margin-top:4px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:#fff;box-sizing:border-box}"
        "button{width:100%%;padding:12px;margin-top:16px;background:#0284c7;color:#fff;border:none;border-radius:8px;font-weight:bold;font-size:15px}"
        "</style></head><body><div class='box'>"
        "<h2 style='color:#38bdf8;margin:0 0 8px 0'>📡 Cài Đặt Node 1 (All Sensors)</h2>"
        "<p style='font-size:12px;color:#cbd5e1'>Nhập cấu hình kết nối Mosquitto 2.0 & Spring Boot 3:</p>"
        "<form method='GET' action='/save'>"
        "<label>1. Tên Wi-Fi (SSID):</label>"
        "<input type='text' name='ssid' value='%s' required>"
        "<label>2. Mật khẩu Wi-Fi:</label>"
        "<input type='password' name='pass' value='%s'>"
        "<label>3. Địa chỉ MQTT Broker (Mosquitto 2.0 Port 1883):</label>"
        "<input type='text' name='mqtt' value='%s' required>"
        "<label>4. Hardware ID (Mã định danh):</label>"
        "<input type='text' name='node_id' value='%s' required>"
        "<label>5. Phòng lắp đặt (Room Code):</label>"
        "<input type='text' name='room_id' value='%s' required>"
        "<label>6. Chế độ vận hành:</label>"
        "<select name='mock'>"
        "<option value='0'%s>Phần cứng thật (PCB Altium 0 lỗi DRC)</option>"
        "<option value='1'%s>Mô phỏng Gaussian (Admin Test)</option>"
        "</select>"
        "<button type='submit'>💾 Lưu Cấu Hình & Kết Nối Lại</button>"
        "</form></div></body></html>",
        s_cfg.wifi_ssid, s_cfg.wifi_pass, s_cfg.mqtt_uri, s_cfg.node_id, s_cfg.room_id,
        (s_cfg.use_mock_mode == 0) ? " selected" : "",
        (s_cfg.use_mock_mode == 1) ? " selected" : "");

    httpd_resp_set_type(req, "text/html; charset=utf-8");
    httpd_resp_send(req, html, strlen(html));
    return ESP_OK;
}

static esp_err_t setup_portal_save_handler(httpd_req_t *req) {
    char query[384];
    if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
        char val[128];

        if (httpd_query_key_value(query, "ssid", val, sizeof(val)) == ESP_OK) {
            url_decode_inplace(val);
            strncpy(s_cfg.wifi_ssid, val, sizeof(s_cfg.wifi_ssid) - 1);
            s_cfg.wifi_ssid[sizeof(s_cfg.wifi_ssid) - 1] = '\0';
        }
        if (httpd_query_key_value(query, "pass", val, sizeof(val)) == ESP_OK) {
            url_decode_inplace(val);
            strncpy(s_cfg.wifi_pass, val, sizeof(s_cfg.wifi_pass) - 1);
            s_cfg.wifi_pass[sizeof(s_cfg.wifi_pass) - 1] = '\0';
        }
        if (httpd_query_key_value(query, "mqtt", val, sizeof(val)) == ESP_OK) {
            url_decode_inplace(val);
            strncpy(s_cfg.mqtt_uri, val, sizeof(s_cfg.mqtt_uri) - 1);
            s_cfg.mqtt_uri[sizeof(s_cfg.mqtt_uri) - 1] = '\0';
        }
        if (httpd_query_key_value(query, "node_id", val, sizeof(val)) == ESP_OK) {
            url_decode_inplace(val);
            strncpy(s_cfg.node_id, val, sizeof(s_cfg.node_id) - 1);
            s_cfg.node_id[sizeof(s_cfg.node_id) - 1] = '\0';
        }
        if (httpd_query_key_value(query, "room_id", val, sizeof(val)) == ESP_OK) {
            url_decode_inplace(val);
            strncpy(s_cfg.room_id, val, sizeof(s_cfg.room_id) - 1);
            s_cfg.room_id[sizeof(s_cfg.room_id) - 1] = '\0';
        }
        if (httpd_query_key_value(query, "mock", val, sizeof(val)) == ESP_OK) {
            s_cfg.use_mock_mode = (uint8_t)atoi(val);
        }

        save_cfg_to_nvs();

        const char *resp = "<!DOCTYPE html><html lang='vi'><head><meta charset='UTF-8'>"
                           "<meta http-equiv='refresh' content='3;url=http://192.168.4.1/'>"
                           "<body style='background:#0f172a;color:#38bdf8;font-family:sans-serif;padding:32px;text-align:center'>"
                           "<h2>✅ ĐÃ LƯU CẤU HÌNH THÀNH CÔNG!</h2>"
                           "<p style='color:#f8fafc'>ESP32-S3 đang khởi động lại để kết nối mạng mới...</p>"
                           "</body></html>";
        httpd_resp_send(req, resp, strlen(resp));

        vTaskDelay(pdMS_TO_TICKS(1500));
        esp_restart();
        return ESP_OK;
    }

    httpd_resp_send_404(req);
    return ESP_FAIL;
}

void ota_remote_start_ap_web_portal(void) {
    if (s_setup_server != NULL) return;

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.max_uri_handlers = 8;
    config.stack_size = 4096;

    if (httpd_start(&s_setup_server, &config) == ESP_OK) {
        httpd_uri_t get_uri = {
            .uri = "/",
            .method = HTTP_GET,
            .handler = setup_portal_get_handler,
            .user_ctx = NULL
        };
        httpd_register_uri_handler(s_setup_server, &get_uri);

        httpd_uri_t save_uri = {
            .uri = "/save",
            .method = HTTP_GET,
            .handler = setup_portal_save_handler,
            .user_ctx = NULL
        };
        httpd_register_uri_handler(s_setup_server, &save_uri);

        ESP_LOGI(TAG, "Web Portal AP da mo tai http://192.168.4.1/");
    }
}
