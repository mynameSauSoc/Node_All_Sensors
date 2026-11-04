package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.dto.response.TelemetryResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class LatestTelemetryCacheImpl implements LatestTelemetryCache {

    private final Map<String, TelemetryResponse> cache = new ConcurrentHashMap<>();

    @Override
    public void putRoomTelemetry(String roomId, TelemetryResponse telemetry) {
        if (roomId == null || roomId.isBlank() || telemetry == null) {
            return;
        }
        cache.put(roomId, telemetry);
        log.trace("Updated latest telemetry for roomId={}", roomId);
    }

    @Override
    public Optional<TelemetryResponse> getRoomTelemetry(String roomId) {
        if (roomId == null || roomId.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(cache.get(roomId));
    }

    @Override
    public Map<String, TelemetryResponse> getAllRoomLatest() {
        return Collections.unmodifiableMap(new ConcurrentHashMap<>(cache));
    }

    @Override
    public void removeRoomTelemetry(String roomId) {
        if (roomId != null) {
            cache.remove(roomId);
            log.trace("Removed latest telemetry for roomId={}", roomId);
        }
    }

    public void clear() {
        cache.clear();
    }
}
