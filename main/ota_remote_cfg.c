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

/**
 * @brief Lưu toàn bộ cấu hình hiện tại của Node vào bộ nhớ Flash NVS (không mất khi cúp điện).
 */
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

    err = nvs_commit(handle);
    nvs_close(handle);
    ESP_LOGI(TAG, "💾 Da luu cau hinh Node vao Flash NVS: Room=%s | ID=%s | Role=%u | Mask=0x%04X | Mock=%u",
             s_cfg.room_id, s_cfg.node_id, s_cfg.node_role, s_cfg.sensor_mask, s_cfg.use_mock_mode);
    return err;
}

/**
 * @brief Tự động quét Bus I2C khi khởi động (Plug-and-Play Hardware Probe)
 *        để xem thực tế cảm biến nào đang được cắm trên bo mạch PCB.
 */
static void auto_detect_plugged_i2c_sensors(void) {
    bool has_bh1750 = drv_i2c_probe_device(I2C_ADDR_BH1750);
    bool has_sht30  = drv_i2c_probe_device(I2C_ADDR_SHT30);
    bool has_scd40  = drv_i2c_probe_device(I2C_ADDR_SCD40);
    bool has_oled   = drv_i2c_probe_device(I2C_ADDR_OLED_SSD1306);

    ESP_LOGI(TAG, "🔍 [PLUG-AND-PLAY I2C SCAN] BH1750(0x23):%s | SHT30(0x44):%s | SCD40(0x62):%s | OLED(0x3C):%s",
             has_bh1750 ? "CAM" : "RUT",
             has_sht30  ? "CAM" : "RUT",
             has_scd40  ? "CAM" : "RUT",
             has_oled   ? "CAM" : "RUT");

    // Nếu đang ở chế độ Phần cứng thật (use_mock_mode == 0), tự động cập nhật bitmask I2C theo thực tế cắm/rút
    if (s_cfg.use_mock_mode == 0) {
        if (has_bh1750) s_cfg.sensor_mask |= SENSOR_MASK_BH1750; else s_cfg.sensor_mask &= ~SENSOR_MASK_BH1750;
        if (has_sht30)  s_cfg.sensor_mask |= SENSOR_MASK_SHT30;  else s_cfg.sensor_mask &= ~SENSOR_MASK_SHT30;
        if (has_scd40)  s_cfg.sensor_mask |= SENSOR_MASK_SCD40;  else s_cfg.sensor_mask &= ~SENSOR_MASK_SCD40;
        if (has_oled)   s_cfg.sensor_mask |= SENSOR_MASK_OLED;   else s_cfg.sensor_mask &= ~SENSOR_MASK_OLED;
    }
}

esp_err_t ota_remote_cfg_init(void) {
    // 1. Thiết lập giá trị mặc định ban đầu từ app_config.h
    snprintf(s_cfg.room_id, sizeof(s_cfg.room_id), "P411");
    snprintf(s_cfg.node_id, sizeof(s_cfg.node_id), "Node_All_Sensors");
    s_cfg.node_role     = NODE_ROLE_CURRENT;
    s_cfg.sensor_mask   = ROLE_MASK_ALL_SENSORS;
    s_cfg.use_mock_mode = USE_MOCK_SENSOR_MODE;
    snprintf(s_cfg.wifi_ssid, sizeof(s_cfg.wifi_ssid), "%s", WIFI_SSID);
    snprintf(s_cfg.wifi_pass, sizeof(s_cfg.wifi_pass), "%s", WIFI_PASS);
    snprintf(s_cfg.mqtt_uri,  sizeof(s_cfg.mqtt_uri),  "%s", MQTT_BROKER_URI);

    // 2. Mở NVS kiểm tra xem Node đã từng được cấu hình từ xa qua Wi-Fi chưa
    nvs_handle_t handle;
    esp_err_t err = nvs_open(NVS_NAMESPACE, NVS_READONLY, &handle);
    if (err == ESP_OK) {
        size_t len;
        len = sizeof(s_cfg.room_id);
        nvs_get_str(handle, "room_id", s_cfg.room_id, &len);
        len = sizeof(s_cfg.node_id);
        nvs_get_str(handle, "node_id", s_cfg.node_id, &len);
        nvs_get_u8(handle,  "node_role", &s_cfg.node_role);
        nvs_get_u16(handle, "sensor_mask", &s_cfg.sensor_mask);
        nvs_get_u8(handle,  "mock_mode", &s_cfg.use_mock_mode);

        len = sizeof(s_cfg.wifi_ssid);
        nvs_get_str(handle, "wifi_ssid", s_cfg.wifi_ssid, &len);
        len = sizeof(s_cfg.wifi_pass);
        nvs_get_str(handle, "wifi_pass", s_cfg.wifi_pass, &len);
        len = sizeof(s_cfg.mqtt_uri);
        nvs_get_str(handle, "mqtt_uri", s_cfg.mqtt_uri, &len);

        nvs_close(handle);
        ESP_LOGI(TAG, "✅ Da khoi phuc cau hinh Node tu NVS: ID=%s | Role=%u | Mask=0x%04X",
                 s_cfg.node_id, s_cfg.node_role, s_cfg.sensor_mask);
    } else {
        ESP_LOGI(TAG, "Chua co cau hinh NVS -> Khoi tao mac dinh va luu lan dau.");
        save_cfg_to_nvs();
    }

    // 3. Quét tự động các cảm biến I2C đang cắm trên mạch
    auto_detect_plugged_i2c_sensors();

    return ESP_OK;
}

