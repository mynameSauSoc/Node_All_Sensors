package com.example.AIoTLibTQB.controller;

import com.example.AIoTLibTQB.document.AcousticMetrics;
import com.example.AIoTLibTQB.document.AirQualityMetrics;
import com.example.AIoTLibTQB.document.ComfortScoreRecord;
import com.example.AIoTLibTQB.document.EnvironmentMetrics;
import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.dto.response.TelemetryResponse;
import com.example.AIoTLibTQB.dto.response.TelemetrySummaryResponse;
import com.example.AIoTLibTQB.service.LatestTelemetryCache;
import com.example.AIoTLibTQB.service.LatestTelemetryCacheImpl;
import com.example.AIoTLibTQB.service.TelemetryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class TelemetryOverviewTest {

    @Mock
    TelemetryService telemetryService;

    TelemetryController controller;
    LatestTelemetryCacheImpl cache;

    @BeforeEach
    void setUp() {
        controller = new TelemetryController(telemetryService);
        cache = new LatestTelemetryCacheImpl();
        controller.setLatestTelemetryCache(cache);
    }

    @Test
    @DisplayName("GET /overview/summary on empty cache returns graceful empty summary without errors")
    void getOverviewSummary_emptyCache_returnsGracefulSummary() {
        ApiResponse<TelemetrySummaryResponse> response = controller.getOverviewSummary();

        assertThat(response).isNotNull();
        TelemetrySummaryResponse summary = response.getResult();
        assertThat(summary).isNotNull();
        assertThat(summary.getTotalRooms()).isEqualTo(0);
        assertThat(summary.getOptimalRoomsCount()).isEqualTo(0);
        assertThat(summary.getAverageComfortScore()).isEqualTo(0.0);
        assertThat(summary.getOverallGrade()).isEqualTo("N/A");
        assertThat(summary.getBestRoom()).isNull();
        assertThat(summary.getAttentionRoom()).isNull();

        // Verify strictly zero DB interactions (no N+1 queries)
        verifyNoInteractions(telemetryService);
    }

    @Test
    @DisplayName("GET /overview/summary computes bestRoom and attentionRoom accurately from in-memory cache without N+1 queries")
    void getOverviewSummary_multipleRooms_computesBestAndAttentionRoom() {
        // Room 1: High comfort (score 92.5, Platinum)
        TelemetryResponse room1 = TelemetryResponse.builder()
                .id("t-r1")
                .timestamp(Instant.parse("2026-10-22T14:00:00Z"))
                .environment(EnvironmentMetrics.builder().temperature(22.5).humidity(50.0).build())
                .acoustics(AcousticMetrics.builder().noiseAvg(38.0).build())
                .airQuality(AirQualityMetrics.builder().pm2_5(12.0).build())
                .comfortScore(ComfortScoreRecord.builder().overall(92.5).grade("Platinum").build())
                .build();

        // Room 2: Moderate comfort (score 78.0, Gold)
        TelemetryResponse room2 = TelemetryResponse.builder()
                .id("t-r2")
                .timestamp(Instant.parse("2026-10-22T14:00:00Z"))
                .environment(EnvironmentMetrics.builder().temperature(24.0).humidity(55.0).build())
                .acoustics(AcousticMetrics.builder().noiseAvg(48.0).build())
                .airQuality(AirQualityMetrics.builder().pm2_5(20.0).build())
                .comfortScore(ComfortScoreRecord.builder().overall(78.0).grade("Gold").build())
                .build();

        // Room 3: Poor comfort (score 52.0, Bronze, noisy)
        TelemetryResponse room3 = TelemetryResponse.builder()
                .id("t-r3")
                .timestamp(Instant.parse("2026-10-22T14:00:00Z"))
                .environment(EnvironmentMetrics.builder().temperature(28.0).humidity(70.0).build())
                .acoustics(AcousticMetrics.builder().noiseAvg(68.5).build())
                .airQuality(AirQualityMetrics.builder().pm2_5(35.0).build())
                .comfortScore(ComfortScoreRecord.builder().overall(52.0).grade("Bronze").build())
                .build();

        cache.putRoomTelemetry("room-101", room1);
        cache.putRoomTelemetry("room-102", room2);
        cache.putRoomTelemetry("room-103", room3);

        ApiResponse<TelemetrySummaryResponse> response = controller.getOverviewSummary();

        assertThat(response).isNotNull();
        TelemetrySummaryResponse summary = response.getResult();
        assertThat(summary).isNotNull();

        assertThat(summary.getTotalRooms()).isEqualTo(3);
        assertThat(summary.getOptimalRoomsCount()).isEqualTo(2); // room1 (92.5) and room2 (78.0) >= 75.0

        // Average: (92.5 + 78.0 + 52.0) / 3 = 222.5 / 3 = 74.17
        assertThat(summary.getAverageComfortScore()).isEqualTo(74.17);
        assertThat(summary.getOverallGrade()).isEqualTo("Silver"); // 74.17 is between 60.0 and 75.0

        // Best room is room-101
        assertThat(summary.getBestRoom()).isNotNull();
        assertThat(summary.getBestRoom().getRoomId()).isEqualTo("room-101");
        assertThat(summary.getBestRoom().getComfortScore()).isEqualTo(92.5);
        assertThat(summary.getBestRoom().getGrade()).isEqualTo("Platinum");

        // Attention room (worst room) is room-103
        assertThat(summary.getAttentionRoom()).isNotNull();
        assertThat(summary.getAttentionRoom().getRoomId()).isEqualTo("room-103");
        assertThat(summary.getAttentionRoom().getComfortScore()).isEqualTo(52.0);
        assertThat(summary.getAttentionRoom().getGrade()).isEqualTo("Bronze");
        assertThat(summary.getAttentionRoom().getBottleneckReason()).contains("Average noise level (68.5 dBA) exceeded threshold");
        assertThat(summary.getWorstRoom()).isNotNull();
        assertThat(summary.getWorstRoom().getRoomId()).isEqualTo("room-103");

        // Pure in-memory calculation: zero DB / repository calls
        verifyNoInteractions(telemetryService);
    }
}
