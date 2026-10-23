#pragma once
#include "app_config.h"
#include "mqtt_client.h"

/**
 * @file offline_storage.h
 * @brief Module Quản lý Bộ nhớ đệm Offline 2 tầng (RAM + Flash 1MB SPIFFS)
 *        Giải quyết bài toán:
 *        - Khi mất Wi-Fi hoặc mất điện lưới (Router tắt, ESP32-S3 chạy bằng Pin dự phòng UPS):
 *          Đóng gói dữ liệu cảm biến thành bản ghi nhị phân 64-byte (offline_record_64b_t)
 *          và lưu vào phân vùng Flash 'storage' (1 MB -> chứa tới ~14,680 bản ghi ~ 2-5 ngày).
 *        - Khi có điện và Wi-Fi trở lại:
 *          Thực hiện cơ chế Store-and-Forward (xả bù từng mẻ nhỏ 5 gói/lần) lên MQTT Broker
 *          mà không làm nghẽn băng thông hay treo chip.
 */

// Khởi tạo phân vùng Flash SPIFFS 1MB (được khai báo tại partitions.csv)
void offline_storage_init(void);

// Lưu 1 gói dữ liệu sensor_data_t vào bộ nhớ Flash khi mất kết nối mạng
bool offline_storage_save(const sensor_data_t *data);

// Lấy tổng số bản ghi đang nằm chờ trong bộ nhớ Offline
uint32_t offline_storage_get_count(void);

// Xả bù (Replay) một mẻ nhỏ dữ liệu từ Flash lên MQTT Broker khi mạng đã kết nối lại
void offline_storage_flush_batch(esp_mqtt_client_handle_t mqtt_client);
