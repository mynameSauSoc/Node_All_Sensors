package com.example.AIoTLibTQB.controller;

import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.dto.response.BucketDataPoint;
import com.example.AIoTLibTQB.dto.response.TelemetryBucketResponse;
import com.example.AIoTLibTQB.service.TelemetryService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TelemetryControllerTest {

    @Mock
    private TelemetryService telemetryService;

    @InjectMocks
    private TelemetryController telemetryController;

    @Test
    @DisplayName("GET /api/v1/telemetry/room/{roomId}/buckets - Ủy quyền chính xác sang TelemetryService.getBucketsByRoomId")
    void getBucketsByRoomId_delegatesToService() {
        String roomId = "room-101";
        String interval = "1h";
        Instant start = Instant.parse("2026-10-21T00:00:00Z");
        Instant end = Instant.parse("2026-10-22T00:00:00Z");

        TelemetryBucketResponse mockResponse = TelemetryBucketResponse.builder()
                .roomId(roomId)
                .interval(interval)
                .dataPoints(List.of(
                        BucketDataPoint.builder()
                                .bucketTime(Instant.parse("2026-10-21T08:00:00Z"))
                                .tempAvg(24.2)
                                .noiseAvg(38.4)
                                .build()
                ))
                .build();

        when(telemetryService.getBucketsByRoomId(roomId, interval, start, end))
                .thenReturn(mockResponse);

        ApiResponse<TelemetryBucketResponse> response = telemetryController.getBucketsByRoomId(roomId, interval, start, end);

        assertThat(response).isNotNull();
        assertThat(response.getResult()).isNotNull();
        assertThat(response.getResult().getRoomId()).isEqualTo("room-101");
        assertThat(response.getResult().getInterval()).isEqualTo("1h");
        assertThat(response.getResult().getDataPoints()).hasSize(1);
        verify(telemetryService, times(1)).getBucketsByRoomId(roomId, interval, start, end);
    }

    @Test
    @DisplayName("GET /api/v1/telemetry/overview/summary - Trả về kết quả summary khi cache rỗng")
    void getOverviewSummary_returnsEmptySummary() {
        ApiResponse<com.example.AIoTLibTQB.dto.response.TelemetrySummaryResponse> response = telemetryController.getOverviewSummary();
        assertThat(response).isNotNull();
        assertThat(response.getResult()).isNotNull();
        assertThat(response.getResult().getTotalRooms()).isEqualTo(0);
    }
}
