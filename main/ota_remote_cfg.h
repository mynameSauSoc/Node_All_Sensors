#pragma once
#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"
#include "app_config.h"

/**
 * @file ota_remote_cfg.h
 * @brief Module Quản lý Từ xa qua Wi-Fi & Bộ nhớ NVS (Zero-Touch Remote Management)
 *        - Cấu hình vai trò Node (Node 1 Bàn / Node 2 Cột / Node 3 Kệ sách / All Sensors)
 *        - Bật/tắt cảm biến động (Plug-and-Play Bitmask)
 *        - Đổi Wi-Fi & IP Mosquitto Broker từ xa qua MQTT hoặc Web Portal
 *        - Nạp firmware mới qua Wi-Fi (HTTP OTA)
 */

#define SENSOR_MASK_INMP441     (1 << 0)  // Micro I2S INMP441
#define SENSOR_MASK_BH1750      (1 << 1)  // Cảm biến ánh sáng I2C BH1750 (0x23)
#define SENSOR_MASK_LED3        (1 << 2)  // 3 Đèn LED đơn sắc rời (GPIO 1, 2, 42)
#define SENSOR_MASK_SCD40       (1 << 3)  // Cảm biến CO2 Sensirion SCD40 (0x62)
#define SENSOR_MASK_SHT30       (1 << 4)  // Cảm biến Nhiệt ẩm SHT30 (0x44)
#define SENSOR_MASK_PM25        (1 << 5)  // Cảm biến Bụi Sharp GP2Y1014AU0F (GPIO 10, GPIO 3 x1.5)
#define SENSOR_MASK_GAS         (1 << 6)  // Cảm biến Khí độc SO2 / NO2 / VOCs
#define SENSOR_MASK_SPK         (1 << 7)  // Mạch Amply I2S MAX98357A + Loa 1W
#define SENSOR_MASK_OLED        (1 << 8)  // Màn hình OLED SH1106 / SSD1306 (0x3C)

#define ROLE_MASK_NODE1_TABLE   (SENSOR_MASK_INMP441 | SENSOR_MASK_BH1750 | SENSOR_MASK_LED3)
#define ROLE_MASK_NODE2_COLUMN  (SENSOR_MASK_SCD40 | SENSOR_MASK_BH1750 | SENSOR_MASK_INMP441 | SENSOR_MASK_SPK | SENSOR_MASK_OLED)
#define ROLE_MASK_NODE3_SHELF   (SENSOR_MASK_SHT30 | SENSOR_MASK_BH1750 | SENSOR_MASK_PM25 | SENSOR_MASK_GAS)
#define ROLE_MASK_ALL_SENSORS   (0x01FF)

typedef struct {
    char     room_id[16];       // "P411"
    char     node_id[32];       // "Node_All_Sensors" (hardware_id)
    uint8_t  node_role;         // 1: Bàn | 2: Cột | 3: Kệ | 4: All Sensors
    uint16_t sensor_mask;       // Bitmask các cảm biến đang bật
    uint8_t  use_mock_mode;     // 1: Giả lập kiểm thử | 0: Phần cứng thật
    char     wifi_ssid[32];     // Wi-Fi SSID
    char     wifi_pass[64];     // Wi-Fi Pass
    char     mqtt_uri[96];      // URI Mosquitto Broker ("mqtt://192.168.1.100:1883")
    char     mqtt_user[32];     // Username ("aiot_backend")
    char     mqtt_pass[32];     // Password ("aiot_backend_password_123")
} node_runtime_cfg_t;

esp_err_t ota_remote_cfg_init(void);

const node_runtime_cfg_t* ota_remote_cfg_get(void);

void ota_remote_cfg_handle_mqtt_cmd(const char *json_str, int len);

void ota_remote_start_wifi_update(const char *firmware_url);

void ota_remote_start_ap_web_portal(void);
