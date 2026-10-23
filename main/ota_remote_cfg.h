#pragma once
#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

/**
 * @file ota_remote_cfg.h
 * @brief Module Quản lý Từ xa qua Wi-Fi (Zero-Touch Wireless Management) cho ESP32-S3:
 *        Giải quyết triệt để bài toán: Khi Node đã lắp cố định lên bàn đọc, cột trụ hoặc
 *        hộc kệ sách trong thư viện, kỹ thuật viên KHÔNG CẦN tháo gỡ mạch hay cắm cáp USB
 *        mà thực hiện toàn bộ qua sóng Wi-Fi:
 *
 *        1. Nạp code mới qua Wi-Fi (Wireless OTA Firmware Update):
 *           - Sử dụng kiến trúc Dual-Partition (ota_0 & ota_1) trên Flash 16MB.
 *           - Khi nhận lệnh MQTT `{"cmd":"ota","url":"http://192.168.x.x:8090/firmware.bin"}`,
 *             ESP32-S3 tự tải file `.bin` mới về phân vùng chờ, kiểm tra checksum SHA-256,
 *             chuyển cờ boot và tự khởi động lại vào code mới. Nếu lỗi tự Rollback về bản cũ.
 *
 *        2. Đổi cấu hình Cắm/Rút Sensor & Vai trò Node từ xa qua Wi-Fi (Remote NVS Config):
 *           - Nhận lệnh JSON qua MQTT để đổi `node_id` (VD: "N1-B1" -> "N3-K2"), đổi vai trò
 *             (Node 1 Bàn / Node 2 Cột / Node 3 Kệ sách), và bật/tắt từng cảm biến (Plug & Play).
 *           - Lưu vĩnh viễn vào bộ nhớ Flash NVS (mất điện không mất cấu hình).
 *
 *        3. Đổi mạng Wi-Fi từ xa qua MQTT hoặc phát Wi-Fi Captive Portal khi đổi phòng.
 */

// Mặt nạ bit (Bitmask) đại diện cho từng cảm biến/ngoại vi được cắm vào hoặc rút ra
#define SENSOR_MASK_INMP441     (1 << 0)  // Micro số I2S INMP441 (Đo độ ồn LAeq)
#define SENSOR_MASK_BH1750      (1 << 1)  // Cảm biến ánh sáng I2C BH1750 (0x23)
#define SENSOR_MASK_LED3        (1 << 2)  // Cụm 3 Đèn LED đơn sắc rời (Xanh lá, Xanh dương, Đỏ)
#define SENSOR_MASK_SCD40       (1 << 3)  // Cảm biến CO2 + Nhiệt + Ẩm I2C SCD40 (0x62)
#define SENSOR_MASK_SHT30       (1 << 4)  // Cảm biến Nhiệt + Ẩm chính xác cao I2C SHT30 (0x44)
#define SENSOR_MASK_PM25        (1 << 5)  // Cảm biến Bụi mịn hồng ngoại Sharp GP2Y1014AU0F (ADC + 280us)
#define SENSOR_MASK_GAS         (1 << 6)  // Cụm cảm biến Khí độc bảo quản sách SO2 / NO2 / VOCs
#define SENSOR_MASK_SPK         (1 << 7)  // Mạch khuếch đại I2S MAX98357A + Loa 1W nhắc nhở
#define SENSOR_MASK_OLED        (1 << 8)  // Màn hình hiển thị tại chỗ OLED 0.96" SSD1306 (0x3C)

