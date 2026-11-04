#pragma once
#include "app_config.h"
#include "mqtt_client.h"

/**
 * @file offline_storage.h
 * @brief Quản lý Bộ nhớ đệm Ngoại tuyến Flash 1MB SPIFFS (Store-and-Forward):
 *        - Lưu trữ an toàn dữ liệu nhị phân 64-byte khi mất Wi-Fi hoặc mất điện (chạy pin UPS).
 *        - Xả bù (Replay) mẻ nhỏ lên MQTT Broker khi có mạng trở lại theo đúng chuẩn JSON SSOT.
 */

void offline_storage_init(void);

bool offline_storage_save(const sensor_data_t *data);

uint32_t offline_storage_get_count(void);

void offline_storage_flush_batch(esp_mqtt_client_handle_t mqtt_client, const char *hardware_id);
