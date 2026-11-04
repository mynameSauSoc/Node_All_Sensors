package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.dto.mqtt.TelemetryPayload;
import com.example.AIoTLibTQB.dto.response.AlertResponse;
import com.example.AIoTLibTQB.dto.response.PageResponse;
import com.example.AIoTLibTQB.enums.AlertStatus;
import com.example.AIoTLibTQB.enums.AlertType;
import org.springframework.data.domain.Pageable;

public interface AlertService {

    PageResponse<AlertResponse> getAlerts(String roomId, AlertType type, AlertStatus status, Pageable pageable);

    long getUnreadCount();

    AlertResponse acknowledgeAlert(String id, String username);

    AlertResponse resolveAlert(String id, String username);

    void evaluateTelemetry(String deviceId, String hardwareId, String roomId, TelemetryPayload.TelemetryData data);

    void triggerDeviceOfflineAlert(String deviceId, String hardwareId, String roomId);

    void resolveDeviceOfflineAlert(String hardwareId);
}
