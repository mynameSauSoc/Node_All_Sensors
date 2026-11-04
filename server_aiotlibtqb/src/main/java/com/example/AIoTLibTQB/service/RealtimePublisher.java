package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.dto.response.AlertResponse;

public interface RealtimePublisher {
    void publishRoomTelemetry(String roomId, Object payload);
    void publishAlert(AlertResponse alert);
}