const node_runtime_cfg_t* ota_remote_cfg_get(void) {
    return &s_cfg;
}

/**
 * @brief Tiến trình FreeRTOS thực thi nạp Firmware mới qua Wi-Fi (OTA HTTP Stream).
 *        Ghi trực tiếp vào phân vùng `ota_0` hoặc `ota_1` mà không làm gián đoạn hệ thống.
 */
static void wifi_ota_update_task(void *pvParameter) {
    ESP_LOGW(TAG, "🚀 [WIFI OTA] Bat dau tai Firmware moi qua Wi-Fi tu: %s", s_ota_url);

    esp_http_client_config_t http_cfg = {
        .url = s_ota_url,
        .timeout_ms = 15000,
        .keep_alive_enable = true,
    };

    esp_err_t ret = esp_https_ota(&http_cfg);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "🎉 [WIFI OTA THANH CONG] Da nap xong code moi qua Wi-Fi! Khoi dong lai ESP32-S3 sau 2 giay...");
        vTaskDelay(pdMS_TO_TICKS(2000));
        esp_restart();
    } else {
        ESP_LOGE(TAG, "❌ [WIFI OTA THAT BAI] Loi khi tai Firmware (%s). Giu nguyen phien ban code hien tai!",
                 esp_err_to_name(ret));
    }

    vTaskDelete(NULL);
}

void ota_remote_start_wifi_update(const char *firmware_url) {
    if (firmware_url == NULL || strlen(firmware_url) < 7) {
        ESP_LOGE(TAG, "URL OTA khong hop le!");
        return;
    }
    snprintf(s_ota_url, sizeof(s_ota_url), "%s", firmware_url);
    xTaskCreate(&wifi_ota_update_task, "wifi_ota_task", 8192, NULL, 6, NULL);
}

/**
 * @brief Phân tích lệnh JSON gửi từ Web Dashboard qua MQTT để:
 *        - Nạp code mới qua Wi-Fi (`"cmd": "ota"`)
 *        - Đổi vai trò Node / Cắm rút sensor (`"cmd": "config"`)
 *        - Đổi mạng Wi-Fi từ xa (`"cmd": "wifi"`)
 */
