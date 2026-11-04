package com.example.AIoTLibTQB.service;

import com.example.AIoTLibTQB.document.AcousticMetrics;
import com.example.AIoTLibTQB.document.AirQualityMetrics;
import com.example.AIoTLibTQB.document.ComfortScoreRecord;
import com.example.AIoTLibTQB.document.EnvironmentMetrics;
import com.example.AIoTLibTQB.dto.response.TelemetryResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LatestTelemetryCacheTest {

    LatestTelemetryCacheImpl cache;

    @Mock
    RealtimePublisher realtimePublisher;

    TelemetryConflationService conflationService;

    @BeforeEach
    void setUp() {
        cache = new LatestTelemetryCacheImpl();
        conflationService = new TelemetryConflationService(cache, realtimePublisher);
    }

    @Test
    @DisplayName("putRoomTelemetry & getRoomTelemetry store and retrieve the latest telemetry per room")
    void putAndGetRoomTelemetry() {
        TelemetryResponse telemetry = TelemetryResponse.builder()
                .id("t-1")
                .timestamp(Instant.parse("2026-10-22T10:00:00Z"))
                .acoustics(AcousticMetrics.builder().noiseAvg(45.0).build())
                .comfortScore(ComfortScoreRecord.builder().overall(88.5).grade("Gold").build())
                .build();

        cache.putRoomTelemetry("room-101", telemetry);

        Optional<TelemetryResponse> result = cache.getRoomTelemetry("room-101");
        assertThat(result).isPresent();
        assertThat(result.get().getId()).isEqualTo("t-1");
        assertThat(result.get().getComfortScore().getOverall()).isEqualTo(88.5);

        // Non-existent room returns empty
        assertThat(cache.getRoomTelemetry("room-non-existent")).isEmpty();
    }

    @Test
    @DisplayName("getAllRoomLatest returns unmodifiable snapshot of all rooms")
    void getAllRoomLatest() {
        TelemetryResponse t1 = TelemetryResponse.builder().id("t-1").build();
        TelemetryResponse t2 = TelemetryResponse.builder().id("t-2").build();

        cache.putRoomTelemetry("room-1", t1);
        cache.putRoomTelemetry("room-2", t2);

        Map<String, TelemetryResponse> all = cache.getAllRoomLatest();
        assertThat(all).hasSize(2);
        assertThat(all).containsKeys("room-1", "room-2");
    }

    @Test
    @DisplayName("Conflation Throttling: single update is published once to RealtimePublisher")
    void conflateAndPublish_singleUpdate() {
        TelemetryResponse t1 = TelemetryResponse.builder()
                .id("t-101")
                .timestamp(Instant.parse("2026-10-22T12:00:00Z"))
                .comfortScore(ComfortScoreRecord.builder().overall(82.0).build())
                .build();

        cache.putRoomTelemetry("room-A", t1);
        conflationService.conflateAndPublish();

        verify(realtimePublisher, times(1)).publishRoomTelemetry(eq("room-A"), eq(t1));
    }

    @Test
    @DisplayName("Conflation Throttling: multiple rapid updates within 1s window collapse into single latest broadcast")
    void conflateAndPublish_rapidUpdates_collapsesToLatest() {
        TelemetryResponse update1 = TelemetryResponse.builder()
                .id("t-1")
                .timestamp(Instant.parse("2026-10-22T12:00:00.100Z"))
                .acoustics(AcousticMetrics.builder().noiseAvg(50.0).build())
                .build();
        TelemetryResponse update2 = TelemetryResponse.builder()
                .id("t-2")
                .timestamp(Instant.parse("2026-10-22T12:00:00.500Z"))
                .acoustics(AcousticMetrics.builder().noiseAvg(55.0).build())
                .build();
        TelemetryResponse update3 = TelemetryResponse.builder()
                .id("t-3")
                .timestamp(Instant.parse("2026-10-22T12:00:00.900Z"))
                .acoustics(AcousticMetrics.builder().noiseAvg(60.0).build())
                .build();

        // 3 rapid MQTT updates arrived within the same 1-second interval
        cache.putRoomTelemetry("room-A", update1);
        cache.putRoomTelemetry("room-A", update2);
        cache.putRoomTelemetry("room-A", update3);

        // 1Hz tick executes
        conflationService.conflateAndPublish();

        // RealtimePublisher is called exactly once, with the latest state (update3)
        verify(realtimePublisher, times(1)).publishRoomTelemetry(eq("room-A"), eq(update3));
        verify(realtimePublisher, never()).publishRoomTelemetry(eq("room-A"), eq(update1));
        verify(realtimePublisher, never()).publishRoomTelemetry(eq("room-A"), eq(update2));
    }

    @Test
    @DisplayName("Conflation Throttling: subsequent tick with no new telemetry does NOT re-publish duplicate")
    void conflateAndPublish_noNewData_skipsPublish() {
        TelemetryResponse t1 = TelemetryResponse.builder()
                .id("t-steady")
                .timestamp(Instant.parse("2026-10-22T12:00:00Z"))
                .build();

        cache.putRoomTelemetry("room-B", t1);

        // First tick: published
        conflationService.conflateAndPublish();
        verify(realtimePublisher, times(1)).publishRoomTelemetry(eq("room-B"), any());

        // Second tick without new telemetry: skipped
        conflationService.conflateAndPublish();
        verify(realtimePublisher, times(1)).publishRoomTelemetry(eq("room-B"), any());
    }
}