// Cấu hình mặt nạ mặc định cho 3 loại Node chuẩn của Thư viện Tạ Quang Bửu
#define ROLE_MASK_NODE1_TABLE   (SENSOR_MASK_INMP441 | SENSOR_MASK_BH1750 | SENSOR_MASK_LED3)
#define ROLE_MASK_NODE2_COLUMN  (SENSOR_MASK_SCD40 | SENSOR_MASK_BH1750 | SENSOR_MASK_INMP441 | SENSOR_MASK_SPK | SENSOR_MASK_OLED)
#define ROLE_MASK_NODE3_SHELF   (SENSOR_MASK_SHT30 | SENSOR_MASK_BH1750 | SENSOR_MASK_PM25 | SENSOR_MASK_GAS)
#define ROLE_MASK_ALL_SENSORS   (0x01FF)  // Bật toàn bộ 9 nhóm phần cứng

typedef struct {
    char     room_id[16];       // Mã Phòng & Tầng (VD: "P411", "P111_T1", "P111_T2", "KHO_T1", "KHO_T2")
    char     node_id[24];       // Mã định danh Node (VD: "N1-B1", "N2-C1", "N3-K1")
    uint8_t  node_role;         // 1: Node 1 Bàn, 2: Node 2 Cột, 3: Node 3 Kệ sách, 4: All Sensors
    uint16_t sensor_mask;       // Bitmask các cảm biến đang được bật (Cắm = 1, Rút = 0)
    uint8_t  use_mock_mode;     // 1: Chế độ giả lập kiểm thử Admin, 0: Đọc phần cứng thật
    char     wifi_ssid[32];     // Tên Wi-Fi lưu trong Flash NVS
    char     wifi_pass[64];     // Mật khẩu Wi-Fi lưu trong Flash NVS
    char     mqtt_uri[64];      // Địa chỉ MQTT Broker lưu trong Flash NVS
} node_runtime_cfg_t;

/**
 * @brief Đọc cấu hình Node từ bộ nhớ Flash NVS khi khởi động.
 *        Nếu NVS chưa có (lần đầu nạp), tự động nạp cấu hình mặc định từ `app_config.h`
 *        và quét Bus I2C (Auto-Detect) để phát hiện các cảm biến đang cắm.
 */
esp_err_t ota_remote_cfg_init(void);

/**
 * @brief Lấy con trỏ tới cấu hình đang chạy của Node.
 */
const node_runtime_cfg_t* ota_remote_cfg_get(void);

/**
 * @brief Xử lý bản tin JSON điều khiển từ xa gửi từ Web Dashboard qua MQTT (`library/p411/node_all_sensors/cmd`).
 *        Hỗ trợ 3 nhóm lệnh không cần tháo mạch:
 *        1. Nạp code mới qua Wi-Fi (OTA):
 *           `{"cmd":"ota","url":"http://192.168.100.209:8090/firmware.bin"}`
 *        2. Đổi cấu hình Cắm/Rút Sensor & Vai trò Node (lưu vào NVS):
 *           `{"cmd":"config","node_id":"N1-B1","role":1,"sensor_mask":7,"mock":0}`
 *        3. Đổi mạng Wi-Fi từ xa (lưu vào NVS & kết nối lại):
 *           `{"cmd":"wifi","ssid":"HUST_LIBRARY","pass":"12345678"}`
 */
void ota_remote_cfg_handle_mqtt_cmd(const char *json_str, int len);

/**
 * @brief Kích hoạt tiến trình tải và nạp Firmware mới qua Wi-Fi (HTTP OTA).
 * @param firmware_url Đường dẫn HTTP tới file `main.bin` trên máy tính/Server.
 */
void ota_remote_start_wifi_update(const char *firmware_url);

/**
 * @brief Khởi chạy Cổng Cài đặt Wi-Fi & Server trực tiếp trên Điện thoại (Captive Web Portal tại http://192.168.4.1).
 *        Khi mang mạch ESP32-S3 sang nơi có mạng Wi-Fi mới (như lên trường bảo vệ),
 *        chỉ cần dùng điện thoại bắt Wi-Fi "TQB_NODE_SETUP" và mở http://192.168.4.1
 *        để nhập tên Wi-Fi trường + IP Laptop Server mà không cần nạp lại code.
 */
void ota_remote_start_ap_web_portal(void);