void ota_remote_cfg_handle_mqtt_cmd(const char *json_str, int len) {
    if (json_str == NULL || len <= 0) return;

    cJSON *root = cJSON_ParseWithLength(json_str, len);
    if (root == NULL) {
        ESP_LOGW(TAG, "Ban tin dieu khien MQTT khong phai JSON hop le");
        return;
    }

    cJSON *cmd_item = cJSON_GetObjectItem(root, "cmd");
    if (!cJSON_IsString(cmd_item)) {
        cJSON_Delete(root);
        return;
    }

    const char *cmd = cmd_item->valuestring;

    // -------------------------------------------------------------------------
    // TRƯỜNG HỢP 1: NẠP CODE MỚI QUA WI-FI (OTA FIRMWARE UPDATE)
    // Ví dụ JSON: {"cmd":"ota", "url":"http://192.168.100.209:8090/firmware.bin"}
    // -------------------------------------------------------------------------
    if (strcmp(cmd, "ota") == 0) {
        cJSON *url_item = cJSON_GetObjectItem(root, "url");
        if (cJSON_IsString(url_item)) {
            ota_remote_start_wifi_update(url_item->valuestring);
        }
    }
    // -------------------------------------------------------------------------
    // TRƯỜNG HỢP 2: ĐỔI CẤU HÌNH CẮM/RÚT SENSOR & VAI TRÒ NODE QUA WI-FI
    // Ví dụ JSON: {"cmd":"config", "node_id":"N1-B1", "role":1, "sensor_mask":7, "mock":0}
    // -------------------------------------------------------------------------
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
            // Nếu không truyền sensor_mask riêng thì tự gán mask chuẩn theo loại Node
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
        ESP_LOGI(TAG, "🔄 Da cap nhat cau hinh Plug-and-Play qua Wi-Fi thanh cong (Khong can thao mach)!");
    }
    // -------------------------------------------------------------------------
    // TRƯỜNG HỢP 3: ĐỔI WI-FI & MQTT BROKER TỪ XA TRƯỚC KHI DI CHUYỂN NODE
    // Ví dụ JSON: {"cmd":"wifi", "ssid":"HUST_TQB_WIFI", "pass":"12345678", "mqtt_uri":"mqtt://192.168.1.100"}
    // -------------------------------------------------------------------------
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
        ESP_LOGW(TAG, "📡 Da luu thong tin Wi-Fi moi (%s) vao NVS -> Khoi dong lai de ket noi...", s_cfg.wifi_ssid);
        vTaskDelay(pdMS_TO_TICKS(1000));
        esp_restart();
    }

    cJSON_Delete(root);
}

