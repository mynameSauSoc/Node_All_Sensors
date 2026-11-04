package com.example.AIoTLibTQB.controller;

import com.example.AIoTLibTQB.document.Room;
import com.example.AIoTLibTQB.dto.response.ApiResponse;
import com.example.AIoTLibTQB.dto.response.TelemetryBucketResponse;
import com.example.AIoTLibTQB.dto.response.TelemetryResponse;
import com.example.AIoTLibTQB.dto.response.TelemetrySummaryResponse;
import com.example.AIoTLibTQB.repository.RoomRepository;
import com.example.AIoTLibTQB.service.LatestTelemetryCache;
import com.example.AIoTLibTQB.service.TelemetryService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/telemetry")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@PreAuthorize("hasAnyAuthority('ADMIN', 'LIBRARIAN', 'ZONE_MANAGER', 'MAINTENANCE', 'USER', 'VIEWER')")
public class TelemetryController {

    TelemetryService telemetryService;

    @Autowired(required = false)
    @lombok.experimental.NonFinal
    LatestTelemetryCache latestTelemetryCache;

    @Autowired(required = false)
    @lombok.experimental.NonFinal
    RoomRepository roomRepository;

    public void setLatestTelemetryCache(LatestTelemetryCache latestTelemetryCache) {
        this.latestTelemetryCache = latestTelemetryCache;
    }

    public void setRoomRepository(RoomRepository roomRepository) {
        this.roomRepository = roomRepository;
    }

    @GetMapping(value = {"/device/{deviceId}/latest", "/devices/{deviceId}/latest"})
    public ApiResponse<TelemetryResponse> getLatestByDeviceId(@PathVariable String deviceId) {
        return ApiResponse.<TelemetryResponse>builder()
                .result(telemetryService.getLatestByDeviceId(deviceId))
                .build();
    }

    @GetMapping(value = {"/room/{roomId}/latest", "/rooms/{roomId}/latest"})
    public ApiResponse<TelemetryResponse> getLatestByRoomId(@PathVariable String roomId) {
        return ApiResponse.<TelemetryResponse>builder()
                .result(telemetryService.getLatestByRoomId(roomId))
                .build();
    }

    @GetMapping(value = {"/device/{deviceId}", "/devices/{deviceId}"})
    public ApiResponse<List<TelemetryResponse>> getHistoryByDeviceId(
            @PathVariable String deviceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant end) {
        return ApiResponse.<List<TelemetryResponse>>builder()
                .result(telemetryService.getHistoryByDeviceId(deviceId, start, end))
                .build();
    }

    @GetMapping(value = {"/room/{roomId}", "/rooms/{roomId}"})
    public ApiResponse<List<TelemetryResponse>> getHistoryByRoomId(
            @PathVariable String roomId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant end) {
        return ApiResponse.<List<TelemetryResponse>>builder()
                .result(telemetryService.getHistoryByRoomId(roomId, start, end))
                .build();
    }

    @GetMapping(value = {"/room/{roomId}/buckets", "/rooms/{roomId}/buckets"})
    public ApiResponse<TelemetryBucketResponse> getBucketsByRoomId(
            @PathVariable String roomId,
            @RequestParam(defaultValue = "1h") String interval,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant end) {
        return ApiResponse.<TelemetryBucketResponse>builder()
                .result(telemetryService.getBucketsByRoomId(roomId, interval, start, end))
                .build();
    }

