package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.dto.response.TelemetryResponse;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Conflation Throttling 1Hz service for WebSocket STOMP telemetry broadcast.
 * Reads latest room telemetry from LatestTelemetryCache every second and publishes
 * to /topic/rooms/{roomId}/telemetry, capping output to at most 1 message per second per room.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TelemetryConflationService {

    LatestTelemetryCache latestTelemetryCache;
    RealtimePublisher realtimePublisher;

    Map<String, String> lastPublishedSignature = new ConcurrentHashMap<>();

    @Scheduled(fixedRate = 1000)
    public void conflateAndPublish() {
        Map<String, TelemetryResponse> allLatest = latestTelemetryCache.getAllRoomLatest();
        if (allLatest == null || allLatest.isEmpty()) {
            return;
        }

        for (Map.Entry<String, TelemetryResponse> entry : allLatest.entrySet()) {
            String roomId = entry.getKey();
            TelemetryResponse telemetry = entry.getValue();
            if (roomId == null || telemetry == null) {
                continue;
            }

            String signature = (telemetry.getId() != null ? telemetry.getId() : "") + ":" +
                    (telemetry.getTimestamp() != null ? telemetry.getTimestamp().toString() : "");

            String lastSig = lastPublishedSignature.get(roomId);
            if (!signature.equals(lastSig)) {
                try {
                    realtimePublisher.publishRoomTelemetry(roomId, telemetry);
                    lastPublishedSignature.put(roomId, signature);
                    log.debug("Conflated telemetry published for roomId={}", roomId);
                } catch (Exception e) {
                    log.warn("Failed to publish conflated telemetry for roomId {}: {}", roomId, e.getMessage());
                }
            }
        }
    }

    public void clearSignatures() {
        lastPublishedSignature.clear();
    }
}
