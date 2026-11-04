#!/bin/sh
set -e

PASSWD_FILE="/mosquitto/data/password.txt"
ACL_FILE="/mosquitto/data/acl.conf"
mkdir -p /mosquitto/data /mosquitto/log

BACKEND_USER="${MQTT_USERNAME:-aiot_backend}"
BACKEND_PASS="${MQTT_PASSWORD:-aiot_backend_secret}"
ADMIN_USER="${MQTT_ADMIN_USERNAME:-admin}"
ADMIN_PASS="${MQTT_ADMIN_PASSWORD:-Admin@123456}"
DEVICE_PASS="${MQTT_DEVICE_PASSWORD:-$BACKEND_PASS}"

: > "$PASSWD_FILE"
cp /mosquitto/config/acl.conf "$ACL_FILE"
chmod 0700 "$PASSWD_FILE" "$ACL_FILE"

mosquitto_passwd -b "$PASSWD_FILE" "$BACKEND_USER" "$BACKEND_PASS"
mosquitto_passwd -b "$PASSWD_FILE" "$ADMIN_USER" "$ADMIN_PASS"

DEVICE_IDS="ESP32S3_ZONE_A_001 ESP32_ROOM_101 ESP32_ROOM_101_CTR ESP32_ROOM_101_DOOR ESP32_ROOM_102 ESP32_ROOM_102_B ESP32_ROOM_102_C ESP32_STORAGE_201 ESP32_STORAGE_201_B ESP32_STORAGE_201_C ESP32_HALL_001_A ESP32_HALL_001_B ESP32_HALL_001_C"

for DEV_ID in $DEVICE_IDS; do
  mosquitto_passwd -b "$PASSWD_FILE" "$DEV_ID" "$DEVICE_PASS"
done

chown -R mosquitto:mosquitto /mosquitto/data /mosquitto/log 2>/dev/null || true
chmod 0700 "$PASSWD_FILE" "$ACL_FILE"

exec /usr/sbin/mosquitto -c /mosquitto/config/mosquitto.conf