    @GetMapping(value = {"/overview", "/overview/summary"})
    public ApiResponse<TelemetrySummaryResponse> getOverviewSummary() {
        Map<String, TelemetryResponse> allLatest = (latestTelemetryCache != null)
                ? latestTelemetryCache.getAllRoomLatest()
                : Collections.emptyMap();

        if (allLatest == null || allLatest.isEmpty()) {
            return ApiResponse.<TelemetrySummaryResponse>builder()
                    .result(TelemetrySummaryResponse.builder()
                            .totalRooms(0)
                            .optimalRoomsCount(0)
                            .averageComfortScore(0.0)
                            .overallGrade("N/A")
                            .bestRoom(null)
                            .attentionRoom(null)
                            .worstRoom(null)
                            .build())
                    .build();
        }

        int totalRooms = allLatest.size();
        int optimalCount = 0;
        double sumScore = 0.0;
        int scoreCount = 0;

        Map.Entry<String, TelemetryResponse> bestEntry = null;
        Map.Entry<String, TelemetryResponse> worstEntry = null;
        double maxScore = -1.0;
        double minScore = Double.MAX_VALUE;

        for (Map.Entry<String, TelemetryResponse> entry : allLatest.entrySet()) {
            TelemetryResponse t = entry.getValue();
            Double score = (t != null && t.getComfortScore() != null) ? t.getComfortScore().getOverall() : null;

            if (score != null) {
                sumScore += score;
                scoreCount++;
                if (score >= 75.0) {
                    optimalCount++;
                }
                if (score > maxScore) {
                    maxScore = score;
                    bestEntry = entry;
                }
                if (score < minScore) {
                    minScore = score;
                    worstEntry = entry;
                }
            }
        }

        Double avgScore = (scoreCount > 0)
                ? BigDecimal.valueOf(sumScore / scoreCount).setScale(2, RoundingMode.HALF_UP).doubleValue()
                : 0.0;

        String overallGrade = determineOverallGrade(avgScore);

        TelemetrySummaryResponse.RoomSummaryInfo bestRoomInfo = (bestEntry != null)
                ? toRoomSummaryInfo(bestEntry.getKey(), bestEntry.getValue())
                : null;
        TelemetrySummaryResponse.RoomSummaryInfo worstRoomInfo = (worstEntry != null)
                ? toRoomSummaryInfo(worstEntry.getKey(), worstEntry.getValue())
                : null;

        return ApiResponse.<TelemetrySummaryResponse>builder()
                .result(TelemetrySummaryResponse.builder()
                        .totalRooms(totalRooms)
                        .optimalRoomsCount(optimalCount)
                        .averageComfortScore(avgScore)
                        .overallGrade(overallGrade)
                        .bestRoom(bestRoomInfo)
                        .attentionRoom(worstRoomInfo)
                        .worstRoom(worstRoomInfo)
                        .build())
                .build();
    }

    private String determineOverallGrade(Double score) {
        if (score == null) return "Poor";
        if (score >= 90.0) return "Platinum";
        if (score >= 75.0) return "Gold";
        if (score >= 60.0) return "Silver";
        if (score >= 45.0) return "Bronze";
        return "Poor";
    }

    private TelemetrySummaryResponse.RoomSummaryInfo toRoomSummaryInfo(String roomId, TelemetryResponse t) {
        String resolvedRoomName = (roomRepository != null && roomId != null)
                ? roomRepository.findById(roomId).map(Room::getName).orElse(roomId)
                : roomId;

        if (t == null) {
            return TelemetrySummaryResponse.RoomSummaryInfo.builder()
                    .roomId(roomId)
                    .roomName(resolvedRoomName)
                    .build();
        }

        Double score = (t.getComfortScore() != null) ? t.getComfortScore().getOverall() : null;
        String grade = (t.getComfortScore() != null) ? t.getComfortScore().getGrade() : null;
        Double temp = (t.getEnvironment() != null) ? t.getEnvironment().getTemperature() : null;
        Double hum = (t.getEnvironment() != null) ? t.getEnvironment().getHumidity() : null;
        Double noise = (t.getAcoustics() != null) ? t.getAcoustics().getNoiseAvg() : null;
        Double pm25 = (t.getAirQuality() != null) ? t.getAirQuality().getPm2_5() : null;

        String bottleneckReason = null;
        if (score != null && score < 75.0) {
            if (noise != null && noise > 65.0) {
                bottleneckReason = String.format("Average noise level (%.1f dBA) exceeded threshold (65.0 dBA)", noise);
            } else if (pm25 != null && pm25 > 50.0) {
                bottleneckReason = String.format("PM2.5 fine dust (%.1f µg/m³) exceeded threshold (50.0 µg/m³)", pm25);
            } else if (temp != null && (temp < 20.0 || temp > 26.0)) {
                bottleneckReason = String.format("Temperature (%.1f °C) out of optimal range (20-26 °C)", temp);
            } else {
                bottleneckReason = "Sub-optimal comfort index";
            }
        }

        return TelemetrySummaryResponse.RoomSummaryInfo.builder()
                .roomId(roomId)
                .roomName(resolvedRoomName)
                .comfortScore(score)
                .grade(grade)
                .temperature(temp)
                .humidity(hum)
                .noiseAvg(noise)
                .pm25(pm25)
                .bottleneckReason(bottleneckReason)
                .build();
    }
}