// =============================================================================
// 4. CỔNG WEB CÀI ĐẶT WI-FI TRÊN ĐIỆN THOẠI (CAPTIVE PORTAL TẠI http://192.168.4.1)
//    Khi mang ESP32-S3 sang nơi có mạng Wi-Fi mới (như lên trường bảo vệ),
//    ESP32-S3 tự phát sóng Wi-Fi "TQB_NODE_SETUP". Mở http://192.168.4.1 trên
//    điện thoại để nhập tên Wi-Fi trường + IP Laptop Server mà không cần nạp lại code.
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
        ".box{max-width:420px;margin:auto;background:#1e293b;padding:18px;border-radius:12px;border:1px solid #38bdf8}"
        "label{display:block;font-size:13px;color:#94a3b8;margin-top:10px}"
        "input,select{width:100%%;padding:9px;margin-top:4px;border-radius:6px;border:1px solid #475569;background:#0f172a;color:#fff;box-sizing:border-box}"
        "button{width:100%%;padding:12px;margin-top:16px;background:#0284c7;color:#fff;border:none;border-radius:8px;font-weight:bold;font-size:15px}"
        "</style></head><body><div class='box'>"
        "<h2 style='color:#38bdf8;margin:0 0 8px 0'>📡 Cài Đặt Wi-Fi & Server TQB</h2>"
        "<p style='font-size:12px;color:#cbd5e1'>Nhập Wi-Fi của Trường/Phòng và Địa chỉ IP hiện tại của Laptop Server (lưu thẳng vào Flash NVS, không cần nạp lại code):</p>"
        "<form method='GET' action='/save'>"
        "<label>1. Tên Wi-Fi (SSID của Trường / Phòng):</label>"
        "<input name='ssid' value='%s' required>"
        "<label>2. Mật khẩu Wi-Fi:</label>"
        "<input name='pass' value='%s'>"
        "<label>3. Địa chỉ MQTT Laptop Server (mqtt://IP_LAPTOP):</label>"
        "<input name='mqtt' value='%s' required>"
        "<label>4. Mã Phòng (VD: P411, P111_T1, KHO_T2):</label>"
        "<input name='room' value='%s'>"
        "<label>5. Mã Định Danh Node (VD: N1_B01, N2_COT1, N3_KE1):</label>"
        "<input name='id' value='%s'>"
        "<label>6. Chế độ Vận hành:</label>"
        "<select name='mock'><option value='0' %s>🔌 Đọc Cảm Biến Phần Cứng Thật (Real Hardware)</option>"
        "<option value='1' %s>🧪 Chế độ Giả Lập Kiểm Thử (Admin Test)</option></select>"
        "<button type='submit'>💾 LƯU VÀO NVS & KẾT NỐI NGAY</button>"
        "</form></div></body></html>",
        s_cfg.wifi_ssid, s_cfg.wifi_pass, s_cfg.mqtt_uri,
        s_cfg.room_id, s_cfg.node_id,
        (s_cfg.use_mock_mode == 0) ? "selected" : "",
        (s_cfg.use_mock_mode != 0) ? "selected" : "");

    httpd_resp_set_type(req, "text/html; charset=utf-8");
    return httpd_resp_send(req, html, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t setup_portal_save_handler(httpd_req_t *req) {
    char query[384] = {0};
    if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
        char val[96];
        if (httpd_query_key_value(query, "ssid", val, sizeof(val)) == ESP_OK) {
            url_decode_inplace(val);
            snprintf(s_cfg.wifi_ssid, sizeof(s_cfg.wifi_ssid), "%.*s", (int)sizeof(s_cfg.wifi_ssid) - 1, val);
        }
        if (httpd_query_key_value(query, "pass", val, sizeof(val)) == ESP_OK) {
            url_decode_inplace(val);
            snprintf(s_cfg.wifi_pass, sizeof(s_cfg.wifi_pass), "%.*s", (int)sizeof(s_cfg.wifi_pass) - 1, val);
        }
        if (httpd_query_key_value(query, "mqtt", val, sizeof(val)) == ESP_OK) {
            url_decode_inplace(val);
            snprintf(s_cfg.mqtt_uri, sizeof(s_cfg.mqtt_uri), "%.*s", (int)sizeof(s_cfg.mqtt_uri) - 1, val);
        }
        if (httpd_query_key_value(query, "room", val, sizeof(val)) == ESP_OK) {
            url_decode_inplace(val);
            snprintf(s_cfg.room_id, sizeof(s_cfg.room_id), "%.*s", (int)sizeof(s_cfg.room_id) - 1, val);
        }
        if (httpd_query_key_value(query, "id", val, sizeof(val)) == ESP_OK) {
            url_decode_inplace(val);
            snprintf(s_cfg.node_id, sizeof(s_cfg.node_id), "%.*s", (int)sizeof(s_cfg.node_id) - 1, val);
        }
        if (httpd_query_key_value(query, "mock", val, sizeof(val)) == ESP_OK) {
            s_cfg.use_mock_mode = (uint8_t)atoi(val);
        }
        save_cfg_to_nvs();
    }

    const char *ok_html =
        "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
        "<body style='background:#0f172a;color:#4ade80;font-family:sans-serif;text-align:center;padding:30px'>"
        "<h2>✅ Đã lưu Wi-Fi & IP Server mới vào Flash NVS!</h2>"
        "<p style='color:#f8fafc'>Chip ESP32-S3 đang tự khởi động lại để kết nối vào mạng Wi-Fi mới...</p></body></html>";
    httpd_resp_set_type(req, "text/html; charset=utf-8");
    httpd_resp_send(req, ok_html, HTTPD_RESP_USE_STRLEN);

    vTaskDelay(pdMS_TO_TICKS(1500));
    esp_restart();
    return ESP_OK;
}

void ota_remote_start_ap_web_portal(void) {
    if (s_setup_server != NULL) return;

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = 80;
    config.lru_purge_enable = true;

    if (httpd_start(&s_setup_server, &config) == ESP_OK) {
        httpd_uri_t uri_root = { .uri = "/",     .method = HTTP_GET, .handler = setup_portal_get_handler,  .user_ctx = NULL };
        httpd_uri_t uri_save = { .uri = "/save", .method = HTTP_GET, .handler = setup_portal_save_handler, .user_ctx = NULL };
        httpd_register_uri_handler(s_setup_server, &uri_root);
        httpd_register_uri_handler(s_setup_server, &uri_save);
        ESP_LOGI(TAG, "🌐 Da bat Trang Web Cai dat Wi-Fi & Server tai: http://192.168.4.1 (Wi-Fi AP: TQB_NODE_SETUP)");
    }
}
