package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.dto.response.TelemetryResponse;

import java.util.Map;
import java.util.Optional;

/**
 * In-memory cache holding the latest TelemetryResponse per roomId.
 * Provides the shared data source for 1Hz Conflation Throttling and Overview Summary calculations without N+1 queries.
 */
public interface LatestTelemetryCache {

    void putRoomTelemetry(String roomId, TelemetryResponse telemetry);

    Optional<TelemetryResponse> getRoomTelemetry(String roomId);

    Map<String, TelemetryResponse> getAllRoomLatest();

    void removeRoomTelemetry(String roomId);
}
